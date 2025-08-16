(() => {
  "use strict";
  if (window.FeatureRotation) return;

  const SECTION_ID = "section-features";
  const TEMPLATE_IDS = ["template-features-1","template-features-2","template-features-3","template-features-4","template-features-5"];
  const TEMPLATE_URL = "/pages/features/features-templates.html";

  const ANIM_OUT = 200, ANIM_IN = 400, EASE = "cubic-bezier(0.25,0.46,0.45,0.94)";
  const THRESHOLDS = [0, .1, .25, .35, .5, .75, 1];
  const ENTER = 0.45, EXIT = 0.35, COOLDOWN = 500;
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let order = [], i = 0, anim = false, queued = false;
  let loaded = false, seen = false, cool = false;
  const timers = new Set();
  let io = null;

  const byId = id => document.getElementById(id);
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const clearTimers = () => { for (const t of timers) clearTimeout(t); timers.clear(); };
  const shuffle = a => { for (let k=a.length-1;k>0;k--){ const j=(Math.random()*(k+1))|0; [a[k],a[j]]=[a[j],a[k]]; } return a; };

  async function ensureTemplates() {
    if (loaded) return;
    if (TEMPLATE_IDS.some(id => byId(id))) { loaded = true; document.dispatchEvent(new CustomEvent("featuresTemplatesLoaded")); return; }
    try {
      const res = await fetch(TEMPLATE_URL, { credentials: "same-origin" });
      if (!res.ok) throw new Error("HTTP "+res.status);
      const wrap = document.createElement("div");
      wrap.style.display = "none";
      wrap.innerHTML = await res.text();
      document.body.appendChild(wrap);
      loaded = true;
      document.dispatchEvent(new CustomEvent("featuresTemplatesLoaded"));
    } catch (error) {
      document.dispatchEvent(new CustomEvent("featuresTemplatesError", { detail: { error, url: TEMPLATE_URL } }));
    }
  }

  function mount(templateId, initial=false) {
    const section = byId(SECTION_ID), tpl = byId(templateId);
    if (!section || !tpl) return;

    if (anim && !initial) { queued = true; return; }
    anim = true;

    const done = () => {
      anim = false;
      if (queued) { queued = false; rotateDifferent(); }
    };

    const mountNew = () => {
      const frag = tpl.content ? document.importNode(tpl.content, true) : null;
      section.replaceChildren(frag || tpl.cloneNode(true));
      section.dataset.currentTemplate = templateId;

      if (REDUCED) { section.style.opacity = "1"; section.style.transform = "none"; done(); return; }

      section.style.opacity = "0";
      section.style.transform = "translateY(10px)";
      section.style.transition = `transform ${ANIM_IN}ms ${EASE}, opacity ${ANIM_IN}ms ${EASE}`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        section.style.opacity = "1";
        section.style.transform = "translateY(0)";
      }));
      later(done, ANIM_IN);
    };

    if (initial || !section.dataset.currentTemplate || REDUCED) { mountNew(); return; }

    section.style.transition = `transform ${ANIM_OUT}ms ${EASE}, opacity ${ANIM_OUT}ms ${EASE}`;
    section.style.opacity = "0";
    section.style.transform = "translateY(-5px)";
    later(mountNew, ANIM_OUT);
  }

  function rotateDifferent() {
    if (!order.length) return;
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
    order = shuffle([...TEMPLATE_IDS]);
    observe();

    const section = byId(SECTION_ID);
    if (section && TEMPLATE_IDS.some(id => byId(id)) && !section.dataset.currentTemplate) mount(order[i], true);

    if (!loaded) { await ensureTemplates(); mountInitialIfNeeded(); }
  }

  window.FeatureRotation = {
    next: rotateDifferent,
    current: () => ({ index: i, id: order[i] }),
    destroy() { io?.disconnect(); io=null; clearTimers(); delete window.FeatureRotation; }
  };

  document.addEventListener("featuresTemplatesLoaded", mountInitialIfNeeded, { once:false });
  (document.readyState === "loading") ? document.addEventListener("DOMContentLoaded", init, { once:true }) : init();
})();