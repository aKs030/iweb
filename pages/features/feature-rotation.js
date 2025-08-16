// Zentrale Utilities nutzen
import { shuffle as shuffleArray, prefersReducedMotion, TimerManager } from "../../content/webentwicklung/utils/common-utils.js";
import { createLogger } from "../../content/webentwicklung/utils/logger.js";

(() => {
  "use strict";
  if (window.FeatureRotation) return;

  const SECTION_ID = "section-features";
  const log = createLogger('features');
  const TEMPLATE_IDS = ["template-features-1","template-features-2","template-features-3","template-features-4","template-features-5"];
  const TEMPLATE_URL = "/pages/features/features-templates.html";

  // Default-Animationen (ms) können via data-attribute am Section-Element überschrieben werden
  const DEFAULT_ANIM_OUT = 200;
  const DEFAULT_ANIM_IN = 400;
  const DEFAULT_EASE = "cubic-bezier(0.25,0.46,0.45,0.94)";
  const THRESHOLDS = [0, .1, .25, .35, .5, .75, 1];
  const ENTER = 0.45, EXIT = 0.35, COOLDOWN = 500;
  const REDUCED = prefersReducedMotion();

  let order = [], i = 0, anim = false, queued = false;
  let loaded = false, seen = false, cool = false;
  const timerManager = new TimerManager();
  let io = null;

  const byId = id => document.getElementById(id);
  const later = (fn, ms) => timerManager.setTimeout(fn, ms);
  const clearTimers = () => timerManager.clearAll();
  const doubleRAF = (cb) => requestAnimationFrame(() => requestAnimationFrame(cb));

  async function ensureTemplates(section) {
    if (loaded) return;
    const srcOverride = section?.dataset.featuresSrc;
    const url = srcOverride || TEMPLATE_URL;
    if (TEMPLATE_IDS.some(id => byId(id))) {
      loaded = true;
      document.dispatchEvent(new CustomEvent("featuresTemplatesLoaded"));
      return;
    }
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const wrap = document.createElement("div");
      wrap.style.display = "none";
      wrap.innerHTML = await res.text();
      document.body.appendChild(wrap);
      loaded = true;
      log.info('Templates geladen', { url });
      document.dispatchEvent(new CustomEvent("featuresTemplatesLoaded"));
    } catch (error) {
      log.error('Templates laden fehlgeschlagen', url, error);
      document.dispatchEvent(new CustomEvent("featuresTemplatesError", { detail: { error, url } }));
    }
  }

  function mount(templateId, initial=false) {
    const section = byId(SECTION_ID), tpl = byId(templateId);
    if (!section || !tpl) return;

    // Animationsdauer dynamisch vom DOM lesen (erste Nutzung cached implizit im closure via locals)
    const ANIM_IN = Number(section.dataset.animIn || DEFAULT_ANIM_IN);
    const ANIM_OUT = Number(section.dataset.animOut || DEFAULT_ANIM_OUT);
      const EASE = section.dataset.animEase || DEFAULT_EASE;
      const LIVE_LABEL_PREFIX = section.dataset.liveLabel || "Feature";

    if (anim && !initial) { queued = true; return; }
    anim = true;

    const done = () => {
      anim = false;
      if (queued) { queued = false; rotateDifferent(); }
    };

    const mountNew = () => {
      const frag = tpl.content ? document.importNode(tpl.content, true) : null;
      section.replaceChildren(frag || tpl.cloneNode(true));
      // ARIA-Live Region erzeugen / aktualisieren
      let live = section.querySelector('[data-feature-rotation-live]');
      if (!live) {
        live = document.createElement('div');
        live.setAttribute('data-feature-rotation-live', '');
        live.setAttribute('aria-live', 'polite');
        live.setAttribute('aria-atomic', 'true');
        live.style.position = 'absolute';
        live.style.width = '1px';
        live.style.height = '1px';
        live.style.margin = '-1px';
        live.style.border = '0';
        live.style.padding = '0';
        live.style.clip = 'rect(0 0 0 0)';
        live.style.overflow = 'hidden';
        section.appendChild(live);
      }
      // Kurz Textinfo zum aktuellen Template liefern (entwicklerfreundlich anpassbar)
        live.textContent = `${LIVE_LABEL_PREFIX}: ${templateId}`;
      section.dataset.currentTemplate = templateId;

      if (REDUCED) { section.style.opacity = "1"; section.style.transform = "none"; done(); return; }

      section.style.opacity = "0";
      section.style.transform = "translateY(10px)";
      section.style.transition = `transform ${ANIM_IN}ms ${EASE}, opacity ${ANIM_IN}ms ${EASE}`;
      doubleRAF(() => {
        section.style.opacity = "1";
        section.style.transform = "translateY(0)";
      });
      later(done, ANIM_IN);
    };

    if (initial || !section.dataset.currentTemplate || REDUCED) { mountNew(); return; }

    section.style.transition = `transform ${ANIM_OUT}ms ${EASE}, opacity ${ANIM_OUT}ms ${EASE}`;
    section.style.opacity = "0";
    section.style.transform = "translateY(-5px)";
    later(mountNew, ANIM_OUT);
  }

  function rotateDifferent() {
  if (!order.length) { log.warn('Keine Templates vorhanden'); return; }
    if (order.length === 1) { mount(order[i]); return; }
    let n; do { n = (Math.random() * order.length) | 0; } while (n === i);
    i = n; mount(order[i]);
  }

  function mountInitialIfNeeded() {
    const section = byId(SECTION_ID);
    if (section && !section.dataset.currentTemplate && order.length) mount(order[i], true);
  }

  function observe() {
    const section = byId(SECTION_ID);
    if (!section) return;
    if (io) io.disconnect();

    io = new IntersectionObserver((ents) => {
      for (const e of ents) {
        if (e.target !== section) continue;
        const r = e.intersectionRatio;
        if (r >= ENTER) seen = true;

        if (seen && r > 0 && r < EXIT && !cool) {
          seen = false; cool = true; rotateDifferent();
          later(() => { cool = false; }, COOLDOWN);
        }
        if ((e.isIntersecting && r > 0) && !section.dataset.currentTemplate) mountInitialIfNeeded();
      }
    }, { threshold: THRESHOLDS });

    io.observe(section);
  }

  async function init() {
  order = shuffleArray([...TEMPLATE_IDS]);
  log.debug('Initiale Reihenfolge', order);
    observe();

    const section = byId(SECTION_ID);
    if (section && TEMPLATE_IDS.some(id => byId(id)) && !section.dataset.currentTemplate) mount(order[i], true);

  if (!loaded) { await ensureTemplates(section); mountInitialIfNeeded(); }
  }

  window.FeatureRotation = {
    next: rotateDifferent,
    current: () => ({ index: i, id: order[i] }),
    destroy() { io?.disconnect(); io=null; clearTimers(); log.info('FeatureRotation zerstört'); delete window.FeatureRotation; }
  };

  document.addEventListener("featuresTemplatesLoaded", mountInitialIfNeeded, { once:false });
  (document.readyState === "loading") ? document.addEventListener("DOMContentLoaded", init, { once:true }) : init();
  log.info('FeatureRotation initialisiert (pending Templates)');
})();