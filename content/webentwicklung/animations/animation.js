/* Animation System
 * Viewport Reveal Animations (bereinigte Version)
 * Attribute: data-animation, data-delay, data-duration, data-easing
 */
(function(){
  'use strict';
  if(window.AnimationSystem) return; // Bereits vorhanden

  // Scrollrichtung erkennen für Re-Trigger beim Hochscrollen
  let lastScrollY = window.scrollY;
  let scrollDir = 'down';
  let ticking = false; // rAF Throttle

  const ATTR = {
    anim: 'data-animation',
    delay: 'data-delay',
    dur: 'data-duration',
    ease: 'data-easing',
  };
  const CLASS_ACTIVE = 'is-animating';
  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hilfsfunktion: Integer-Attribut auslesen mit Fallback
  const getInt = (el, attr, fallback) => {
    const v = el.getAttribute(attr);
    if(v == null || v === '') return fallback;
    const n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
  };

  // CSS nur einmal einfügen
  const ensureCSS = () => {
    if(document.getElementById('anim-css')) return;
    const style = document.createElement('style');
    style.id = 'anim-css';
    style.textContent = `.animate-element{opacity:0;transform:translateY(30px);transition:all .6s ease}.animate-element.is-visible{opacity:1;transform:translateY(0)}.animate-fadeInUp{transform:translateY(50px)}.animate-fadeInDown{transform:translateY(-50px)}.animate-fadeInLeft{transform:translateX(-50px)}.animate-fadeInRight{transform:translateX(50px)}.animate-zoomIn{transform:scale(.85)}.animate-fadeIn{transform:translateY(0)}`;
    document.head.appendChild(style);
  };

  const init = el => {
    const type = el.getAttribute(ATTR.anim);
    if(!type) return;
    // Allen Animationstypen ein spezifisches Klassenpräfix geben
    // Dadurch erhält z.B. "fadeIn" die Klasse "animate-fadeIn" und verliert
    // die standardmäßige vertikale Verschiebung.
    el.classList.add('animate-element', 'animate-' + type);

    el.style.transitionDuration = getInt(el, ATTR.dur, 600) + 'ms';
    const ease = el.getAttribute(ATTR.ease);
    if(ease) el.style.transitionTimingFunction = ease;

  // Kein data-distance mehr: Standard-Transform aus CSS bleibt erhalten

    if(prefersReduced) el.classList.add('is-visible');
  };

  const animate = el => {
    if(!el || el.classList.contains(CLASS_ACTIVE) || prefersReduced) return;
    const delay = getInt(el, ATTR.delay, 0);
    const dur = getInt(el, ATTR.dur, 600);
    el.classList.add(CLASS_ACTIVE);
    el.style.transitionDelay = delay + 'ms';
    el.classList.add('is-visible');
    setTimeout(() => {
      el.classList.remove(CLASS_ACTIVE);
      el.style.transitionDelay = '';
    }, delay + dur);
  };

  const reset = el => {
    if(!el) return;
    el.classList.remove('is-visible', CLASS_ACTIVE);
    el.style.transitionDelay = '';
  };

  // IntersectionObserver nur, wenn Animationen nicht reduziert werden sollen
  const observer = !prefersReduced && new IntersectionObserver(entries => {
    for(const { isIntersecting, target } of entries){
      if(isIntersecting){
        if(scrollDir === 'up') reset(target); // neu starten beim Hochscrollen
        animate(target);
      } else {
        // leichte Verzögerung minimiert Flackern beim Scrollen
        setTimeout(() => { if(!document.hidden) reset(target); }, 120);
      }
    }
  }, { threshold: 0.12 });

  // Re-Trigger Logik bei Hochscrollen für bereits sichtbare Elemente im oberen Bereich
  const retriggerOnScrollUp = () => {
    ticking = false;
    if(prefersReduced || scrollDir !== 'up') return;
    const vh = window.innerHeight;
    document.querySelectorAll('[' + ATTR.anim + ']').forEach(el => {
      const r = el.getBoundingClientRect();
      if(r.top >= 0 && r.top < vh * 0.7){
        if(el.classList.contains('is-visible') && !el.classList.contains(CLASS_ACTIVE)){
          // reset erzwingen (kurzer Reflow damit CSS Transition erneut greift)
          el.classList.remove('is-visible');
          // Reflow
          void el.offsetWidth;
          animate(el);
        }
      }
    });
  };

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    scrollDir = (y < lastScrollY) ? 'up' : 'down';
    lastScrollY = y;
    if(!ticking){
      ticking = true;
      requestAnimationFrame(retriggerOnScrollUp);
    }
  }, { passive: true });

  const scan = () => {
    ensureCSS();
    document.querySelectorAll('[' + ATTR.anim + ']').forEach(el => {
      init(el);
      if(observer) observer.observe(el);
    });
  };

  // MutationObserver für dynamisch eingefügte Inhalte (z.B. Template-Klone)
  const processed = new WeakSet();
  const handleNewEl = el => {
    if(!el || processed.has(el) || !el.hasAttribute?.(ATTR.anim)) return;
    init(el);
    if(observer) observer.observe(el);
    processed.add(el);
  };
  const mutationObserver = new MutationObserver(mutations => {
    for(const m of mutations){
      if(m.type === 'childList'){
        m.addedNodes.forEach(node => {
          if(node.nodeType !== 1) return; // Element
          if(node.hasAttribute && node.hasAttribute(ATTR.anim)) handleNewEl(node);
          // auch verschachtelte
          node.querySelectorAll?.('[' + ATTR.anim + ']').forEach(handleNewEl);
        });
      } else if(m.type === 'attributes' && m.attributeName === ATTR.anim){
        handleNewEl(m.target);
      }
    }
  });

  const startObserving = () => {
    mutationObserver.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: [ATTR.anim] });
  };

  const boot = () => { scan(); startObserving(); };
  (document.readyState === 'loading')
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();

  window.AnimationSystem = { scan, animate, reset };
})();

