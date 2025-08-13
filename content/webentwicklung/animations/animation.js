/* Animation System
 * Viewport Reveal Animations (bereinigte Version)
 * Attribute: data-animation, data-delay, data-duration, data-easing
 */
(function(){
  'use strict';
  if(window.AnimationSystem) return; // Bereits vorhanden

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
        animate(target);
      } else {
        // leichte Verzögerung minimiert Flackern beim Scrollen
        setTimeout(() => { if(!document.hidden) reset(target); }, 100);
      }
    }
  }, { threshold: 0.1 });

  const scan = () => {
    ensureCSS();
    document.querySelectorAll('[' + ATTR.anim + ']').forEach(el => {
      init(el);
      if(observer) observer.observe(el);
    });
  };

  (document.readyState === 'loading')
    ? document.addEventListener('DOMContentLoaded', scan)
    : scan();

  window.AnimationSystem = { scan, animate, reset };
})();
