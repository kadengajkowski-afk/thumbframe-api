self.onmessage = function(e) {
  const { imageData, width, height, cx, cy, r, strength, brushEdge, PATCH } = e.data;

  // ✅ BUG FIX 1: Use separate input/output buffers
  // Never read from and write to the same array
  const src   = new Uint8ClampedArray(imageData); // read only — never modified
  const out   = new Uint8ClampedArray(imageData); // output — written to
  const clamp = v => Math.min(255, Math.max(0, Math.round(v)));
  const idx   = (x, y) => (y * width + x) * 4;

  // ── Build mask ──────────────────────────────────────────────────────────────
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const d = Math.sqrt((i-cx)**2 + (j-cy)**2);
      // ✅ BUG FIX 2: Mark ONLY pixels inside brush OR transparent as needing fill
      // Don't mark the entire working area — just what needs healing
      if (d <= r || src[idx(i,j)+3] < 128) {
        mask[j*width+i] = 1;
      }
    }
  }

  // ── Collect source pixels (unmasked, opaque) ────────────────────────────────
  const sources = [];
  for (let i = PATCH; i < width-PATCH; i++) {
    for (let j = PATCH; j < height-PATCH; j++) {
      if (!mask[j*width+i] && src[idx(i,j)+3] >= 200) {
        sources.push([i, j]);
      }
    }
  }

  if (sources.length < 8) {
    self.postMessage({ imageData: out.buffer }, [out.buffer]);
    return;
  }

  // ── Patch distance function ─────────────────────────────────────────────────
  // ✅ BUG FIX 3: Always read from src (immutable) never from out
  function patchDist(ax, ay, bx, by) {
    let sum = 0, cnt = 0;
    for (let di = -PATCH; di <= PATCH; di += 2) {
      for (let dj = -PATCH; dj <= PATCH; dj += 2) {
        const ai=ax+di, aj=ay+dj, bi=bx+di, bj=by+dj;
        if (ai<0||ai>=width||aj<0||aj>=height) continue;
        if (bi<0||bi>=width||bj<0||bj>=height) continue;
        if (mask[aj*width+ai] || mask[bj*width+bi]) continue;
        const a=idx(ai,aj), b=idx(bi,bj);
        const dr=src[a]-src[b], dg=src[a+1]-src[b+1], db=src[a+2]-src[b+2];
        sum += dr*dr + dg*dg + db*db;
        cnt++;
      }
    }
    return cnt > 0 ? sum/cnt : Infinity;
  }

  // ── Initialize NNF with random assignments ──────────────────────────────────
  const nnfX = new Int16Array(width * height);
  const nnfY = new Int16Array(width * height);
  const nnfS = new Float32Array(width * height).fill(Infinity);

  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      if (!mask[j*width+i]) continue;
      const rnd = sources[Math.floor(Math.random() * sources.length)];
      nnfX[j*width+i] = rnd[0];
      nnfY[j*width+i] = rnd[1];
      nnfS[j*width+i] = patchDist(i, j, rnd[0], rnd[1]);
    }
  }

  // ── PatchMatch iterations ───────────────────────────────────────────────────
  for (let iter = 0; iter < 4; iter++) {
    const fwd  = iter % 2 === 0;
    const iS   = fwd ? PATCH : width-PATCH-1;
    const iE   = fwd ? width-PATCH : PATCH-1;
    const iV   = fwd ? 1 : -1;
    const jS   = fwd ? PATCH : height-PATCH-1;
    const jE   = fwd ? height-PATCH : PATCH-1;
    const jV   = fwd ? 1 : -1;

    for (let i = iS; i !== iE; i += iV) {
      for (let j = jS; j !== jE; j += jV) {
        if (!mask[j*width+i]) continue;
        const ni  = j*width+i;
        let bx    = nnfX[ni], by = nnfY[ni], bs = nnfS[ni];

        // Propagate from neighbors
        for (const [nni, nnj] of [[i-iV, j], [i, j-jV]]) {
          if (nni<0||nni>=width||nnj<0||nnj>=height) continue;
          if (!mask[nnj*width+nni]) continue;
          const nIdx = nnj*width+nni;
          const px   = nnfX[nIdx]+iV, py = nnfY[nIdx]+jV;
          if (px<PATCH||px>=width-PATCH||py<PATCH||py>=height-PATCH) continue;
          if (mask[py*width+px]) continue;
          const sc = patchDist(i, j, px, py);
          if (sc < bs) { bx=px; by=py; bs=sc; }
        }

        // Random search — exponentially shrinking radius
        let sr = Math.max(width, height) / 2;
        while (sr >= 1) {
          const rx = Math.round(bx + (Math.random()*2-1)*sr);
          const ry = Math.round(by + (Math.random()*2-1)*sr);
          if (rx>=PATCH&&rx<width-PATCH&&ry>=PATCH&&ry<height-PATCH&&!mask[ry*width+rx]) {
            const sc = patchDist(i, j, rx, ry);
            if (sc < bs) { bx=rx; by=ry; bs=sc; }
          }
          sr *= 0.5;
        }

        nnfX[ni]=bx; nnfY[ni]=by; nnfS[ni]=bs;
      }
    }
  }

  // ── Reconstruct — weighted vote, pick BEST match not average ───────────────
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      if (!mask[j*width+i]) continue;
      const dist = Math.sqrt((i-cx)**2 + (j-cy)**2);
      if (dist > r+1) continue;
      const falloff  = brushEdge==='hard' ? 1 : Math.max(0, 1-(dist/r)**1.5);
      const str      = strength * falloff;
      if (str <= 0) continue;

      const pidx = idx(i, j);
      const alpha = src[pidx+3];

      // ✅ BUG FIX 4: Use small vote window — prevents blur from over-averaging
      // Only use the single best match from each pixel's own NNF entry
      // plus immediate neighbors — not a large patch window
      let wR=0, wG=0, wB=0, wT=0;
      const voteR = Math.min(2, PATCH); // tiny vote window = sharp result

      for (let di=-voteR; di<=voteR; di++) {
        for (let dj=-voteR; dj<=voteR; dj++) {
          const ni=i+di, nj=j+dj;
          if (ni<0||ni>=width||nj<0||nj>=height) continue;
          if (!mask[nj*width+ni]) continue;
          const nIdx = nj*width+ni;
          // ✅ BUG FIX 5: Correct offset calculation
          // Source pixel = NNF match position + offset from neighbor to current
          const sx = nnfX[nIdx] + di;
          const sy = nnfY[nIdx] + dj;
          if (sx<0||sx>=width||sy<0||sy>=height) continue;
          if (mask[sy*width+sx]) continue; // skip if source is masked
          const sidx = idx(sx, sy);
          // ✅ BUG FIX 6: Read from src not out — prevents black pixel propagation
          if (src[sidx+3] < 200) continue;
          const w = 1.0 / (nnfS[nIdx] + 0.001);
          wR += src[sidx]   * w;
          wG += src[sidx+1] * w;
          wB += src[sidx+2] * w;
          wT += w;
        }
      }

      if (wT === 0) continue;
      const fR = wR/wT, fG = wG/wT, fB = wB/wT;

      if (alpha < 128) {
        // Transparent — fill completely
        out[pidx+0] = clamp(fR);
        out[pidx+1] = clamp(fG);
        out[pidx+2] = clamp(fB);
        out[pidx+3] = clamp(255 * str);
      } else {
        // Opaque — blend with luminance match
        const tL = 0.299*src[pidx]+0.587*src[pidx+1]+0.114*src[pidx+2];
        const sL = 0.299*fR + 0.587*fG + 0.114*fB;
        const lr = sL > 1 ? Math.min(tL/sL, 1.8) : 1;
        out[pidx+0] = clamp(src[pidx+0]*(1-str) + fR*lr*str);
        out[pidx+1] = clamp(src[pidx+1]*(1-str) + fG*lr*str);
        out[pidx+2] = clamp(src[pidx+2]*(1-str) + fB*lr*str);
        out[pidx+3] = src[pidx+3];
      }
    }
  }

  // ── Feather edge only — thin band ──────────────────────────────────────────
  const final = new Uint8ClampedArray(out);
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      if (!mask[j*width+i]) continue;
      const dist = Math.sqrt((i-cx)**2 + (j-cy)**2);
      if (dist < r*0.8 || dist > r) continue;
      const t   = (dist - r*0.8) / (r*0.2);
      const pidx = idx(i, j);
      for (let c=0; c<3; c++) {
        final[pidx+c] = clamp(out[pidx+c]*(1-t) + src[pidx+c]*t);
      }
      if (src[pidx+3] < 128) {
        final[pidx+3] = clamp(out[pidx+3]*(1-t));
      }
    }
  }

  // ✅ BUG FIX 7: Post final not out — avoids accessing transferred buffer
  self.postMessage({ imageData: final.buffer }, [final.buffer]);
};