/* ---------------------------------------------------------
 * Feature Rotation Modul (zusammengeführt aus feature-rotation.js)
 * Lädt Feature-Templates und wechselt sie bei Scroll-Interaktion.
 * Öffentliche API: window.FeatureRotation { next(), current() }
 * Abhängigkeiten: keine – läuft unabhängig vom AnimationSystem.
 * --------------------------------------------------------- */
(function(){
  'use strict';
  if(window.FeatureRotation) return; // Doppelladung verhindern

  const SECTION_ID = 'section-features';
  const ALL_TEMPLATE_IDS = [
    'template-features-1',
    'template-features-2',
    'template-features-3',
    'template-features-4',
    'template-features-5'
  ];
  const TEMPLATES_URL = '/pages/features/features-templates.html';

  let currentIndex = 0;
  let shuffledTemplates = [];
  let cycleCount = 0; // (reserviert – aktuell nicht aktiv genutzt)
  let wasVisible = false;
  let isAnimating = false;
  let pendingSwitch = false;
  let templatesLoaded = false;
  let bootstrapped = false;
  let lastAboveThreshold = false;
  let exitDebounce = false;
  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function shuffle(arr){
    for(let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function hasAnyTemplateInDOM(){
    return ALL_TEMPLATE_IDS.some(id => document.getElementById(id));
  }

  async function loadTemplatesOnce(){
    if(templatesLoaded) return;
    try {
      const res = await fetch(TEMPLATES_URL, { credentials: 'same-origin' });
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const html = await res.text();
      const container = document.createElement('div');
      container.style.display = 'none';
      container.innerHTML = html;
      document.body.appendChild(container);
      templatesLoaded = true;
      document.dispatchEvent(new CustomEvent('featuresTemplatesLoaded'));
    } catch(err){
      document.dispatchEvent(new CustomEvent('featuresTemplatesError', { detail: { error: err, url: TEMPLATES_URL } }));
    }
  }

  function applyTemplate(id, { isInitial = false } = {}){
    const sectionEl = document.getElementById(SECTION_ID);
    const tpl = document.getElementById(id);
    if(!sectionEl || !tpl) return;
    if(isAnimating && !isInitial){
      pendingSwitch = true; return;
    }
    isAnimating = true;

    const previousId = sectionEl.dataset.currentTemplate || null;

    function finalizeEnter(){
      isAnimating = false;
      if(pendingSwitch){
        pendingSwitch = false;
        nextTemplate();
      }
    }

    function doSwap(){
      const frag = document.importNode(tpl.content, true);
      sectionEl.innerHTML = '';
      sectionEl.appendChild(frag);
      sectionEl.dataset.currentTemplate = id;
      sectionEl.style.opacity = '0';
      sectionEl.style.transform = 'translateY(10px)';
      sectionEl.style.transition = 'all 0.4s cubic-bezier(0.25,0.46,0.45,0.94)';
      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          sectionEl.style.opacity = '1';
          sectionEl.style.transform = 'translateY(0)';
        });
        setTimeout(finalizeEnter, 400);
      });
    }

    if(isInitial || !previousId){
      doSwap();
      return;
    }

    const ref = document.getElementById(SECTION_ID);
    if(ref){
      ref.style.transition = 'all 0.2s cubic-bezier(0.25,0.46,0.45,0.94)';
      ref.style.opacity = '0';
      ref.style.transform = 'translateY(-5px)';
    }
    setTimeout(doSwap, 200);
  }

  function nextTemplate(){
    if(shuffledTemplates.length === 0) return;
    const currentId = shuffledTemplates[currentIndex];
    let candidates = shuffledTemplates.filter(id => id !== currentId);
    if(candidates.length === 0) return;
    const nextId = candidates[Math.floor(Math.random() * candidates.length)];
    currentIndex = shuffledTemplates.indexOf(nextId);
    if(!isAnimating){
      applyTemplate(nextId);
    } else {
      pendingSwitch = true;
    }
  }

  function setupScrollObserver(){
    const sectionEl = document.getElementById(SECTION_ID);
    if(!sectionEl) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.target !== sectionEl) return;
        const ratio = entry.intersectionRatio;
        const nowVisible = entry.isIntersecting && ratio > 0;
        const EXIT_THRESHOLD = 0.35;
        const REENTER_THRESHOLD = 0.45;
        if(ratio >= REENTER_THRESHOLD){
          lastAboveThreshold = true;
        }
        if(lastAboveThreshold && ratio > 0 && ratio < EXIT_THRESHOLD && !exitDebounce){
          lastAboveThreshold = false;
          exitDebounce = true;
          nextTemplate();
          setTimeout(()=>{ exitDebounce = false; }, 500);
        }
        if(nowVisible && !sectionEl.dataset.currentTemplate){
          applyTemplate(shuffledTemplates[currentIndex], { isInitial: true });
        }
        wasVisible = nowVisible;
      });
    }, { threshold: [0,0.1,0.25,0.35,0.5,0.75,1] });
    observer.observe(sectionEl);
  }

  function bootstrap(){
    if(bootstrapped) return;
    bootstrapped = true;
    shuffledTemplates = shuffle([...ALL_TEMPLATE_IDS]);
    setupScrollObserver();
    const sectionEl = document.getElementById(SECTION_ID);
    if(sectionEl && hasAnyTemplateInDOM() && !sectionEl.dataset.currentTemplate){
      applyTemplate(shuffledTemplates[currentIndex], { isInitial: true });
    }
    if(prefersReduced){ /* Keine Auto-Rotation bei Reduced Motion */ }
  }

  window.FeatureRotation = {
    next: () => nextTemplate(),
    current: () => ({ index: currentIndex, id: shuffledTemplates[currentIndex] })
  };

  document.addEventListener('featuresTemplatesLoaded', bootstrap);
  document.addEventListener('DOMContentLoaded', () => {
    if(hasAnyTemplateInDOM()){
      templatesLoaded = true;
      bootstrap();
    } else {
      loadTemplatesOnce();
    }
  });
})();

