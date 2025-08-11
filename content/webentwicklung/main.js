// Main Initialisierung
// Enthält:
//  - Dynamische Imports (typing Module) mit Fallback debounce/throttle
//  - Partikel-System (adaptiv: FPS-gestützte Dichte, Stats Export window.__particleStats)
//  - Greeting Text Zufallsauswahl
//  - Projekt-Filter, Smooth Scroll, BackToTop
//  - Loader / Snap-Scroll Schutz
//  - Hero Sichtbarkeits-Observer -> body.hero-active
//  - Reduce-Motion Persistenz (localStorage 'pref-reduce-motion') & Toggle: window.toggleReducedMotion()
//  - Anim Debug Toggle Helper: window.toggleAnimDebug()
//  - Overlay (in animations.js) liest Partikel-/Animations-Stats
// ===== Dynamic Imports + Fallbacks =====
export function debounce(fn, wait = 200) {
  let t = null;
  let lastArgs = null;
  let lastThis = null;

  function invoke() {
    const args = lastArgs, ctx = lastThis;
    lastArgs = lastThis = null;
    t = null;
    fn.apply(ctx, args || []);
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;
    if (t !== null) clearTimeout(t);
    t = setTimeout(invoke, wait);
  }

  debounced.cancel = () => {
    if (t !== null) {
      clearTimeout(t);
      t = null;
      lastArgs = lastThis = null;
      return true;           // gut für Tests
    }
    return false;
  };

  debounced.flush = () => {
    if (t !== null) {
      clearTimeout(t);
      invoke();
      return true;
    }
    return false;
  };

  debounced.pending = () => t !== null;

  return debounced;
}
};
let throttle = (fn, limit = 250) => {
  let inFlight=false, pending=false, lastArgs, lastThis;
  function run(){ inFlight=true; fn.apply(lastThis,lastArgs); setTimeout(()=>{ inFlight=false; if(pending){ pending=false; run(); } }, limit); }
  return function(...args){ lastArgs=args; lastThis=this; if(inFlight){ pending=true; return; } run(); };
};
let TypeWriter = null;            // dynamisch geladene Klasse
let makeLineMeasurer = null;      // lineMeasurer Factory
let quotes = [];                  // Zitate (quotes-de.js)
let heroDataModule = null;        // lazy import hero-data.js (greetings + configs)

window.__postHeroEnhancements = async function(){
  const hero = document.getElementById('hero');
  if(!hero) return false;
  // Hero Visibility Observer
  (async function(){
    const existing = document.body.__heroObserverAttached;
    if(existing) return; // vermeiden mehrfach
    const rootBody = document.body;
    let cfg = { threshold: [0,0.25,0.5,0.75,1], minActiveRatio: 0.5 };
    try { const mod = await ensureHeroDataModule(); if(mod?.heroObserverConfig) cfg = { ...cfg, ...mod.heroObserverConfig }; }
    catch(e){ console.warn('heroObserverConfig load failed', e); }
    const heroObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if(e.target === hero){
          const active = e.intersectionRatio >= cfg.minActiveRatio;
          rootBody.classList.toggle('hero-active', active);
          const subtitle = document.querySelector('.hero-subtitle');
          if(subtitle){ subtitle.classList.toggle('hero-subtitle--fixed', active); }
        }
      });
    }, { threshold: cfg.threshold });
    heroObs.observe(hero);
    document.body.__heroObserverAttached = true;
  })();
  // Force-start button animations
  (function(){
    if(!window.AnimationSystem) return;
    const rect = hero.getBoundingClientRect();
    if(rect.top < window.innerHeight && rect.bottom > 0){
      const btns = hero.querySelectorAll('.hero-buttons [data-animation].animate-element:not(.is-visible)');
      btns.forEach(el => { if(typeof window.AnimationSystem.replay === 'function') window.AnimationSystem.replay(el); else el.classList.add('is-visible'); });
    }
  })();
  return true;
};

