// Export: initParticles({ getElement, throttle, checkReducedMotion }) -> cleanup()
export function initParticles({ getElement, throttle, checkReducedMotion }) {
  
  const canvas = getElement("particleCanvas");
  if (!canvas) return () => {};
  canvas.setAttribute("aria-hidden","true");
  const ctx = canvas.getContext("2d", { alpha: true });

  // ===== Perf-Grundlagen =====
  const DPR = Math.min(2, Math.max(1, Math.ceil(devicePixelRatio || 1)));
  const bgRoot = document.querySelector(".global-particle-background");

  let particles = [];
  let rafId = 0, hidden = false;
  let lastTime = performance.now();
  const fpsSamples = [];
  const stats = (window.__particleStats = window.__particleStats || { fps:0, count:0 });

  // ===== Größe / DPR =====
  const resize = () => {
    const w = innerWidth|0, h = innerHeight|0;
    canvas.width = w * DPR; canvas.height = h * DPR;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.setTransform(DPR,0,0,DPR,0,0);
    invalidateGradients();
    updateScrollMax();
  };

  // ===== Partikel =====
  class Particle {
    constructor(x = Math.random()*innerWidth, y = Math.random()*innerHeight) {
      this.x = x; this.y = y;
      this.s = Math.random()*2 + 1;
      this.vx = (Math.random()*2 - 1) * 0.6;
      this.vy = (Math.random()*2 - 1) * 0.6;
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
    for (let i=0; i<particles.length; i++){
      const p = particles[i];
      const gx = (p.x / cell) | 0, gy = (p.y / cell) | 0;
      const key = keyOf(gx, gy);
      let bucket = grid.get(key);
      if (!bucket) grid.set(key, bucket = []);
      bucket.push(i); // speichere Index statt Objekt
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

  function clamp(v,min,max){ return v<min?min : v>max?max : v; }
  function parseRGBA(str){
    if(!str) return null;
    const m = str.trim().match(/^rgba?\(([^)]+)\)/i);
    if(!m) return null;
    const parts = m[1].split(/\s*,\s*/).map(Number);
    if (parts.length < 3) return null;
    const [r,g,b] = parts; const a = parts[3]!=null ? parseFloat(parts[3]) : 1;
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
    const lerp = (a,b)=> a + (b-a)*t;
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
  let gradLinear = null, gradRadial = null, gradMode = "linear";
  let gradBaseW = 0, gradBaseH = 0, gradBaseR = -1, gradBaseG = -1, gradBaseB = -1;
  function invalidateGradients(){ gradLinear = gradRadial = null; }

  function ensureGradients(dynAlpha){
    const W = canvas.width, H = canvas.height;
    const needRebuild = !gradLinear || W!==gradBaseW || H!==gradBaseH ||
                        (colorCurrent.r|0)!==gradBaseR || (colorCurrent.g|0)!==gradBaseG || (colorCurrent.b|0)!==gradBaseB;

    if (!needRebuild) return;

    gradBaseW = W; gradBaseH = H;
    gradBaseR = colorCurrent.r|0; gradBaseG = colorCurrent.g|0; gradBaseB = colorCurrent.b|0;

    const lighten = (r,g,b,p)=>[
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

    for (let i=0; i<particles.length; i++){ const p = particles[i]; p.update(); p.draw(); }
  }

function drawConnections(){
  // Baseline-Intensität (etwas kräftiger als vorher)
  const baseAlpha = (colorCurrent.aStroke * (0.8 + 0.2 * densityFactor) * scrollFactor);
  const baseWidth = 1.1;   // Grunddicke
  const widthBoost = 1.3;  // Zusatzdicke bei sehr kurzer Distanz

  // Einmalige Stroke-Farbe ohne Alpha (Alpha wird pro Segment via globalAlpha gesetzt)
  const sr = colorCurrent.r | 0, sg = colorCurrent.g | 0, sb = colorCurrent.b | 0;
  ctx.strokeStyle = `rgb(${sr},${sg},${sb})`;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Optional sanfter Glow (deaktiviert; aktivieren = FPS-Kosten)
  // const USE_GLOW = false;
  // if (USE_GLOW) { ctx.shadowColor = `rgba(${sr},${sg},${sb},${Math.min(1, baseAlpha).toFixed(3)})`; ctx.shadowBlur = 3; }

  for (const [k, bucket] of grid){
    const gy = (k >>> 16) & 0xFFFF, gx = k & 0xFFFF;
    const nb = collectNeighborIndices(gx, gy);

    for (let bi = 0; bi < bucket.length; bi++){
      const i = bucket[bi];
      const p = particles[i];

      for (let nbi = 0; nbi < nb.length; nbi++){
        const neighList = nb[nbi];
        for (let bj = 0; bj < neighList.length; bj++){
          const j = neighList[bj];
          if (j <= i) continue; // Paar nur einmal zeichnen

          const q = particles[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const d2 = dx*dx + dy*dy;
          if (d2 >= maxD2) continue;

          // Nähe 0..1 (1 = sehr nah)
          const proximity = 1 - (d2 * invMaxD2);
          if (proximity <= 0) continue;

          // Alpha skaliert mit Nähe (sichtbarer) und Basisintensität
          const segAlpha = Math.min(1, baseAlpha * (0.55 + 0.45 * proximity)); // 55–100% von baseAlpha
          ctx.globalAlpha = segAlpha;

          // Strichstärke skaliert mit Nähe
          ctx.lineWidth = baseWidth + widthBoost * proximity;

          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }
  }

  // Reset
  ctx.globalAlpha = 1;
  // if (USE_GLOW) { ctx.shadowBlur = 0; }
}

  // ===== Loop =====
  function animationLoop(){
    if (hidden) { rafId = requestAnimationFrame(animationLoop); return; }

    const now = performance.now();
    const dt = (now - lastTime) || 16.7; lastTime = now;
    const fps = 1000 / dt;
    fpsSamples.push(fps); if (fpsSamples.length > 20) fpsSamples.shift();
    if (fpsSamples.length === 20){
      const avg = fpsSamples.reduce((a,b)=>a+b,0)/20;
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

  document.addEventListener("visibilitychange", () => { hidden = document.hidden; }, { passive:true });
  addEventListener("resize", throttle(() => { cancelAnimationFrame(rafId); resize(); ensureParticleCount(targetCount); animationLoop(); }, 180), { passive:true });

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