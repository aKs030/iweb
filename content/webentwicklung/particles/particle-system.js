// Particle System (ausgelagert)
// Exportierte Fabrikfunktion initParticles(getElement, throttle, checkReducedMotion)
// Rückgabe: cleanup Funktion
export function initParticles({ getElement, throttle, checkReducedMotion }) {
  const canvas = getElement("particleCanvas");
  if (!canvas) return () => {};
  canvas.setAttribute('aria-hidden','true');
  const ctx = canvas.getContext("2d");
  const DPR = Math.max(1, Math.floor(devicePixelRatio || 1));
  const grid = new Map();
  let particles = [], rafId, targetCount = 0, lastTime = performance.now(), fpsSamples = [], hidden = false;
  const stats = (window.__particleStats = window.__particleStats || { fps:0, count:0 });

  const resize = () => {
    const w = innerWidth|0, h = innerHeight|0;
    canvas.width = w * DPR; canvas.height = h * DPR;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.setTransform(DPR,0,0,DPR,0,0);
  };

  class Particle {
    constructor(){
      this.x = Math.random()*innerWidth;
      this.y = Math.random()*innerHeight;
      this.s = Math.random()*2+1;
      this.vx = Math.random()*2-1;
      this.vy = Math.random()*2-1;
    }
    update(){
      this.x += this.vx; this.y += this.vy;
      if(this.x>innerWidth || this.x<0) this.vx *= -1;
      if(this.y>innerHeight|| this.y<0) this.vy *= -1;
    }
    draw(){ ctx.beginPath(); ctx.arc(this.x,this.y,this.s,0,Math.PI*2); ctx.fill(); }
  }

  function allocate(count){
    targetCount = count ?? Math.min(100, (innerWidth/10)|0);
    particles = Array.from({ length: targetCount }, () => new Particle());
    stats.count = targetCount;
  }
  function adaptParticleCount(fps){
    if (fps < 45 && targetCount > 25) allocate(Math.max(20, (targetCount*0.85)|0));
    else if (fps > 58 && targetCount < 140) allocate(Math.min(140, ((targetCount*1.12+2)|0)));
  }

  const cell = 96, maxD = 110, maxD2 = maxD*maxD;
  function collectNeighbors(gx, gy){
    const out = [];
    for (let yy=-1; yy<=1; yy++) for (let xx=-1; xx<=1; xx++) {
      const bucket = grid.get((gx+xx)+":"+(gy+yy));
      if (bucket) out.push(...bucket);
    }
    return out;
  }
  function fillSpatialGrid(){
    grid.clear();
    for (const p of particles){
      const gx = (p.x / cell)|0, gy = (p.y / cell)|0, key = gx+":"+gy;
      const bucket = grid.get(key);
      if (bucket) bucket.push(p); else grid.set(key,[p]);
    }
  }

  // Dynamische Faktoren
  let densityFactor = 1, scrollFactor = 1;
  function computeDynamicFactors(){
    const bucketCount = grid.size || 1;
    let total = 0; for (const [,b] of grid) total += b.length;
    const avg = total / bucketCount;
    densityFactor = Math.min(1, (avg / (targetCount / 18)) );
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const y = window.scrollY / maxScroll;
    scrollFactor = 1 - y * 0.55;
  }

  // Farblogik
  let colorCurrent = { r:9, g:139, b:255, aFill:0.8, aStroke:0.25 };
  let colorTarget = { ...colorCurrent };
  let colorTweenStart = 0;
  const COLOR_TWEEN_MS = 420;
  const reduceMotion = checkReducedMotion();
  function clamp(v,min,max){ if(v<min) return min; if(v>max) return max; return v; }
  function parseRGBA(str){
    if(!str) return null; const m = str.trim().match(/^rgba?\(([^)]+)\)/i); if(!m) return null;
    const parts = m[1].split(/\s*,\s*/).map(Number); if(parts.length<3) return null;
    const [r,g,b] = parts; const a = parts[3]!=null?parseFloat(parts[3]):1;
    if([r,g,b].some(x=>isNaN(x))) return null; return { r:clamp(r,0,255), g:clamp(g,0,255), b:clamp(b,0,255), a:clamp(a,0,1) };
  }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function updateTargetColor(){
    const root = document.querySelector('.global-particle-background'); if(!root) return;
    const css = getComputedStyle(root).getPropertyValue('--particle-color') || 'rgba(9,139,255,0.8)';
    const p = parseRGBA(css); if(!p) return;
    colorTarget = { r:p.r, g:p.g, b:p.b, aFill:p.a, aStroke: p.a * 0.32 };
    if(reduceMotion) colorCurrent = { ...colorTarget }; else colorTweenStart = performance.now();
  }
  const observer = new MutationObserver(muts => { for(const m of muts){ if(m.type==='attributes' && m.attributeName.startsWith('data-')){ updateTargetColor(); break; } } });
  const bgEl = document.querySelector('.global-particle-background'); if(bgEl) observer.observe(bgEl,{ attributes:true });
  window.addEventListener('snapSectionChange', updateTargetColor);
  updateTargetColor();
  function applyTween(){
    if(reduceMotion || colorCurrent === colorTarget) return;
    const t = clamp((performance.now() - colorTweenStart)/COLOR_TWEEN_MS,0,1);
    if(t>=1){ colorCurrent = { ...colorTarget }; return; }
    colorCurrent = {
      r: lerp(colorCurrent.r, colorTarget.r, t),
      g: lerp(colorCurrent.g, colorTarget.g, t),
      b: lerp(colorCurrent.b, colorTarget.b, t),
      aFill: lerp(colorCurrent.aFill, colorTarget.aFill, t),
      aStroke: lerp(colorCurrent.aStroke, colorTarget.aStroke, t)
    };
  }

  function drawConnections(){
    const dynStrokeA = (colorCurrent.aStroke *  (0.5 + 0.5*densityFactor) * scrollFactor);
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${colorCurrent.r|0},${colorCurrent.g|0},${colorCurrent.b|0},${dynStrokeA.toFixed(3)})`;
    for (const [key,bucket] of grid){
      const [gx,gy] = key.split(":").map(Number);
      const list = collectNeighbors(gx,gy);
      for(const p of bucket){
        for(const q of list){
          if(p===q) continue;
          const dx=p.x-q.x, dy=p.y-q.y, d2=dx*dx+dy*dy;
          if(d2<maxD2){
            const a = 1 - Math.sqrt(d2)/maxD; ctx.globalAlpha = a*0.35;
            ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke();
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function updateAndDrawParticles(){
    const dynFillA = colorCurrent.aFill * (0.65 + 0.35*scrollFactor) * (0.7 + 0.3*densityFactor);
    // Gradient Cache (linear & radial)
    if(!updateAndDrawParticles._grad || updateAndDrawParticles._w!==canvas.width || updateAndDrawParticles._h!==canvas.height || updateAndDrawParticles._baseR!==(colorCurrent.r|0) || updateAndDrawParticles._baseG!==(colorCurrent.g|0) || updateAndDrawParticles._baseB!==(colorCurrent.b|0)){
      const g = ctx.createLinearGradient(0,0,0,canvas.height);
      const lighten = (r,g,b,p)=>[
        Math.min(255,(r+(255-r)*p))|0,
        Math.min(255,(g+(255-g)*p))|0,
        Math.min(255,(b+(255-b)*p))|0
      ];
      const [lr,lg,lb] = lighten(colorCurrent.r,colorCurrent.g,colorCurrent.b,0.18);
      const topA = Math.min(1,dynFillA*1.05);
      g.addColorStop(0,`rgba(${lr},${lg},${lb},${topA.toFixed(3)})`);
      g.addColorStop(0.55,`rgba(${colorCurrent.r|0},${colorCurrent.g|0},${colorCurrent.b|0},${dynFillA.toFixed(3)})`);
      g.addColorStop(1,`rgba(${colorCurrent.r|0},${colorCurrent.g|0},${colorCurrent.b|0},${(dynFillA*0.55).toFixed(3)})`);
      updateAndDrawParticles._grad = g;
      updateAndDrawParticles._w = canvas.width; updateAndDrawParticles._h = canvas.height;
      updateAndDrawParticles._baseR = colorCurrent.r|0; updateAndDrawParticles._baseG = colorCurrent.g|0; updateAndDrawParticles._baseB = colorCurrent.b|0;
    }
    const bgRoot = document.querySelector('.global-particle-background');
    let mode = bgRoot?.getAttribute('data-particle-gradient') || 'linear';
    let alphaScaleAttr = bgRoot?.getAttribute('data-particle-alpha-scale');
    const alphaScale = alphaScaleAttr ? Math.min(2, Math.max(0.2, parseFloat(alphaScaleAttr))) : 1;
    const finalFillA = dynFillA * alphaScale;
    if(mode==='radial'){
      if(!updateAndDrawParticles._gradR || updateAndDrawParticles._mode!=='radial' || updateAndDrawParticles._w!==canvas.width || updateAndDrawParticles._h!==canvas.height || updateAndDrawParticles._baseR!==(colorCurrent.r|0) || updateAndDrawParticles._baseG!==(colorCurrent.g|0) || updateAndDrawParticles._baseB!==(colorCurrent.b|0)){
        const radius = Math.max(canvas.width, canvas.height)*0.65;
        const rg = ctx.createRadialGradient(canvas.width/2,canvas.height/2,radius*0.05, canvas.width/2,canvas.height/2,radius);
        rg.addColorStop(0,`rgba(${colorCurrent.r|0},${colorCurrent.g|0},${colorCurrent.b|0},${Math.min(1,finalFillA*1.05).toFixed(3)})`);
        rg.addColorStop(0.55,`rgba(${colorCurrent.r|0},${colorCurrent.g|0},${colorCurrent.b|0},${finalFillA.toFixed(3)})`);
        rg.addColorStop(1,`rgba(${colorCurrent.r|0},${colorCurrent.g|0},${colorCurrent.b|0},${(finalFillA*0.25).toFixed(3)})`);
        updateAndDrawParticles._gradR = rg; updateAndDrawParticles._mode='radial';
      }
      ctx.fillStyle = updateAndDrawParticles._gradR;
    } else {
      updateAndDrawParticles._mode='linear';
      ctx.fillStyle = updateAndDrawParticles._grad;
    }
    for (const p of particles){ p.update(); p.draw(); }
  }

  function animationLoop(){
    if(hidden){ rafId=requestAnimationFrame(animationLoop); return; }
    const now = performance.now();
    const fps = 1000/((now-lastTime)||1); lastTime=now;
    fpsSamples.push(fps); if(fpsSamples.length>20) fpsSamples.shift();
    if(fpsSamples.length===20){ const avg=fpsSamples.reduce((a,b)=>a+b,0)/20; adaptParticleCount(avg); stats.fps=avg; }
    ctx.clearRect(0,0,canvas.width,canvas.height);
    applyTween();
    computeDynamicFactors();
    updateAndDrawParticles();
    fillSpatialGrid();
    drawConnections();
    rafId=requestAnimationFrame(animationLoop);
  }

  resize(); allocate(); animationLoop();
  const io=new IntersectionObserver(es=>{ for(const e of es){ hidden = !e.isIntersecting || document.hidden; } },{ threshold:0 });
  io.observe(canvas);
  document.addEventListener("visibilitychange", ()=> hidden=document.hidden);
  addEventListener("resize", throttle(()=>{ cancelAnimationFrame(rafId); resize(); allocate(targetCount); animationLoop(); },180), { passive:true });

  const api = {
    setColor(rgba){
      const root = document.querySelector('.global-particle-background');
      if(root){ root.style.setProperty('--particle-color', rgba); updateTargetColor(); }
    },
    setGradientMode(mode){
      const root = document.querySelector('.global-particle-background');
      if(root) root.setAttribute('data-particle-gradient', mode === 'radial' ? 'radial':'linear');
    },
    setAlphaScale(f){
      const root = document.querySelector('.global-particle-background');
      if(root) root.setAttribute('data-particle-alpha-scale', String(Math.min(2, Math.max(0.2, parseFloat(f)))));
    },
    stop(){ cancelAnimationFrame(rafId); particles.length=0; grid.clear(); io.disconnect(); observer.disconnect(); }
  };
  return api.stop;





  
}

// Optional global für legacy Aufrufe
if(!window.initParticles){ window.initParticles = (deps) => initParticles(deps); }


