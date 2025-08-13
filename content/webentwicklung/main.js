// Kern-Initialisierung & Helfer
// Enthält: dynamische Imports, Partikel, Greeting, Filter, Scroll/Loader, Hero-Observer, Reduced Motion, Debug

// ===== Utils =====
const debounce = (fn, wait = 200) => {
  let t;
  const d = function(...a){
    clearTimeout(t);
    t = setTimeout(()=>fn.apply(this,a), wait);
  };
  d.cancel = () => clearTimeout(t);
  return d;
};
const throttle = (fn, limit = 250) => {
  let inFlight=false, pend=false, lastA, lastT;
  const run = () => {
    inFlight = true;
    fn.apply(lastT,lastA);
    setTimeout(()=>{
      inFlight = false;
      if(pend){ pend=false; run(); }
    }, limit);
  };
  return function(...a){
    lastA=a; lastT=this;
    if(inFlight){ pend=true; return; }
    run();
  };
};

let TypeWriter=null, makeLineMeasurer=null, quotes=[], heroDataModule=null;

// Hero Enhancements jetzt ausgelagert (hero-runtime.js)
window.__postHeroEnhancements = async function(){
  try {
    await import('../../pages/home/hero-runtime.js');
    window.__initHeroRuntime?.();
    return true;
  } catch(e){ console.warn('hero-runtime Import fehlgeschlagen', e); return false; }
};

async function loadTypedModules(){
  const tasks = [
    { p:'../../pages/home/timing.js', h: m=>{
      if(m.debounce) window.debounce = m.debounce;
      if(m.throttle) window.throttle = m.throttle;
    } },
    { p:'../../pages/home/TypeWriter.js', h: m=>{ TypeWriter = m.default || m.TypeWriter || TypeWriter; } },
    { p:'../../pages/home/lineMeasurer.js', h: m=>{ makeLineMeasurer = m.makeLineMeasurer || makeLineMeasurer; } },
    { p:'../../pages/home/quotes-de.js', h: m=>{ quotes = m.default || m.quotes || quotes; } }
  ];
  for (const t of tasks){
    try {
      const mod = await import(t.p);
      t.h(mod);
    } catch(e){
      console.error('[import fail]', t.p, e);
    }
  }
}

// ===== Particles =====
function initParticles(){
  const canvas = document.getElementById('particleCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles=[]; let id; let targetCount=0; let last=performance.now(); const fpsS=[]; let hidden=false; let frameToggle=false;
  window.__particleStats = window.__particleStats || { fps:0, count:0 };
  const resize = () => { canvas.width=innerWidth; canvas.height=innerHeight; };
  class P{
    constructor(){
      this.x=Math.random()*canvas.width;
      this.y=Math.random()*canvas.height;
      this.s=Math.random()*2+1;
      this.vx=Math.random()*2-1;
      this.vy=Math.random()*2-1;
      this.o=Math.random()*0.5+0.2;
    }
    u(){
      this.x+=this.vx; this.y+=this.vy;
      if(this.x>canvas.width||this.x<0) this.vx*=-1;
      if(this.y>canvas.height||this.y<0) this.vy*=-1;
    }
    d(){
      ctx.fillStyle = `rgba(9,139,255,${this.o})`;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.s,0,Math.PI*2); ctx.fill();
    }
  }
  const make = cnt => {
    particles=[];
    targetCount = cnt ?? Math.min(100, Math.round(innerWidth/10));
    for(let i=0;i<targetCount;i++) particles.push(new P());
    window.__particleStats.count=targetCount;
  };
  const adjust = fps => {
    if(fps<45 && targetCount>25) make(Math.max(20,Math.round(targetCount*0.85)));
    else if(fps>55 && targetCount<120) make(Math.min(120,Math.round(targetCount*1.1+2)));
  };
  const loop = () => {
    if(hidden){ id=requestAnimationFrame(loop); return; }
    const now=performance.now(); const fps=1000/((now-last)||1); last=now; fpsS.push(fps); if(fpsS.length>20) fpsS.shift();
    if(fpsS.length===20){
      const avg=fpsS.reduce((a,b)=>a+b,0)/fpsS.length; adjust(avg); window.__particleStats.fps=avg;
    }
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{ p.u(); p.d(); });
    frameToggle=!frameToggle;
    if(frameToggle){
      for(let i=0;i<particles.length;i++){
        for(let j=i+1;j<particles.length;j++){
          const dx=particles[i].x-particles[j].x, dy=particles[i].y-particles[j].y; const dist=Math.hypot(dx,dy);
          if(dist<100){
            ctx.strokeStyle=`rgba(9,139,255,${0.1*(1-dist/100)})`;
            ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(particles[i].x,particles[i].y); ctx.lineTo(particles[j].x,particles[j].y); ctx.stroke();
          }
        }
      }
    }
    id=requestAnimationFrame(loop);
  };
  resize(); make(); loop();
  document.addEventListener('visibilitychange', ()=> hidden=document.hidden);
  addEventListener('resize', throttle(()=>{ cancelAnimationFrame(id); resize(); make(targetCount); loop(); }, 250));
}

