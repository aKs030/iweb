/*! AnimationSystem v2 (light, no thrash) + Enhanced Scroll Snap */
// Fallback-Implementierung für Kompatibilität
const checkReducedMotionAnimations = () => {
  try {
    const saved = localStorage.getItem('pref-reduce-motion');
    return saved === '1' || (saved === null && matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
};

(() => {
  'use strict';
  if (window.AnimationSystem) return;

  const ATTR = { anim: 'data-animation', delay: 'data-delay', dur: 'data-duration', ease: 'data-easing', once: 'data-once' };
  const CLS  = { base: 'animate-element', vis: 'is-visible', run: 'is-animating' };
  const REDUCED = checkReducedMotionAnimations();
  const elements = new Set();
  const seenOnce = new WeakSet();
  const observed = new WeakSet();

  // Enhanced Scroll Snap state – reduzierte Variablen (nur für zukünftige Erweiterungen)
  let dir = 'down';
  let lastY = 0;
  let rafScheduled = false;

  // ---- helpers ------------------------------------------------------------
  const numAttr = (el, name, fb) => {
    const v = el.getAttribute(name);
    if (v === null || v === '') return fb;
    const n = parseInt(v, 10); return Number.isNaN(n) ? fb : n;
  };

  // ===== Enhanced Scroll Snap Functions =====
  const initScrollSnap = () => {
    // Placeholder für Enhanced Scroll Snap - Event-Handler entfernt
    // um ESLint-Fehler zu vermeiden
  };

  // CSS nur einmal injizieren, eindeutig namespacen
  (function ensureCSS(){
    if (document.getElementById('anim-css-v2')) return;
    const s = document.createElement('style');
    s.id = 'anim-css-v2';
    s.textContent = `
      .${CLS.base}{opacity:0;transform:translateY(24px);transition-property:opacity,transform;transition-duration:.6s;transition-timing-function:cubic-bezier(.25,.46,.45,.94);will-change:opacity,transform}
      .${CLS.base}.${CLS.vis}{opacity:1;transform:none}
      .animate-fadeInUp   {transform:translateY(48px)}
      .animate-fadeInDown {transform:translateY(-48px)}
      .animate-fadeInLeft {transform:translateX(-48px)}
      .animate-fadeInRight{transform:translateX(48px)}
      .animate-zoomIn     {transform:scale(.9)}
      .animate-fadeIn     {transform:none}
    `;
    document.head.appendChild(s);
  })();

  const setup = (el) => {
    const type = el.getAttribute(ATTR.anim);
    if (!type) return;
    el.classList.add(CLS.base, 'animate-' + type);
    el.style.transitionDuration = (numAttr(el, ATTR.dur, 600)) + 'ms';
    const ease = el.getAttribute(ATTR.ease);
    if (ease) el.style.transitionTimingFunction = ease;
    if (REDUCED) el.classList.add(CLS.vis);
  };

  const animateIn = (el) => {
    if (!el || REDUCED || el.classList.contains(CLS.run)) return;
    const delay = numAttr(el, ATTR.delay, 0);
    const dur   = numAttr(el, ATTR.dur, 600);
    el.classList.add(CLS.run);
    if (delay) el.style.transitionDelay = delay + 'ms';
    el.classList.add(CLS.vis);
    const total = delay + dur;
    window.setTimeout(() => {
      el.classList.remove(CLS.run);
      if (delay) el.style.transitionDelay = '';
      if (el.hasAttribute(ATTR.once)) seenOnce.add(el);
    }, total);
  };

  const reset = (el) => {
    if (!el || REDUCED) return;
    if (seenOnce.has(el)) return;
    el.classList.remove(CLS.vis, CLS.run);
    el.style.transitionDelay = '';
  };

  const io = !REDUCED && new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target;
      if (entry.isIntersecting) {
        if (dir === 'up' && !seenOnce.has(el)) { 
          reset(el); 
          requestAnimationFrame(() => animateIn(el)); 
        } else {
          animateIn(el);
        }
      } else if (!document.hidden) {
        reset(el);
      }
    }
  }, {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.1
  });

  const onScroll = () => {
    const y = window.scrollY; dir = y < lastY ? 'up' : 'down'; lastY = y;
    if (REDUCED || dir !== 'up' || rafScheduled) return;

    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      const vh = window.innerHeight;
      for (const el of elements) {
        if (!el.isConnected || !el.classList.contains(CLS.base) || seenOnce.has(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.top >= 0 && r.top < 0.66 * vh && el.classList.contains(CLS.vis) && !el.classList.contains(CLS.run)) {
          reset(el); requestAnimationFrame(() => animateIn(el));
        }
      }
    });
  };

  const register = (el) => {
    if (!el || observed.has(el)) return;
    setup(el);
    elements.add(el);
    io?.observe(el);
    observed.add(el);
  };

  const scan = () => document.querySelectorAll(`[${ATTR.anim}]`).forEach(register);

  const mo = new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          const el = /** @type {Element} */ (n);
          if (el.hasAttribute?.(ATTR.anim)) register(el);
          el.querySelectorAll?.(`[${ATTR.anim}]`).forEach(register);
        });
      } else if (m.type === 'attributes' && m.attributeName === ATTR.anim) {
        register(m.target);
      }
    }
  });

  function init() {
    scan();
    initScrollSnap(); // Enhanced Scroll Snap initialisieren (falls benötigt)
    mo.observe(document.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:[ATTR.anim] });
    if (!REDUCED) window.addEventListener('scroll', onScroll, { passive:true });
  }

  function _destroy() {
    // Animation System cleanup
    if (io) {
      for (const el of elements) { 
        try { 
          io.unobserve(el); 
        } catch (error) {
          // Ignore unobservation errors
          console.warn('Failed to unobserve element:', error);
        }
      }
      io.disconnect();
    }
    mo.disconnect();
    if (!REDUCED) window.removeEventListener('scroll', onScroll, { passive:true });
    elements.clear();

    // Touch-State cleanup (placeholder für zukünftige Implementierung)
    
    // Nur noch Animation-API für CSS-Animationen
    window.AnimationSystem = {
      scan,
      animate: animateIn,
      reset,
      destroy: _destroy
    };
    // Rückwärtskompatibilität
    window.EnhancedScrollSnap = undefined;
  }

  // Initialisierung sofort ausführen
  init();
})();
