(() => {
  "use strict";
  if (window.FeatureRotation) return; // Doppel-Init verhindern

  // ==== Konfiguration ====
  const SECTION_ID      = "section-features";
  const TEMPLATE_IDS    = ["template-features-1","template-features-2","template-features-3","template-features-4","template-features-5"];
  const TEMPLATE_URL    = "/pages/features/features-templates.html";

  const ANIM_OUT_MS     = 200;
  const ANIM_IN_MS      = 400;
  const EASING          = "cubic-bezier(0.25,0.46,0.45,0.94)";

  // Intersection-Trigger: erst „gesehen“, dann ganz leicht raus -> wechsle
  const IO_THRESHOLDS   = [0, .1, .25, .35, .5, .75, 1];
  const IO_ENTER_RATIO  = 0.45; // ab hier „im View“
  const IO_MIN_RATIO    = 0.35; // unter diesen Wert nach „gesehen“ -> wechseln
  const IO_COOLDOWN_MS  = 500;

  const PREFERS_REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ==== State ====
  let order = [];        // gemischte Reihenfolge der TEMPLATE_IDS
  let idx = 0;           // aktueller Index in order
  let isAnimating = false;
  let switchQueued = false;

  let templatesLoaded = false;
  let seenInView = false;
  let ioCooldown = false;

  // Cleanup
  const timeouts = new Set();
  let observer = null;

  // ==== Utils ====
  const setTimeoutTracked = (fn, ms) => {
    const t = setTimeout(() => { timeouts.delete(t); fn(); }, ms);
    timeouts.add(t);
    return t;
  };

  const clearAllTimeouts = () => {
    for (const t of timeouts) clearTimeout(t);
    timeouts.clear();
  };

  const byId = (id) => document.getElementById(id);

  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const ensureTemplatesInDOM = async () => {
    if (templatesLoaded) return;
    // wenn bereits ein Template-Tag existiert, nicht laden
    const exists = TEMPLATE_IDS.some(id => byId(id));
    if (exists) {
      templatesLoaded = true;
      document.dispatchEvent(new CustomEvent("featuresTemplatesLoaded"));
      return;
    }
    try {
      const res = await fetch(TEMPLATE_URL, { credentials: "same-origin" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const html = await res.text();
      const container = document.createElement("div");
      container.style.display = "none";
      container.innerHTML = html;
      document.body.appendChild(container);
      templatesLoaded = true;
      document.dispatchEvent(new CustomEvent("featuresTemplatesLoaded"));
    } catch (error) {
      document.dispatchEvent(new CustomEvent("featuresTemplatesError", { detail: { error, url: TEMPLATE_URL } }));
    }
  };

  const pickNextIndexDifferent = (currentIndex) => {
    if (order.length <= 1) return currentIndex;
    // wähle ein anderes Element (gleichmäßiger)
    let candidate;
    do {
      candidate = Math.floor(Math.random() * order.length);
    } while (candidate === currentIndex);
    return candidate;
  };

  // ==== DOM/Animation ====
  const applyTemplate = (templateId, { initial = false } = {}) => {
    const section = byId(SECTION_ID);
    const tpl = byId(templateId);
    if (!section || !tpl) return;

    if (isAnimating && !initial) { // aktuell animiert -> nächsten Wechsel vormerken
      switchQueued = true;
      return;
    }

    isAnimating = true;
    const prevId = section.dataset.currentTemplate || null;

    const end = () => {
      isAnimating = false;
      if (switchQueued) {
        switchQueued = false;
        // Sofort nach Ende zum nächsten springen
        rotateToRandomDifferent();
      }
    };

    const mountNew = () => {
      const fragment = document.importNode(tpl.content, true);
      section.innerHTML = "";
      section.appendChild(fragment);
      section.dataset.currentTemplate = templateId;

      if (PREFERS_REDUCED) {
        // keine Animation
        section.style.opacity = "1";
        section.style.transform = "none";
        end();
        return;
      }

      // Fade/Slide-In
      section.style.opacity = "0";
      section.style.transform = "translateY(10px)";
      section.style.transition = `all ${ANIM_IN_MS}ms ${EASING}`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          section.style.opacity = "1";
          section.style.transform = "translateY(0)";
        });
      });
      setTimeoutTracked(end, ANIM_IN_MS);
    };

    if (initial || !prevId) {
      mountNew();
      return;
    }

    // Fade/Slide-Out der aktuellen Version
    if (!PREFERS_REDUCED) {
      section.style.transition = `all ${ANIM_OUT_MS}ms ${EASING}`;
      section.style.opacity = "0";
      section.style.transform = "translateY(-5px)";
    }
    setTimeoutTracked(mountNew, PREFERS_REDUCED ? 0 : ANIM_OUT_MS);
  };

  const rotateToRandomDifferent = () => {
    if (!order.length) return;
    const currentId = order[idx];
    if (order.length === 1) {
      applyTemplate(currentId);
      return;
    }
    const newIdx = pickNextIndexDifferent(idx);
    idx = newIdx;
    applyTemplate(order[idx]);
  };

  const mountInitialIfNeeded = () => {
    const section = byId(SECTION_ID);
    if (!section) return;
    if (!section.dataset.currentTemplate && order.length) {
      applyTemplate(order[idx], { initial: true });
    }
  };

  // ==== Intersection Observer ====
  const setupObserver = () => {
    const section = byId(SECTION_ID);
    if (!section) return;
    if (observer) observer.disconnect();

    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target !== section) continue;
        const r = entry.intersectionRatio;
        const isInView = entry.isIntersecting && r > 0;

        if (r >= IO_ENTER_RATIO) seenInView = true;

        // „gesehen“, dann leicht rausfallen -> wechsle; Cooldown verhindert Bouncing
        if (seenInView && r > 0 && r < IO_MIN_RATIO && !ioCooldown) {
          seenInView = false;
          ioCooldown = true;
          rotateToRandomDifferent();
          setTimeoutTracked(() => { ioCooldown = false; }, IO_COOLDOWN_MS);
        }

        if (isInView && !byId(SECTION_ID).dataset.currentTemplate) {
          // erstes Mount im View
          mountInitialIfNeeded();
        }
      }
    }, { threshold: IO_THRESHOLDS });

    observer.observe(section);
  };

  // ==== Init ====
  const init = async () => {
    order = shuffle([...TEMPLATE_IDS]);
    setupObserver();
    const section = byId(SECTION_ID);

    if (section && TEMPLATE_IDS.some(id => byId(id)) && !section.dataset.currentTemplate) {
      // Templates sind schon im DOM
      applyTemplate(order[idx], { initial: true });
    }

    if (!templatesLoaded) {
      await ensureTemplatesInDOM();
      // falls noch nichts gemountet wurde, jetzt initial mounten
      mountInitialIfNeeded();
    }
  };

  // ==== Public API ====
  const api = {
    next() { rotateToRandomDifferent(); },
    current() { return { index: idx, id: order[idx] }; },
    destroy() {
      if (observer) { observer.disconnect(); observer = null; }
      clearAllTimeouts();
      // keine weiteren globalen Listener nötig
      // optional: Section leeren
      // const s = byId(SECTION_ID); if (s) { s.innerHTML = ""; delete s.dataset.currentTemplate; }
      delete window.FeatureRotation;
    }
  };

  // Exponieren
  window.FeatureRotation = api;

  // Events
  document.addEventListener("featuresTemplatesLoaded", () => {
    // sicherstellen, dass gemountet wird wenn noch nicht
    mountInitialIfNeeded();
  });

  document.addEventListener("DOMContentLoaded", () => {
    // sofort loslegen
    init();
  });
})();
