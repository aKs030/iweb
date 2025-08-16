
/* =============================================
 * content/webentwicklung/main.js
 * Verbesserungen:
 * - Smooth-Scroll respektiert Reduced Motion
 * - Partikel: DPR-Scaling + Gitter-Bucketing (O(n)) statt O(n^2) Verbindungen
 * - Robuster Loader: garantiertes Ausblenden, kein „hängenbleiben“
 * - Kleinkram: sichere Anchor-Links, saubere Listener, Resize-Throttle
 * ============================================= */
(() => {
  "use strict";

  // ===== Utils =====
  const debounce = (fn, wait = 200) => { let t; const d = function(...a){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,a), wait); }; d.cancel=()=>clearTimeout(t); return d; };
  const throttle = (fn, limit = 250) => { let inFlight=false, pend=false, lastA, lastT; const run=()=>{ inFlight=true; fn.apply(lastT,lastA); setTimeout(()=>{ inFlight=false; if(pend){ pend=false; run(); } }, limit); }; return function(...a){ lastA=a; lastT=this; if(inFlight){ pend=true; return; } run(); }; };

  let TypeWriter=null, makeLineMeasurer=null, quotes=[], heroDataModule=null;

  window.__postHeroEnhancements = async function(){
    try { await import('../../pages/home/hero-runtime.js'); window.__initHeroRuntime?.(); return true; }
    catch(e){ console.warn('hero-runtime Import fehlgeschlagen', e); return false; }
  };

  async function loadTypedModules(){
    const tasks = [
      { p:'../../pages/home/timing.js', h: m=>{ if(m.debounce) window.debounce=m.debounce; if(m.throttle) window.throttle=m.throttle; } },
      { p:'../../pages/home/TypeWriter.js', h: m=>{ TypeWriter = m.default || m.TypeWriter || TypeWriter; } },
      { p:'../../pages/home/lineMeasurer.js', h: m=>{ makeLineMeasurer = m.makeLineMeasurer || makeLineMeasurer; } },
      { p:'../../pages/home/quotes-de.js', h: m=>{ quotes = m.default || m.quotes || quotes; } }
    ];
    for (const t of tasks) {
      try { const mod = await import(t.p); t.h(mod); }
      catch(e){ console.error('[import fail]', t.p, e); }
    }
  }

  // ===== Particles (DPR + Spatial Hash) =====
  function initParticles(){
    const canvas = document.getElementById('particleCanvas');
    if(!canvas) return () => {};
    const ctx = canvas.getContext('2d');

    let particles=[]; let id; let targetCount=0; let last=performance.now(); const fpsS=[]; let hidden=false;
    const stats = (window.__particleStats = window.__particleStats || { fps:0, count:0 });

    const DPR = Math.max(1, Math.floor(devicePixelRatio || 1));
    const resize = () => {
      const w = Math.floor(innerWidth);
      const h = Math.floor(innerHeight);
      canvas.width = w * DPR; canvas.height = h * DPR; canvas.style.width = w+"px"; canvas.style.height = h+"px";
      ctx.setTransform(DPR,0,0,DPR,0,0);
    };

    class P{
      constructor(){
        this.x=Math.random()*innerWidth; this.y=Math.random()*innerHeight;
        this.s=Math.random()*2+1; this.vx=(Math.random()*2-1); this.vy=(Math.random()*2-1); this.o=Math.random()*0.5+0.2;
      }
      u(){
        this.x+=this.vx; this.y+=this.vy;
        if(this.x>innerWidth||this.x<0) this.vx*=-1;
        if(this.y>innerHeight||this.y<0) this.vy*=-1;
      }
      d(){ ctx.beginPath(); ctx.arc(this.x,this.y,this.s,0,Math.PI*2); ctx.fill(); }
    }

    const make = cnt => {
      targetCount = cnt ?? Math.min(100, Math.round(innerWidth/10));
      particles = Array.from({length: targetCount}, () => new P());
      stats.count = targetCount;
    };

    const adjust = fps => {
      if(fps<45 && targetCount>25) make(Math.max(20,Math.round(targetCount*0.85)));
      else if(fps>58 && targetCount<140) make(Math.min(140,Math.round(targetCount*1.12+2)));
    };

    const cellSize = 96; // px
    const neighbors = (grid, gx, gy) => {
      const arr = [];
      for(let y=-1;y<=1;y++) for(let x=-1;x<=1;x++){ const bucket = grid.get((gx+x)+":"+(gy+y)); if(bucket) arr.push(...bucket); }
      return arr;
    };

    const loop = () => {
      if(hidden){ id=requestAnimationFrame(loop); return; }
      const now=performance.now(); const fps=1000/((now-last)||1); last=now; fpsS.push(fps); if(fpsS.length>20) fpsS.shift();
      if(fpsS.length===20){ const avg=fpsS.reduce((a,b)=>a+b,0)/fpsS.length; adjust(avg); stats.fps=avg; }

      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = 'rgba(9,139,255,0.8)';
      particles.forEach(p=>{ p.u(); p.d(); });

      // Linien mit Spatial Hash statt O(n^2)
      ctx.lineWidth=1; ctx.strokeStyle='rgba(9,139,255,0.25)';
      const grid = new Map();
      for (let i=0;i<particles.length;i++){
        const p=particles[i];
        const gx = (p.x/cellSize)|0, gy=(p.y/cellSize)|0;
        const key = gx+":"+gy; const bucket = grid.get(key); if(bucket) bucket.push(p); else grid.set(key,[p]);
      }
      const maxDist = 110; const maxDist2 = maxDist*maxDist;
      for (const [key, bucket] of grid){
        const [gx,gy] = key.split(":").map(Number);
        const list = neighbors(grid, gx, gy);
        for (const p of bucket){
          for (const q of list){ if (p===q) continue; const dx=p.x-q.x, dy=p.y-q.y; const d2=dx*dx+dy*dy; if (d2<maxDist2){ const a=1-Math.sqrt(d2)/maxDist; ctx.globalAlpha = a*0.35; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke(); } }
        }
      }
      ctx.globalAlpha = 1;

      id=requestAnimationFrame(loop);
    };

    resize(); make(); loop();
    document.addEventListener('visibilitychange', ()=> hidden=document.hidden);
    addEventListener('resize', throttle(()=>{ cancelAnimationFrame(id); resize(); make(targetCount); loop(); }, 200), { passive: true });

    return () => { cancelAnimationFrame(id); particles.length=0; };
  }

  // ===== Greeting =====
  const ensureHeroDataModule = async()=> heroDataModule || (heroDataModule = await import('../../pages/home/hero-data.js').catch(e=>{ console.error('[hero-data] Import fehlgeschlagen', e); return {}; }));
  async function setRandomGreetingHTML(animated = false) {
    const el = document.getElementById('greetingText'); if (!el) return;
    const mod = await ensureHeroDataModule();
    const set = mod.getGreetingSet ? mod.getGreetingSet() : [];
    const pick = mod.pickGreeting ? mod.pickGreeting(el.dataset.last, set) : '';
    if(!pick) return; el.dataset.last = pick;
    if (animated) { el.classList.add('fade'); setTimeout(() => { el.textContent = pick; el.classList.remove('fade'); }, 360); }
    else { el.textContent = pick; }
  }

  // ===== Project Filter =====
  function initProjectFilter(){
    const buttons=[...document.querySelectorAll('.filter-btn')]; const cards=[...document.querySelectorAll('.project-card')]; if(!buttons.length||!cards.length) return;
    const show=c=>{ c.style.display='block'; requestAnimationFrame(()=>{ c.style.opacity='1'; c.style.transform='scale(1)'; }); };
    const hide=c=>{ c.style.opacity='0'; c.style.transform='scale(0.97)'; setTimeout(()=>c.style.display='none',280); };
    buttons.forEach(btn=>btn.addEventListener('click',()=>{ buttons.forEach(b=>b.classList.remove('active')); btn.classList.add('active'); const f=btn.dataset.filter; cards.forEach(card=> (f==='all'||card.dataset.category===f)?show(card):hide(card)); }));
    (document.querySelector('.filter-btn.active')||buttons[0])?.click();
  }

  // ===== Smooth Scroll (respect reduced motion) =====
  function initSmoothScroll(){
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const t=document.querySelector(href);
      if(!t) return;
      e.preventDefault();
      const top=t.getBoundingClientRect().top+window.pageYOffset-80;
      if (reduced) { window.scrollTo(0, top); }
      else { window.scrollTo({ top, behavior:'smooth'}); }
    }));
  }

  // ===== BackToTop & AOS =====
  function handleScrollEvents(){
    const btn=document.getElementById('backToTop'); if(!btn) return;
    (window.scrollY>300) ? btn.classList.add('show') : btn.classList.remove('show');
  }
  function initScrollAnimations(){
    document.getElementById('backToTop')?.addEventListener('click', ()=> window.scrollTo({ top:0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches? 'auto' : 'smooth'}));
    const obs=new IntersectionObserver(ents=>ents.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('aos-animate'); }), { threshold:0.1, rootMargin:'0px 0px -50px 0px' });
    document.querySelectorAll('[data-aos]').forEach(el=>obs.observe(el));
  }

  // ===== Menü-Assets =====
  function loadMenuAssets(){
    if(!document.getElementById('menu-container')) return;
    if(!document.querySelector('script[src="/content/webentwicklung/menu/menu.js"]')){
      const s=document.createElement('script'); s.src='/content/webentwicklung/menu/menu.js'; s.defer=true; document.body.appendChild(s);
    }
  }

  // ===== Loader =====
  let __modulesReady = false; let __windowLoaded = false; let __loaderStart = 0; const __MIN_LOADER_MS = 700;
  function hideLoadingScreen(){
    const el=document.getElementById('loadingScreen'); if(!el) return;
    el.classList.add('hide'); el.setAttribute('aria-hidden','true'); Object.assign(el.style,{ opacity:'0', pointerEvents:'none', visibility:'hidden'});
    const rm=()=>{ el.style.display='none'; el.removeEventListener('transitionend', rm); };
    el.addEventListener('transitionend', rm); setTimeout(rm,700);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    __loaderStart = performance.now();
    const tryHideLoader = () => {
      if (!__modulesReady) return;
      if (!__windowLoaded && document.readyState !== 'complete') return;
      const elapsed = performance.now() - __loaderStart;
      const wait = Math.max(0, __MIN_LOADER_MS - elapsed);
      setTimeout(hideLoadingScreen, wait);
    };

    window.addEventListener('load', () => { __windowLoaded = true; tryHideLoader(); }, { once: true });

    await loadTypedModules(); __modulesReady = true; tryHideLoader();

    window.__initTyping = ()=> import('../../pages/home/TypeWriter.js').then(m=> typeof m.initHeroSubtitle==='function' ? m.initHeroSubtitle({ ensureHeroDataModule, makeLineMeasurer, quotes, TypeWriterClass: TypeWriter }) : (console.warn('initHeroSubtitle nicht gefunden'), false));

    setTimeout(hideLoadingScreen, 5000);

    // Typing
    window.__initTyping();

    // Greeting
    setRandomGreetingHTML();

    // Particles
    const stopParticles = initParticles();
    window.__stopParticles = stopParticles;

    // Project-Filter
    initProjectFilter();

    // Scroll / Intersection / BackToTop
    initScrollAnimations();
    window.addEventListener('scroll', debounce(handleScrollEvents, 75), { passive: true });
    handleScrollEvents();

    // Smooth Anchor Scroll
    initSmoothScroll();

    // Hero Enhancements
    window.__postHeroEnhancements();

    // Reduce Motion Toggle & Hero Button Fallback
    (function(){
      const body=document.body; let reduced=false;
      try{ const saved=localStorage.getItem('pref-reduce-motion'); reduced = saved==='1' || (saved===null && matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(e){}
      if(reduced) body.classList.add('reduce-motion');
      window.toggleReducedMotion = force => {
        const val = force!==undefined ? force : !body.classList.contains('reduce-motion');
        body.classList.toggle('reduce-motion', !!val);
        try { localStorage.setItem('pref-reduce-motion', body.classList.contains('reduce-motion') ? '1':'0'); } catch(e){}
      };
      setTimeout(()=>{
        try{
          const hero=document.getElementById('hero'); if(!hero||!window.AnimationSystem) return;
          window.AnimationSystem.scan?.();
          hero.querySelectorAll('.hero-buttons [data-animation="crt"].animate-element:not(.is-visible)')?.forEach(btn=> btn.classList.add('is-visible'));
        }catch(err){ console.warn('Hero Button Anim Fallback',err); }
      },420);
    })();

    // AOS-Delays
    document.querySelectorAll('[data-aos]').forEach((el,i)=> el.hasAttribute('data-aos-delay')||el.setAttribute('data-aos-delay', String(i*50)));

    // Menü dynamisch nachladen
    loadMenuAssets();
  });

  if(typeof module!=='undefined') module.exports={ debounce, throttle };
})();