// ===== Greeting (Zeit-basiert) ausgelagert in hero-data.js =====
const ensureHeroDataModule = async()=> heroDataModule || (heroDataModule = await import('../../pages/home/hero-data.js').catch(e=>{ console.error('[hero-data] Import fehlgeschlagen', e); return {}; }));
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

function initProjectFilter(){
  const buttons=[...document.querySelectorAll('.filter-btn')]; const cards=[...document.querySelectorAll('.project-card')]; if(!buttons.length||!cards.length) return;
  const show=c=>{ c.style.display='block'; requestAnimationFrame(()=>{ c.style.opacity='1'; c.style.transform='scale(1)'; }); };
  const hide=c=>{ c.style.opacity='0'; c.style.transform='scale(0.95)'; setTimeout(()=>c.style.display='none',300); };
  buttons.forEach(btn=>btn.addEventListener('click',()=>{ buttons.forEach(b=>b.classList.remove('active')); btn.classList.add('active'); const f=btn.dataset.filter; cards.forEach(card=> (f==='all'||card.dataset.category===f)?show(card):hide(card)); }));
  (document.querySelector('.filter-btn.active')||buttons[0])?.click();
}

// ===== Smooth Scroll for Anchor Links =====
function initSmoothScroll(){ document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{ e.preventDefault(); const t=document.querySelector(a.getAttribute('href')); if(t){ const top=t.getBoundingClientRect().top+pageYOffset-80; scrollTo({ top, behavior:'smooth'}); } })); }

// ===== Scroll Animations & BackToTop =====
function handleScrollEvents(){
  const btn=document.getElementById('backToTop');
  if(!btn) return;
  if(pageYOffset>300) btn.classList.add('show'); else btn.classList.remove('show');
}
function initScrollAnimations(){
  document.getElementById('backToTop')?.addEventListener('click', ()=> scrollTo({ top:0, behavior:'smooth'}));
  const obs=new IntersectionObserver(ents=>ents.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('aos-animate'); }), { threshold:0.1, rootMargin:'0px 0px -50px 0px' });
  document.querySelectorAll('[data-aos]').forEach(el=>obs.observe(el));
}

// ===== Menü-Assets =====
function loadMenuAssets(){
  if(!document.getElementById('menu-container')) return;
  const exists = document.querySelector('script[src="/content/webentwicklung/menu/menu.js"]');
  if(!exists){
    const s=document.createElement('script');
    s.src='/content/webentwicklung/menu/menu.js';
    s.defer=true;
    document.body.appendChild(s);
  }
}

// ===== Loader State =====
let __modulesReady = false;
let __windowLoaded = false;
let __loaderStart = 0;
const __MIN_LOADER_MS = 700; // Mindestanzeige, damit man den Loader sieht

