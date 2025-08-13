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
    el.classList.add('animate-element');
    if(type !== 'fadeIn') el.classList.add('animate-' + type);

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
    setTimeout(() => el.classList.add('is-visible'), delay);
    setTimeout(() => el.classList.remove(CLASS_ACTIVE), delay + dur);
  };

  const reset = el => { if(el) el.classList.remove('is-visible', CLASS_ACTIVE); };

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
