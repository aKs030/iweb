// Helper: load star options from a DOM root (keeps parsing logic out of initParticles)
function loadStarOptions(bgRoot, defaultOpts){
  const opts = { ...defaultOpts };
  let showStars = true;
  if (!bgRoot) return { opts, showStars };
  const sa = bgRoot.getAttribute('data-stars-count'); if (sa) opts.count = Math.max(0, parseInt(sa,10) || opts.count);
  const sp = bgRoot.getAttribute('data-stars-spread'); if (sp) opts.spread = parseFloat(sp) || opts.spread;
  const sh = bgRoot.getAttribute('data-stars-shape'); if (sh) opts.shape = sh;
  const sd = bgRoot.getAttribute('data-stars-seed'); if (sd) opts.seed = parseInt(sd,10) || opts.seed;
  const ss = bgRoot.getAttribute('data-stars-size'); if (ss) opts.size = parseFloat(ss) || opts.size;
  const so = bgRoot.getAttribute('data-stars-opacity'); if (so) opts.opacity = parseFloat(so) || opts.opacity;
  if (bgRoot.getAttribute('data-stars') === 'off') showStars = false;
  return { opts, showStars };
}

// Export: initParticles({ getElement, throttle, checkReducedMotion }) -> cleanup()
import { randomFloat } from '../utils/common-utils.js';

