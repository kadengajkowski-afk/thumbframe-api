'use strict';

// ── Brand-kit font detection (Day 33) ─────────────────────────────────────────
// Send up to 5 channel thumbnails to Claude Sonnet 4.6 vision, ask it to
// identify the most prominent font(s), filter to our 25-OFL bundled set,
// return [{ name, confidence }].
//
// Failure mode is "return []" — never throw upward. The Brand Kit response
// degrades gracefully when fonts are missing.

const Anthropic = require('@anthropic-ai/sdk');
const fetch     = require('node-fetch');

const VISION_MODEL  = 'claude-sonnet-4-6-20250929';
const MAX_THUMBS    = 5;
const FETCH_TIMEOUT = 8000;
const CONFIDENCE_FLOOR = 0.6;

// Mirror the 25-OFL set bundled in src/editor-v3/state/types.ts. Keep
// in sync — the frontend filters again, but having the canonical list
// here means we don't waste Claude tokens on out-of-set guesses.
const BUNDLED_FONTS = [
  // Sans
  'Inter', 'Roboto', 'Montserrat', 'Poppins', 'Lato', 'Open Sans',
  'Raleway', 'Source Sans 3', 'Nunito', 'Work Sans', 'Rubik',
  // Serif
  'DM Serif Display', 'Playfair Display', 'Merriweather', 'Lora',
  // Display (the YouTube-thumbnail bread-and-butter live here)
  'Anton', 'Bebas Neue', 'Archivo Black', 'Oswald', 'Bangers',
  'Russo One', 'Squada One', 'Black Ops One',
  // Handwritten
  'Permanent Marker',
  // Pixel / retro
  'Press Start 2P',
];

const BUNDLED_SET = new Set(BUNDLED_FONTS.map((f) => f.toLowerCase()));

async function fetchAsBase64(url) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const buf      = await res.buffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return { data: buf.toString('base64'), mediaType: contentType.split(';')[0].trim() };
  } finally {
    clearTimeout(timer);
  }
}

function tryParseFontJson(raw) {
  if (!raw) return null;
  // Strip markdown code fences (Sonnet sometimes wraps despite the
  // "JSON only" instruction).
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Last-ditch: extract the first {...} block.
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return null;
  }
}

/** Filter Claude's font predictions:
 *   - confidence >= CONFIDENCE_FLOOR
 *   - name matches one of the bundled OFL families (case-insensitive)
 *   - dedupe (same canonical name from multiple casings collapses)
 *   - cap at 3 entries
 *
 * Returns [{ name: BundledFontName, confidence: number }]. */
function filterFonts(rawFonts) {
  if (!Array.isArray(rawFonts)) return [];
  const seen = new Set();
  const out  = [];
  const canonByLower = new Map(BUNDLED_FONTS.map((f) => [f.toLowerCase(), f]));

  for (const item of rawFonts) {
    if (!item || typeof item !== 'object') continue;
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const conf = typeof item.confidence === 'number' ? item.confidence : NaN;
    if (!name || !Number.isFinite(conf)) continue;
    if (conf < CONFIDENCE_FLOOR) continue;
    const lower = name.toLowerCase();
    if (!BUNDLED_SET.has(lower)) continue;
    const canonical = canonByLower.get(lower);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    out.push({ name: canonical, confidence: Math.min(1, Math.max(0, conf)) });
    if (out.length >= 3) break;
  }
  return out;
}

const PROMPT = `You are a typography expert analyzing YouTube thumbnails. Identify the most prominent fonts visible in these thumbnails.

Match against this list of common YouTube thumbnail fonts (only return names from this list):
${BUNDLED_FONTS.join(', ')}

Rules:
- Only identify text that is large/prominent (titles, hooks, CTAs) — ignore tiny captions or watermarks.
- Confidence must reflect how sure you are. Use 0.9+ only when you can see distinctive letterforms (Anton's narrow forms, Bebas Neue's tall thin look, Bangers' irregular comic-style strokes, Press Start 2P's pixel grid, etc.).
- If you can't confidently identify any font from the list, return an empty array. Do NOT guess.
- Return up to 3 fonts max.

Respond with ONLY valid JSON, no other text:
{"fonts": [{"name": "Anton", "confidence": 0.85}, ...]}`;

/** detectFonts({ anthropic, thumbnailUrls })
 *   → [{ name: BundledFontName, confidence: number }] */
async function detectFonts({ anthropic, thumbnailUrls }) {
  if (!anthropic) return [];
  if (!Array.isArray(thumbnailUrls) || thumbnailUrls.length === 0) return [];

  const urls = thumbnailUrls.slice(0, MAX_THUMBS);
  const images = await Promise.all(
    urls.map((url) =>
      fetchAsBase64(url).catch((err) => {
        console.warn('[BRAND-KIT/fonts] image fetch failed:', url, err.message);
        return null;
      }),
    ),
  );
  const validImages = images.filter((i) => i !== null);
  if (validImages.length === 0) return [];

  const content = [
    ...validImages.map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.data },
    })),
    { type: 'text', text: PROMPT },
  ];

  try {
    const response = await anthropic.messages.create({
      model: VISION_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content }],
    });
    const raw = response.content?.[0]?.text?.trim() || '';
    const parsed = tryParseFontJson(raw);
    if (!parsed) {
      console.warn('[BRAND-KIT/fonts] vision returned non-JSON:', raw.slice(0, 200));
      return [];
    }
    return filterFonts(parsed.fonts);
  } catch (err) {
    console.warn('[BRAND-KIT/fonts] vision call failed:', err.message);
    return [];
  }
}

module.exports = {
  detectFonts,
  // Test-only exports
  _filterFonts: filterFonts,
  _tryParseFontJson: tryParseFontJson,
  _BUNDLED_FONTS: BUNDLED_FONTS,
};
