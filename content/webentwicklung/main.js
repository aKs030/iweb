// ESM statischer Import zentraler Utilities
import { debounce, throttle } from '../webentwicklung/utils/common-utils.js';
const checkReducedMotion = () => {
  try {
    const saved = localStorage.getItem("pref-reduce-motion");
    return saved === "1" || (saved === null && matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
};
const setReducedMotion = (enabled) => {
  document.body.classList.toggle("reduce-motion", enabled);
  try { localStorage.setItem("pref-reduce-motion", enabled ? "1" : "0"); } catch {}
};
const toggleReducedMotion = (force) => {
  const v = force !== undefined ? !!force : !document.body.classList.contains("reduce-motion");
  setReducedMotion(v);
  return v;
};

(() => {
  "use strict";

  let TypeWriter=null, makeLineMeasurer=null, quotes=[], heroData=null;
  
  // ===== Gecachte DOM-Elemente =====
  let cachedElements = {};
  
  const getElement = (id) => {
    if (!cachedElements[id]) {
      cachedElements[id] = document.getElementById(id);
    }
    return cachedElements[id];
  };
  
  const clearElementCache = () => {
    cachedElements = {};
  };

  // Entfernt: hero-runtime.js (Datei gelöscht). Aufrufer prüfen optional auf Existenz.
  // Kein Stub mehr nötig.

  async function loadTyped() {
    const mods = [
      ["../../pages/home/TypeWriter.js",   m => { TypeWriter = m.default || m.TypeWriter || TypeWriter; }],
      ["../../pages/home/lineMeasurer.js", m => { makeLineMeasurer = m.makeLineMeasurer || makeLineMeasurer; }],
      ["../../pages/home/quotes-de.js",    m => { quotes = m.default || m.quotes || quotes; }],
    ];
    for (const [p, h] of mods) { try { h(await import(p)); } catch {} }
  }
  function initLazyHeroModules(){
    let loaded = false;
    const triggerLoad = async () => {
      if (loaded) return;
      loaded = true;
      await loadTyped();
      window.__initTyping?.();
      setRandomGreetingHTML();
    };
    const heroEl = document.getElementById('hero') || document.querySelector('section#hero');
    if (!heroEl) { // Fallback falls kein Hero (oder später dynamisch)
      setTimeout(triggerLoad, 2500);
      return;
    }
    // Falls schon im Viewport
    const rect = heroEl.getBoundingClientRect();
    if (rect.top < innerHeight && rect.bottom > 0) {
      triggerLoad();
      return;
    }
    const obs = new IntersectionObserver(entries => {
      for (const e of entries){
        if (e.isIntersecting){
          obs.disconnect();
            triggerLoad();
          break;
        }
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
    obs.observe(heroEl);
    // Safety Timeout (langsames Scrollen / nie sichtbar)
    setTimeout(triggerLoad, 6000);
  }

  // ===== Particles (DPR + Spatial Hash, Map-Reuse) =====
  function initParticles(){
    const canvas = getElement("particleCanvas");
    if(!canvas) return () => {};
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
      draw(){
        ctx.beginPath();
        ctx.arc(this.x,this.y,this.s,0,Math.PI*2);
        ctx.fill();
      }
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
      for (let yy=-1; yy<=1; yy++) {
        for (let xx=-1; xx<=1; xx++) {
          const bucket = grid.get((gx+xx)+":"+(gy+yy));
          if (bucket) out.push(...bucket);
        }
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

    function drawConnections(){
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(9,139,255,.25)";
      for (const [key, bucket] of grid){
        const [gx,gy] = key.split(":").map(Number);
        const list = collectNeighbors(gx,gy);
        for (const p of bucket){
          for (const q of list){
            if (p === q) continue;
            const dx = p.x - q.x, dy = p.y - q.y, d2 = dx*dx + dy*dy;
            if (d2 < maxD2){
              const a = 1 - Math.sqrt(d2)/maxD; ctx.globalAlpha = a*0.35;
              ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke();
            }
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function updateAndDrawParticles(){
      ctx.fillStyle = "rgba(9,139,255,.8)";
      for (const p of particles){ p.update(); p.draw(); }
    }

    function animationLoop(){
      if (hidden){ rafId = requestAnimationFrame(animationLoop); return; }
      const now = performance.now();
      const fps = 1000 / ((now - lastTime) || 1); lastTime = now;
      fpsSamples.push(fps); if (fpsSamples.length > 20) fpsSamples.shift();
      if (fpsSamples.length === 20){
        const avg = fpsSamples.reduce((a,b)=>a+b,0) / 20;
        adaptParticleCount(avg); stats.fps = avg;
      }
      ctx.clearRect(0,0,canvas.width,canvas.height);
      updateAndDrawParticles();
      fillSpatialGrid();
      drawConnections();
      rafId = requestAnimationFrame(animationLoop);
    }

    resize(); allocate(); animationLoop();
    // Offscreen Pause mittels IntersectionObserver
    const io = new IntersectionObserver(entries => {
      for (const e of entries){
        hidden = !e.isIntersecting || document.hidden;
      }
    }, { threshold: 0, root: null });
    io.observe(canvas);
    document.addEventListener("visibilitychange", () => hidden = document.hidden);
    addEventListener("resize", throttle(() => { cancelAnimationFrame(rafId); resize(); allocate(targetCount); animationLoop(); }, 180), { passive:true });

  return () => { cancelAnimationFrame(rafId); particles.length = 0; grid.clear(); io.disconnect(); };
  }

  // ===== Greetings =====
  const ensureHeroData = async () => heroData || (heroData = await import("../../pages/home/hero-data.js").catch(()=>({})));
  async function setRandomGreetingHTML(animated=false) {
    const el = getElement("greetingText"); if (!el) return;
    const mod = await ensureHeroData();
    const set = mod.getGreetingSet ? mod.getGreetingSet() : [];
    const next = mod.pickGreeting ? mod.pickGreeting(el.dataset.last, set) : "";
    if (!next) return;
    el.dataset.last = next;
    if (animated) { el.classList.add("fade"); setTimeout(() => { el.textContent = next; el.classList.remove("fade"); }, 360); }
    else el.textContent = next;
  }

  // ===== Project Filter =====
  function initProjectFilter(){
    const buttons=[...document.querySelectorAll(".filter-btn")];
    const cards=[...document.querySelectorAll(".project-card")];
    if(!buttons.length||!cards.length) return;

    function show(card){
      card.style.display="block";
      requestAnimationFrame(()=>{
        card.style.opacity="1";
        card.style.transform="scale(1)";
      });
    }
    function hide(card){
      card.style.opacity="0";
      card.style.transform="scale(0.97)";
      setTimeout(()=> card.style.display="none", 280);
    }
    function applyFilter(filter){
      for (const btn of buttons){ btn.classList.toggle("active", btn.dataset.filter === filter); }
      for (const card of cards){
        if (filter === "all" || card.dataset.category === filter) show(card); else hide(card);
      }
    }
    function handleClick(e){
      const btn = e.currentTarget;
      const filter = btn.dataset.filter || "all";
      applyFilter(filter);
    }
    for (const btn of buttons){ btn.addEventListener("click", handleClick); }
    const initial = (document.querySelector(".filter-btn.active") || buttons[0])?.dataset.filter || "all";
    applyFilter(initial);
  }

  // ===== Smooth Scroll (achtet auf Reduced Motion) =====
  function initSmoothScroll(){
    const reduced = checkReducedMotion();
    document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener("click",e=>{
      const href = a.getAttribute("href"); if (!href || href === "#") return;
      const t = document.querySelector(href); if (!t) return;
      e.preventDefault();
      const top = t.getBoundingClientRect().top + pageYOffset - 80;
      reduced ? scrollTo(0, top) : scrollTo({ top, behavior:"smooth" });
    }));
  }

  // ===== BackToTop & AOS =====
  function handleScrollEvents(){
    const btn = getElement("backToTop"); if(!btn) return;
    (scrollY>300) ? btn.classList.add("show") : btn.classList.remove("show");
  }
  function initScrollAnimations(){
    getElement("backToTop")?.addEventListener("click", ()=> scrollTo({ top:0, behavior: checkReducedMotion() ? "auto":"smooth" }));
    const obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add("aos-animate"); }), { threshold:0.1, rootMargin:"0px 0px -50px 0px" });
    document.querySelectorAll("[data-aos]").forEach(el => obs.observe(el));
  }

  // ===== Menü-Assets on demand =====
  function loadMenuAssets(){
    if (!getElement("menu-container")) return;
    if (!document.querySelector('script[src="/content/webentwicklung/menu/menu.js"]')) {
      const s=document.createElement("script"); s.src="/content/webentwicklung/menu/menu.js"; s.defer=true; document.body.appendChild(s);
    }
  }

  // ===== Loader robust =====
  let __modulesReady=false, __windowLoaded=false, __start=0; const __MIN=700;
  function hideLoading(){
    const el=getElement("loadingScreen"); if(!el) return;
    el.classList.add("hide"); el.setAttribute("aria-hidden","true");
    Object.assign(el.style,{ opacity:"0", pointerEvents:"none", visibility:"hidden" });
    const rm=()=>{ el.style.display="none"; el.removeEventListener("transitionend", rm); };
    el.addEventListener("transitionend", rm); setTimeout(rm, 700);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    __start = performance.now();

    const tryHide = () => {
      if (!__modulesReady) return;
      if (!__windowLoaded && document.readyState !== "complete") return;
      const elapsed = performance.now() - __start;
      setTimeout(hideLoading, Math.max(0, __MIN - elapsed));
    };

    addEventListener("load", () => { __windowLoaded = true; tryHide(); }, { once:true });

    // __modulesReady ohne sofortige Hero-Module (Lazy Load)
    __modulesReady = true; tryHide();

    window.__initTyping = () => import("../../pages/home/TypeWriter.js")
      .then(m => (typeof m.initHeroSubtitle === "function")
        ? m.initHeroSubtitle({ ensureHeroDataModule: ensureHeroData, makeLineMeasurer, quotes, TypeWriterClass: TypeWriter })
        : false);

    setTimeout(hideLoading, 5000);   // Hard fallback

    // Lazy Loading Hero Module
    initLazyHeroModules();

    // Particles
  const stopParticles = initParticles();
  window.__stopParticles = stopParticles;
  window.initParticles = initParticles; // für hero.js Aufruf (Kompatibilität)

    // Project-Filter
    initProjectFilter();

    // Scroll/AOS/BackToTop
    initScrollAnimations();
    addEventListener("scroll", debounce(handleScrollEvents, 75), { passive:true });
    handleScrollEvents();

    // Smooth Anchor Scroll
    initSmoothScroll();

  // Hero Enhancements entfernt (hero-runtime.js wurde gelöscht)

    // Reduced Motion Setup
    setReducedMotion(checkReducedMotion());
    window.toggleReducedMotion = toggleReducedMotion;
    
    setTimeout(()=> {
      try {
        const hero=getElement("hero"); if(!hero||!window.AnimationSystem) return;
        window.AnimationSystem.scan?.();
        hero.querySelectorAll('.hero-buttons [data-animation="crt"].animate-element:not(.is-visible)')?.forEach(b => b.classList.add("is-visible"));
      } catch {}
    }, 420);

    // AOS Auto-Delay (nur wenn nicht gesetzt)
    document.querySelectorAll("[data-aos]").forEach((el,i)=> el.hasAttribute("data-aos-delay") || el.setAttribute("data-aos-delay", String(i*50)));

    // Enhanced Scroll Snap Integration (über AnimationSystem)
    window.addEventListener('snapSectionChange', (event) => {
      const { index, section } = event.detail;
      console.log(`Aktuelle Section: ${index}`, section);
      
      // Back-to-Top Button bei letzter Section anzeigen
      const backToTop = getElement('backToTop');
      if (backToTop) {
        backToTop.style.display = index > 0 ? 'flex' : 'none';
      }

      // Optional: Section-spezifische Aktionen
      section.classList.add('section-active');
      // Vorherige aktive Section cleanup
      document.querySelectorAll('.section.section-active').forEach(s => {
        if (s !== section) s.classList.remove('section-active');
      });
    });

    // Menü nachladen
    loadMenuAssets();
  });

  // CommonJS Export entfernt (ESM jetzt aktiv)
})();


