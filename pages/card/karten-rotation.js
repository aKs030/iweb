// Zentrale Utilities nutzen
import { shuffle as shuffleArray, TimerManager } from '../../content/webentwicklung/utils/common-utils.js';
import { isReducedMotion } from '../../content/webentwicklung/animations/animation-utils.js';
import { createLogger } from '../../content/webentwicklung/utils/logger.js';
import { EVENTS, fire, on } from '../../content/webentwicklung/utils/events.js';

(() => {
  'use strict';
  if (window.FeatureRotation) return;

  const SECTION_ID = 'features';
  const log = createLogger('features');
  const TEMPLATE_IDS = ['template-features-1','template-features-2','template-features-3','template-features-4','template-features-5'];
  const TEMPLATE_URL = '/pages/card/karten.html';

  // Default-Animationen (ms) können via data-attribute am Section-Element überschrieben werden
  const DEFAULT_ANIM_OUT = 200;
  const DEFAULT_ANIM_IN = 400;
  const DEFAULT_EASE = 'cubic-bezier(0.25,0.46,0.45,0.94)';
  const THRESHOLDS = [0, .1, .25, .35, .5, .75, 1];
  const ENTER = 0.45, EXIT = 0.35, COOLDOWN = 500;
  const REDUCED = isReducedMotion();

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
      fire(EVENTS.FEATURES_TEMPLATES_LOADED);
      return;
    }
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const wrap = document.createElement('div');
      wrap.style.display = 'none';
      wrap.innerHTML = await res.text();
      document.body.appendChild(wrap);
      loaded = true;
      log.debug('Templates geladen', { url });
      fire(EVENTS.FEATURES_TEMPLATES_LOADED);
    } catch (error) {
      log.error('Templates laden fehlgeschlagen', url, error);
      fire(EVENTS.FEATURES_TEMPLATES_ERROR, { error, url });
    }
  }

  // Enhanced Animation Engine Integration
  function triggerAnimationEngineRescan() {
    if (window.enhancedAnimationEngine?.scan) {
      window.enhancedAnimationEngine.scan();
    }
  }

  function prepareAnimationReset(section) {
    if (window.enhancedAnimationEngine?.resetSection) {
      window.enhancedAnimationEngine.resetSection(section);
    } else {
      // Nutze WeakSet für Performance, falls viele Elemente
      const animatedElements = section.querySelectorAll('[data-animation], .animate, .animated');
      animatedElements.forEach(el => {
        el.classList.remove('animate', 'animated');
        el.style.opacity = '';
        el.style.transform = '';
      });
    }
  }

  function createLiveRegion(section, templateId, LIVE_LABEL_PREFIX) {
    let live = section.querySelector('[data-feature-rotation-live]');
    if (!live) {
      live = document.createElement('div');
      live.setAttribute('data-feature-rotation-live', '');
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      live.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;border:0;padding:0;clip:rect(0 0 0 0);overflow:hidden;';
      section.appendChild(live);
    }
    // Accessibility: Klarer Text für Screenreader
    live.textContent = `${LIVE_LABEL_PREFIX}: ${templateId}`;
    return live;
  }

  function applyInAnimation(section, ANIM_IN, EASE, done) {
    section.style.opacity = '0';
    section.style.transform = 'translateY(10px)';
    section.style.transition = `transform ${ANIM_IN}ms ${EASE}, opacity ${ANIM_IN}ms ${EASE}`;
    doubleRAF(() => {
      section.style.opacity = '1';
      section.style.transform = 'translateY(0)';
      later(() => {
        triggerAnimationEngineRescan();
        section.dispatchEvent(new CustomEvent('template:mounted', {
          detail: { templateId: section.dataset.currentTemplate },
          bubbles: true
        }));
      }, 50);
    });
    later(done, ANIM_IN);
  }

  function mount(templateId, initial=false) {
    const section = byId(SECTION_ID), tpl = byId(templateId);
    if (!section || !tpl) {
      log.warn('Mount failed: section or template not found', { sectionId: SECTION_ID, templateId });
      return;
    }

    if (section.id !== 'features') {
      log.warn('Mount blocked: wrong section', { actualId: section.id });
      return;
    }

    const ANIM_IN = Number(section.dataset.animIn || DEFAULT_ANIM_IN);
    const ANIM_OUT = Number(section.dataset.animOut || DEFAULT_ANIM_OUT);
    const EASE = section.dataset.animEase || DEFAULT_EASE;
    const LIVE_LABEL_PREFIX = section.dataset.liveLabel || 'Feature';

    if (anim && !initial) { queued = true; return; }
    anim = true;

    const done = () => {
      anim = false;
      if (queued) { queued = false; rotateDifferent(); }
    };

    const mountNew = () => {
      const frag = tpl.content ? document.importNode(tpl.content, true) : null;
      prepareAnimationReset(section);
      section.replaceChildren(frag || tpl.cloneNode(true));
      createLiveRegion(section, templateId, LIVE_LABEL_PREFIX);
      section.dataset.currentTemplate = templateId;
      try {
        fire(EVENTS.FEATURES_CHANGE, { index: i, total: order.length });
      } catch (err) {
        log.warn('Event dispatch failed', err);
      }
      if (REDUCED) { 
        section.style.opacity = '1'; 
        section.style.transform = 'none'; 
        done(); 
        return; 
      }
      applyInAnimation(section, ANIM_IN, EASE, done);
    };

    if (initial || !section.dataset.currentTemplate || REDUCED) { mountNew(); return; }

    section.style.transition = `transform ${ANIM_OUT}ms ${EASE}, opacity ${ANIM_OUT}ms ${EASE}`;
    section.style.opacity = '0';
    section.style.transform = 'translateY(-5px)';
    later(mountNew, ANIM_OUT);
  }

  function rotateDifferent() {
    if (!order.length) { log.warn('Keine Templates vorhanden'); return; }
    if (order.length === 1) { mount(order[i]); return; }
    function getSecureRandomInt(max) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return array[0] % max;
    }
    let n; do { n = getSecureRandomInt(order.length); } while (n === i);
    i = n; mount(order[i]);
  }

  function mountInitialIfNeeded() {
    const section = byId(SECTION_ID);
    if (section && !section.dataset.currentTemplate && order.length) {
      mount(order[i], true);
      // Nach dem ersten Mount: Animation-Scan garantiert nach DOM-Update
      doubleRAF(() => {
        if (window.enhancedAnimationEngine?.scan) window.enhancedAnimationEngine.scan();
      });
    }
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
    observe();

    const section = byId(SECTION_ID);
    if (section && TEMPLATE_IDS.some(id => byId(id)) && !section.dataset.currentTemplate) {
      mount(order[i], true);
    }

    if (!loaded) { 
      await ensureTemplates(section); 
      mountInitialIfNeeded(); 
    }
  }

  window.FeatureRotation = {
    next: rotateDifferent,
    current: () => ({ index: i, id: order[i] }),
    destroy() { 
      io?.disconnect(); 
      io = null; 
      clearTimers(); 
      delete window.FeatureRotation; 
    }
  };

  on(EVENTS.FEATURES_TEMPLATES_LOADED, () => {
    mountInitialIfNeeded();
    // Animation-Scan nach Template-Load garantiert nach DOM-Update
    doubleRAF(() => {
      if (window.enhancedAnimationEngine?.scan) window.enhancedAnimationEngine.scan();
    });
  });

  on(EVENTS.TEMPLATE_MOUNTED, (e) => {
    if (e.target.id === SECTION_ID && window.enhancedAnimationEngine?.handleTemplateChange) {
      window.enhancedAnimationEngine.handleTemplateChange(e.target);
    }
  });

  (document.readyState === 'loading') ? 
    document.addEventListener('DOMContentLoaded', init, { once: true }) : 
    init();
})();