export function initParticles({ getElement, throttle, checkReducedMotion }) {
  
  const canvas = getElement('particleCanvas');
  if (!canvas) return () => {};
  canvas.setAttribute('aria-hidden','true');
  const ctx = canvas.getContext('2d', { alpha: true });

  // ===== Perf-Grundlagen =====
  const DPR = Math.min(2, Math.max(1, Math.ceil(devicePixelRatio || 1)));
  const bgRoot = document.querySelector('.global-particle-background');

  // ===== Stars Layer (optional, using content/webentwicklung/particles/stars-utils.js) =====
  let starPositions = null; // Float32Array
  let starOpts = { count: 800, spread: 6, zBias: -1.5, shape: 'cube', seed: 1337, size: 1.0, opacity: 0.75 };
  let showStars = true;
  // load star options from data-attributes (optional) via helper
  ({ opts: starOpts, showStars } = loadStarOptions(bgRoot, starOpts));

  let starsModulePromise = null;
  function ensureStarsModule(){
    if (!starsModulePromise) {
      starsModulePromise = import('./stars-utils.js');
    }
    return starsModulePromise;
  }

  const particles = [];
  let rafId = 0, hidden = false;
  let lastTime = performance.now();
  const fpsSamples = [];
  const stats = (window.__particleStats = window.__particleStats || { fps:0, count:0 });

  // ===== Größe / DPR =====
  const resize = () => {
    const w = innerWidth|0, h = innerHeight|0;
    canvas.width = w * DPR; canvas.height = h * DPR;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    invalidateGradients();
    updateScrollMax();
    // regenerate stars positions at new size (for 2D rendering we map 3D positions onto canvas)
    if (showStars && !checkReducedMotion()) {
      ensureStarsModule().then(mod => {
        // create star positions in 3D then project to 2D canvas coordinates
        const pos = mod.makeStarPositions({ count: starOpts.count, spread: starOpts.spread, zBias: starOpts.zBias, shape: starOpts.shape, seed: starOpts.seed });
        // map to canvas pixel positions (0..width,0..height) with center origin
        const w2 = innerWidth / 2, h2 = innerHeight / 2;
        const mapped = new Float32Array(pos.length);
        for (let i=0;i<pos.length;i+=3){
          const x = pos[i], y = pos[i+1], z = pos[i+2];
          // simple projection: scale by (1 + z * smallFactor) and offset to center
          const proj = 1 + (z / Math.max(1, starOpts.spread)) * 0.12;
          mapped[i] = w2 + x * (innerWidth / (starOpts.spread*2)) * proj;
          mapped[i+1] = h2 + y * (innerHeight / (starOpts.spread*2)) * proj;
          mapped[i+2] = z;
        }
        starPositions = mapped;
      }).catch(() => { starPositions = null; });
    } else {
      starPositions = null;
    }
  };

  // ===== Partikel =====
  class Particle {
    constructor(x = randomFloat(0, innerWidth), y = randomFloat(0, innerHeight)) {
      this.x = x; this.y = y;
      this.s = randomFloat(0, 2) + 1;
      this.vx = (randomFloat(-1, 1)) * 0.6;
      this.vy = (randomFloat(-1, 1)) * 0.6;
    }
    update(){
      this.x += this.vx; this.y += this.vy;
      // weich wrapen statt bouncen -> weniger Richtungs-Flackern
      if (this.x > innerWidth) this.x -= innerWidth;
      else if (this.x < 0) this.x += innerWidth;
      if (this.y > innerHeight) this.y -= innerHeight;
      else if (this.y < 0) this.y += innerHeight;
    }
    draw(){
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.s, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // dynamische Zielanzahl + sanfte Resize der Liste
  let targetCount = 0;
  function ensureParticleCount(target){
    target = target ?? Math.min(100, (innerWidth/10)|0);
    if (target === targetCount) return;
    if (target > particles.length) {
      for (let i = particles.length; i < target; i++) particles.push(new Particle());
    } else {
      particles.length = target;
    }
    targetCount = target;
    stats.count = targetCount;
  }

  function adaptParticleCount(fps){
    if (fps < 45 && targetCount > 25) {
      ensureParticleCount(Math.max(20, (targetCount*0.85)|0));
    } else if (fps > 58 && targetCount < 140) {
      ensureParticleCount(Math.min(140, ((targetCount*1.12 + 2)|0)));
    }
  }

  // ===== Spatial Grid (schneller) =====
  const cell = 96;
  const maxD = 110, maxD2 = maxD*maxD, invMaxD2 = 1 / maxD2;
  // Key als 32bit-Integer: (gy<<16) | (gx & 0xFFFF)
  const grid = new Map();
  function keyOf(gx, gy){ return ((gy & 0xFFFF) << 16) | (gx & 0xFFFF); }

  function fillSpatialGrid(){
    grid.clear();
    for (const [idx, p] of particles.entries()){
      const gx = (p.x / cell) | 0, gy = (p.y / cell) | 0;
      const key = keyOf(gx, gy);
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(idx); // speichere Index statt Objekt
    }
  }

  // Nachbarschaft sammeln (wiederverwendetes Array)
  const neighbors = [];
  function collectNeighborIndices(gx, gy){
    neighbors.length = 0;
    for (let yy=-1; yy<=1; yy++){
      for (let xx=-1; xx<=1; xx++){
        const b = grid.get(keyOf(gx+xx, gy+yy));
        if (b) neighbors.push(b);
      }
    }
    return neighbors;
  }

  // ===== Dynamische Faktoren (cached scrollMax) =====
  let densityFactor = 1, scrollFactor = 1;
  let scrollMax = 1;
  function updateScrollMax(){
    const doc = document.documentElement;
    scrollMax = Math.max(1, (doc.scrollHeight - innerHeight) | 0);
  }
  function computeDynamicFactors(){
    const bucketCount = grid.size || 1;
    let total = 0; for (const [,b] of grid) total += b.length;
    const avg = total / bucketCount;
    densityFactor = Math.min(1, (avg / (targetCount / 18)) );
    const y = window.scrollY / scrollMax;
    scrollFactor = 1 - y * 0.55;
  }

  // ===== Farblogik (gecached) =====
  let colorCurrent = { r:9, g:139, b:255, aFill:0.8, aStroke:0.25 };
  let colorTarget  = { ...colorCurrent };
  const reduceMotion = checkReducedMotion();
  let colorTweenStart = 0;
  const COLOR_TWEEN_MS = 420;

  function clamp(v,min,max){
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }
  function parseRGBA(str){
    if(!str) return null;
    const m = str.trim().match(/^rgba?\(([^)]+)\)/i);
    if(!m) return null;
    // avoid regex with backtracking by splitting on comma and trimming spaces
    const parts = m[1].split(',').map(s => Number(s.trim()));
    if (parts.length < 3) return null;
    const [r,g,b] = parts; const a = parts[3] !== null && parts[3] !== undefined ? parseFloat(parts[3]) : 1;
    if([r,g,b].some(n => Number.isNaN(n))) return null;
    return { r:clamp(r,0,255), g:clamp(g,0,255), b:clamp(b,0,255), a:clamp(a,0,1) };
  }
  function updateTargetColor(){
    if (!bgRoot) return;
    const css = getComputedStyle(bgRoot).getPropertyValue('--particle-color') || 'rgba(9,139,255,0.8)';
    const p = parseRGBA(css); if (!p) return;
    colorTarget = { r:p.r, g:p.g, b:p.b, aFill:p.a, aStroke: p.a * 0.32 };
    if (reduceMotion) colorCurrent = { ...colorTarget };
    else colorTweenStart = performance.now();
    invalidateGradients();
  }
  function applyTween(now){
    if (reduceMotion) return;
    const t = clamp((now - colorTweenStart)/COLOR_TWEEN_MS,0,1);
    if (t >= 1) { colorCurrent = { ...colorTarget }; return; }
    const lerp = (a,b) => a + (b-a)*t;
    colorCurrent = {
      r: lerp(colorCurrent.r, colorTarget.r),
      g: lerp(colorCurrent.g, colorTarget.g),
      b: lerp(colorCurrent.b, colorTarget.b),
      aFill: lerp(colorCurrent.aFill, colorTarget.aFill),
      aStroke: lerp(colorCurrent.aStroke, colorTarget.aStroke),
    };
  }

  const observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'attributes' && m.attributeName.startsWith('data-')) { updateTargetColor(); break; }
    }
  });
  if (bgRoot) observer.observe(bgRoot,{ attributes:true });

  window.addEventListener('snapSectionChange', updateTargetColor, { passive:true });

  // ===== Verbindungen + Partikel zeichnen =====
  let gradLinear = null, gradRadial = null, gradMode = 'linear';
  let gradBaseW = 0, gradBaseH = 0, gradBaseR = -1, gradBaseG = -1, gradBaseB = -1;
  function invalidateGradients(){ gradLinear = gradRadial = null; }

  function ensureGradients(dynAlpha){
    const W = canvas.width, H = canvas.height;
    const needRebuild = !gradLinear || W!==gradBaseW || H!==gradBaseH ||
                        (colorCurrent.r|0)!==gradBaseR || (colorCurrent.g|0)!==gradBaseG || (colorCurrent.b|0)!==gradBaseB;

    if (!needRebuild) return;

    gradBaseW = W; gradBaseH = H;
    gradBaseR = colorCurrent.r|0; gradBaseG = colorCurrent.g|0; gradBaseB = colorCurrent.b|0;

    const lighten = (r,g,b,p) => [
      Math.min(255,(r+(255-r)*p))|0,
      Math.min(255,(g+(255-g)*p))|0,
      Math.min(255,(b+(255-b)*p))|0
    ];
    const [lr,lg,lb] = lighten(gradBaseR, gradBaseG, gradBaseB, 0.18);

    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, `rgba(${lr},${lg},${lb},${Math.min(1, dynAlpha*1.05).toFixed(3)})`);
    g.addColorStop(0.55, `rgba(${gradBaseR},${gradBaseG},${gradBaseB},${dynAlpha.toFixed(3)})`);
    g.addColorStop(1, `rgba(${gradBaseR},${gradBaseG},${gradBaseB},${(dynAlpha*0.55).toFixed(3)})`);
    gradLinear = g;

    const radius = Math.max(W, H) * 0.65;
    const rg = ctx.createRadialGradient(W/2,H/2,radius*0.05, W/2,H/2,radius);
    rg.addColorStop(0, `rgba(${gradBaseR},${gradBaseG},${gradBaseB},${Math.min(1,dynAlpha*1.05).toFixed(3)})`);
    rg.addColorStop(0.55, `rgba(${gradBaseR},${gradBaseG},${gradBaseB},${dynAlpha.toFixed(3)})`);
    rg.addColorStop(1, `rgba(${gradBaseR},${gradBaseG},${gradBaseB},${(dynAlpha*0.25).toFixed(3)})`);
    gradRadial = rg;
  }

  function updateAndDrawParticles(finalFillA){
    // Gradientwahl aus data-Attributen (einmal pro Frame)
    gradMode = (bgRoot?.getAttribute('data-particle-gradient') === 'radial') ? 'radial' : 'linear';
    const aScaleAttr = bgRoot?.getAttribute('data-particle-alpha-scale');
    const alphaScale = aScaleAttr ? Math.min(2, Math.max(0.2, parseFloat(aScaleAttr))) : 1;
    const dynA = finalFillA * alphaScale;

    ensureGradients(dynA);
    ctx.fillStyle = (gradMode === 'radial') ? gradRadial : gradLinear;

    // Draw stars behind particles (faint points)
    if (starPositions && showStars) {
      const starAlpha = Math.min(1, (starOpts.opacity || 0.7) * (0.6 + 0.4 * scrollFactor));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${colorCurrent.r|0},${colorCurrent.g|0},${colorCurrent.b|0},${starAlpha.toFixed(3)})`;
      const s = Math.max(0.4, (starOpts.size || 1.0));
      for (let i=0;i<starPositions.length;i+=3){
        const sx = starPositions[i], sy = starPositions[i+1];
        // skip off-canvas
        if (sx < -10 || sy < -10 || sx > innerWidth+10 || sy > innerHeight+10) continue;
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const p of particles) { p.update(); p.draw(); }
  }

  function drawConnections(){
  // Baseline-Intensität (etwas kräftiger als vorher)
    const baseAlpha = (colorCurrent.aStroke * (0.8 + 0.2 * densityFactor) * scrollFactor);
    const baseWidth = 1.1;   // Grunddicke
    const widthBoost = 1.3;  // Zusatzdicke bei sehr kurzer Distanz

    // Einmalige Stroke-Farbe ohne Alpha (Alpha wird pro Segment via globalAlpha gesetzt)
    const sr = colorCurrent.r | 0, sg = colorCurrent.g | 0, sb = colorCurrent.b | 0;
    ctx.strokeStyle = `rgb(${sr},${sg},${sb})`;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Optional sanfter Glow (deaktiviert; aktivieren = FPS-Kosten)

    // Helper: decide quickly if two particle indices form a visible connection
    function shouldConnect(i, j, p, q){
    // returns proximity in range 0..1 (0 = no connection)
      if (j <= i) return 0; // only draw pair once
      const dx = p.x - q.x, dy = p.y - q.y;
      const d2 = dx*dx + dy*dy;
      if (d2 >= maxD2) return 0;
      const proximity = 1 - (d2 * invMaxD2);
      return proximity > 0 ? proximity : 0;
    }

    // Helper: draw a single segment given proximity (0..1)
    function drawSegment(p, q, proximity){
      const segAlpha = Math.min(1, baseAlpha * (0.55 + 0.45 * proximity));
      ctx.globalAlpha = segAlpha;
      ctx.lineWidth = baseWidth + widthBoost * proximity;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }

    for (const [k, bucket] of grid){
      const gy = (k >>> 16) & 0xFFFF, gx = k & 0xFFFF;
      const nb = collectNeighborIndices(gx, gy);

      for (const i of bucket){
        const p = particles[i];
        for (const neighList of nb){
          for (const j of neighList){
            const q = particles[j];
            const proximity = shouldConnect(i, j, p, q);
            if (!proximity) continue;
            drawSegment(p, q, proximity);
          }
        }
      }
    }

    // Reset
    ctx.globalAlpha = 1;
  }

  // ===== Loop =====
  function animationLoop(){
    if (hidden) { rafId = requestAnimationFrame(animationLoop); return; }

    const now = performance.now();
    const dt = (now - lastTime) || 16.7; lastTime = now;
    const fps = 1000 / dt;
    fpsSamples.push(fps); if (fpsSamples.length > 20) fpsSamples.shift();
    if (fpsSamples.length === 20){
      const avg = fpsSamples.reduce((a,b) => a+b,0)/20;
      adaptParticleCount(avg);
      stats.fps = avg;
    }

    ctx.clearRect(0,0,canvas.width,canvas.height);

    applyTween(now);
    fillSpatialGrid();
    computeDynamicFactors();

    const dynFillA = colorCurrent.aFill * (0.65 + 0.35*scrollFactor) * (0.7 + 0.3*densityFactor);
    updateAndDrawParticles(dynFillA);
    drawConnections();

    rafId = requestAnimationFrame(animationLoop);
  }

  // ===== Init / Events =====
  const io = new IntersectionObserver(entries => {
    for (const e of entries) hidden = !e.isIntersecting || document.hidden;
  }, { threshold: 0 });
  io.observe(canvas);

  document.addEventListener('visibilitychange', () => { hidden = document.hidden; }, { passive:true });
  addEventListener('resize', throttle(() => { cancelAnimationFrame(rafId); resize(); ensureParticleCount(targetCount); animationLoop(); }, 180), { passive:true });

  // Start
  resize(); ensureParticleCount(); updateTargetColor(); updateScrollMax(); animationLoop();

  // ===== API / Cleanup =====
  const api = {
    setColor(rgba){ if(bgRoot){ bgRoot.style.setProperty('--particle-color', rgba); updateTargetColor(); } },
    setGradientMode(mode){ if(bgRoot) bgRoot.setAttribute('data-particle-gradient', mode === 'radial' ? 'radial' : 'linear'); },
    setAlphaScale(f){ if(bgRoot) bgRoot.setAttribute('data-particle-alpha-scale', String(Math.min(2, Math.max(0.2, parseFloat(f))))); },
    stop(){
      cancelAnimationFrame(rafId);
      particles.length = 0; grid.clear();
      io.disconnect(); observer.disconnect();
      // Canvas leeren
      ctx.clearRect(0,0,canvas.width,canvas.height);
    }
  };
  return api.stop;
}

// Legacy-Fallback
if (!window.initParticles) window.initParticles = (deps) => initParticles(deps);