// ===== Loading Screen (robust) =====
function hideLoadingScreen(){
  const el=document.getElementById('loadingScreen');
  if(!el) return;
  el.classList.add('hide');
  el.setAttribute('aria-hidden','true');
  Object.assign(el.style,{ opacity:'0', pointerEvents:'none', visibility:'hidden'});
  const rm=()=>{ el.style.display='none'; el.removeEventListener('transitionend', rm); };
  el.addEventListener('transitionend', rm);
  setTimeout(rm,700);
  try{ window.AnimationSystem?.releaseLoadingGate?.(); }
  catch(e){ console.warn('releaseLoadingGate failed', e); }
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
  await loadTypedModules(); __modulesReady = true; tryHideLoader();

  // Nach Laden der Module: Hero Typing Initialisierung verfügbar machen (neu ausgelagert in TypeWriter.js)
  window.__initTyping = ()=> import('../../pages/home/TypeWriter.js').then(m=> typeof m.initHeroSubtitle==='function' ? m.initHeroSubtitle({ ensureHeroDataModule, makeLineMeasurer, quotes, TypeWriterClass: TypeWriter }) : (console.warn('initHeroSubtitle nicht gefunden'), false));

  // Hard fallback, falls irgendwas schiefgeht
  setTimeout(hideLoadingScreen, 5000);

  // Overscroll Guard jetzt in hero-runtime.js

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
  handleScrollEvents();

  // Smooth Anchor Scroll
  initSmoothScroll();

  // Hero Sichtbarkeits-Observer -> body.hero-active toggeln
  window.__postHeroEnhancements();

  // Reduce Motion Toggle
  (function(){
    const body=document.body;
    let reduced=false;
    try{
      const saved=localStorage.getItem('pref-reduce-motion');
      reduced = saved==='1' || (saved===null && matchMedia('(prefers-reduced-motion: reduce)').matches);
    }catch(e){
      if(window.AnimationSystem?.isDebug?.()) window.AnimationSystem.dlog('ls read',e);
    }
    if(reduced) body.classList.add('reduce-motion');
    window.toggleReducedMotion = force => {
      const val = force!==undefined ? force : !body.classList.contains('reduce-motion');
      body.classList.toggle('reduce-motion', !!val);
      try { localStorage.setItem('pref-reduce-motion', body.classList.contains('reduce-motion') ? '1':'0'); }
      catch(e){ if(window.AnimationSystem?.isDebug?.()) window.AnimationSystem.dlog('ls write',e); }
      if(window.AnimationSystem?.isDebug?.()) window.AnimationSystem.dlog('reduce-motion =', body.classList.contains('reduce-motion'));
    };
    // Fallback für CRT Buttons
    setTimeout(()=>{
      try{
        const hero=document.getElementById('hero');
        if(!hero||!window.AnimationSystem) return;
        window.AnimationSystem.scan?.();
        hero.querySelectorAll('.hero-buttons [data-animation="crt"].animate-element:not(.is-visible)')
          ?.forEach(btn=>{
            if(typeof window.AnimationSystem.replay==='function') window.AnimationSystem.replay(btn);
            else btn.classList.add('is-visible');
          });
      }catch(err){ console.warn('Hero Button Anim Fallback',err); }
    },450);
  })();

  // Global Debug Toggle Helper
  window.toggleAnimDebug = force => {
    if(!window.AnimationSystem) return;
    const tgt = force!==undefined ? !!force : !window.AnimationSystem.isDebug();
    window.AnimationSystem.setDebug(tgt);
  };

  // AOS-Delays
  document.querySelectorAll('[data-aos]').forEach((el,i)=> el.hasAttribute('data-aos-delay')||el.setAttribute('data-aos-delay', i*50));

  // Menü dynamisch nachladen
  loadMenuAssets();

});

// Für Tests exportieren
if(typeof module!=='undefined') module.exports={ debounce, throttle };

