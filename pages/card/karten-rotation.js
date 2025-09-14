// Zentrale Utilities nutzen
import { shuffle as shuffleArray, TimerManager, getElementById } from '../../content/webentwicklung/utils/common-utils.js';
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

  let order = [], i = 0, anim = false, queued = false;
  let loaded = false, seen = false, cool = false;
  const timerManager = new TimerManager();
  let io = null;

  const later = (fn, ms) => timerManager.setTimeout(fn, ms);
  const clearTimers = () => timerManager.clearAll();

  async function ensureTemplates(section) {
    if (loaded) return;
    const srcOverride = section?.dataset.featuresSrc;
    const url = srcOverride || TEMPLATE_URL;
    if (TEMPLATE_IDS.some(id => getElementById(id))) {
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

  // Spezielle Integration für Snap Scroll Events
  function handleSnapScrollEvent() {
    const section = getElementById(SECTION_ID);
    if (!section) return;
    
    // Forciere Re-Animation der Karten-Section bei Snap Events
    if (window.enhancedAnimationEngine?.forceCurrentSectionAnimations) {
      window.enhancedAnimationEngine.forceCurrentSectionAnimations();
    }
    
    // Stelle sicher, dass die aktuelle Karte sichtbar ist
    if (section.dataset.currentTemplate) {
      section.style.opacity = '1';
      section.style.transform = 'none';
    }
  }

  function prepareAnimationReset(section) {
    if (window.enhancedAnimationEngine?.resetSection) {
      window.enhancedAnimationEngine.resetSection(section);
    } else {
      // Fallback: manuell reset
      const animatedElements = section.querySelectorAll('[data-animation], .animate, .animated');
      animatedElements.forEach(el => {
        el.classList.remove('animate', 'animated');
        el.removeAttribute('data-animation');
        el.style.opacity = '';
        el.style.transform = '';
        el.style.transition = '';
        el.style.willChange = '';
      });
    }
    
    // Section selbst auch zurücksetzen
    section.classList.remove('animate', 'animated');
    section.removeAttribute('data-animation');
    section.style.opacity = '1'; // Sicherstellen dass Section sichtbar bleibt
    section.style.transform = 'none';
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
    // Erst alle vorherigen Animation-States zurücksetzen
    section.classList.remove('animate', 'animated');
    section.removeAttribute('data-animation');
    section.style.opacity = '';
    section.style.transform = '';
    
    // Kurz warten für DOM Cleanup
    requestAnimationFrame(() => {
      // Verwende Enhanced Animation Engine für konsistente Animationen
      section.setAttribute('data-animation', 'fadeInUp');
      section.setAttribute('data-duration', ANIM_IN + 'ms');
      
      // Sicherstellen dass Section sichtbar ist
      section.style.opacity = '1';
      section.style.transform = 'none';
      
      // Trigger Animation Engine rescan für neue Attribute
      triggerAnimationEngineRescan();
      
      // Dispatch template mounted event
      requestAnimationFrame(() => {
        section.dispatchEvent(new CustomEvent('template:mounted', {
          detail: { templateId: section.dataset.currentTemplate },
          bubbles: true
        }));
      });
    });
    
    later(done, ANIM_IN);
  }

  function mount(templateId, initial=false) {
    const section = getElementById(SECTION_ID), tpl = getElementById(templateId);
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
      
      // Stelle sicher, dass Section immer sichtbar ist
      section.style.opacity = '1';
      section.style.transform = 'none';
      section.style.willChange = '';
      
      try {
        fire(EVENTS.FEATURES_CHANGE, { index: i, total: order.length });
      } catch (err) {
        log.warn('Event dispatch failed', err);
      }
      applyInAnimation(section, ANIM_IN, EASE, done);
    };

    if (initial || !section.dataset.currentTemplate) { mountNew(); return; }

    // Performance-optimiert: will-change vor Animation
    section.style.willChange = 'transform, opacity';
    section.style.transition = `transform ${ANIM_OUT}ms ${EASE}, opacity ${ANIM_OUT}ms ${EASE}`;
    section.style.opacity = '0';
    section.style.transform = 'translateY(-5px) translateZ(0)';
    
    later(() => {
      // Vor dem neuen Mount: Transition zurücksetzen für sauberen Start
      section.style.transition = '';
      section.style.willChange = '';
      mountNew();
    }, ANIM_OUT);
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
    const section = getElementById(SECTION_ID);
    if (section && !section.dataset.currentTemplate && order.length) {
      mount(order[i], true);
      // Nach dem ersten Mount: Animation-Scan optimized
      requestAnimationFrame(() => {
        if (window.enhancedAnimationEngine?.scan) {
          window.enhancedAnimationEngine.scan();
        }
      });
    }
  }

  function observe() {
    const section = getElementById(SECTION_ID);
    if (!section) return;
    if (io) io.disconnect();

    io = new IntersectionObserver((ents) => {
      for (const e of ents) {
        if (e.target !== section) continue;
        const r = e.intersectionRatio;
        
        // Bessere Sichtbarkeits-Logik: seen wird bei ausreichender Sichtbarkeit gesetzt
        if (r >= ENTER) {
          seen = true;
        }
        
        // Reset seen beim vollständigen Verlassen der Section
        if (r === 0) {
          seen = false;
        }

        // Rotation triggern wenn Section verlassen wird (aber noch teilweise sichtbar)
        if (seen && r > 0 && r < EXIT && !cool) {
          cool = true; 
          rotateDifferent();
          later(() => { cool = false; }, COOLDOWN);
        }
        
        // Initial mount wenn Section sichtbar wird
        if ((e.isIntersecting && r > 0) && !section.dataset.currentTemplate) {
          mountInitialIfNeeded();
        }
      }
    }, { threshold: THRESHOLDS });

    io.observe(section);
  }

  async function init() {
    order = shuffleArray([...TEMPLATE_IDS]);
    observe();

    const section = getElementById(SECTION_ID);
    if (section && TEMPLATE_IDS.some(id => getElementById(id)) && !section.dataset.currentTemplate) {
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
    // Animation-Scan nach Template-Load - optimized timing
    requestAnimationFrame(() => {
      if (window.enhancedAnimationEngine?.scan) {
        window.enhancedAnimationEngine.scan();
      }
    });
  });

  on(EVENTS.TEMPLATE_MOUNTED, (e) => {
    if (e.target.id === SECTION_ID && window.enhancedAnimationEngine?.handleTemplateChange) {
      window.enhancedAnimationEngine.handleTemplateChange(e.target);
    }
  });

  // Snap Scroll Integration - horche auf Scroll Events
  let snapScrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(snapScrollTimeout);
    snapScrollTimeout = setTimeout(handleSnapScrollEvent, 100);
  }, { passive: true });

  (document.readyState === 'loading') ? 
    document.addEventListener('DOMContentLoaded', init, { once: true }) : 
    init();
})();