async function loadTypedModules() {
  try {
    const timing = await import('./home/timing.js');
    debounce = timing.debounce || debounce;
    throttle = timing.throttle || throttle;
  } catch (e) { console.error('[typed] timing.js fehlgeschlagen:', e); }

  try {
    const mod = await import('./home/TypeWriter.js');
    TypeWriter = mod.default || mod.TypeWriter || TypeWriter;
  } catch (e) { console.error('[typed] TypeWriter.js fehlgeschlagen:', e); }

  try {
    const lm = await import('./home/lineMeasurer.js');
    makeLineMeasurer = lm.makeLineMeasurer || makeLineMeasurer;
  } catch (e) { console.error('[typed] lineMeasurer.js fehlgeschlagen:', e); }

  try {
    const q = await import('./home/quotes-de.js');
    quotes = q.default || q.quotes || quotes;
  } catch (e) { console.error('[typed] quotes-de.js fehlgeschlagen:', e); }
}

// ===== Particles =====
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animationId;
  let targetCount = 0;
  let dynamic = true;
  let lastFrameTime = performance.now();
  let fpsSamples = [];
  let hidden = false;
  // Export Stats
  window.__particleStats = window.__particleStats || { fps: 0, count: 0 };

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 1;
      this.speedX = Math.random() * 2 - 1;
      this.speedY = Math.random() * 2 - 1;
      this.opacity = Math.random() * 0.5 + 0.2;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x > canvas.width || this.x < 0) this.speedX *= -1;
      if (this.y > canvas.height || this.y < 0) this.speedY *= -1;
    }
    draw() {
      ctx.fillStyle = `rgba(9, 139, 255, ${this.opacity})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function createParticles(countOverride) {
    particles = [];
    const base = Math.min(100, Math.round(window.innerWidth / 10));
    targetCount = countOverride ?? base;
    for (let i = 0; i < targetCount; i++) particles.push(new Particle());
  }
  function adjustParticleDensity(fps){
    if(!dynamic) return;
    if(fps < 45 && targetCount > 25){
      targetCount = Math.max(20, Math.round(targetCount * 0.85));
      createParticles(targetCount);
    } else if(fps > 55 && targetCount < 120){
      targetCount = Math.min(120, Math.round(targetCount * 1.1 + 2));
      createParticles(targetCount);
    }
  }
  let frameToggle = false;
  function animateParticles() {
    if(hidden){ animationId = requestAnimationFrame(animateParticles); return; }
    const now = performance.now();
    const delta = now - lastFrameTime;
    lastFrameTime = now;
    const fps = 1000 / (delta || 1);
    fpsSamples.push(fps); if(fpsSamples.length > 20) fpsSamples.shift();
    if(fpsSamples.length === 20){
      const avg = fpsSamples.reduce((a,b)=>a+b,0)/fpsSamples.length;
      adjustParticleDensity(avg);
  window.__particleStats.fps = avg;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    // Verbindungslinien nur jedes zweite Frame zur Lastreduktion
    frameToggle = !frameToggle;
    if(frameToggle){
      particles.forEach((p, i) => {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = p.x - particles[j].x, dy = p.y - particles[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < 100) {
            ctx.strokeStyle = `rgba(9,139,255,${0.1 * (1 - dist / 100)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      });
    }
    animationId = requestAnimationFrame(animateParticles);
  }
  resizeCanvas();
  createParticles();
  window.__particleStats.count = targetCount;
  animateParticles();
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
  });
  window.addEventListener('resize', throttle(() => {
    cancelAnimationFrame(animationId);
    resizeCanvas();
  createParticles(targetCount);
    window.__particleStats.count = targetCount;
    animateParticles();
  }, 250));
}

// ===== Greeting (Zeit-basiert) ausgelagert in hero-data.js =====
async function ensureHeroDataModule(){
  if(heroDataModule) return heroDataModule;
  try {
    heroDataModule = await import('./home/hero-data.js');
  } catch(err){ console.error('[hero-data] hero-data.js Import fehlgeschlagen', err); heroDataModule = {}; }
  return heroDataModule;
}
async function setRandomGreetingHTML(animated = false) {
  const el = document.getElementById('greetingText');
  if (!el) return;
  const mod = await ensureHeroDataModule();
  const set = mod.getGreetingSet ? mod.getGreetingSet() : [];
  const pick = mod.pickGreeting ? mod.pickGreeting(el.dataset.last, set) : '';
  if(!pick) return;
  el.dataset.last = pick;
  if (animated) {
    el.classList.add('fade');
    setTimeout(() => { el.textContent = pick; el.classList.remove('fade'); }, 400);
  } else {
    el.textContent = pick;
  }
}

