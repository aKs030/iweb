"use strict";

/**
 * Features: Templates laden + Rotation steuern (ein Modul)
 * - Lädt /content/webentwicklung/features/features-templates.html
 * - Rotiert Templates in #section-features
 * - Sichtbarkeits- & Motion-Respekt, Public-API unter window.FeatureRotation
 */
(function () {
  // ===== Config =====
  const SECTION_ID = "section-features";
  const ALL_TEMPLATE_IDS = [
    "template-features-1",
    "template-features-2",
    "template-features-3",
    "template-features-4",
    "template-features-5",
  ];
  const TEMPLATES_URL = "/content/webentwicklung/features/features-templates.html";
  const ROTATION_INTERVAL_MS = 14000;

  // ===== State =====
  let currentIndex = 0;
  let shuffledTemplates = [];
  let intervalHandle = null;
  let isVisible = false;
  let isAnimating = false;
  let templatesLoaded = false;
  let bootstrapped = false;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ===== Utils =====
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function hasAnyTemplateInDOM() {
    return ALL_TEMPLATE_IDS.some((id) => document.getElementById(id));
  }

  // ===== Loader =====
  async function loadTemplatesOnce() {
    if (templatesLoaded) return;
    try {
      const res = await fetch(TEMPLATES_URL, { credentials: "same-origin" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const html = await res.text();
      const container = document.createElement("div");
      container.style.display = "none";
      container.innerHTML = html;
      document.body.appendChild(container);
      templatesLoaded = true;
      document.dispatchEvent(new CustomEvent("featuresTemplatesLoaded"));
      console.log("[Features] Templates geladen");
    } catch (err) {
      console.error("[Features] Fehler beim Laden:", err);
      document.dispatchEvent(
        new CustomEvent("featuresTemplatesError", { detail: { error: err, url: TEMPLATES_URL } })
      );
    }
  }

  // ===== Rotation =====
  function applyTemplate(id) {
    const sectionEl = document.getElementById(SECTION_ID);
    const tpl = document.getElementById(id);
    if (!sectionEl || !tpl || isAnimating) {
      if (!tpl) console.warn("[Features] Template fehlt im DOM:", id);
      return;
    }
    isAnimating = true;

    const previousId = sectionEl.dataset.currentTemplate || null;
    document.dispatchEvent(
      new CustomEvent("featureTemplateWillChange", { detail: { from: previousId, to: id } })
    );

    function finalizeEnter() {
      isAnimating = false;
      document.dispatchEvent(
        new CustomEvent("featureTemplateChanged", {
          detail: { templateId: id, index: currentIndex, from: previousId },
        })
      );
      document.dispatchEvent(
        new CustomEvent("sectionContentChanged", { detail: { section: SECTION_ID, template: id } })
      );
    }

    function doSwap() {
      const frag = document.importNode(tpl.content, true);
      sectionEl.innerHTML = "";
      sectionEl.appendChild(frag);
      sectionEl.dataset.currentTemplate = id;

      // Enter-Transition
      sectionEl.style.opacity = "0";
      sectionEl.style.transform = "translateY(10px)";
      sectionEl.style.transition =
        "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          sectionEl.style.opacity = "1";
          sectionEl.style.transform = "translateY(0)";
        });
        setTimeout(finalizeEnter, 400);
      });
    }

    if (!previousId) {
      doSwap();
      return;
    }

    // Exit-Transition
    const sectionElRef = document.getElementById(SECTION_ID);
    if (sectionElRef) {
      sectionElRef.style.transition =
        "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
      sectionElRef.style.opacity = "0";
      sectionElRef.style.transform = "translateY(-5px)";
    }
    setTimeout(doSwap, 200);
  }

  function nextTemplate() {
    if (isAnimating) return;
    currentIndex = (currentIndex + 1) % shuffledTemplates.length;
    applyTemplate(shuffledTemplates[currentIndex]);
  }

  function randomTemplate() {
    if (isAnimating) return;
    if (shuffledTemplates.length === 0) return;
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * shuffledTemplates.length);
    } while (newIndex === currentIndex && shuffledTemplates.length > 1);
    currentIndex = newIndex;
    applyTemplate(shuffledTemplates[currentIndex]);
  }

  function startInterval() {
    if (prefersReduced) return; // kein Auto-Rotate bei reduced motion
    if (intervalHandle) return;
    intervalHandle = setInterval(() => {
      if (isVisible) nextTemplate();
    }, ROTATION_INTERVAL_MS);
  }

  function stopInterval() {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  // ===== Observer =====
  function setupScrollObserver() {
    const sectionEl = document.getElementById(SECTION_ID);
    if (!sectionEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target.id !== SECTION_ID) return;

          if (entry.isIntersecting) {
            isVisible = true;
            // Initialer Wechsel beim Eintritt
            randomTemplate();
            startInterval();
          } else {
            isVisible = false;
            stopInterval();
          }
        });
      },
      {
        threshold: 0.3,
        rootMargin: "0px 0px -100px 0px",
      }
    );

    observer.observe(sectionEl);
  }

  // ===== Bootstrap =====
  function bootstrap() {
    if (bootstrapped) return;
    bootstrapped = true;

    // Templates-Reihenfolge vorbereiten
    shuffledTemplates = shuffle([...ALL_TEMPLATE_IDS]);

    setupScrollObserver();

    // Falls Section leer -> einmal initial setzen (ohne auf Sichtbarkeit zu warten)
    const sectionEl = document.getElementById(SECTION_ID);
    if (sectionEl && !sectionEl.firstElementChild) {
      // Falls Templates da sind, sofort anwenden
      if (hasAnyTemplateInDOM()) {
        applyTemplate(shuffledTemplates[currentIndex]);
      }
    }

    if (prefersReduced) {
      console.log("[Features] Reduced motion aktiv: Auto-Rotation aus.");
    }
  }

  // ===== Public API =====
  window.FeatureRotation = {
    next: () => nextTemplate(),
    prev: () => {
      if (isAnimating) return;
      currentIndex =
        (currentIndex - 1 + shuffledTemplates.length) % shuffledTemplates.length;
      applyTemplate(shuffledTemplates[currentIndex]);
    },
    goto: (i) => {
      if (isAnimating) return;
      if (!(i >= 0 && i < shuffledTemplates.length)) return;
      currentIndex = i;
      applyTemplate(shuffledTemplates[currentIndex]);
    },
    random: () => randomTemplate(),
    current: () => ({
      index: currentIndex,
      id: shuffledTemplates[currentIndex],
    }),
    pause: () => stopInterval(),
    resume: () => startInterval(),
  };

  // ===== Global Events =====
  document.addEventListener("sectionUpdate", (e) => {
    if (e.detail && e.detail.sectionId === SECTION_ID) nextTemplate();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopInterval();
    } else if (isVisible) {
      startInterval();
    }
  });

  // Wenn Templates geladen sind -> bootstrap
  document.addEventListener("featuresTemplatesLoaded", bootstrap);

  // DOM ready: laden (falls nicht inline vorhanden), sonst direkt bootstrap
  document.addEventListener("DOMContentLoaded", () => {
    if (hasAnyTemplateInDOM()) {
      templatesLoaded = true; // inline vorhanden
      bootstrap();
    } else {
      loadTemplatesOnce();
    }
  });
})();
