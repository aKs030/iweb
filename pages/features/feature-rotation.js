"use strict";

/**
 * Features: Templates laden + Rotation steuern (ein Modul)
 * - Lädt /pages/features/features-templates.html
 * - Rotiert Templates in #section-features
 * - Sichtbarkeits- & Motion-Respekt, Public-API unter window.FeatureRotation
 */
(function () {
  // Config
  const SECTION_ID = "section-features";
  const ALL_TEMPLATE_IDS = [
    "template-features-1",
    "template-features-2",
    "template-features-3",
    "template-features-4",
    "template-features-5",
  ];
  const TEMPLATES_URL = "/pages/features/features-templates.html"; // Auto-Rotation entfernt

  // State
  let currentIndex = 0;
  let shuffledTemplates = [];
  let cycleCount = 0; // wie oft komplette Liste durchlaufen wurde
  // Tracking für Scroll-Wiedereintritt
  let wasVisible = false;
  let isAnimating = false;
  let pendingSwitch = false; // gemerkter Wechsel während Animation
  let templatesLoaded = false;
  let bootstrapped = false;
  let lastAboveThreshold = false; // ob zuletzt deutlich über Schwelle
  let exitDebounce = false; // verhindert schnellen Mehrfach-Trigger

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Utils
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

  // Loader
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
    } catch (err) {
  // optionales Logging entfernt
      document.dispatchEvent(
        new CustomEvent("featuresTemplatesError", { detail: { error: err, url: TEMPLATES_URL } })
      );
    }
  }

  // Rotation
  function applyTemplate(id, { isInitial = false } = {}) {
    const sectionEl = document.getElementById(SECTION_ID);
    const tpl = document.getElementById(id);
    if (!sectionEl || !tpl) return;
    if (isAnimating && !isInitial) { pendingSwitch = true; return; }
    isAnimating = true;

  const previousId = sectionEl.dataset.currentTemplate || null; // nur intern genutzt für Transition

    function finalizeEnter() {
      isAnimating = false;
      if(pendingSwitch){
        pendingSwitch = false;
        nextTemplate();
      }
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

    if (isInitial || !previousId) { // initialer Render ohne Exit Animation
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

  function reshuffleIfCycleComplete() {
    if(currentIndex === shuffledTemplates.length - 1){
      cycleCount++;
      const currentId = shuffledTemplates[currentIndex];
      const old = currentId; // letztes im alten Zyklus
      // neu mischen
      const fresh = shuffle([...ALL_TEMPLATE_IDS]);
      // Verhindern dass das letzte Id direkt erneut an erster Stelle ist
      if(fresh[0] === old && fresh.length > 1){
        // tausche mit zweitem
        [fresh[0], fresh[1]] = [fresh[1], fresh[0]];
      }
      shuffledTemplates = fresh;
      currentIndex = 0;
      return true;
    }
    return false;
  }

  function nextTemplate() {
    if (shuffledTemplates.length === 0) return;
    // Exit-basiert: wähle zufälliges anderes Template
    const currentId = shuffledTemplates[currentIndex];
    let candidates = shuffledTemplates.filter(id => id !== currentId);
    if(candidates.length === 0) return; // nur eins vorhanden
    const nextId = candidates[Math.floor(Math.random()*candidates.length)];
    currentIndex = shuffledTemplates.indexOf(nextId);
    if(!isAnimating){
      applyTemplate(nextId);
    } else {
      pendingSwitch = true;
    }
  }
  // Entfernte: ungenutzte randomTemplate / Interval-Funktionen

  // Observer
  function setupScrollObserver() {
    const sectionEl = document.getElementById(SECTION_ID);
    if (!sectionEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target !== sectionEl) return;
          const ratio = entry.intersectionRatio;
          const nowVisible = entry.isIntersecting && ratio > 0;
          // Schwellenwerte
          const EXIT_THRESHOLD = 0.35;
          const REENTER_THRESHOLD = 0.45; // Hysterese gegen Flackern

          if(ratio >= REENTER_THRESHOLD){
            lastAboveThreshold = true; // wieder klar im Viewport
          }

          // Teil-Verlassen Trigger: einmalig wenn wir von oberhalb der Schwelle unter EXIT fallen
          if(lastAboveThreshold && ratio > 0 && ratio < EXIT_THRESHOLD && !exitDebounce){
            lastAboveThreshold = false; // zurücksetzen bis erneutes klares Re-Enter
            exitDebounce = true;
            nextTemplate();
            // Debounce Timeout (Animation + kleine Pause)
            setTimeout(()=>{ exitDebounce = false; }, 500);
          }
          // Initialer Render falls noch keiner gesetzt und jetzt erster Eintritt sichtbar
          if(nowVisible && !sectionEl.dataset.currentTemplate){
            applyTemplate(shuffledTemplates[currentIndex], { isInitial: true });
          }
          wasVisible = nowVisible;
        });
      },
  { threshold: [0, 0.1, 0.25, 0.35, 0.5, 0.75, 1] }
    );
    observer.observe(sectionEl);
  }

  // Bootstrap
  function bootstrap() {
    if (bootstrapped) return;
    bootstrapped = true;

    // Templates-Reihenfolge vorbereiten
    shuffledTemplates = shuffle([...ALL_TEMPLATE_IDS]);

    setupScrollObserver();

    // Falls Section leer -> einmal initial setzen (ohne auf Sichtbarkeit zu warten)
    const sectionEl = document.getElementById(SECTION_ID);
    if (sectionEl && hasAnyTemplateInDOM() && !sectionEl.dataset.currentTemplate) {
      // Direkt initial rendern (auch wenn noch nicht sichtbar)
      applyTemplate(shuffledTemplates[currentIndex], { isInitial: true });
    }

  if (prefersReduced) { /* Rotation bleibt manuell bei Reduced Motion */ }
  }

  // Public API
  window.FeatureRotation = {
    next: () => nextTemplate(),
    current: () => ({ index: currentIndex, id: shuffledTemplates[currentIndex] }),
  };

  // Global Events

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