// ===== Project Filter =====
function initProjectFilter() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      const filter = button.getAttribute('data-filter');
      projectCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filter === 'all' || category === filter) showCard(card);
        else hideCard(card);
      });
    });
  });
  const activeBtn = document.querySelector('.filter-btn.active') || filterButtons[0];
  if (activeBtn) activeBtn.click();
  function showCard(card) {
    card.style.display = 'block';
    setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'scale(1)'; }, 10);
  }
  function hideCard(card) {
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    setTimeout(() => { card.style.display = 'none'; }, 300);
  }
}

// ===== Smooth Scroll for Anchor Links =====
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const offset = 80;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      }
    });
  });
}

// ===== Scroll Animations & BackToTop =====
function handleScrollEvents() {
  const backToTopBtn = document.getElementById('backToTop');
  if (backToTopBtn) {
    if (window.pageYOffset > 300) backToTopBtn.classList.add('show');
    else backToTopBtn.classList.remove('show');
  }
}
function initScrollAnimations() {
  const backToTopBtn = document.getElementById('backToTop');
  backToTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('aos-animate'); });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('[data-aos]').forEach(el => observer.observe(el));
}

// ===== Menü-Assets =====
function loadMenuAssets() {
  if (!document.getElementById('menu-container')) return;
  if (!document.querySelector('link[href="/content/webentwicklung/menu/menux.css"]')) {
    const menuCss = document.createElement('link');
    menuCss.rel = 'stylesheet';
    menuCss.href = '/content/webentwicklung/menu/menux.css';
    document.head.appendChild(menuCss);
  }
  if (!document.querySelector('script[src="/content/webentwicklung/menu/menu.js"]')) {
    const menuScript = document.createElement('script');
    menuScript.src = '/content/webentwicklung/menu/menu.js';
    menuScript.defer = true;
    document.body.appendChild(menuScript);
  }
}

// ===== Loader State =====
let __modulesReady = false;
let __windowLoaded = false;
let __loaderStart = 0;
const __MIN_LOADER_MS = 700; // Mindestanzeige, damit man den Loader sieht

// ===== Loading Screen (robust) =====
function hideLoadingScreen() {
  const el = document.getElementById('loadingScreen');
  if (!el) return;
  el.classList.add('hide');
  el.setAttribute('aria-hidden', 'true');
  // Hard inline styles als Fallback, falls CSS-Klasse fehlt
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  el.style.visibility = 'hidden';
  // Nach Transition endgültig aus dem Layout nehmen
  const remove = () => {
    el.style.display = 'none';
    el.removeEventListener('transitionend', remove);
  };
  el.addEventListener('transitionend', remove);
  setTimeout(remove, 700); // Fallback, falls keine Transition feuert
  // Nach dem Verstecken: Animations-Gate freigeben
  try {
    window.AnimationSystem?.releaseLoadingGate?.();
  } catch(err) {
    console.warn('releaseLoadingGate failed', err);
  }
}

