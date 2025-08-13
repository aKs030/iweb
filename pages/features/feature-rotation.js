"use strict";

/**
 * Features: Templates laden + Rotation steuern (ein Modul)
 * - Lädt /pages/features/features-templates.html
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
  const TEMPLATES_URL = "/pages/features/features-templates.html"; // Auto-Rotation entfernt

  // ===== State =====
  let currentIndex = 0;
  let shuffledTemplates = [];
  // Tracking für Scroll-Wiedereintritt
  let wasVisible = false;
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
  window.AnimationSystem?.dlog?.('[Features] Templates geladen');
    } catch (err) {
  window.AnimationSystem?.dlog?.('[Features] Fehler beim Laden', err);
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
  if (!tpl) window.AnimationSystem?.dlog?.('[Features] Template fehlt im DOM:', id);
      return;
    }
    isAnimating = true;

  const previousId = sectionEl.dataset.currentTemplate || null; // nur intern genutzt für Transition

    function finalizeEnter() {
      isAnimating = false;
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
    if (isAnimating || shuffledTemplates.length === 0) return;
    currentIndex = (currentIndex + 1) % shuffledTemplates.length;
    applyTemplate(shuffledTemplates[currentIndex]);
  }
  function randomTemplate() { /* nicht benötigt, entfernt */ }
  function stopInterval() {}
  function startInterval() {}

  // ===== Observer =====
  function setupScrollObserver() {
    const sectionEl = document.getElementById(SECTION_ID);
    if (!sectionEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target !== sectionEl) return;
          const nowVisible = entry.isIntersecting && entry.intersectionRatio > 0;
          if (nowVisible && !wasVisible) {
            // Sichtbar geworden (auch beim Hochscrollen) -> nächstes Template
            nextTemplate();
          }
          wasVisible = nowVisible;
        });
      },
      { threshold: [0, 0.1, 0.25] }
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

  if (prefersReduced) { /* Hinweis entfernte Rotation */ }
  }

  // ===== Public API =====
  window.FeatureRotation = {
    next: () => nextTemplate(),
    current: () => ({ index: currentIndex, id: shuffledTemplates[currentIndex] }),
  };

  // ===== Global Events =====
  // Entfernt: Event-Listener "sectionUpdate" & diverse Custom Events (featureTemplateWillChange, featureTemplateChanged, sectionContentChanged), da keine Verwendungen gefunden.

  // visibilitychange entfernt

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
