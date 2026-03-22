self.onmessage = function(e) {
  const { imageData, width, height, cx, cy, objW, objH, pad } = e.data;

  const src   = new Uint8ClampedArray(imageData);
  const out   = new Uint8ClampedArray(imageData);
  const clamp = v => Math.min(255, Math.max(0, Math.round(v)));
  const SI    = (x, y) => (y * width + x) * 4;

  // ── Build mask — pixels to fill ──────────────────────────────────────────
  const mask  = new Uint8Array(width * height);
  const rx    = Math.max(0, Math.round(cx - objW/2 - pad));
  const ry    = Math.max(0, Math.round(cy - objH/2 - pad));
  const rw    = Math.min(width  - rx, Math.round(objW + pad*2));
  const rh    = Math.min(height - ry, Math.round(objH + pad*2));

  for (let i = rx; i < rx+rw; i++) {
    for (let j = ry; j < ry+rh; j++) {
      if (i<0||i>=width||j<0||j>=height) continue;
      const nx = (i - cx) / (objW/2);
      const ny = (j - cy) / (objH/2);
      if (Math.sqrt(nx*nx + ny*ny) <= 1.0) {
        mask[j*width+i] = 1;
      }
    }
  }

  // ── Collect source pixels (unmasked, opaque) ──────────────────────────────
  const PATCH = Math.max(3, Math.round(Math.min(objW, objH) * 0.12));
  const sources = [];
  for (let i = PATCH; i < width-PATCH; i += 2) {
    for (let j = PATCH; j < height-PATCH; j += 2) {
      if (!mask[j*width+i] && src[SI(i,j)+3] >= 200) {
        sources.push([i, j]);
      }
    }
  }

  if (sources.length < 8) {
    self.postMessage({ imageData: out.buffer }, [out.buffer]);
    return;
  }

  // ── Patch distance ────────────────────────────────────────────────────────
  function patchDist(ax, ay, bx, by) {
    let sum = 0, cnt = 0;
    for (let di = -PATCH; di <= PATCH; di += 2) {
      for (let dj = -PATCH; dj <= PATCH; dj += 2) {
        const ai=ax+di, aj=ay+dj, bi=bx+di, bj=by+dj;
        if (ai<0||ai>=width||aj<0||aj>=height) continue;
        if (bi<0||bi>=width||bj<0||bj>=height) continue;
        if (mask[aj*width+ai] || mask[bj*width+bi]) continue;
        const a=SI(ai,aj), b=SI(bi,bj);
        const dr=src[a]-src[b], dg=src[a+1]-src[b+1], db=src[a+2]-src[b+2];
        sum += dr*dr + dg*dg + db*db;
        cnt++;
      }
    }
    return cnt > 0 ? sum/cnt : Infinity;
  }

  // ── BFS order — fill outside in ───────────────────────────────────────────
  const order   = [];
  const visited = new Uint8Array(width * height);
  const queue   = [];

  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      if (!mask[j*width+i]) continue;
      for (const [di,dj] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const ni=i+di, nj=j+dj;
        if (ni<0||ni>=width||nj<0||nj>=height) continue;
        if (!mask[nj*width+ni] && !visited[j*width+i]) {
          visited[j*width+i] = 1;
          queue.push([i,j]);
          break;
        }
      }
    }
  }

  let qi = 0;
  while (qi < queue.length) {
    const [ci,cj] = queue[qi++];
    order.push([ci,cj]);
    for (const [di,dj] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const ni=ci+di, nj=cj+dj;
      if (ni<0||ni>=width||nj<0||nj>=height) continue;
      if (!mask[nj*width+ni] || visited[nj*width+ni]) continue;
      visited[nj*width+ni] = 1;
      queue.push([ni,nj]);
    }
  }

  // ── Initialize NNF ────────────────────────────────────────────────────────
  const nnfX = new Int16Array(width * height);
  const nnfY = new Int16Array(width * height);
  const nnfS = new Float32Array(width * height).fill(Infinity);

  for (const [i,j] of order) {
    let bx=-1, by=-1, bs=Infinity;
    for (const [di,dj] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const ni=i+di, nj=j+dj;
      if (ni<0||ni>=width||nj<0||nj>=height) continue;
      if (nnfS[nj*width+ni] === Infinity) continue;
      const cx2=nnfX[nj*width+ni]+di, cy2=nnfY[nj*width+ni]+dj;
      if (cx2<0||cx2>=width||cy2<0||cy2>=height||mask[cy2*width+cx2]) continue;
      const sc = patchDist(i,j,cx2,cy2);
      if (sc < bs) { bx=cx2; by=cy2; bs=sc; }
    }
    if (bx < 0) {
      const rnd = sources[Math.floor(Math.random()*sources.length)];
      bx=rnd[0]; by=rnd[1]; bs=patchDist(i,j,bx,by);
    }
    nnfX[j*width+i]=bx; nnfY[j*width+i]=by; nnfS[j*width+i]=bs;
  }

  // ── PatchMatch iterations ─────────────────────────────────────────────────
  for (let iter = 0; iter < 4; iter++) {
    const fwd = iter%2===0;
    const iS=fwd?PATCH:width-PATCH-1, iE=fwd?width-PATCH:PATCH-1, iV=fwd?1:-1;
    const jS=fwd?PATCH:height-PATCH-1, jE=fwd?height-PATCH:PATCH-1, jV=fwd?1:-1;
    for (let i=iS; i!==iE; i+=iV) {
      for (let j=jS; j!==jE; j+=jV) {
        if (!mask[j*width+i]) continue;
        const ni  = j*width+i;
        let bx=nnfX[ni], by=nnfY[ni], bs=nnfS[ni];
        for (const [di,dj] of [[iV,0],[0,jV]]) {
          const pi=i-di, pj=j-dj;
          if (pi<0||pi>=width||pj<0||pj>=height||!mask[pj*width+pi]) continue;
          const cx2=nnfX[pj*width+pi]+di, cy2=nnfY[pj*width+pi]+dj;
          if (cx2<PATCH||cx2>=width-PATCH||cy2<PATCH||cy2>=height-PATCH||mask[cy2*width+cx2]) continue;
          const sc=patchDist(i,j,cx2,cy2);
          if (sc<bs) { bx=cx2; by=cy2; bs=sc; }
        }
        let sr = Math.max(width,height)/2;
        while (sr >= 1) {
          const rx2=Math.round(bx+(Math.random()*2-1)*sr);
          const ry2=Math.round(by+(Math.random()*2-1)*sr);
          if (rx2>=PATCH&&rx2<width-PATCH&&ry2>=PATCH&&ry2<height-PATCH&&!mask[ry2*width+rx2]) {
            const sc=patchDist(i,j,rx2,ry2);
            if (sc<bs) { bx=rx2; by=ry2; bs=sc; }
          }
          sr *= 0.5;
        }
        nnfX[ni]=bx; nnfY[ni]=by; nnfS[ni]=bs;
      }
    }
  }

  // ── Reconstruct with Gaussian blend ──────────────────────────────────────
  const filled = new Uint8ClampedArray(src);

  for (const [i,j] of order) {
    const ni   = j*width+i;
    const dist = Math.sqrt(((i-cx)/(objW/2))**2 + ((j-cy)/(objH/2))**2);
    const falloff = Math.max(0, 1-(dist)**1.5);
    const str     = falloff;
    if (str <= 0) continue;

    let wR=0,wG=0,wB=0,wT=0;
    const kr = Math.min(2, PATCH);
    for (let di=-kr; di<=kr; di++) {
      for (let dj=-kr; dj<=kr; dj++) {
        const ni2=i+di, nj2=j+dj;
        if (ni2<0||ni2>=width||nj2<0||nj2>=height||!mask[nj2*width+ni2]) continue;
        const nn2 = nj2*width+ni2;
        const sx2=nnfX[nn2]+di, sy2=nnfY[nn2]+dj;
        if (sx2<0||sx2>=width||sy2<0||sy2>=height||mask[sy2*width+sx2]) continue;
        const ss2 = SI(sx2,sy2);
        if (src[ss2+3] < 200) continue;
        const gw = Math.exp(-(di*di+dj*dj)/(kr*kr+0.1)) / (nnfS[nn2]+0.001);
        wR+=filled[ss2]*gw; wG+=filled[ss2+1]*gw; wB+=filled[ss2+2]*gw; wT+=gw;
      }
    }

    if (wT === 0) continue;
    const fR=wR/wT, fG=wG/wT, fB=wB/wT;
    const pidx = SI(i,j);
    const tL = 0.299*src[pidx]+0.587*src[pidx+1]+0.114*src[pidx+2];
    const sL = 0.299*fR+0.587*fG+0.114*fB;
    const lr = sL>1 ? Math.min(tL/sL, 1.8) : 1;

    filled[pidx+0] = clamp(src[pidx+0]*(1-str) + fR*lr*str);
    filled[pidx+1] = clamp(src[pidx+1]*(1-str) + fG*lr*str);
    filled[pidx+2] = clamp(src[pidx+2]*(1-str) + fB*lr*str);
    filled[pidx+3] = 255;

    // Unmask so adjacent pixels can use this as source
    mask[j*width+i] = 0;
  }

  // ── Feather edges ─────────────────────────────────────────────────────────
  const final = new Uint8ClampedArray(filled);
  for (let i=rx; i<rx+rw; i++) {
    for (let j=ry; j<ry+rh; j++) {
      if (i<0||i>=width||j<0||j>=height) continue;
      const nx = (i-cx)/(objW/2);
      const ny = (j-cy)/(objH/2);
      const dist = Math.sqrt(nx*nx+ny*ny);
      if (dist < 0.82 || dist > 1.05) continue;
      const t = (dist-0.82)/(0.23);
      const tt = Math.min(1, Math.max(0, t));
      const pidx = SI(i,j);
      for (let c=0;c<3;c++) {
        final[pidx+c] = clamp(filled[pidx+c]*(1-tt) + src[pidx+c]*tt);
      }
    }
  }

  self.postMessage({ imageData: final.buffer }, [final.buffer]);
};
