import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

// ─── Brush Overlay ─────────────────────────────────────────────────────────────
export const BrushOverlay = forwardRef(function BrushOverlay(
  { layer, onUpdate, brushType, brushSize, brushStrength, brushEdge, brushFlow, brushStabilizer, active, zoom, paintColor, paintAlpha },
  ref
) {
  const canvasRef      = useRef(null);
  const cursorRef      = useRef(null);
  const lastPos        = useRef(null);
  const stabPos        = useRef(null); // stabilized position lags behind mouse
  const cloneSource    = useRef(null);
  const isPainting     = useRef(false);
  const isReady        = useRef(false);
  const historyRef     = useRef([]);
  const loadedSrc      = useRef(null);
  const lastPressure   = useRef(1);
  const lastTime       = useRef(Date.now());
  const lastHealPos    = useRef(null);

  useImperativeHandle(ref, () => ({
    undo() {
      if (historyRef.current.length <= 1) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      historyRef.current.pop();
      canvas.getContext('2d').putImageData(
        historyRef.current[historyRef.current.length - 1], 0, 0
      );
      flush();
    },
  }));

  useEffect(() => {
    if (!layer?.src || !active) return;
    if (loadedSrc.current === layer.src) return;
    isReady.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      const z = zoom || 1;
      canvas.width  = layer.width;
      canvas.height = layer.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
      isReady.current    = true;
      loadedSrc.current  = layer.src;
    };
    img.src = layer.src;
  }, [layer?.src, layer?.width, layer?.height, active, zoom]);

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
      clientX: e.clientX,
      clientY: e.clientY,
    };
  }

  function saveSnap() {
    const canvas = canvasRef.current;
    if (!canvas || !isReady.current) return;
    const snap = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = [...historyRef.current.slice(-19), snap];
  }

  function flush() {
    const canvas = canvasRef.current;
    if (!canvas || !isReady.current) return;
    const tmp = document.createElement('canvas');
    tmp.width  = layer.width;
    tmp.height = layer.height;
    tmp.getContext('2d').drawImage(canvas, 0, 0, layer.width, layer.height);
    const dataUrl = tmp.toDataURL('image/png');
    loadedSrc.current = dataUrl;
    onUpdate({ src: dataUrl });
  }

  function getPressure(pos) {
    if (!lastPos.current) return 1;
    const now    = Date.now();
    const dt     = Math.max(1, now - lastTime.current);
    const dx     = pos.x - lastPos.current.x;
    const dy     = pos.y - lastPos.current.y;
    const speed  = Math.sqrt(dx*dx + dy*dy) / dt;
    const p      = Math.max(0.15, Math.min(1, 1 - speed * 0.8));
    lastPressure.current = lastPressure.current * 0.7 + p * 0.3;
    lastTime.current = now;
    return lastPressure.current;
  }

  // ✅ PHASE 2: Stabilizer — smooth position lags behind mouse
  function getStabilizedPos(target) {
    const stab = brushStabilizer || 0;
    if (stab === 0) return target;
    if (!stabPos.current) { stabPos.current = { x:target.x, y:target.y }; return target; }
    const lag = stab / 100;
    stabPos.current = {
      x: stabPos.current.x + (target.x - stabPos.current.x) * (1 - lag),
      y: stabPos.current.y + (target.y - stabPos.current.y) * (1 - lag),
    };
    return stabPos.current;
  }

  function getStamps(from, to, spacing) {
    const dx   = to.x - from.x;
    const dy   = to.y - from.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < spacing) return [];
    const steps  = Math.floor(dist / spacing);
    const stamps = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      stamps.push({ x: from.x + dx*t, y: from.y + dy*t });
    }
    return stamps;
  }

  // ── 3-pass box blur ────────────────────────────────────────────────────────
  function boxBlurH(src, dst, w, h, r) {
    const iarr = 1/(r+r+1);
    for (let i=0; i<h; i++) {
      let ti=i*w*4, li=ti, ri=ti+r*4;
      const fv=[src[ti],src[ti+1],src[ti+2],src[ti+3]];
      const lv=[src[ti+(w-1)*4],src[ti+(w-1)*4+1],src[ti+(w-1)*4+2],src[ti+(w-1)*4+3]];
      let val=[fv[0]*(r+1),fv[1]*(r+1),fv[2]*(r+1),fv[3]*(r+1)];
      for (let j=0;j<r;j++) for (let c=0;c<4;c++) val[c]+=src[ti+j*4+c];
      for (let j=0;j<=r;j++){for(let c=0;c<4;c++){val[c]+=src[ri+c]-fv[c];dst[ti+c]=Math.round(val[c]*iarr);}ri+=4;ti+=4;}
      for (let j=r+1;j<w-r;j++){for(let c=0;c<4;c++){val[c]+=src[ri+c]-src[li+c];dst[ti+c]=Math.round(val[c]*iarr);}ri+=4;li+=4;ti+=4;}
      for (let j=w-r;j<w;j++){for(let c=0;c<4;c++){val[c]+=lv[c]-src[li+c];dst[ti+c]=Math.round(val[c]*iarr);}li+=4;ti+=4;}
    }
  }
  function boxBlurV(src, dst, w, h, r) {
    const iarr = 1/(r+r+1);
    for (let i=0; i<w; i++) {
      let ti=i*4, li=ti, ri=ti+r*w*4;
      const fv=[src[ti],src[ti+1],src[ti+2],src[ti+3]];
      const lv=[src[ti+(h-1)*w*4],src[ti+(h-1)*w*4+1],src[ti+(h-1)*w*4+2],src[ti+(h-1)*w*4+3]];
      let val=[fv[0]*(r+1),fv[1]*(r+1),fv[2]*(r+1),fv[3]*(r+1)];
      for (let j=0;j<r;j++) for (let c=0;c<4;c++) val[c]+=src[ti+j*w*4+c];
      for (let j=0;j<=r;j++){for(let c=0;c<4;c++){val[c]+=src[ri+c]-fv[c];dst[ti+c]=Math.round(val[c]*iarr);}ri+=w*4;ti+=w*4;}
      for (let j=r+1;j<h-r;j++){for(let c=0;c<4;c++){val[c]+=src[ri+c]-src[li+c];dst[ti+c]=Math.round(val[c]*iarr);}ri+=w*4;li+=w*4;ti+=w*4;}
      for (let j=h-r;j<h;j++){for(let c=0;c<4;c++){val[c]+=lv[c]-src[li+c];dst[ti+c]=Math.round(val[c]*iarr);}li+=w*4;ti+=w*4;}
    }
  }

  function applyBlurStamp(ctx, x, y, pressure) {
    const canvas = canvasRef.current;
    const r  = Math.round(brushSize*(zoom||1));
    // ✅ PHASE 2: Flow separates how much paint per stamp from total opacity
    const s  = (brushStrength/100) * (brushFlow/100) * pressure;
    const sx = Math.max(0,Math.round(x-r)), sy = Math.max(0,Math.round(y-r));
    const sw = Math.min(canvas.width-sx,r*2+1), sh = Math.min(canvas.height-sy,r*2+1);
    if (sw<3||sh<3) return;
    const id  = ctx.getImageData(sx,sy,sw,sh);
    const src = new Uint8ClampedArray(id.data);
    const tmp = new Uint8ClampedArray(id.data.length);
    const dst = new Uint8ClampedArray(id.data.length);
    const k   = brushEdge==='hard' ? Math.max(1,Math.round(r*0.15)) : Math.max(1,Math.round(r*0.25));
    boxBlurH(src,tmp,sw,sh,k); boxBlurH(tmp,dst,sw,sh,k); boxBlurH(dst,tmp,sw,sh,k);
    boxBlurV(tmp,dst,sw,sh,k); boxBlurV(dst,tmp,sw,sh,k); boxBlurV(tmp,dst,sw,sh,k);
    for (let i=0;i<sw;i++) for (let j=0;j<sh;j++) {
      const dist=Math.sqrt((sx+i-x)**2+(sy+j-y)**2);
      if (dist>r) continue;
      const falloff=brushEdge==='hard'?1:Math.max(0,1-(dist/r)**1.5);
      const blend=s*falloff;
      const idx=(j*sw+i)*4;
      for (let c=0;c<3;c++) id.data[idx+c]=Math.round(src[idx+c]*(1-blend)+dst[idx+c]*blend);
    }
    ctx.putImageData(id,sx,sy);
  }

  function applySmearStamp(ctx, x, y, fromX, fromY, pressure) {
    const canvas = canvasRef.current;
    const r  = Math.round(brushSize*(zoom||1));
    const s  = (brushStrength/100)*(brushFlow/100)*pressure*0.5;
    const dx = x-fromX, dy = y-fromY;
    if (Math.abs(dx)<0.5&&Math.abs(dy)<0.5) return;
    const sx=Math.max(0,Math.round(x-r)), sy=Math.max(0,Math.round(y-r));
    const sw=Math.min(canvas.width-sx,r*2+1), sh=Math.min(canvas.height-sy,r*2+1);
    const osx=Math.max(0,Math.round(x-r-dx)), osy=Math.max(0,Math.round(y-r-dy));
    const osw=Math.min(canvas.width-osx,r*2+1), osh=Math.min(canvas.height-osy,r*2+1);
    if (sw<=0||sh<=0||osw<=0||osh<=0) return;
    const dest=ctx.getImageData(sx,sy,sw,sh);
    const src=ctx.getImageData(osx,osy,osw,osh);
    const dd=dest.data, sd=src.data;
    for (let i=0;i<sw;i++) for (let j=0;j<sh;j++) {
      const dist=Math.sqrt((sx+i-x)**2+(sy+j-y)**2);
      if (dist>r) continue;
      const falloff=brushEdge==='hard'?1:Math.max(0,1-(dist/r)**1.5);
      const blend=s*falloff;
      const si=Math.min(i,osw-1), sj=Math.min(j,osh-1);
      const idx=(j*sw+i)*4, sidx=(sj*osw+si)*4;
      for (let c=0;c<3;c++) dd[idx+c]=Math.round(dd[idx+c]*(1-blend)+sd[sidx+c]*blend);
    }
    ctx.putImageData(dest,sx,sy);
  }

  function applySharpenStamp(ctx, x, y, pressure) {
    const canvas = canvasRef.current;
    const r  = Math.round(brushSize*(zoom||1));
    const s  = (brushStrength/100)*(brushFlow/100)*pressure*0.12;
    const sx = Math.max(0,Math.round(x-r)), sy = Math.max(0,Math.round(y-r));
    const sw = Math.min(canvas.width-sx,r*2+1), sh = Math.min(canvas.height-sy,r*2+1);
    if (sw<=2||sh<=2) return;
    const id=ctx.getImageData(sx,sy,sw,sh);
    const d=id.data, out=new Uint8ClampedArray(d);
    for (let i=1;i<sw-1;i++) for (let j=1;j<sh-1;j++) {
      const dist=Math.sqrt((sx+i-x)**2+(sy+j-y)**2);
      if (dist>r) continue;
      const falloff=brushEdge==='hard'?1:Math.max(0,1-(dist/r)**2);
      const strength=s*falloff;
      if (strength<=0) continue;
      for (let c=0;c<3;c++) {
        const idx=(j*sw+i)*4+c;
        const neighbors=(d[((j-1)*sw+i)*4+c]+d[((j+1)*sw+i)*4+c]+d[(j*sw+i-1)*4+c]+d[(j*sw+i+1)*4+c])/4;
        out[idx]=Math.min(255,Math.max(0,Math.round(d[idx]+(d[idx]-neighbors)*strength*3)));
      }
      out[(j*sw+i)*4+3]=d[(j*sw+i)*4+3];
    }
    id.data.set(out);
    ctx.putImageData(id,sx,sy);
  }

  function applyAirbrushStamp(ctx, x, y, pressure) {
    const r       = Math.round(brushSize*(zoom||1));
    const flow    = brushFlow/100;
    const alpha   = (brushStrength/100)*flow*pressure*0.12;
    const density = Math.round(r*1.2);
    ctx.save();
    for (let i=0;i<density;i++){
      const angle    = Math.random()*Math.PI*2;
      const dist     = brushEdge==='hard'
        ? Math.random()*r
        : Math.pow(Math.random(),0.6)*r;
      const px = x+Math.cos(angle)*dist;
      const py = y+Math.sin(angle)*dist;
      const falloff = brushEdge==='hard'?1:Math.pow(1-dist/r,0.5);
      const dotSize = Math.max(0.5, (1-dist/r)*2.5);
      ctx.globalAlpha = Math.min(1, alpha*falloff*(0.6+Math.random()*0.8));
      ctx.beginPath();
      ctx.arc(px,py,dotSize,0,Math.PI*2);
      ctx.fillStyle='#000000';
      ctx.fill();
    }
    ctx.restore();
  }

  function applyEraserStamp(ctx, x, y, pressure) {
    const r     = Math.round(brushSize*(zoom||1));
    const alpha = (brushStrength/100)*(brushFlow/100)*pressure;
    ctx.save();
    ctx.globalCompositeOperation='destination-out';
    if (brushEdge==='soft') {
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,  `rgba(0,0,0,${alpha})`);
      g.addColorStop(0.4,`rgba(0,0,0,${alpha*0.8})`);
      g.addColorStop(1,  'rgba(0,0,0,0)');
      ctx.fillStyle=g;
    } else {
      ctx.fillStyle=`rgba(0,0,0,${alpha})`;
    }
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function applyCloneStamp(ctx, x, y, pressure) {
    if (!cloneSource.current) return;
    const r=Math.round(brushSize*(zoom||1)), cs=cloneSource.current;
    ctx.save();
    ctx.globalAlpha=(brushStrength/100)*(brushFlow/100)*pressure;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.clip();
    ctx.drawImage(canvasRef.current,cs.x-r,cs.y-r,r*2,r*2,x-r,y-r,r*2,r*2);
    ctx.restore();
  }

  function applyPaintStamp(ctx, x, y, pressure, color, alpha) {
    const r     = Math.round(brushSize*(zoom||1));
    const a     = ((alpha||100)/100) * (brushStrength/100) * (brushFlow/100) * pressure;
    const hex   = (color||'#ff0000').replace('#','');
    const cr    = parseInt(hex.slice(0,2),16);
    const cg    = parseInt(hex.slice(2,4),16);
    const cb    = parseInt(hex.slice(4,6),16);
    const canvas= canvasRef.current;
    const sx    = Math.max(0,Math.round(x-r));
    const sy    = Math.max(0,Math.round(y-r));
    const sw    = Math.min(canvas.width-sx,r*2+1);
    const sh    = Math.min(canvas.height-sy,r*2+1);
    if(sw<=0||sh<=0) return;
    const id    = ctx.getImageData(sx,sy,sw,sh);
    const d     = id.data;
    for(let i=0;i<sw;i++){
      for(let j=0;j<sh;j++){
        const dist=Math.sqrt((sx+i-x)**2+(sy+j-y)**2);
        if(dist>r) continue;
        const falloff=brushEdge==='hard'?1:Math.max(0,1-(dist/r)**1.5);
        const blend=a*falloff;
        if(blend<=0) continue;
        const idx=(j*sw+i)*4;
        d[idx+0]=Math.round(d[idx+0]*(1-blend)+cr*blend);
        d[idx+1]=Math.round(d[idx+1]*(1-blend)+cg*blend);
        d[idx+2]=Math.round(d[idx+2]*(1-blend)+cb*blend);
        if(d[idx+3]<255) d[idx+3]=Math.min(255,Math.round(d[idx+3]+255*blend));
      }
    }
    ctx.putImageData(id,sx,sy);
  }

  function applyFloodFill(ctx, x, y, fillColor) {
    const canvas = canvasRef.current;
    const width  = canvas.width;
    const height = canvas.height;
    const hex    = (fillColor||'#ff0000').replace('#','');
    const fr     = parseInt(hex.slice(0,2),16);
    const fg     = parseInt(hex.slice(2,4),16);
    const fb     = parseInt(hex.slice(4,6),16);
    const id     = ctx.getImageData(0,0,width,height);
    const data   = id.data;
    const px     = Math.round(x), py = Math.round(y);
    if(px<0||px>=width||py<0||py>=height) return;
    const startIdx=(py*width+px)*4;
    const sr=data[startIdx],sg=data[startIdx+1],sb=data[startIdx+2];
    if(sr===fr&&sg===fg&&sb===fb) return;
    const tolerance=30;
    function matches(idx){
      return Math.abs(data[idx]-sr)<=tolerance&&
             Math.abs(data[idx+1]-sg)<=tolerance&&
             Math.abs(data[idx+2]-sb)<=tolerance;
    }
    const stack=[[px,py]];
    const visited=new Uint8Array(width*height);
    visited[py*width+px]=1;
    while(stack.length>0){
      const [cx,cy]=stack.pop();
      const idx=(cy*width+cx)*4;
      data[idx]=fr;data[idx+1]=fg;data[idx+2]=fb;data[idx+3]=255;
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const nx=cx+dx,ny=cy+dy;
        if(nx<0||nx>=width||ny<0||ny>=height) continue;
        if(visited[ny*width+nx]) continue;
        const nidx=(ny*width+nx)*4;
        if(matches(nidx)){
          visited[ny*width+nx]=1;
          stack.push([nx,ny]);
        }
      }
    }
    ctx.putImageData(id,0,0);
    flush();
  }

  // ✅ PHASE 3: Dodge — brighten pixels
  function applyDodgeStamp(ctx, x, y, pressure) {
    const canvas = canvasRef.current;
    const r  = Math.round(brushSize*(zoom||1));
    const s  = (brushStrength/100)*(brushFlow/100)*pressure*0.4;
    const sx = Math.max(0,Math.round(x-r)), sy = Math.max(0,Math.round(y-r));
    const sw = Math.min(canvas.width-sx,r*2+1), sh = Math.min(canvas.height-sy,r*2+1);
    if (sw<=0||sh<=0) return;
    const id=ctx.getImageData(sx,sy,sw,sh);
    const d=id.data;
    for (let i=0;i<sw;i++) for (let j=0;j<sh;j++) {
      const dist=Math.sqrt((sx+i-x)**2+(sy+j-y)**2);
      if (dist>r) continue;
      const falloff=brushEdge==='hard'?1:Math.max(0,1-(dist/r)**1.5);
      const strength=s*falloff;
      const idx=(j*sw+i)*4;
      for (let c=0;c<3;c++) {
        const v=d[idx+c];
        d[idx+c]=Math.min(255,Math.round(v+(255-v)*strength));
      }
    }
    ctx.putImageData(id,sx,sy);
  }

  // ✅ PHASE 3: Burn — darken pixels
  function applyBurnStamp(ctx, x, y, pressure) {
    const canvas = canvasRef.current;
    const r  = Math.round(brushSize*(zoom||1));
    const s  = (brushStrength/100)*(brushFlow/100)*pressure*0.4;
    const sx = Math.max(0,Math.round(x-r)), sy = Math.max(0,Math.round(y-r));
    const sw = Math.min(canvas.width-sx,r*2+1), sh = Math.min(canvas.height-sy,r*2+1);
    if (sw<=0||sh<=0) return;
    const id=ctx.getImageData(sx,sy,sw,sh);
    const d=id.data;
    for (let i=0;i<sw;i++) for (let j=0;j<sh;j++) {
      const dist=Math.sqrt((sx+i-x)**2+(sy+j-y)**2);
      if (dist>r) continue;
      const falloff=brushEdge==='hard'?1:Math.max(0,1-(dist/r)**1.5);
      const strength=s*falloff;
      const idx=(j*sw+i)*4;
      for (let c=0;c<3;c++) d[idx+c]=Math.min(255,Math.max(0,Math.round(d[idx+c]*(1-strength))));
    }
    ctx.putImageData(id,sx,sy);
  }

  // ✅ PHASE 3: Healing brush — samples surrounding texture
  function applyHealStamp(ctx, x, y, pressure) {
    const canvas = canvasRef.current;
    const z      = zoom || 1;
    const r      = Math.round(brushSize * z);
    const s      = Math.min(1, (brushStrength/100) * (brushFlow/100) * pressure * 1.8);
    const clamp  = v => Math.min(255, Math.max(0, Math.round(v)));
    const PATCH  = Math.max(2, Math.round(r * 0.2));

    // ✅ Tighter margin — less pixels to process
    const margin = Math.round(r * 2);
    const wx  = Math.max(0, Math.round(x-r-margin));
    const wy  = Math.max(0, Math.round(y-r-margin));
    const ww  = Math.min(canvas.width-wx,  (r+margin)*2+1);
    const wh  = Math.min(canvas.height-wy, (r+margin)*2+1);
    if (ww < PATCH*4 || wh < PATCH*4) return;

    const lx = x-wx, ly = y-wy;
    const SI = (px,py) => (py*ww+px)*4;

    const wid  = ctx.getImageData(wx, wy, ww, wh);
    const src  = new Uint8ClampedArray(wid.data);
    const work = new Uint8ClampedArray(wid.data);

    // ── Build mask ──────────────────────────────────────────────────────────────
    const mask = new Uint8Array(ww*wh);
    for (let i=0;i<ww;i++) for (let j=0;j<wh;j++) {
      const d  = Math.sqrt((i-lx)**2+(j-ly)**2);
      const p  = SI(i,j);
      const pb = src[p+2], pr = src[p], pg = src[p+1], pa = src[p+3];
      const isBlue = pb>150&&pb>pr*1.5&&pb>pg*1.3&&pa>40;
      if (d<=r||pa<128||isBlue) mask[j*ww+i]=1;
    }

    // ── BFS order — outside in ──────────────────────────────────────────────────
    const order = [];
    const visited = new Uint8Array(ww*wh);
    const bfsQ = [];

    // Seed BFS from masked pixels adjacent to unmasked
    for (let i=0;i<ww;i++) for (let j=0;j<wh;j++) {
      if (!mask[j*ww+i]) continue;
      let hasUnmaskedNeighbor = false;
      for (const [di,dj] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const ni=i+di,nj=j+dj;
        if (ni<0||ni>=ww||nj<0||nj>=wh) continue;
        if (!mask[nj*ww+ni]) { hasUnmaskedNeighbor=true; break; }
      }
      if (hasUnmaskedNeighbor) { bfsQ.push([i,j]); visited[j*ww+i]=1; }
    }

    let qi=0;
    while (qi<bfsQ.length) {
      const [ci,cj]=bfsQ[qi++];
      order.push([ci,cj]);
      for (const [di,dj] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const ni=ci+di,nj=cj+dj;
        if (ni<0||ni>=ww||nj<0||nj>=wh) continue;
        if (!mask[nj*ww+ni]||visited[nj*ww+ni]) continue;
        visited[nj*ww+ni]=1;
        bfsQ.push([ni,nj]);
      }
    }

    // ── Single PatchMatch pass on ALL masked pixels ─────────────────────────────
    // ✅ Run NNF once upfront instead of per-layer — much faster
    const sources=[];
    for (let i=PATCH;i<ww-PATCH;i+=2) for (let j=PATCH;j<wh-PATCH;j+=2) {
      if (!mask[j*ww+i]&&src[SI(i,j)+3]>=200) sources.push([i,j]);
    }
    if (sources.length<4) return;

    function patchDist(ax,ay,bx,by) {
      let sum=0,cnt=0;
      for (let di=-PATCH;di<=PATCH;di+=2) for (let dj=-PATCH;dj<=PATCH;dj+=2) {
        const ai=ax+di,aj=ay+dj,bi=bx+di,bj=by+dj;
        if(ai<0||ai>=ww||aj<0||aj>=wh||bi<0||bi>=ww||bj<0||bj>=wh) continue;
        if(mask[aj*ww+ai]||mask[bj*ww+bi]) continue;
        const a=SI(ai,aj),b=SI(bi,bj);
        const dr=src[a]-src[b],dg=src[a+1]-src[b+1],db=src[a+2]-src[b+2];
        sum+=dr*dr+dg*dg+db*db; cnt++;
      }
      return cnt>0?sum/cnt:Infinity;
    }

    const nnfX=new Int16Array(ww*wh);
    const nnfY=new Int16Array(ww*wh);
    const nnfS=new Float32Array(ww*wh).fill(Infinity);

    // Init NNF — use BFS order for smarter initialization
    for (const [i,j] of order) {
      // Try to inherit from already-processed neighbor first
      let bx=-1,by=-1,bs=Infinity;
      for (const [di,dj] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const ni=i+di,nj=j+dj;
        if(ni<0||ni>=ww||nj<0||nj>=wh) continue;
        if(nnfS[nj*ww+ni]===Infinity) continue;
        const cx=nnfX[nj*ww+ni]+di,cy=nnfY[nj*ww+ni]+dj;
        if(cx<0||cx>=ww||cy<0||cy>=wh||mask[cy*ww+cx]) continue;
        const sc=patchDist(i,j,cx,cy);
        if(sc<bs){bx=cx;by=cy;bs=sc;}
      }
      if(bx<0){
        // Random init
        const rnd=sources[Math.floor(Math.random()*sources.length)];
        bx=rnd[0];by=rnd[1];bs=patchDist(i,j,bx,by);
      }
      nnfX[j*ww+i]=bx;nnfY[j*ww+i]=by;nnfS[j*ww+i]=bs;
    }

    // ✅ Two PatchMatch passes total — not per layer
    for (let iter=0;iter<2;iter++) {
      const fwd=iter%2===0;
      const iS=fwd?PATCH:ww-PATCH-1,iE=fwd?ww-PATCH:PATCH-1,iV=fwd?1:-1;
      const jS=fwd?PATCH:wh-PATCH-1,jE=fwd?wh-PATCH:PATCH-1,jV=fwd?1:-1;
      for (let i=iS;i!==iE;i+=iV) for (let j=jS;j!==jE;j+=jV) {
        if (!mask[j*ww+i]) continue;
        const ni=j*ww+i;
        let bx=nnfX[ni],by=nnfY[ni],bs=nnfS[ni];
        for (const [di,dj] of [[iV,0],[0,jV]]) {
          const pi=i-di,pj=j-dj;
          if(pi<0||pi>=ww||pj<0||pj>=wh||!mask[pj*ww+pi]) continue;
          const cx=nnfX[pj*ww+pi]+di,cy=nnfY[pj*ww+pi]+dj;
          if(cx<PATCH||cx>=ww-PATCH||cy<PATCH||cy>=wh-PATCH||mask[cy*ww+cx]) continue;
          const sc=patchDist(i,j,cx,cy);
          if(sc<bs){bx=cx;by=cy;bs=sc;}
        }
        let sr=Math.max(ww,wh)/2;
        while(sr>=1){
          const rx=Math.round(bx+(Math.random()*2-1)*sr);
          const ry=Math.round(by+(Math.random()*2-1)*sr);
          if(rx>=PATCH&&rx<ww-PATCH&&ry>=PATCH&&ry<wh-PATCH&&!mask[ry*ww+rx]){
            const sc=patchDist(i,j,rx,ry);
            if(sc<bs){bx=rx;by=ry;bs=sc;}
          }
          sr*=0.5;
        }
        nnfX[ni]=bx;nnfY[ni]=by;nnfS[ni]=bs;
      }
    }

    // ── Reconstruct in BFS order ────────────────────────────────────────────────
    for (const [i,j] of order) {
      const ni  = j*ww+i;
      const sx  = nnfX[ni], sy = nnfY[ni];
      if(sx<0||sx>=ww||sy<0||sy>=wh) continue;
      const ss  = SI(sx,sy);
      if(src[ss+3]<200) continue;
      const pidx = SI(i,j);
      const dist = Math.sqrt((i-lx)**2+(j-ly)**2);
      const fo   = brushEdge==='hard'?1:Math.max(0,1-(dist/r)**1.2);
      const str  = s*fo;
      if(str<=0) continue;

      // Gaussian blend of small neighborhood
      let wR=0,wG=0,wB=0,wT=0;
      const kr=Math.min(2,PATCH);
      for(let di=-kr;di<=kr;di++) for(let dj=-kr;dj<=kr;dj++){
        const ni2=i+di,nj2=j+dj;
        if(ni2<0||ni2>=ww||nj2<0||nj2>=wh||!mask[nj2*ww+ni2]) continue;
        const nn2=nj2*ww+ni2;
        const sx2=nnfX[nn2]+di,sy2=nnfY[nn2]+dj;
        if(sx2<0||sx2>=ww||sy2<0||sy2>=wh||mask[sy2*ww+sx2]) continue;
        const ss2=SI(sx2,sy2);
        if(work[ss2+3]<200) continue;
        const gw=Math.exp(-(di*di+dj*dj)/(kr*kr+0.1))/(nnfS[nn2]+0.001);
        wR+=work[ss2]*gw;wG+=work[ss2+1]*gw;wB+=work[ss2+2]*gw;wT+=gw;
      }
      const fR=wT>0?wR/wT:src[ss];
      const fG=wT>0?wG/wT:src[ss+1];
      const fB=wT>0?wB/wT:src[ss+2];
      const alpha=src[pidx+3];

      if(alpha<128){
        work[pidx+0]=clamp(fR);
        work[pidx+1]=clamp(fG);
        work[pidx+2]=clamp(fB);
        work[pidx+3]=clamp(255*Math.min(1,str*1.5));
      } else {
        const tL=0.299*src[pidx]+0.587*src[pidx+1]+0.114*src[pidx+2];
        const sL=0.299*fR+0.587*fG+0.114*fB;
        const lr=sL>1?Math.min(tL/sL,1.8):1;
        work[pidx+0]=clamp(src[pidx+0]*(1-str)+fR*lr*str);
        work[pidx+1]=clamp(src[pidx+1]*(1-str)+fG*lr*str);
        work[pidx+2]=clamp(src[pidx+2]*(1-str)+fB*lr*str);
        work[pidx+3]=src[pidx+3];
      }
      // Unmask so inner pixels can use it
      mask[j*ww+i]=0;
    }

    // ── Feather edge ────────────────────────────────────────────────────────────
    const final=new Uint8ClampedArray(work);
    for(let i=0;i<ww;i++) for(let j=0;j<wh;j++){
      const d=Math.sqrt((i-lx)**2+(j-ly)**2);
      if(d<r*0.82||d>r) continue;
      const t=(d-r*0.82)/(r*0.18);
      const p=SI(i,j);
      for(let c=0;c<3;c++) final[p+c]=clamp(work[p+c]*(1-t)+src[p+c]*t);
      if(src[p+3]<128) final[p+3]=clamp(work[p+3]*(1-t));
    }

    ctx.putImageData(new ImageData(final,ww,wh),wx,wy);
  }

  // ✅ PHASE 3: Wet mix — picks up color from canvas and mixes like paint
  function applyWetMixStamp(ctx, x, y, pressure) {
    const canvas = canvasRef.current;
    const r  = Math.round(brushSize*(zoom||1));
    const s  = (brushStrength/100)*(brushFlow/100)*pressure*0.6;
    const sx = Math.max(0,Math.round(x-r)), sy = Math.max(0,Math.round(y-r));
    const sw = Math.min(canvas.width-sx,r*2+1), sh = Math.min(canvas.height-sy,r*2+1);
    if (sw<=0||sh<=0) return;

    const id  = ctx.getImageData(sx,sy,sw,sh);
    const d   = id.data;

    // Sample canvas color under brush center
    const centerData = ctx.getImageData(Math.round(x),Math.round(y),1,1).data;
    const pickR = centerData[0], pickG = centerData[1], pickB = centerData[2];

    // Sample from behind (smear direction)
    const fromX = lastPos.current ? lastPos.current.x : x;
    const fromY = lastPos.current ? lastPos.current.y : y;
    const osx = Math.max(0,Math.round(fromX-r)), osy = Math.max(0,Math.round(fromY-r));
    const osw = Math.min(canvas.width-osx,r*2+1), osh = Math.min(canvas.height-osy,r*2+1);
    if (osw<=0||osh<=0) return;
    const behind = ctx.getImageData(osx,osy,osw,osh);
    const bd     = behind.data;

    for (let i=0;i<sw;i++) for (let j=0;j<sh;j++) {
      const dist=Math.sqrt((sx+i-x)**2+(sy+j-y)**2);
      if (dist>r) continue;
      const falloff=brushEdge==='hard'?1:Math.max(0,1-(dist/r)**1.5);
      const blend=s*falloff;
      const si=Math.min(i,osw-1), sj=Math.min(j,osh-1);
      const idx=(j*sw+i)*4, bidx=(sj*osw+si)*4;

      // Mix: canvas pixel + picked color + behind pixel
      for (let c=0;c<3;c++) {
        const picked = c===0?pickR:c===1?pickG:pickB;
        const wet    = d[idx+c]*0.4 + bd[bidx+c]*0.4 + picked*0.2;
        d[idx+c]     = Math.round(d[idx+c]*(1-blend)+wet*blend);
      }
    }
    ctx.putImageData(id,sx,sy);
  }


  function paintStamp(ctx, x, y, fromX, fromY, pressure) {
    if (brushType==='blur')     applyBlurStamp(ctx,x,y,pressure);
    if (brushType==='smear')    applySmearStamp(ctx,x,y,fromX||x,fromY||y,pressure);
    if (brushType==='sharpen')  applySharpenStamp(ctx,x,y,pressure);
    if (brushType==='airbrush') applyAirbrushStamp(ctx,x,y,pressure);
    if (brushType==='eraser')   applyEraserStamp(ctx,x,y,pressure);
    if (brushType==='clone')    applyCloneStamp(ctx,x,y,pressure);
    if (brushType==='dodge')    applyDodgeStamp(ctx,x,y,pressure);
    if (brushType==='burn')     applyBurnStamp(ctx,x,y,pressure);
    if (brushType==='wetmix')   applyWetMixStamp(ctx,x,y,pressure);
    if (brushType==='paint')    applyPaintStamp(ctx,x,y,pressure,paintColor,paintAlpha);
    if (brushType==='fill')     applyFloodFill(ctx,x,y,paintColor);
  }

  function paintStroke(pos) {
    if (!isReady.current||!canvasRef.current) return;
    const ctx      = canvasRef.current.getContext('2d');
    const pressure = getPressure(pos);
    const stabbed  = getStabilizedPos(pos);
    const r        = Math.round(brushSize*(zoom||1));
    const spacing  = Math.max(1, r*(brushEdge==='hard'?0.2:0.12));

    if (lastPos.current) {
      const stamps = getStamps(lastPos.current, stabbed, spacing);
      stamps.forEach(s=>paintStamp(ctx,s.x,s.y,lastPos.current.x,lastPos.current.y,pressure));
    } else {
      paintStamp(ctx,stabbed.x,stabbed.y,stabbed.x,stabbed.y,pressure);
    }
  }

  function updateCursor(clientX, clientY, visible) {
    const cursor = cursorRef.current;
    if (!cursor) return;
    if (!visible) { cursor.style.display='none'; return; }
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const z      = zoom || 1;
    const r      = brushSize;
    const localX = (clientX - rect.left) / z;
    const localY = (clientY - rect.top)  / z;
    cursor.style.display      = 'block';
    cursor.style.left         = (localX - r) + 'px';
    cursor.style.top          = (localY - r) + 'px';
    cursor.style.width        = (r * 2) + 'px';
    cursor.style.height       = (r * 2) + 'px';
    cursor.style.borderRadius = '50%';
    cursor.style.position     = 'absolute';
    cursor.style.pointerEvents= 'none';
    cursor.style.zIndex       = '99999';
    cursor.style.border       = brushEdge==='soft'
      ? '1.5px solid rgba(255,255,255,0.75)'
      : '1.5px solid rgba(255,255,255,0.95)';
    cursor.style.background   = brushEdge==='soft'
      ? `radial-gradient(circle, rgba(255,255,255,${(brushStrength/100)*0.08}) 0%, transparent 70%)`
      : `rgba(255,255,255,${(brushStrength/100)*0.05})`;
    cursor.style.boxShadow    = '0 0 0 1px rgba(0,0,0,0.5)';
    cursor.style.transition   = 'width 0.06s, height 0.06s';
    if (brushType === 'heal') {
      cursor.style.border = '2px solid rgba(100,220,100,0.9)';
      cursor.style.background = 'rgba(100,220,100,0.08)';
    }
  }

  function onMouseDown(e) {
    e.preventDefault(); e.stopPropagation();
    if (!isReady.current||!active) return;
    if (brushType==='clone'&&e.altKey) { cloneSource.current=getPos(e); return; }
    saveSnap();
    isPainting.current   = true;
    lastPressure.current = 1;
    lastTime.current     = Date.now();
    stabPos.current      = null;
    const pos = getPos(e);
    lastPos.current = pos;
    if (brushType === 'heal') {
      const pos = getPos(e);
      lastHealPos.current = pos;
      lastPos.current = pos;
      saveSnap();
      isPainting.current = true;
      lastPressure.current = 1;
      lastTime.current = Date.now();
      stabPos.current = null;
      if (isReady.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        applyHealStamp(ctx, pos.x, pos.y, 1.0);
      }
      return;
    }
    paintStroke(pos);
  }

  function onMouseMove(e) {
    e.preventDefault();
    const pos = getPos(e);
    updateCursor(e.clientX, e.clientY, true);
    if (!isPainting.current||!active||!isReady.current) return;
    if (brushType === 'heal') {
      lastHealPos.current = pos;
      // ✅ Throttle heal during drag — only fire every 30px of movement
      if (lastPos.current) {
        const dx = pos.x - lastPos.current.x;
        const dy = pos.y - lastPos.current.y;
        const moved = Math.sqrt(dx*dx+dy*dy);
        if (moved >= Math.max(brushSize*(zoom||1)*0.8, 20)) {
          if (isReady.current && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            applyHealStamp(ctx, pos.x, pos.y, getPressure(pos));
          }
          lastPos.current = pos;
        }
      } else {
        lastPos.current = pos;
      }
      return;
    }
    paintStroke(pos);
    lastPos.current = pos;
  }

  function onMouseUp(e) {
    e.preventDefault();
    if (isPainting.current) {
      isPainting.current   = false;
      lastPos.current      = null;
      stabPos.current      = null;
      lastPressure.current = 1;
      // ✅ Run heal on mouseUp only — not during drag
      // This prevents lag since PatchMatch only runs once per click
      if (brushType === 'heal' && isReady.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx    = canvas.getContext('2d');
        if (lastHealPos.current) {
          applyHealStamp(ctx, lastHealPos.current.x, lastHealPos.current.y, 1.0);
        }
      }
      flush();
    }
  }

  function onMouseLeave(e) { updateCursor(0,0,false); onMouseUp(e); }

  if (!active||!layer?.src) return null;

  return (
    <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%' }}>
      <div ref={cursorRef} style={{ display:'none', position:'absolute', pointerEvents:'none', zIndex:99999 }}/>
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        style={{
          position:'absolute', top:0, left:0,
          width:layer.width+'px', height:layer.height+'px',
          cursor:'none', display:'block',
          userSelect:'none', WebkitUserSelect:'none',
        }}
      />
    </div>
  );
});

