// ESM statischer Import zentraler Utilities
import { debounce, throttle } from '../webentwicklung/utils/common-utils.js';
import { initParticles as _initParticles } from './particles/particle-system.js';
// --- Snap beim aktiven Scrollen temporär ausschalten
let snapTimer = null;
const snapContainer = document.querySelector('.snap-container') || document.documentElement;

const disableSnap = () => snapContainer.classList.add('no-snap');
const enableSnap  = () => snapContainer.classList.remove('no-snap');

const onActiveScroll = () => {
  disableSnap();
  clearTimeout(snapTimer);
  snapTimer = setTimeout(enableSnap, 180); // 120–220ms ist sweet spot
};

addEventListener('wheel', onActiveScroll, { passive: true });
addEventListener('touchmove', onActiveScroll, { passive: true });
addEventListener('keydown', (e) => {
  if (['PageDown','PageUp','Home','End','ArrowDown','ArrowUp','Space'].includes(e.key)) onActiveScroll();
}, { passive: true });
const checkReducedMotion = () => {
  try {
    const saved = localStorage.getItem("pref-reduce-motion");
    return saved === "1" || (saved === null && matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
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
  const initParticles = () => _initParticles({ getElement, throttle, checkReducedMotion });

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

  // ===== BackToTop & AOS =====
  function handleScrollEvents(){
    const btn = getElement("backToTop"); if(!btn) return;
    (scrollY>300) ? btn.classList.add("show") : btn.classList.remove("show");
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

    // Scroll/AOS/BackToTop
    addEventListener("scroll", debounce(handleScrollEvents, 75), { passive:true });
    handleScrollEvents();
    
    
    setTimeout(()=> {
      try {
        const hero=getElement("hero"); if(!hero||!window.AnimationSystem) return;
        window.AnimationSystem.scan?.();
        hero.querySelectorAll('.hero-buttons [data-animation="crt"].animate-element:not(.is-visible)')?.forEach(b => b.classList.add("is-visible"));
      } catch {}
    }, 420);

    // AOS Auto-Delay (nur wenn nicht gesetzt)
    document.querySelectorAll("[data-aos]").forEach((el,i)=> el.hasAttribute("data-aos-delay") || el.setAttribute("data-aos-delay", String(i*50)));

    // Menü nachladen
    loadMenuAssets();
  });

})();


