'use strict';

// ── Brand-kit color extraction (Day 31) ───────────────────────────────────────
// Pull avatar + thumbnails from YouTube CDN, sample pixels via sharp, run
// k-means in LAB color space, merge clusters within ΔE ≈ 5, return 5–8 hex
// colors. Avatar runs k=1 separately to surface a single primary accent.
//
// Why LAB: k-means in raw sRGB clusters by channel magnitude rather than
// perceptual distance. Two reds with different brightness end up in different
// clusters, and dark-blue + dark-red can collapse into one. LAB gets us
// "looks similar" instead of "is mathematically close".

const fetch = require('node-fetch');
const sharp = require('sharp');

const SAMPLE_SIZE      = 64;   // downscale to 64×64 before sampling (fast + still representative)
const MAX_ITERATIONS   = 12;
const PALETTE_K        = 8;
const MERGE_DELTA_E    = 5;    // CIE76 ΔE — clusters closer than this collapse
const MIN_CLUSTER_SIZE = 0.02; // drop clusters that own <2% of pixels (specular/edge noise)
const FETCH_TIMEOUT_MS = 8000;

// ── sRGB ↔ LAB ──────────────────────────────────────────────────────────────
// D65 reference white. Standard sRGB → linear → XYZ → LAB pipeline.

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function rgbToLab(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  // sRGB → XYZ (D65)
  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
  const z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;

  // XYZ → LAB (D65 ref white, normalized)
  const xn = x / 0.95047;
  const yn = y / 1.0;
  const zn = z / 1.08883;

  const f = (t) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;

  const fx = f(xn);
  const fy = f(yn);
  const fz = f(zn);

  return [
    116 * fy - 16,
    500 * (fx - fy),
    200 * (fy - fz),
  ];
}

function deltaE(a, b) {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

// ── k-means ───────────────────────────────────────────────────────────────────

function kMeansLab(samples, k) {
  if (samples.length === 0) return [];
  if (samples.length <= k) {
    return samples.map((s) => ({ centroid: s, members: [s] }));
  }

  // k-means++ init: first centroid random, subsequent ones weighted by
  // squared distance to nearest existing centroid. Reduces "all centroids
  // landed in the same cluster" runs that plague vanilla random init.
  const centroids = [samples[Math.floor(Math.random() * samples.length)]];
  while (centroids.length < k) {
    const dists = samples.map((s) => {
      let min = Infinity;
      for (const c of centroids) {
        const d = deltaE(s, c);
        if (d < min) min = d;
      }
      return min * min;
    });
    const sum = dists.reduce((acc, d) => acc + d, 0);
    if (sum === 0) break;
    let pick = Math.random() * sum;
    for (let i = 0; i < dists.length; i++) {
      pick -= dists[i];
      if (pick <= 0) {
        centroids.push(samples[i]);
        break;
      }
    }
  }

  let assignments = new Array(samples.length).fill(0);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let moved = false;

    // Assign step
    for (let i = 0; i < samples.length; i++) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = deltaE(samples[i], centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = c;
        }
      }
      if (assignments[i] !== bestIdx) {
        moved = true;
        assignments[i] = bestIdx;
      }
    }

    if (!moved && iter > 0) break;

    // Update step
    for (let c = 0; c < centroids.length; c++) {
      let sumL = 0, sumA = 0, sumB = 0, count = 0;
      for (let i = 0; i < samples.length; i++) {
        if (assignments[i] !== c) continue;
        sumL += samples[i][0];
        sumA += samples[i][1];
        sumB += samples[i][2];
        count += 1;
      }
      if (count > 0) {
        centroids[c] = [sumL / count, sumA / count, sumB / count];
      }
    }
  }

  // Materialize clusters
  const clusters = centroids.map((c) => ({ centroid: c, members: [] }));
  for (let i = 0; i < samples.length; i++) {
    clusters[assignments[i]].members.push(samples[i]);
  }
  return clusters.filter((cl) => cl.members.length > 0);
}

// ── Cluster post-processing ───────────────────────────────────────────────────

function mergeSimilarClusters(clusters, delta) {
  // Greedy merge: walk biggest-first, fold any subsequent cluster whose
  // centroid is within `delta` ΔE into the larger one.
  const sorted = clusters.slice().sort((a, b) => b.members.length - a.members.length);
  const out = [];
  for (const cl of sorted) {
    let merged = false;
    for (const kept of out) {
      if (deltaE(cl.centroid, kept.centroid) < delta) {
        kept.members = kept.members.concat(cl.members);
        // Recompute centroid with the new members (weighted average)
        let sL = 0, sA = 0, sB = 0;
        for (const m of kept.members) { sL += m[0]; sA += m[1]; sB += m[2]; }
        const n = kept.members.length;
        kept.centroid = [sL / n, sA / n, sB / n];
        merged = true;
        break;
      }
    }
    if (!merged) out.push(cl);
  }
  return out;
}