// ─── Brush Tool Sidebar ─────────────────────────────────────────────────────────
export default function BrushTool({
  layer, theme:T, brushOverlayRef,
  brushType, brushSize, brushStrength, brushEdge,
  brushFlow, brushStabilizer,
  paintColor, paintAlpha,
  onBrushTypeChange, onBrushSizeChange, onBrushStrengthChange,
  onBrushEdgeChange, onBrushFlowChange, onBrushStabilizerChange,
  onPaintColorChange, onPaintAlphaChange,
}) {
  const brushTypes = [
    { key:'blur',     label:'Blur',     icon:'◎', desc:'Softens — good for skin and backgrounds'      },
    { key:'smear',    label:'Smear',    icon:'≋', desc:'Drags pixels — blend edges naturally'         },
    { key:'sharpen',  label:'Sharpen',  icon:'◈', desc:'Crispens detail — use lightly'                },
    { key:'airbrush', label:'Air',      icon:'∴', desc:'Soft scattered spray'                         },
    { key:'dodge',    label:'Dodge',    icon:'☀', desc:'Brightens — add highlights and rim light'     },
    { key:'burn',     label:'Burn',     icon:'◑', desc:'Darkens — add shadows and depth'              },
    { key:'heal',     label:'Heal',     icon:'✚', desc:'Removes blemishes using surrounding texture'  },
    { key:'wetmix',   label:'Wet',      icon:'≈', desc:'Wet mix — picks up and blends color like paint'},
    { key:'eraser',   label:'Erase',    icon:'○', desc:'Erases to transparent'                        },
    { key:'clone',    label:'Clone',    icon:'⊕', desc:'Alt+click to set source, then paint'          },
    { key:'paint',    label:'Paint',    icon:'✏', desc:'Paint with a custom color'                     },
    { key:'fill',     label:'Fill',     icon:'⬛', desc:'Flood fill — click to fill area with color'   },
  ];

  const css = {
    label:   { fontSize:'10px', color:T.muted, marginBottom:4, marginTop:12, letterSpacing:'0.8px', fontWeight:'600', textTransform:'uppercase', display:'block' },
    section: { padding:10, background:T.input, borderRadius:7, border:`1px solid ${T.border}`, marginTop:8 },
    row:     { display:'flex', gap:6, alignItems:'center' },
  };

  const flow       = brushFlow       ?? 100;
  const stabilizer = brushStabilizer ?? 0;

  if (!layer?.src) return (
    <div style={{ ...css.section, marginTop:0, fontSize:11, color:T.muted, lineHeight:1.8 }}>
      Click an image on the canvas to select it, then use brush tools.
    </div>
  );

  return (
    <div>
      <div style={{ ...css.section, marginTop:0, fontSize:11, color:T.success, fontWeight:'600' }}>
        ✓ Image selected — paint on the canvas
      </div>

      <span style={css.label}>Brush type</span>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:4 }}>
        {brushTypes.map(b=>(
          <button key={b.key} onClick={()=>onBrushTypeChange(b.key)} title={b.desc}
            style={{
              padding:'8px 2px', borderRadius:6,
              border:`1px solid ${brushType===b.key?T.accent:T.border}`,
              background: brushType===b.key?`${T.accent}18`:T.input,
              color:      brushType===b.key?T.accent:T.text,
              fontSize:8, cursor:'pointer', fontWeight:brushType===b.key?'700':'400',
              textAlign:'center', lineHeight:1.6, transition:'all 0.1s',
            }}>
            <div style={{ fontFamily:'monospace', fontSize:13, marginBottom:1 }}>{b.icon}</div>
            <div>{b.label}</div>
          </button>
        ))}
      </div>

      {brushType==='clone'&&(
        <div style={{ ...css.section, fontSize:11, color:T.muted, lineHeight:1.6, marginTop:6 }}>
          <strong style={{ color:T.text }}>Alt+click</strong> to set source, then paint.
        </div>
      )}

      {/* Size */}
      <span style={css.label}>Size — {brushSize}px</span>
      <div style={css.row}>
        <input type="range" min="2" max="120" value={brushSize}
          onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);}}
          onPointerMove={e=>{if(e.buttons)onBrushSizeChange(Number(e.currentTarget.value));}}
          onPointerUp={e=>onBrushSizeChange(Number(e.currentTarget.value))}
          onChange={e=>onBrushSizeChange(Number(e.target.value))}
          style={{ flex:1 }}/>
        <span style={{ fontSize:10, color:T.muted, minWidth:32, textAlign:'right' }}>{brushSize}px</span>
      </div>

      {/* ✅ PHASE 2: Opacity (strength) */}
      <span style={css.label}>Opacity — {brushStrength}%</span>
      <div style={css.row}>
        <input type="range" min="1" max="100" value={brushStrength}
          onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);}}
          onPointerMove={e=>{if(e.buttons)onBrushStrengthChange(Number(e.currentTarget.value));}}
          onPointerUp={e=>onBrushStrengthChange(Number(e.currentTarget.value))}
          onChange={e=>onBrushStrengthChange(Number(e.target.value))}
          style={{ flex:1 }}/>
        <span style={{ fontSize:10, color:T.muted, minWidth:32, textAlign:'right' }}>{brushStrength}%</span>
      </div>

      {/* ✅ PHASE 2: Flow — separate from opacity */}
      <span style={css.label}>Flow — {flow}%</span>
      <div style={css.row}>
        <input type="range" min="1" max="100" value={flow}
          onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);}}
          onPointerMove={e=>{if(e.buttons)onBrushFlowChange(Number(e.currentTarget.value));}}
          onPointerUp={e=>onBrushFlowChange(Number(e.currentTarget.value))}
          onChange={e=>onBrushFlowChange(Number(e.target.value))}
          style={{ flex:1 }}/>
        <span style={{ fontSize:10, color:T.muted, minWidth:32, textAlign:'right' }}>{flow}%</span>
      </div>
      <div style={{ fontSize:10, color:T.muted, marginTop:2, marginBottom:2 }}>
        Opacity = max effect. Flow = buildup per stroke.
      </div>

      {/* ✅ PHASE 2: Stabilizer */}
      <span style={css.label}>Stabilizer — {stabilizer}%</span>
      <div style={css.row}>
        <input type="range" min="0" max="95" value={stabilizer}
          onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);}}
          onPointerMove={e=>{if(e.buttons)onBrushStabilizerChange(Number(e.currentTarget.value));}}
          onPointerUp={e=>onBrushStabilizerChange(Number(e.currentTarget.value))}
          onChange={e=>onBrushStabilizerChange(Number(e.target.value))}
          style={{ flex:1 }}/>
        <span style={{ fontSize:10, color:T.muted, minWidth:32, textAlign:'right' }}>{stabilizer}%</span>
      </div>
      <div style={{ fontSize:10, color:T.muted, marginTop:2, marginBottom:2 }}>
        Smooths wobbly lines. High = very smooth curves.
      </div>

      {/* Edge */}
      <span style={css.label}>Edge</span>
      <div style={{ display:'flex', gap:5 }}>
        {['soft','hard'].map(edge=>(
          <button key={edge} onClick={()=>onBrushEdgeChange(edge)}
            style={{
              flex:1, padding:'7px', borderRadius:6,
              border:`1px solid ${brushEdge===edge?T.accent:T.border}`,
              background: brushEdge===edge?`${T.accent}18`:T.input,
              color:      brushEdge===edge?T.accent:T.text,
              fontSize:11, cursor:'pointer',
              fontWeight: brushEdge===edge?'700':'400',
              textTransform:'capitalize',
            }}>{edge}</button>
        ))}
      </div>

      {(brushType==='paint'||brushType==='fill')&&(
        <div>
          <span style={css.label}>Paint color</span>
          <input type="color" value={paintColor||'#ff0000'}
            onChange={e=>onPaintColorChange(e.target.value)}
            style={{width:'100%',height:36,borderRadius:6,
              border:`1px solid ${T.border}`,cursor:'pointer',background:'none'}}/>

          <span style={css.label}>RGB sliders</span>
          <div style={css.section}>
            {(()=>{
              const hex=(paintColor||'#ff0000').replace('#','');
              const vals=[
                parseInt(hex.slice(0,2),16)||0,
                parseInt(hex.slice(2,4),16)||0,
                parseInt(hex.slice(4,6),16)||0,
              ];
              const colors=['#f87171','#4ade80','#60a5fa'];
              const labels=['R','G','B'];
              return labels.map((l,idx)=>(
                <div key={l} style={{...css.row,marginBottom:6}}>
                  <span style={{fontSize:11,color:colors[idx],fontWeight:'700',width:12}}>{l}</span>
                  <input type="range" min={0} max={255} value={vals[idx]}
                    onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);}}
                    onChange={e=>{
                      const newVals=[...vals];
                      newVals[idx]=Number(e.target.value);
                      const newHex='#'+newVals.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
                      onPaintColorChange(newHex);
                    }}
                    style={{flex:1}}/>
                  <span style={{fontSize:10,color:T.text,width:26,textAlign:'right'}}>{vals[idx]}</span>
                </div>
              ));
            })()}
          </div>

          <span style={css.label}>Opacity — {paintAlpha||100}%</span>
          <input type="range" min={1} max={100} value={paintAlpha||100}
            onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);}}
            onChange={e=>onPaintAlphaChange(Number(e.target.value))}
            style={{width:'100%'}}/>

          <div style={{
            width:'100%',height:32,borderRadius:6,
            background:paintColor||'#ff0000',
            opacity:(paintAlpha||100)/100,
            border:`1px solid ${T.border}`,
            marginTop:8,
          }}/>
        </div>
      )}

      <button onClick={()=>brushOverlayRef?.current?.undo()}
        style={{ width:'100%', padding:9, borderRadius:7, border:`1px solid ${T.border}`, background:'transparent', color:T.text, fontSize:12, cursor:'pointer', fontWeight:'600', marginTop:10 }}>
        ↩ Undo stroke
      </button>

      {/* Live preview */}
      <span style={css.label}>Preview</span>
      <div style={{ position:'relative', width:'100%', height:64, borderRadius:8, background:T.bg, border:`1px solid ${T.border}`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{
          width:  Math.min(brushSize*1.4,58),
          height: Math.min(brushSize*1.4,58),
          borderRadius:'50%',
          background: brushEdge==='soft'
            ? `radial-gradient(circle, rgba(108,99,255,${brushStrength/100}) 0%, rgba(108,99,255,${brushStrength/300}) 50%, rgba(108,99,255,0) 100%)`
            : `rgba(108,99,255,${brushStrength/100})`,
          border:'1.5px solid rgba(108,99,255,0.6)',
          transition:'all 0.1s',
          opacity: flow/100,
        }}/>
      </div>

      <div style={{ ...css.section, fontSize:11, color:T.muted, lineHeight:1.6, marginTop:8 }}>
        {brushTypes.find(b=>b.key===brushType)?.desc}
      </div>
    </div>
  );
}