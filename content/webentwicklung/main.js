(() => {
  "use strict";

  // ===== Utils =====
  const debounce = (fn, wait=200) => { let t; const d=function(...a){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a),wait); }; d.cancel=()=>clearTimeout(t); return d; };
  const throttle = (fn, limit=250) => { let busy=false, pend=false, ctx, args; const run=()=>{ busy=true; fn.apply(ctx,args); setTimeout(()=>{ busy=false; if(pend){ pend=false; run(); } }, limit); }; return function(...a){ ctx=this; args=a; busy ? (pend=true) : run(); }; };

  let TypeWriter=null, makeLineMeasurer=null, quotes=[], heroData=null;

  window.__postHeroEnhancements = async () => {
    try { await import("../../pages/home/hero-runtime.js"); window.__initHeroRuntime?.(); return true; }
    catch { return false; }
  };

  async function loadTyped() {
    const mods = [
      ["../../pages/home/timing.js",       m => { if (m.debounce) window.debounce=m.debounce; if (m.throttle) window.throttle=m.throttle; }],
      ["../../pages/home/TypeWriter.js",   m => { TypeWriter = m.default || m.TypeWriter || TypeWriter; }],
      ["../../pages/home/lineMeasurer.js", m => { makeLineMeasurer = m.makeLineMeasurer || makeLineMeasurer; }],
      ["../../pages/home/quotes-de.js",    m => { quotes = m.default || m.quotes || quotes; }],
    ];
    for (const [p, h] of mods) { try { h(await import(p)); } catch {} }
  }

  // ===== Particles (DPR + Spatial Hash, Map-Reuse) =====
  function initParticles(){
    const c = document.getElementById("particleCanvas"); if(!c) return () => {};
    const ctx = c.getContext("2d");
    const DPR = Math.max(1, Math.floor(devicePixelRatio || 1));
    const grid = new Map(); // wiederverwenden
    let parts=[], raf, target=0, last=performance.now(), fpsQ=[], hidden=false;

    const stats = (window.__particleStats = window.__particleStats || { fps:0, count:0 });

    const resize = () => {
      const w = innerWidth|0, h = innerHeight|0;
      c.width = w*DPR; c.height = h*DPR; c.style.width = w+"px"; c.style.height = h+"px";
      ctx.setTransform(DPR,0,0,DPR,0,0);
    };

    class P{
      constructor(){ this.x=Math.random()*innerWidth; this.y=Math.random()*innerHeight; this.s=Math.random()*2+1; this.vx=Math.random()*2-1; this.vy=Math.random()*2-1; }
      u(){ (this.x+=this.vx) && (this.y+=this.vy);
           if(this.x>innerWidth||this.x<0) this.vx*=-1;
           if(this.y>innerHeight||this.y<0) this.vy*=-1; }
      d(){ ctx.beginPath(); ctx.arc(this.x,this.y,this.s,0,Math.PI*2); ctx.fill(); }
    }

    const make = n => {
      target = n ?? Math.min(100, (innerWidth/10)|0);
      parts = Array.from({length: target}, () => new P());
      stats.count = target;
    };

    const adjust = fps => {
      if (fps < 45 && target > 25) make(Math.max(20, (target*0.85)|0));
      else if (fps > 58 && target < 140) make(Math.min(140, ((target*1.12+2)|0)));
    };

    const cell = 96, maxD = 110, maxD2 = maxD*maxD;

    const neighbors = (gx, gy) => {
      const out=[]; for(let y=-1;y<=1;y++) for(let x=-1;x<=1;x++){ const b=grid.get((gx+x)+":"+(gy+y)); if(b) out.push(...b); } return out;
    };

    const loop = () => {
      if (hidden) { raf = requestAnimationFrame(loop); return; }

      const now = performance.now(), fps = 1000/((now-last)||1); last = now;
      fpsQ.push(fps); if (fpsQ.length>20) fpsQ.shift();
      if (fpsQ.length===20) { const avg = fpsQ.reduce((a,b)=>a+b,0)/20; adjust(avg); stats.fps = avg; }

      ctx.clearRect(0,0,c.width,c.height);
      ctx.fillStyle = "rgba(9,139,255,.8)";
      for (let i=0;i<parts.length;i++){ const p=parts[i]; p.u(); p.d(); }

      grid.clear();
      for (let i=0;i<parts.length;i++){ const p=parts[i], gx=(p.x/cell)|0, gy=(p.y/cell)|0, key=gx+":"+gy; (grid.get(key)?.push(p)) || grid.set(key, [p]); }

      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(9,139,255,.25)";
      for (const [k, bucket] of grid) {
        const [gx,gy] = k.split(":").map(Number);
        const list = neighbors(gx, gy);
        for (const p of bucket) {
          for (const q of list) {
            if (p===q) continue;
            const dx=p.x-q.x, dy=p.y-q.y, d2=dx*dx+dy*dy;
            if (d2 < maxD2) {
              const a = 1 - Math.sqrt(d2)/maxD; ctx.globalAlpha = a*0.35;
              ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke();
            }
          }
        }
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(loop);
    };

    resize(); make(); loop();
    document.addEventListener("visibilitychange", () => hidden = document.hidden);
    addEventListener("resize", throttle(() => { cancelAnimationFrame(raf); resize(); make(target); loop(); }, 180), { passive:true });

    return () => { cancelAnimationFrame(raf); parts.length=0; grid.clear(); };
  }

  // ===== Greetings =====
  const ensureHeroData = async () => heroData || (heroData = await import("../../pages/home/hero-data.js").catch(()=>({})));
  async function setRandomGreetingHTML(animated=false) {
    const el = document.getElementById("greetingText"); if (!el) return;
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
    const show=c=>{ c.style.display="block"; requestAnimationFrame(()=>{ c.style.opacity="1"; c.style.transform="scale(1)"; }); };
    const hide=c=>{ c.style.opacity="0"; c.style.transform="scale(0.97)"; setTimeout(()=>c.style.display="none",280); };
    buttons.forEach(btn=>btn.addEventListener("click",()=>{ buttons.forEach(b=>b.classList.remove("active")); btn.classList.add("active"); const f=btn.dataset.filter; cards.forEach(card=> (f==="all"||card.dataset.category===f)?show(card):hide(card)); }));
    (document.querySelector(".filter-btn.active")||buttons[0])?.click();
  }

  // ===== Smooth Scroll (achtet auf Reduced Motion) =====
  function initSmoothScroll(){
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    const btn = document.getElementById("backToTop"); if(!btn) return;
    (scrollY>300) ? btn.classList.add("show") : btn.classList.remove("show");
  }
  function initScrollAnimations(){
    document.getElementById("backToTop")?.addEventListener("click", ()=> scrollTo({ top:0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto":"smooth" }));
    const obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add("aos-animate"); }), { threshold:0.1, rootMargin:"0px 0px -50px 0px" });
    document.querySelectorAll("[data-aos]").forEach(el => obs.observe(el));
  }

  // ===== Menü-Assets on demand =====
  function loadMenuAssets(){
    if (!document.getElementById("menu-container")) return;
    if (!document.querySelector('script[src="/content/webentwicklung/menu/menu.js"]')) {
      const s=document.createElement("script"); s.src="/content/webentwicklung/menu/menu.js"; s.defer=true; document.body.appendChild(s);
    }
  }

  // ===== Loader robust =====
  let __modulesReady=false, __windowLoaded=false, __start=0; const __MIN=700;
  function hideLoading(){
    const el=document.getElementById("loadingScreen"); if(!el) return;
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

    await loadTyped(); __modulesReady = true; tryHide();

    window.__initTyping = () => import("../../pages/home/TypeWriter.js")
      .then(m => (typeof m.initHeroSubtitle === "function")
        ? m.initHeroSubtitle({ ensureHeroDataModule: ensureHeroData, makeLineMeasurer, quotes, TypeWriterClass: TypeWriter })
        : false);

    setTimeout(hideLoading, 5000);   // Hard fallback

    // Typing + Greeting
    window.__initTyping();
    setRandomGreetingHTML();

    // Particles
    const stopParticles = initParticles();
    window.__stopParticles = stopParticles;

    // Project-Filter
    initProjectFilter();

    // Scroll/AOS/BackToTop
    initScrollAnimations();
    addEventListener("scroll", debounce(handleScrollEvents, 75), { passive:true });
    handleScrollEvents();

    // Smooth Anchor Scroll
    initSmoothScroll();

    // Hero Enhancements
    window.__postHeroEnhancements();

    // Reduced Motion Toggle & Hero-Button Fallback
    (function(){
      const body=document.body;
      let reduced=false;
      try {
        const saved=localStorage.getItem("pref-reduce-motion");
        reduced = saved==="1" || (saved===null && matchMedia("(prefers-reduced-motion: reduce)").matches);
      } catch {}
      if (reduced) body.classList.add("reduce-motion");
      window.toggleReducedMotion = (force) => {
        const v = force!==undefined ? !!force : !body.classList.contains("reduce-motion");
        body.classList.toggle("reduce-motion", v);
        try { localStorage.setItem("pref-reduce-motion", v ? "1":"0"); } catch {}
      };
      setTimeout(()=> {
        try {
          const hero=document.getElementById("hero"); if(!hero||!window.AnimationSystem) return;
          window.AnimationSystem.scan?.();
          hero.querySelectorAll('.hero-buttons [data-animation="crt"].animate-element:not(.is-visible)')?.forEach(b => b.classList.add("is-visible"));
        } catch {}
      }, 420);
    })();

    // AOS Auto-Delay (nur wenn nicht gesetzt)
    document.querySelectorAll("[data-aos]").forEach((el,i)=> el.hasAttribute("data-aos-delay") || el.setAttribute("data-aos-delay", String(i*50)));

    // Menü nachladen
    loadMenuAssets();
  });

  if (typeof module !== "undefined") module.exports = { debounce, throttle };
})();


