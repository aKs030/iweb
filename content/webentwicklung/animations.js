"use strict";
/**
 * Universelles Animation System – nur Opacity (keine Translate/Scale-Bewegung mehr)
 * Features:
 *  - Attribute:
 *      data-animation        : Name (fadeInUp, fadeInLeft, fadeIn, zoomIn ...)
 *      data-delay            : Startverzögerung in ms (optional)
 *      data-duration         : Dauer in ms (optional, default 600)
 *      data-easing           : CSS easing (optional)
 *      data-distance         : (ignoriert – keine Bewegung mehr)
 *      data-stagger-group    : Gruppierung für automatisches Staggering
 *      data-stagger-step     : Schrittweite in ms (Default 80) für Gruppe
 *      data-stagger-base     : Basis-Offset (Startdelay) bei Wrapper-Verteilung
 *      data-stagger-jitter   : Zufalls-Variation (+/- ms) auf berechneten Delay (Default 20)
 *  - Sichtbarkeits-Trigger via IntersectionObserver
 *  - Automatisches Staggering
 *  - Replay: AnimationSystem.replay(el)
 *  - Debug-Overlay: AnimationSystem.setDebug(true/false)
 *  - Respektiert prefers-reduced-motion
 */
(function(){
  const ATTR = 'data-animation';
  const DELAY_ATTR = 'data-delay';
  const DURATION_ATTR = 'data-duration';
  const EASING_ATTR = 'data-easing';
  const STAGGER_GROUP_ATTR = 'data-stagger-group';
  const STAGGER_STEP_ATTR = 'data-stagger-step';
  const STAGGER_BASE_ATTR = 'data-stagger-base';
  const STAGGER_JITTER_ATTR = 'data-stagger-jitter';

  const ACTIVE_CLASS = 'is-animating';

  // Debug Flag (persistierbar)
  let __debug = false;
  try { __debug = localStorage.getItem('anim-debug') === '1'; } catch(_e) {}
  const dlog = (...args) => { if(__debug) console.log('[AnimationSystem]', ...args); };

  // Statistik
  const __stats = { activeAnimations: 0, observed: 0, lastScan: 0 };
  const __groups = new Map();           // groupName -> { paused:boolean }
  const __pendingTimers = new WeakMap(); // el -> timeout id
  const __delayedQueue = new Map();     // groupName -> Set<el>

  // Loading Gate: blockiert Start bis freigegeben
  let __loadingGateActive = true;
  const __loadingHeld = new Set();

  // Debug-Overlay
  let overlayTimer = null;
  let overlayEl = null;

  // *** Nur Opacity, keine Bewegung/Transforms ***
  const animationCSS = `
    .animate-element {
      opacity: 0;
      transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: opacity;
    }
    .animate-element.is-visible { opacity: 1; }

    /* Varianten bleiben semantisch erhalten (Klassen für Selektoren),
       aber ohne Positions-/Skalierungsänderungen */
    .animate-fadeInUp    {}
    .animate-fadeInDown  {}
    .animate-fadeInLeft  {}
    .animate-fadeInRight {}
    .animate-zoomIn      {}
    .animate-fadeIn      {}
  `;

  // CSS in Head einfügen
  if(!document.getElementById('custom-animations')){
    const style = document.createElement('style');
    style.id = 'custom-animations';
    style.textContent = animationCSS;
    document.head.appendChild(style);
  }

  // Reduced Motion Check
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initElement(el){
    const animType = el.getAttribute(ATTR);
    if(!animType) return;

    el.classList.add('animate-element');
    // Semantische Variant-Klasse (ohne Effekt, aber für Selektoren nutzbar)
    if(animType && animType !== 'fadeIn'){
      el.classList.add(`animate-${animType}`);
    }

    const duration = parseInt(el.getAttribute(DURATION_ATTR) || '600', 10);
    if (Number.isFinite(duration)) el.style.transitionDuration = duration + 'ms';

    const easing = el.getAttribute(EASING_ATTR);
    if(easing){ el.style.transitionTimingFunction = easing; }

    if(prefersReduced){
      el.classList.add('is-visible');  // sofort sichtbar
      return;
    }
  }

  function animateElement(el){
    if(el.classList.contains(ACTIVE_CLASS)) return;

    // Loading Gate Prüfung
    if(__loadingGateActive){
      __loadingHeld.add(el);
      dlog('gate hold', el);
      return;
    }

    // Gruppen-Pause prüfen
    const g = el.getAttribute(STAGGER_GROUP_ATTR) || el.closest(`[${STAGGER_GROUP_ATTR}]`)?.getAttribute(STAGGER_GROUP_ATTR);
    if(g && __groups.get(g)?.paused){
      if(!__delayedQueue.has(g)) __delayedQueue.set(g, new Set());
      __delayedQueue.get(g).add(el);
      dlog('queue (paused group)', g, el);
      return;
    }

    const delay = parseInt(el.getAttribute(DELAY_ATTR) || '0', 10) || 0;

    el.classList.add(ACTIVE_CLASS);

    // will-change nur kurz
    const prevWill = el.style.willChange;
    el.style.willChange = 'opacity, transform';

    const tId = setTimeout(() => {
      el.classList.add('is-visible');
      __pendingTimers.delete(el);
    }, delay);
    __pendingTimers.set(el, tId);
    __stats.activeAnimations++;

    // Nach Ende wieder ACTIVE-Flag runter, will-change zurück
    setTimeout(() => {
      el.classList.remove(ACTIVE_CLASS);
      if(prevWill) el.style.willChange = prevWill; else el.style.removeProperty('will-change');
      __stats.activeAnimations = Math.max(0, __stats.activeAnimations - 1);
    }, delay + (parseInt(el.getAttribute(DURATION_ATTR) || '600', 10) || 600));
  }

  function resetElement(el){
    el.classList.remove('is-visible', ACTIVE_CLASS);
    if(el.style && el.style.willChange){ el.style.removeProperty('will-change'); }
    if(el.hasAttribute(EASING_ATTR)) el.style.removeProperty('transition-timing-function');
  }

  // Sauberes Replay
  function replayElement(el){
    if(!el) return;
    resetElement(el);
    void el.offsetWidth; // Reflow erzwingen
    animateElement(el);
  }

  // *** WICHTIG: Beim Verlassen NICHT zurücksetzen – Ausblenden übernimmt Scroll-Fade ***
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        animateElement(entry.target);
      } else {
        // Nichts tun (kein resetElement hier), damit kein Flackern
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  function applyStagger(elements){
    // Gruppierung nach STAGGER_GROUP_ATTR
    const groups = new Map();
    elements.forEach(el => {
      const grp = el.getAttribute(STAGGER_GROUP_ATTR);
      if(!grp) return;
      if(!groups.has(grp)) groups.set(grp, []);
      groups.get(grp).push(el);
    });
    groups.forEach(list => {
      let step = parseInt(list[0].getAttribute(STAGGER_STEP_ATTR) || '80', 10);
      if(!(step >= 0)) step = 80;
      list.forEach((el,i) => {
        if(!el.hasAttribute(DELAY_ATTR)){
          el.setAttribute(DELAY_ATTR, String(i * step));
        }
      });
    });

    // Wrapper-basiertes Staggering
    const wrappers = document.querySelectorAll(`[${STAGGER_GROUP_ATTR}]`);
    wrappers.forEach(wrapper => {
      const step = parseInt(wrapper.getAttribute(STAGGER_STEP_ATTR) || '80', 10) || 80;
      const base = parseInt(wrapper.getAttribute(STAGGER_BASE_ATTR) || '0', 10) || 0;
      const jitter = parseInt(wrapper.getAttribute(STAGGER_JITTER_ATTR) || '20', 10) || 0;

      const childAnim = Array.from(wrapper.querySelectorAll('[data-animation]'))
        .filter(child => !child.hasAttribute(DELAY_ATTR) && child.closest(`[${STAGGER_GROUP_ATTR}]`) === wrapper);

      childAnim.forEach((child, idx) => {
        let d = base + idx * step;
        if(jitter){
          const j = Math.round((Math.random() * 2 - 1) * jitter);
          d = Math.max(0, d + j);
        }
        child.setAttribute(DELAY_ATTR, String(d));
      });
    });
  }

  function setGroupPaused(group, paused){
    if(!__groups.has(group)) __groups.set(group, { paused:false });
    const state = __groups.get(group);
    if(state.paused === paused) return;
    state.paused = paused;
    dlog('group', group, paused ? 'paused' : 'resumed');
    if(!paused){
      const queued = __delayedQueue.get(group);
      if(queued){
        queued.forEach(el => animateElement(el));
        __delayedQueue.delete(group);
      }
    }
  }
  function pauseGroup(group){ setGroupPaused(group, true); }
  function resumeGroup(group){ setGroupPaused(group, false); }
  function pauseAll(){ __groups.forEach((_v,k)=>pauseGroup(k)); }
  function resumeAll(){ __groups.forEach((_v,k)=>resumeGroup(k)); }
  function cancelQueued(el){
    const t = __pendingTimers.get(el);
    if(t){ clearTimeout(t); __pendingTimers.delete(el); }
  }

  function scan(){
    dlog('scan()');
    const elements = Array.from(document.querySelectorAll(`[${ATTR}]`));
    applyStagger(elements);
    __stats.observed = elements.length;
    __stats.lastScan = performance.now();
    elements.forEach(el => {
      initElement(el);
      observer.observe(el);
    });
  }

  function ensureOverlay(){
    if(!__debug) { return; }
    if(!overlayEl){
      overlayEl = document.createElement('div');
      overlayEl.id = 'anim-debug-overlay';
      overlayEl.style.cssText = 'position:fixed;z-index:99999;top:6px;left:6px;padding:6px 10px;font:12px/1.3 system-ui,Arial,sans-serif;background:rgba(0,0,0,0.55);color:#9ff;border:1px solid #0bf;border-radius:6px;backdrop-filter:blur(4px);pointer-events:none;white-space:nowrap;';
      document.body.appendChild(overlayEl);
    }
    if(!overlayTimer){
      overlayTimer = setInterval(() => {
        if(!__debug){ clearInterval(overlayTimer); overlayTimer=null; if(overlayEl){ overlayEl.remove(); overlayEl=null; } return; }
        const pStats = window.__particleStats || {};
        const lines = [
          `DBG ✓`,
          `Anim: ${__stats.activeAnimations}/${__stats.observed}`,
          pStats.count ? `Partikel: ${pStats.count}` : '',
          pStats.fps ? `FPS≈ ${Math.round(pStats.fps)}` : ''
        ].filter(Boolean);
        if(overlayEl) overlayEl.textContent = lines.join(' | ');
      }, 500);
    }
  }

  // API
  window.AnimationSystem = {
    scan,
    animate: animateElement,
    reset: resetElement,
    replay: replayElement,
    releaseLoadingGate(){
      if(!__loadingGateActive) return;
      __loadingGateActive = false;
      dlog('loading gate release');
      __loadingHeld.forEach(el => {
        if(el.isConnected){
          animateElement(el);
        }
      });
      __loadingHeld.clear();
    },
    setDebug(v){
      __debug = !!v;
      try { localStorage.setItem('anim-debug', __debug ? '1' : '0'); } catch(_e) {}
      dlog('debug mode =', __debug);
      ensureOverlay();
    },
    isDebug(){ return __debug; },
    dlog,
    getStats(){ return { ...__stats }; },
    smokeTest(){
      try {
        dlog('smokeTest start');
        const before = this.getStats();
        dlog('stats.before', before);
        this.setDebug(!this.isDebug());
        this.setDebug(!this.isDebug());
        const first = document.querySelector('[data-animation]');
        if(first) { this.replay(first); dlog('replayed first element'); }
        setTimeout(()=>{ dlog('smokeTest end', this.getStats()); }, 800);
        return true;
      } catch(err){ console.error('smokeTest failed', err); return false; }
    },
    pauseGroup, resumeGroup, pauseAll, resumeAll, cancelQueued
  };

  // Auto-Init
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    setTimeout(scan, 10);
  }

  dlog('init');

  // Re-scan bei dynamischen Inhalten
  document.addEventListener('sectionContentChanged', () => { dlog('sectionContentChanged'); setTimeout(scan, 50); });
  document.addEventListener('featuresTemplatesLoaded', () => { dlog('featuresTemplatesLoaded'); setTimeout(scan, 50); });

  // MutationObserver (nur Features-Section, wie gehabt)
  const mutationObserver = new MutationObserver((mutations) => {
    let needsRescan = false;
    mutations.forEach(mutation => {
      if(mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if(node.nodeType === 1 && (
            (node.matches && node.matches('[data-animation]')) ||
            (node.querySelector && node.querySelector('[data-animation]'))
          )) {
            needsRescan = true;
          }
        });
      }
    });
    if(needsRescan) setTimeout(scan, 50);
  });

  const featuresSection = document.getElementById('section-features');
  if(featuresSection) {
    mutationObserver.observe(featuresSection, { childList: true, subtree: true });
  }

  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    mutationObserver.disconnect();
  });
})();
