/*! AnimationSystem v2 (light, no thrash) + Enhanced Scroll Snap */
// Fallback-Implementierung für Kompatibilität
const checkReducedMotionAnimations = () => {
  try {
    const saved = localStorage.getItem("pref-reduce-motion");
    return saved === "1" || (saved === null && matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
};

(() => {
  "use strict";
  if (window.AnimationSystem) return;

  const ATTR = { anim:"data-animation", delay:"data-delay", dur:"data-duration", ease:"data-easing", once:"data-once" };
  const CLS  = { base:"animate-element", vis:"is-visible", run:"is-animating" };
  const REDUCED = checkReducedMotionAnimations();

  let lastY = window.scrollY, dir = "down", rafScheduled = false;

  const elements = new Set();
  const seenOnce = new WeakSet();    // für data-once
  const observed = new WeakSet();

  // ===== Enhanced Scroll Snap Integration =====
  const SNAP_CONFIG = {
    SCROLL_LOCK_MS: 1200,        // Längere Lock-Zeit für saubere Übergänge
    WHEEL_THRESHOLD: 0.5,        // Ultra-niedrig für sofortiges Snapping
    TOUCH_THRESHOLD: 3,          // Ultra-niedrig für kleinste Touch-Bewegungen
    INTERSECTION_THRESHOLD: 0.6,
    ROOT_MARGIN: '-10% 0px -10% 0px',
    DEBOUNCE_MS: 150             // Debounce zwischen Section-Wechseln
  };

  let snapSections = [];
  let currentSnapIndex = 0;
  let snapLocked = false;
  let snapObserver = null;
  let touchStartY = 0;
  let touchArmed = false;
  let lastScrollTime = 0;
  let touchTimeout = null;
  let touchMoveCount = 0;
  let resetTouchState = null;

  // ---- helpers ------------------------------------------------------------
  const numAttr = (el, name, fb) => {
    const v = el.getAttribute(name);
    if (v == null || v === "") return fb;
    const n = parseInt(v, 10); return Number.isNaN(n) ? fb : n;
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

  // ===== Enhanced Scroll Snap Functions =====
  const initScrollSnap = () => {
    snapSections = Array.from(document.querySelectorAll('.section'));
    if (snapSections.length === 0) return;

    // Sections als snap-section markieren
    snapSections.forEach((section, index) => {
      section.classList.add('snap-section');
      section.dataset.snapIndex = index;
    });

    // Parallax System
    const updateScrollPos = () => {
      document.documentElement.style.setProperty('--scrollY', String(window.scrollY));
    };
    updateScrollPos();
    window.addEventListener('scroll', updateScrollPos, { passive: true });

    // Particle Background Management
    
    // Snap Observer
    snapObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const section = entry.target;
        const index = parseInt(section.dataset.snapIndex);

        if (entry.isIntersecting) {
          section.classList.add('in-view');
          if (entry.intersectionRatio > SNAP_CONFIG.INTERSECTION_THRESHOLD) {
            currentSnapIndex = index;
            window.dispatchEvent(new CustomEvent('snapSectionChange', {
              detail: { index, section }
            }));
          }
        }
      });
    }, {
      threshold: [0, SNAP_CONFIG.INTERSECTION_THRESHOLD, 1],
      rootMargin: SNAP_CONFIG.ROOT_MARGIN
    });

    snapSections.forEach(section => snapObserver.observe(section));

    // Event Handlers
    if (!REDUCED) {
      window.addEventListener('wheel', handleWheel, { passive: false });
      window.addEventListener('touchstart', handleTouchStart, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd, { passive: true });
      window.addEventListener('touchcancel', handleTouchEnd, { passive: true }); // Für abgebrochene Touches
    }
    window.addEventListener('keydown', handleKeydown);
    
    // Zusätzliche Touch-Reset-Handler für robustere Touch-Behandlung
    resetTouchState = () => {
      touchArmed = false;
      touchMoveCount = 0;
      if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
      }
    };
    
    // Erweiterte Reset-Funktion für bessere Kompatibilität
    const forceResetTouch = () => {
      resetTouchState();
      // Doppelte Sicherheit mit kurzer Verzögerung
      setTimeout(resetTouchState, 100);
    };
    
    // Touch bei verschiedenen Events zurücksetzen
    document.addEventListener('visibilitychange', forceResetTouch);
    window.addEventListener('blur', forceResetTouch);
    window.addEventListener('focus', forceResetTouch);
    window.addEventListener('resize', forceResetTouch); // Auch bei Größenänderungen
    
    // Touch nach Scroll-Lock-Ende zurücksetzen
    window.addEventListener('snapSectionChange', () => {
      setTimeout(resetTouchState, SNAP_CONFIG.SCROLL_LOCK_MS + 100);
    });
  };

  const scrollToSection = (targetIndex) => {
    let clampedIndex = clamp(targetIndex, 0, snapSections.length - 1);
    
    // Verhindern des Überspringens von Sektionen
    const maxJump = 1; // Nur eine Section pro Sprung erlaubt
    const indexDiff = Math.abs(clampedIndex - currentSnapIndex);
    
    if (indexDiff > maxJump) {
      // Wenn mehr als eine Section übersprungen werden soll, nur eine springen
      const direction = clampedIndex > currentSnapIndex ? 1 : -1;
      const newTargetIndex = currentSnapIndex + direction;
      clampedIndex = clamp(newTargetIndex, 0, snapSections.length - 1);
    }
    
    if (clampedIndex === currentSnapIndex || snapLocked) return;

    snapLocked = true;
    currentSnapIndex = clampedIndex;

    const targetSection = snapSections[clampedIndex];
    const scrollBehavior = REDUCED ? 'auto' : 'smooth';

    targetSection.scrollIntoView({ behavior: scrollBehavior, block: 'start' });

    setTimeout(() => { snapLocked = false; }, SNAP_CONFIG.SCROLL_LOCK_MS);
  };

  const handleWheel = (event) => {
    if (REDUCED || snapLocked) {
      if (snapLocked) event.preventDefault();
      return;
    }

    // Aggressive Scroll-Erkennung - reagiert auf jede Bewegung
    event.preventDefault();
    
    // Anti-Bounce: Mindestens 150ms zwischen Scroll-Events (erhöht für bessere Kontrolle)
    const now = Date.now();
    if (now - lastScrollTime < SNAP_CONFIG.DEBOUNCE_MS) return;
    lastScrollTime = now;
    
    // Minimaler Threshold - auch winzigste Bewegungen werden erkannt
    const delta = event.deltaY;
    if (Math.abs(delta) > 0.5) { // Extrem niedrige Schwelle
      // Nur jeweils eine Section vor oder zurück
      if (delta > 0) {
        scrollToSection(currentSnapIndex + 1);
      } else {
        scrollToSection(currentSnapIndex - 1);
      }
    }
  };

  const handleTouchStart = (event) => {
    if (REDUCED) return;
    
    // Immer erstmal komplett zurücksetzen für frischen Start
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      touchTimeout = null;
    }
    
    // Touch-State komplett neu setzen
    touchArmed = false;
    touchMoveCount = 0;
    
    const touch = event.changedTouches[0];
    if (touch) {
      touchStartY = touch.clientY;
      touchArmed = true; // Erst NACH dem Reset aktivieren
      touchMoveCount = 0;
      
      // Sicherheits-Timeout: Touch nach 3 Sekunden zurücksetzen (verlängert)
      touchTimeout = setTimeout(() => {
        touchArmed = false;
        touchMoveCount = 0;
        touchTimeout = null;
      }, 3000);
    }
  };

  const handleTouchMove = (event) => {
    if (REDUCED || snapLocked || !touchArmed) return;
    
    const touch = event.changedTouches[0];
    if (!touch) {
      // Kein Touch gefunden - komplett zurücksetzen für nächste Geste
      touchArmed = false;
      touchMoveCount = 0;
      if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
      }
      return;
    }

    touchMoveCount++;
    const deltaY = touch.clientY - touchStartY;
    
    // Ultra-sensitive Touch-Erkennung - reagiert auf kleinste Bewegungen (3px)
    if (Math.abs(deltaY) > SNAP_CONFIG.TOUCH_THRESHOLD) {
      event.preventDefault();
      
      // Scroll-Aktion ausführen
      if (deltaY < 0) {
        scrollToSection(currentSnapIndex + 1); // Nach unten wischen = nächste Section
      } else {
        scrollToSection(currentSnapIndex - 1); // Nach oben wischen = vorherige Section
      }
      
      // Touch-State zurücksetzen NACH der Aktion
      setTimeout(() => {
        touchArmed = false;
        touchMoveCount = 0;
        if (touchTimeout) {
          clearTimeout(touchTimeout);
          touchTimeout = null;
        }
      }, 100);
    }
  };

  const handleTouchEnd = (event) => { 
    // WICHTIG: Immer einen vollständigen Reset machen für nächste Touch-Geste
    const wasArmed = touchArmed;
    
    // Touch-State komplett zurücksetzen
    touchArmed = false;
    touchMoveCount = 0;
    
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      touchTimeout = null;
    }
    
    // Nur bei bewussten Touch-Gesten reagieren (wenn Touch ursprünglich armed war)
    if (wasArmed && event?.changedTouches?.length > 0) {
      const touch = event.changedTouches[0];
      const deltaY = touch.clientY - touchStartY;
      
      // Sehr kurze Tap-Gesten (< 8px Bewegung) als potenzielle Scroll-Intention behandeln
      if (Math.abs(deltaY) < 8 && touchMoveCount === 0) {
        // Kurzer Tap in der unteren Hälfte = vorwärts, obere Hälfte = rückwärts
        const viewportHeight = window.innerHeight;
        const tapY = touch.clientY;
        
        if (tapY > viewportHeight * 0.6 && !snapLocked) {
          scrollToSection(currentSnapIndex + 1);
        } else if (tapY < viewportHeight * 0.4 && !snapLocked) {
          scrollToSection(currentSnapIndex - 1);
        }
      }
    }
    
    // Zusätzlicher Reset mit kleiner Verzögerung für bessere Kompatibilität
    setTimeout(() => {
      touchArmed = false;
      touchMoveCount = 0;
    }, 50);
  };

  const handleKeydown = (event) => {
    if (snapLocked) return;
    const key = event.key;
    
    // Sequenzielle Navigation mit Keyboard
    if (['ArrowDown', 'PageDown', ' '].includes(key)) {
      event.preventDefault();
      scrollToSection(currentSnapIndex + 1); // Nur eine Section weiter
    } else if (['ArrowUp', 'PageUp'].includes(key)) {
      event.preventDefault();
      scrollToSection(currentSnapIndex - 1); // Nur eine Section zurück
    } else if (key === 'Home') {
      event.preventDefault();
      // Home erlaubt direkten Sprung zur ersten Section
      if (currentSnapIndex !== 0) {
        scrollToSection(0);
      }
    } else if (key === 'End') {
      event.preventDefault();
      // End erlaubt direkten Sprung zur letzten Section
      const lastIndex = snapSections.length - 1;
      if (currentSnapIndex !== lastIndex) {
        scrollToSection(lastIndex);
      }
    }
  };

  // CSS nur einmal injizieren, eindeutig namespacen
  (function ensureCSS(){
    if (document.getElementById("anim-css-v2")) return;
    const s = document.createElement("style");
    s.id = "anim-css-v2";
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
    el.classList.add(CLS.base, "animate-" + type);
    el.style.transitionDuration = (numAttr(el, ATTR.dur, 600)) + "ms";
    const ease = el.getAttribute(ATTR.ease);
    if (ease) el.style.transitionTimingFunction = ease;
    if (REDUCED) el.classList.add(CLS.vis); // respektiere reduced-motion
  };

  const animateIn = (el) => {
    if (!el || REDUCED || el.classList.contains(CLS.run)) return;
    const delay = numAttr(el, ATTR.delay, 0);
    const dur   = numAttr(el, ATTR.dur, 600);
    el.classList.add(CLS.run);
    if (delay) el.style.transitionDelay = delay + "ms";
    el.classList.add(CLS.vis);
    const total = delay + dur;
    window.setTimeout(() => {
      el.classList.remove(CLS.run);
      if (delay) el.style.transitionDelay = "";
      if (el.hasAttribute(ATTR.once)) seenOnce.add(el);
    }, total);
  };

  const reset = (el) => {
    if (!el || REDUCED) return;
    if (seenOnce.has(el)) return; // bei data-once nie zurücksetzen
    el.classList.remove(CLS.vis, CLS.run);
    el.style.transitionDelay = "";
  };

  const io = !REDUCED && new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target;
      if (entry.isIntersecting) {
        // Beim Hochscrollen kurze Rücksetzung, dann neu animieren → flüssiger
        if (dir === "up" && !seenOnce.has(el)) { 
          reset(el); 
          requestAnimationFrame(() => animateIn(el)); 
        } else {
          animateIn(el);
        }
      } else if (!document.hidden) {
        // Sichtbar -> rausgescrollt: ggf. zurücksetzen (außer once)
        reset(el);
      }
    }
  }, {
    // etwas vor Sichtbereich triggern, wirkt smoother
    root: null,
    rootMargin: "0px 0px -10% 0px",
    threshold: 0.1
  });

  const onScroll = () => {
    const y = window.scrollY; dir = y < lastY ? "up" : "down"; lastY = y;
    if (REDUCED || dir !== "up" || rafScheduled) return;

    // Nur beim Hochscrollen: nahe Elemente re-animate (ohne Layout-Spam)
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
      if (m.type === "childList") {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          const el = /** @type {Element} */ (n);
          if (el.hasAttribute?.(ATTR.anim)) register(el);
          el.querySelectorAll?.(`[${ATTR.anim}]`).forEach(register);
        });
      } else if (m.type === "attributes" && m.attributeName === ATTR.anim) {
        register(m.target);
      }
    }
  });

  function init() {
    scan();
    initScrollSnap(); // Enhanced Scroll Snap initialisieren
    mo.observe(document.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:[ATTR.anim] });
    if (!REDUCED) window.addEventListener("scroll", onScroll, { passive:true });
  }

  function destroy() {
    // Animation System cleanup
    if (io) {
      for (const el of elements) { try { io.unobserve(el); } catch {} }
      io.disconnect();
    }
    mo.disconnect();
    if (!REDUCED) window.removeEventListener("scroll", onScroll, { passive:true });
    elements.clear();

    // Scroll Snap cleanup
    if (snapObserver) {
      snapObserver.disconnect();
      snapObserver = null;
    }
    if (!REDUCED) {
      window.removeEventListener('wheel', handleWheel, { passive: false });
      window.removeEventListener('touchstart', handleTouchStart, { passive: true });
      window.removeEventListener('touchmove', handleTouchMove, { passive: false });
      window.removeEventListener('touchend', handleTouchEnd, { passive: true });
      window.removeEventListener('touchcancel', handleTouchEnd, { passive: true });
    }
    window.removeEventListener('keydown', handleKeydown);
    
    // Zusätzliche Event-Listener entfernen
    if (resetTouchState) {
      document.removeEventListener('visibilitychange', resetTouchState);
      window.removeEventListener('blur', resetTouchState);
      window.removeEventListener('focus', resetTouchState);
    }
    
    // Touch-State cleanup
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      touchTimeout = null;
    }
    touchArmed = false;
    touchMoveCount = 0;
    
    snapSections.forEach(section => {
      section.classList.remove('snap-section', 'in-view');
      delete section.dataset.snapIndex;
    });
    snapSections = [];
  }

  (document.readyState === "loading")
    ? document.addEventListener("DOMContentLoaded", init, { once:true })
    : init();

  // Erweiterte API mit Scroll Snap Funktionalität
  window.AnimationSystem = { 
    scan, 
    animate: animateIn, 
    reset, 
    destroy,
    // Enhanced Scroll Snap API
    scrollSnap: {
      goToSection: scrollToSection,
      getCurrentIndex: () => currentSnapIndex,
      getSectionCount: () => snapSections.length,
      isLocked: () => snapLocked,
      getSections: () => snapSections
    }
  };

  // Rückwärtskompatibilität
  window.EnhancedScrollSnap = window.AnimationSystem.scrollSnap;
})();