!function () {
  "use strict";
  if (window.AnimationSystem) return;

  // ====== Config / State ======
  const ATTR = {
    anim:  "data-animation",
    delay: "data-delay",
    dur:   "data-duration",
    ease:  "data-easing",
  };
  const CLS = {
    base: "animate-element",
    visible: "is-visible",
    animating: "is-animating",
  };

  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastY = window.scrollY;
  let scrollDir = "down"; // "down" | "up"
  let rafScheduled = false;

  // Track all known/observed elements
  const elements = new Set();
  const observed = new WeakSet();

  // ====== Utils ======
  const parseIntAttr = (el, name, fallback) => {
    const v = el.getAttribute(name);
    if (v == null || v === "") return fallback;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? fallback : n; // 0 ist erlaubt
  };

  const ensureBaseCSS = () => {
    if (document.getElementById("anim-css")) return;
    const style = document.createElement("style");
    style.id = "anim-css";
    style.textContent =
      ".animate-element{opacity:0;transform:translateY(30px);transition:all .6s ease}" +
      ".animate-element.is-visible{opacity:1;transform:translateY(0)}" +
      ".animate-fadeInUp{transform:translateY(50px)}" +
      ".animate-fadeInDown{transform:translateY(-50px)}" +
      ".animate-fadeInLeft{transform:translateX(-50px)}" +
      ".animate-fadeInRight{transform:translateX(50px)}" +
      ".animate-zoomIn{transform:scale(.85)}" +
      ".animate-fadeIn{transform:translateY(0)}";
    document.head.appendChild(style);
  };

  // ====== Element Init / Apply ======
  const setupElement = (el) => {
    const type = el.getAttribute(ATTR.anim);
    if (!type) return;

    // Grundklassen + spezifische Klasse
    el.classList.add(CLS.base, "animate-" + type);

    // Dauer + Easing aus data-*
    el.style.transitionDuration = parseIntAttr(el, ATTR.dur, 600) + "ms";
    const ease = el.getAttribute(ATTR.ease);
    if (ease) el.style.transitionTimingFunction = ease;

    // Reduced motion -> sofort sichtbar
    if (prefersReduced) el.classList.add(CLS.visible);
  };

  const animateIn = (el) => {
    if (!el || prefersReduced) return;
    if (el.classList.contains(CLS.animating)) return;

    const delay = parseIntAttr(el, ATTR.delay, 0);
    const dur = parseIntAttr(el, ATTR.dur, 600);

    el.classList.add(CLS.animating);
    // Delay nur setzen, wenn >0
    if (delay) el.style.transitionDelay = delay + "ms";
    // Sichtbar schalten, CSS-Transition übernimmt
    el.classList.add(CLS.visible);

    // Nach Ablauf: animating-Flag weg + Delay zurücksetzen
    window.setTimeout(() => {
      el.classList.remove(CLS.animating);
      if (delay) el.style.transitionDelay = "";
    }, delay + dur);
  };

  const resetEl = (el) => {
    if (!el) return;
    el.classList.remove(CLS.visible, CLS.animating);
    el.style.transitionDelay = "";
  };

  // ====== IntersectionObserver ======
  const io = !prefersReduced && new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target;
      if (entry.isIntersecting) {
        if (scrollDir === "up") {
          // Wenn nach oben gescrollt und Element wieder in Sicht -> vorherigen Zustand entfernen
          resetEl(el);
          // rAF, um Stiländerungen zu flushen, ohne forced reflow
          requestAnimationFrame(() => animateIn(el));
        } else {
          animateIn(el);
        }
      } else {
        // Aus dem Viewport -> nur zurücksetzen, wenn Seite sichtbar ist
        // (verhindert Flackern bei Tab-Wechseln)
        if (!document.hidden) {
          // leichte Verzögerung, damit schnelle Scrollbewegungen nicht ständig togglen
          setTimeout(() => {
            if (!document.hidden) resetEl(el);
          }, 120);
        }
      }
    }
  }, { threshold: 0.12 });

  // ====== Scroll Direction + Up-Replay ======
  const onScroll = () => {
    const y = window.scrollY;
    scrollDir = y < lastY ? "up" : "down";
    lastY = y;

    if (prefersReduced || scrollDir !== "up") return;
    if (rafScheduled) return;
    rafScheduled = true;

    requestAnimationFrame(() => {
      rafScheduled = false;

      // Replay-Logik beim Hochscrollen: Elemente im unteren 70%-Fenster erneut animieren
      const vh = window.innerHeight;
      for (const el of elements) {
        if (!el.isConnected) continue;
        if (!el.classList.contains(CLS.base)) continue;

        const rect = el.getBoundingClientRect();
        const inRange = rect.top >= 0 && rect.top < 0.7 * vh;

        // Bereits sichtbar & nicht gerade animierend -> kurz zurücksetzen und direkt wieder animieren
        if (inRange && el.classList.contains(CLS.visible) && !el.classList.contains(CLS.animating)) {
          resetEl(el);
          // rAF, um Style-Änderungen zu committen, ohne offsetWidth-Hack
          requestAnimationFrame(() => animateIn(el));
        }
      }
    });
  };

  // ====== Bootstrapping / Scanning ======
  const registerEl = (el) => {
    if (!el || observed.has(el)) return;
    setupElement(el);
    elements.add(el);
    if (io) io.observe(el);
    observed.add(el);
  };

  const scan = () => {
    ensureBaseCSS();
    document.querySelectorAll("[" + ATTR.anim + "]").forEach(registerEl);
  };

  // ====== MutationObserver: neue Knoten / Attributwechsel ======
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const el = /** @type {Element} */ (node);
          if (el.hasAttribute?.(ATTR.anim)) registerEl(el);
          el.querySelectorAll?.("[" + ATTR.anim + "]").forEach(registerEl);
        });
      } else if (m.type === "attributes" && m.attributeName === ATTR.anim) {
        const el = m.target;
        registerEl(el);
      }
    }
  });

  const startObserving = () => {
    mo.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [ATTR.anim],
    });
  };

  // ====== Event Listener ======
  const onScrollPassive = { passive: true };
  const onVisibility = () => {
    // Wenn Tab wieder aktiv ist, IntersectionObserver triggert ohnehin
    // Hier kein extra Handling nötig – Platzhalter falls gewünscht.
  };

  const init = () => {
    scan();
    startObserving();
    if (!prefersReduced) {
      window.addEventListener("scroll", onScroll, onScrollPassive);
      document.addEventListener("visibilitychange", onVisibility, false);
    }
  };

  const destroy = () => {
    // Cleanup
    if (io) {
      for (const el of elements) {
        try { io.unobserve(el); } catch {}
      }
      io.disconnect();
    }
    mo.disconnect();
    if (!prefersReduced) {
      window.removeEventListener("scroll", onScroll, onScrollPassive);
      document.removeEventListener("visibilitychange", onVisibility, false);
    }
    elements.clear();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  // ====== Public API (kompatibel) ======
  window.AnimationSystem = {
    scan,                 // erneut scannen (z. B. nach Template-Swap)
    animate: animateIn,   // gezielt ein Element animieren
    reset: resetEl,       // Sichtbarkeit zurücksetzen
    destroy,              // NEU: alles aufräumen
  };
}();