// ===== Main =====
document.addEventListener('DOMContentLoaded', async () => {
  // Loading screen: sichtbar lassen, bis Module + window load fertig sind
  __loaderStart = performance.now();

  function tryHideLoader() {
    // nur schließen, wenn Module geladen
    if (!__modulesReady) return;
    // warte bis window "load" oder readyState complete (Assets geladen)
    if (!__windowLoaded && document.readyState !== 'complete') return;
    const elapsed = performance.now() - __loaderStart;
    const wait = Math.max(0, __MIN_LOADER_MS - elapsed);
    setTimeout(hideLoadingScreen, wait);
  }

  window.addEventListener('load', () => { __windowLoaded = true; tryHideLoader(); });

  // Module laden (dynamisch). Wenn fertig, erneut prüfen.
  await loadTypedModules();
  __modulesReady = true;
  tryHideLoader();

  // Nach Laden der Module: Hero Typing Initialisierung verfügbar machen (neu ausgelagert in TypeWriter.js)
  window.__initTyping = function(){
    return import('./home/TypeWriter.js').then(mod => {
      if(typeof mod.initHeroSubtitle === 'function'){
        return mod.initHeroSubtitle({
          ensureHeroDataModule,
          makeLineMeasurer,
            quotes,
          TypeWriterClass: TypeWriter
        });
      }
      console.warn('initHeroSubtitle nicht gefunden');
      return false;
    });
  };

  // Hard fallback, falls irgendwas schiefgeht
  setTimeout(hideLoadingScreen, 5000);

  // Prevent overscroll/bounce NUR am ersten Snap und letzten (Footer)
  (function () {
    function getSnapBounds() {
      const sections = Array.from(document.querySelectorAll('.section'));
      let first = sections[0] || document.querySelector('#hero') || document.body;
      let last  = sections[sections.length - 1] || document.querySelector('footer') || document.body;
      const realFooter = document.querySelector('footer');
      if (realFooter) last = realFooter;
      return { first, last };
    }
    function atTopOfFirst() {
      const { first } = getSnapBounds();
      const top = Math.max(0, first?.offsetTop || 0);
      return window.scrollY <= top + 1;
    }
    function atBottomOfLast() {
      const { last } = getSnapBounds();
      const lastTop = last?.offsetTop || 0;
      const lastBottom = lastTop + (last?.offsetHeight || 0);
      const viewBottom = window.scrollY + window.innerHeight;
      return viewBottom >= lastBottom - 1;
    }
    // Desktop
    window.addEventListener('wheel', (e) => {
      const dy = e.deltaY;
      if ((dy < 0 && atTopOfFirst()) || (dy > 0 && atBottomOfLast())) e.preventDefault();
    }, { passive: false });
    // Touch
    let startY = 0;
    window.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      const y = e.touches[0].clientY;
      const goingDown = y > startY;
      const goingUp   = y < startY;
      if ((goingDown && atTopOfFirst()) || (goingUp && atBottomOfLast())) e.preventDefault();
    }, { passive: false });
  })();

  // ===== Typing initialisieren (ausgelagert in TypeWriter.js) =====
  window.__initTyping();

  // Greeting
  setRandomGreetingHTML();

  // Particles
  // initParticles moved to global for hero lazy load reuse
  initParticles();

  // Project-Filter
  initProjectFilter();

  // Scroll / Intersection / BackToTop
  initScrollAnimations();

  // Performance: Scroll-Handler (nach geladener timing.js)
  window.addEventListener('scroll', debounce(handleScrollEvents, 75));

  // Smooth Anchor Scroll
  initSmoothScroll();

  // Hero Sichtbarkeits-Observer -> body.hero-active toggeln
  window.__postHeroEnhancements();

  // Reduce Motion Toggle
  (function(){
    const body = document.body;
    // Initial aus Persistenz / Systempräferenz
    let initial = false;
    try {
      const saved = localStorage.getItem('pref-reduce-motion');
      if(saved === '1') initial = true; else if(saved === null){
        // Fallback auf prefers-reduced-motion
        initial = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }
    } catch(err) {
      if(window.AnimationSystem?.isDebug?.()) window.AnimationSystem.dlog('localStorage read error', err);
    }
    if(initial) body.classList.add('reduce-motion');
    window.toggleReducedMotion = function(force){
      const val = force !== undefined ? force : !body.classList.contains('reduce-motion');
      body.classList.toggle('reduce-motion', !!val);
      try { localStorage.setItem('pref-reduce-motion', body.classList.contains('reduce-motion') ? '1' : '0'); } catch(err) {
        if(window.AnimationSystem?.isDebug?.()) window.AnimationSystem.dlog('localStorage write error', err);
      }
      if(window.AnimationSystem?.isDebug?.()){
        window.AnimationSystem.dlog('reduce-motion =', body.classList.contains('reduce-motion'));
      }
    };
  })();

  // Global Debug Toggle Helper
  window.toggleAnimDebug = function(force){
    if(!window.AnimationSystem) return;
    const target = force !== undefined ? !!force : !window.AnimationSystem.isDebug();
    window.AnimationSystem.setDebug(target);
  };

  // AOS-Delays
  document.querySelectorAll('[data-aos]').forEach((el, idx) => {
    if (!el.hasAttribute('data-aos-delay')) el.setAttribute('data-aos-delay', idx * 50);
  });

  // Menü dynamisch nachladen
  loadMenuAssets();

  // Force-Start für Hero-Button Animationen beim direkten Seitenaufruf (ohne Scroll)
  // Falls Hero später nachgeladen wird erneut durch hero.js aufrufbar

});

// Für Tests exportieren
if (typeof module !== 'undefined') {
  module.exports = { debounce, throttle };
}