function labToHex(lab) {
  // LAB → XYZ
  const fy = (lab[0] + 16) / 116;
  const fx = lab[1] / 500 + fy;
  const fz = fy - lab[2] / 200;

  const inv = (f) => (f * f * f > 0.008856 ? f * f * f : (f - 16 / 116) / 7.787);

  const xn = inv(fx) * 0.95047;
  const yn = inv(fy) * 1.0;
  const zn = inv(fz) * 1.08883;

  // XYZ → linear sRGB
  let lr =  3.2404542 * xn - 1.5371385 * yn - 0.4985314 * zn;
  let lg = -0.9692660 * xn + 1.8760108 * yn + 0.0415560 * zn;
  let lb =  0.0556434 * xn - 0.2040259 * yn + 1.0572252 * zn;

  const linearToSrgb = (c) => {
    if (c <= 0) return 0;
    if (c >= 1) return 255;
    return Math.round(
      255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055),
    );
  };

  const r = linearToSrgb(lr);
  const g = linearToSrgb(lg);
  const b = linearToSrgb(lb);
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// ── Image fetching + sampling ─────────────────────────────────────────────────

async function fetchImageBuffer(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    return await res.buffer();
  } finally {
    clearTimeout(timer);
  }
}

async function sampleLabFromBuffer(buf) {
  // Downscale to SAMPLE_SIZE × SAMPLE_SIZE, force RGB, raw bytes.
  const { data, info } = await sharp(buf)
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = [];
  const stride = info.channels;
  for (let i = 0; i < data.length; i += stride) {
    out.push(rgbToLab(data[i], data[i + 1], data[i + 2]));
  }
  return out;
}

async function sampleManyToLab(urls) {
  const buffers = await Promise.all(
    urls.map((u) =>
      fetchImageBuffer(u).catch((err) => {
        console.warn('[BRAND-KIT] image fetch failed:', u, err.message);
        return null;
      }),
    ),
  );
  const samples = [];
  for (const buf of buffers) {
    if (!buf) continue;
    try {
      const labs = await sampleLabFromBuffer(buf);
      for (const lab of labs) samples.push(lab);
    } catch (err) {
      console.warn('[BRAND-KIT] sharp decode failed:', err.message);
    }
  }
  return samples;
}

// ── Public API ────────────────────────────────────────────────────────────────
//
// extractColors({ avatarUrl, thumbnails: string[] })
//   → { palette: hex[], primaryAccent: hex|null }
async function extractColors({ avatarUrl, thumbnails = [] }) {
  // Primary accent: avatar k=1 (the dominant color of the avatar). If no
  // avatar, fall back to the dominant cluster of the thumbnail strip.
  let primaryAccent = null;
  if (avatarUrl) {
    try {
      const buf = await fetchImageBuffer(avatarUrl);
      const samples = await sampleLabFromBuffer(buf);
      if (samples.length) {
        const [{ centroid }] = kMeansLab(samples, 1);
        primaryAccent = labToHex(centroid);
      }
    } catch (err) {
      console.warn('[BRAND-KIT] avatar extraction failed:', err.message);
    }
  }

  // Brand palette: concatenated thumbnail samples → k-means k=8 → merge.
  const palette = [];
  if (thumbnails.length > 0) {
    const samples = await sampleManyToLab(thumbnails);
    if (samples.length > 0) {
      const clusters = kMeansLab(samples, PALETTE_K);
      const merged   = mergeSimilarClusters(clusters, MERGE_DELTA_E);

      // Drop noise clusters (< 2% share)
      const total = samples.length;
      const significant = merged
        .filter((cl) => cl.members.length / total >= MIN_CLUSTER_SIZE)
        .sort((a, b) => b.members.length - a.members.length)
        .slice(0, PALETTE_K);

      for (const cl of significant) palette.push(labToHex(cl.centroid));
    }
  }

  // If the avatar didn't yield an accent, take the top palette color.
  if (!primaryAccent && palette.length > 0) {
    primaryAccent = palette[0];
  }

  return { palette, primaryAccent };
}

module.exports = {
  extractColors,
  // Test-only exports
  _rgbToLab: rgbToLab,
  _labToHex: labToHex,
  _kMeansLab: kMeansLab,
  _deltaE: deltaE,
  _parseChannelInput: undefined, // re-exported by routes/brandKit.js
};
