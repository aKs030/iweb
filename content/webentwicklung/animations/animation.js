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

  const ATTR = { anim: "data-animation", delay: "data-delay", dur: "data-duration", ease: "data-easing", once: "data-once" };
  const CLS  = { base: "animate-element", vis: "is-visible", run: "is-animating" };
  const REDUCED = checkReducedMotionAnimations();
  const elements = new Set();
  const seenOnce = new WeakSet();
  const observed = new WeakSet();

  // Enhanced Scroll Snap state – fehlende Variablen sauber deklarieren
  let snapSections = [];
  let currentSnapIndex = 0;
  let snapLocked = false;
  let lockScrollHandler = null;
  let lastScrollTime = 0;
  let touchTimeout = null;
  let touchArmed = false;
  let touchMoveCount = 0;
  let snapObserver = null;
  let resetTouchState = null;
  let dir = 'down';
  let lastY = 0;
  let rafScheduled = false;
  const SNAP_CONFIG = {
    TOUCH_THRESHOLD: 1,
    SCROLL_LOCK_MS: 1000
  };

  // ---- helpers ------------------------------------------------------------
  const numAttr = (el, name, fb) => {
    const v = el.getAttribute(name);
    if (v == null || v === "") return fb;
    const n = parseInt(v, 10); return Number.isNaN(n) ? fb : n;
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

  // ===== Enhanced Scroll Snap Functions =====
  const initScrollSnap = () => {
    // Nur noch CSS-Snap verwenden, keine JS-Handler mehr
    // Snap-Logik und Event-Handler entfernt

    // Alle Sections als Snap-Targets registrieren und Observer einrichten
    snapSections = Array.from(document.querySelectorAll('section'));
    snapSections.forEach((el, idx) => {
      el.classList.add('snap-section');
      if (idx === 0) el.classList.add('section-active');
    });

    snapObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const newIndex = snapSections.indexOf(entry.target);
        if (newIndex === -1 || newIndex === currentSnapIndex) continue;
        snapSections[currentSnapIndex]?.classList.remove('section-active');
        currentSnapIndex = newIndex;
        entry.target.classList.add('section-active');
        window.dispatchEvent(new CustomEvent('snapSectionChange', {
          detail: { index: currentSnapIndex, id: entry.target.id }
        }));
      }
    }, { threshold: 0.6 });

    snapSections.forEach(s => snapObserver.observe(s));

    const scrollToSection = (targetIndex) => {
      let clampedIndex = clamp(targetIndex, 0, snapSections.length - 1);

      // Verhindern des Überspringens von Sektionen
      const maxJump = 1; // Nur eine Section pro Sprung erlaubt
      const indexDiff = Math.abs(clampedIndex - currentSnapIndex);

      if (indexDiff > maxJump) {
        const direction = clampedIndex > currentSnapIndex ? 1 : -1;
        const newTargetIndex = currentSnapIndex + direction;
        clampedIndex = clamp(newTargetIndex, 0, snapSections.length - 1);
      }

      if (clampedIndex === currentSnapIndex || snapLocked) return;

      snapLocked = true;
      currentSnapIndex = clampedIndex;

      // Während des Locks: Scroll- und Touch-Events blockieren (auch auf document)
      if (!lockScrollHandler) {
        lockScrollHandler = (e) => {
          if (snapLocked) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return false;
          }
        };
        window.addEventListener('wheel', lockScrollHandler, { passive: false });
        window.addEventListener('touchmove', lockScrollHandler, { passive: false });
        window.addEventListener('keydown', lockScrollHandler, { passive: false });
        document.addEventListener('wheel', lockScrollHandler, { passive: false });
        document.addEventListener('touchmove', lockScrollHandler, { passive: false });
        document.addEventListener('keydown', lockScrollHandler, { passive: false });
      }

      const targetSection = snapSections[clampedIndex];
      const scrollBehavior = REDUCED ? 'auto' : 'smooth';

      targetSection.scrollIntoView({ behavior: scrollBehavior, block: 'start' });

      // Lock-Zeit für Touch-Gesten verlängern (schnelle Swipes abfangen)
      const lockMs = (window.__lastInputType === 'touch') ? 2000 : SNAP_CONFIG.SCROLL_LOCK_MS;
      setTimeout(() => {
        snapLocked = false;
        if (lockScrollHandler) {
          window.removeEventListener('wheel', lockScrollHandler, { passive: false });
          window.removeEventListener('touchmove', lockScrollHandler, { passive: false });
          window.removeEventListener('keydown', lockScrollHandler, { passive: false });
          document.removeEventListener('wheel', lockScrollHandler, { passive: false });
          document.removeEventListener('touchmove', lockScrollHandler, { passive: false });
          document.removeEventListener('keydown', lockScrollHandler, { passive: false });
          lockScrollHandler = null;
        }
      }, lockMs);
    };

    const handleWheel = (event) => {
      if (REDUCED || snapLocked) {
        event.preventDefault();
        return;
      }
      snapLocked = true;
      window.__lastInputType = 'wheel';
      event.preventDefault();

      const now = Date.now();
      if (now - lastScrollTime < 400) return;
      lastScrollTime = now;

      const delta = event.deltaY;
      if (Math.abs(delta) > 0.5) {
        if (delta > 0) {
          scrollToSection(currentSnapIndex + 1);
        } else {
          scrollToSection(currentSnapIndex - 1);
        }
        setTimeout(() => { snapLocked = false; }, 800);
      } else {
        snapLocked = false;
      }
      document.body.style.scrollBehavior = 'auto';
    };

    const handleTouchStart = (event) => {
      if (REDUCED) return;

      if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
      }

      touchArmed = false;
      touchMoveCount = 0;

      const touch = event.changedTouches[0];
      if (touch) {
        touchStartY = touch.clientY;
        touchArmed = true;
        touchMoveCount = 0;

        touchTimeout = setTimeout(() => {
          touchArmed = false;
          touchMoveCount = 0;
          touchTimeout = null;
        }, 3000);
      }
    };

    const handleTouchMove = (event) => {
      if (REDUCED || snapLocked || !touchArmed) return;
      window.__lastInputType = 'touch';
      const touch = event.changedTouches[0];
      if (!touch) {
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
      if (Math.abs(deltaY) > SNAP_CONFIG.TOUCH_THRESHOLD) {
        snapLocked = true;
        if (deltaY < 0) {
          scrollToSection(currentSnapIndex + 1);
        } else {
          scrollToSection(currentSnapIndex - 1);
        }
        touchArmed = false;
        touchMoveCount = 0;
        if (touchTimeout) {
          clearTimeout(touchTimeout);
          touchTimeout = null;
        }
      }
    };

    const handleTouchEnd = (event) => {
      const wasArmed = touchArmed;
      touchArmed = false;
      touchMoveCount = 0;

      if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
      }

      if (wasArmed && event?.changedTouches?.length > 0) {
        const touch = event.changedTouches[0];
        const deltaY = touch.clientY - touchStartY;

        if (Math.abs(deltaY) < 8 && touchMoveCount === 0) {
          const viewportHeight = window.innerHeight;
          const tapY = touch.clientY;

          if (tapY > viewportHeight * 0.6 && !snapLocked) {
            scrollToSection(currentSnapIndex + 1);
          } else if (tapY < viewportHeight * 0.4 && !snapLocked) {
            scrollToSection(currentSnapIndex - 1);
          }
        }
      }

      setTimeout(() => {
        touchArmed = false;
        touchMoveCount = 0;
      }, 50);
    };

    const handleKeydown = (event) => {
      if (snapLocked) return;
      const key = event.key;

      if (['ArrowDown', 'PageDown', ' '].includes(key)) {
        scrollToSection(currentSnapIndex + 1);
      } else if (['ArrowUp', 'PageUp'].includes(key)) {
        scrollToSection(currentSnapIndex - 1);
      } else if (key === 'Home') {
        if (currentSnapIndex !== 0) {
          scrollToSection(0);
        }
      } else if (key === 'End') {
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

    // Hinweis: Hier könnten noch Registrierungen für wheel/touch/key-Events folgen,
    // wenn initScrollSnap genutzt werden soll.
  };

  const setup = (el) => {
    const type = el.getAttribute(ATTR.anim);
    if (!type) return;
    el.classList.add(CLS.base, "animate-" + type);
    el.style.transitionDuration = (numAttr(el, ATTR.dur, 600)) + "ms";
    const ease = el.getAttribute(ATTR.ease);
    if (ease) el.style.transitionTimingFunction = ease;
    if (REDUCED) el.classList.add(CLS.vis);
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
    if (seenOnce.has(el)) return;
    el.classList.remove(CLS.vis, CLS.run);
    el.style.transitionDelay = "";
  };

  const io = !REDUCED && new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target;
      if (entry.isIntersecting) {
        if (dir === "up" && !seenOnce.has(el)) { 
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
    rootMargin: "0px 0px -10% 0px",
    threshold: 0.1
  });

  const onScroll = () => {
    const y = window.scrollY; dir = y < lastY ? "up" : "down"; lastY = y;
    if (REDUCED || dir !== "up" || rafScheduled) return;

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
    initScrollSnap(); // Enhanced Scroll Snap initialisieren (falls benötigt)
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
      window.removeEventListener('touchstart', handleTouchStart, { passive: false });
      window.removeEventListener('touchmove', handleTouchMove, { passive: false });
      window.removeEventListener('touchend', handleTouchEnd, { passive: false });
      window.removeEventListener('touchcancel', handleTouchEnd, { passive: false });
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
    }

    // API global verfügbar machen
    window.AnimationSystem = {
      scan,
      animate: animateIn,
      reset,
      destroy
    };
    // Rückwärtskompatibilität
    window.EnhancedScrollSnap = undefined;

    // Initialisierung sofort ausführen
    init();
})();