"use strict";
/**
 * Universelles Animation System
 * Features:
 *  - Attribute:
 *      data-animation        : Name (fadeInUp, fadeInLeft, fadeIn, zoomIn ...)
 *      data-delay            : Startverzögerung in ms (optional)
 *      data-duration         : Dauer in ms (optional, default 600)
 *      data-stagger-group    : Gruppierung für automatisches Staggering
 *      data-stagger-step     : Schrittweite in ms (Default 80) für Gruppe
 *      data-stagger-base     : Basis-Offset (Startdelay) bei Wrapper-Verteilung
 *      data-stagger-jitter   : Zufalls-Variation (+/- ms) auf berechneten Delay (Default 20)
 *  - Sichtbarkeits-Triggers via IntersectionObserver (0.1 Threshold)
 *  - Automatischer Reset beim Verlassen des Viewports für Replay
 *  - Sauberes Replay per AnimationSystem.replay(el)
 *  - Temporäre will-change Optimierung während Animation
 *  - Debug-Modus (persistiert über localStorage 'anim-debug'):
 *        AnimationSystem.setDebug(true/false)
 *        Overlay mit: aktive Animationen / beobachtete Elemente / Partikel-FPS & Count
 *        Öffentliche Logger-Funktion: AnimationSystem.dlog(...)
 *  - Stagger Gruppen: Falls Elemente gleicher Gruppe kein eigenes data-delay haben, wird delay = index*step gesetzt
 *  - Statistik: AnimationSystem.getStats()
 *  - Gruppensteuerung: AnimationSystem.pauseGroup(name) / resumeGroup(name) / pauseAll() / resumeAll()
 *  - Respektiert prefers-reduced-motion (zeigt Elemente sofort)
 */
(function(){
  const ATTR = 'data-animation';
  const DELAY_ATTR = 'data-delay';
  const DURATION_ATTR = 'data-duration';
  const EASING_ATTR = 'data-easing';
  const DISTANCE_ATTR = 'data-distance';
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
  const __groups = new Map(); // groupName -> { paused:boolean }
  const __pendingTimers = new WeakMap(); // el -> timeout id
  const __delayedQueue = new Map(); // groupName -> Set<el>
  // Loading Gate: blockiert Start bis freigegeben
  let __loadingGateActive = true;
  const __loadingHeld = new Set();
  let overlayTimer = null;
  let overlayEl = null;
  
  // Basis Animation CSS
  const animationCSS = `
    .animate-element {
      opacity: 0;
      transform: translateY(30px);
      transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .animate-element.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
    .animate-fadeInUp { transform: translateY(50px); }
    .animate-fadeInDown { transform: translateY(-50px); }
    .animate-fadeInLeft { transform: translateX(-50px) translateY(0); }
    .animate-fadeInRight { transform: translateX(50px) translateY(0); }
    .animate-zoomIn { transform: scale(0.8) translateY(0); }
    .animate-fadeIn { transform: translateY(0); }
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
    if(animType !== 'fadeIn'){
      el.classList.add(`animate-${animType}`);
    }
    
    const duration = parseInt(el.getAttribute(DURATION_ATTR) || '600', 10);
    el.style.transitionDuration = duration + 'ms';
    const easing = el.getAttribute(EASING_ATTR);
    if(easing){ el.style.transitionTimingFunction = easing; }
    // Optional: distance anpassen wenn Standard translateY Basis genutzt
    const dist = el.getAttribute(DISTANCE_ATTR);
    if(dist && !el.classList.contains('is-visible')){
      // Nur anwenden falls Standard translate Richtung (vereinfachter Check)
      const num = parseInt(dist,10);
      if(!isNaN(num)){
        // Wenn bereits transform gesetzt, nur ersetzen wenn Basis pattern
        const base = el.style.transform || '';
        if(/translate[XY]\(/.test(base)){
          // lassen wir unangetastet
        } else {
          el.style.transform = `translateY(${num}px)`;
        }
      }
    }
    
    if(prefersReduced){
      el.classList.add('is-visible');
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
    
  const delay = parseInt(el.getAttribute(DELAY_ATTR) || '0', 10);
    el.classList.add(ACTIVE_CLASS);
    // will-change nur kurzfristig setzen
    const prevWill = el.style.willChange;
    el.style.willChange = 'opacity, transform';
    
    const tId = setTimeout(() => {
      el.classList.add('is-visible');
      __pendingTimers.delete(el);
    }, delay);
    __pendingTimers.set(el, tId);
    __stats.activeAnimations++;
    
    // Nach Animation wieder entfernen für Re-Trigger
    setTimeout(() => {
      el.classList.remove(ACTIVE_CLASS);
      // will-change zurücksetzen
      if(prevWill) el.style.willChange = prevWill; else el.style.removeProperty('will-change');
      __stats.activeAnimations = Math.max(0, __stats.activeAnimations - 1);
    }, delay + parseInt(el.getAttribute(DURATION_ATTR) || '600', 10));
  }

  function resetElement(el){
    el.classList.remove('is-visible', ACTIVE_CLASS);
    if(el.style && el.style.willChange){ el.style.removeProperty('will-change'); }
  if(el.hasAttribute(EASING_ATTR)) el.style.removeProperty('transition-timing-function');
  }

  // Forciert ein sauberes erneutes Abspielen: sofort reset, Reflow erzwingen, dann animate
  function replayElement(el){
    if(!el) return;
    resetElement(el);
    // Reflow erzwingen, damit Transition erneut greift
    void el.offsetWidth; // eslint-disable-line no-unused-expressions
    animateElement(el);
  }

  // IntersectionObserver für alle animierbaren Elemente
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        animateElement(entry.target);
      } else {
        // Reset für Re-Trigger beim erneuten Eintritt
        setTimeout(() => {
          if(!entry.isIntersecting){
            resetElement(entry.target);
          }
        }, 100);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

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
      // Schritt über Attribut an erstem Element, fallback 80ms
      let step = parseInt(list[0].getAttribute(STAGGER_STEP_ATTR) || '80', 10);
      if(!(step >= 0)) step = 80;
      list.forEach((el,i) => {
        if(!el.hasAttribute(DELAY_ATTR)){
          el.setAttribute(DELAY_ATTR, i * step + '');
        }
      });
    });

    // Wrapper-basierte Stagger (Eltern mit data-stagger-group, Kinder ohne eigenes data-delay)
    const wrappers = document.querySelectorAll(`[${STAGGER_GROUP_ATTR}]`);
    wrappers.forEach(wrapper => {
      // Wenn Wrapper selbst animierbar, Kinder separat behandeln
      const wGroup = wrapper.getAttribute(STAGGER_GROUP_ATTR);
      const step = parseInt(wrapper.getAttribute(STAGGER_STEP_ATTR) || '80', 10) || 80;
      const base = parseInt(wrapper.getAttribute(STAGGER_BASE_ATTR) || '0', 10) || 0;
      const jitter = parseInt(wrapper.getAttribute(STAGGER_JITTER_ATTR) || '20', 10) || 0;
      // Selektiere nur direkte Kinder mit data-animation (oder alle Nachfahren?) -> direkt ist stabiler
      const childAnim = Array.from(wrapper.querySelectorAll('[data-animation]'))
        .filter(child => !child.hasAttribute(DELAY_ATTR) && child.closest(`[${STAGGER_GROUP_ATTR}]`) === wrapper);
      if(childAnim.length === 0) return;
      childAnim.forEach((child, idx) => {
        let d = base + idx * step;
        if(jitter){
          const j = Math.round((Math.random() * 2 - 1) * jitter);
          d = Math.max(0, d + j);
        }
        child.setAttribute(DELAY_ATTR, d + '');
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
      // Resume: alle wartenden Elemente animieren
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
      // Held elements jetzt starten (Intersection Zustand prüfen)
      __loadingHeld.forEach(el => {
        if(el.isConnected){
          // Falls schon sichtbar laut Observer-Klasse (manuell prüfen)
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
        // Toggle debug off/on
        this.setDebug(!this.isDebug());
        this.setDebug(!this.isDebug());
        // Force replay first anim element
        const first = document.querySelector('[data-animation]');
        if(first) { this.replay(first); dlog('replayed first element'); }
        setTimeout(()=>{
          dlog('smokeTest end', this.getStats());
        }, 800);
        return true;
      } catch(err){ console.error('smokeTest failed', err); return false; }
  },
  pauseGroup, resumeGroup, pauseAll, resumeAll, cancelQueued
  };

  // Auto-Init
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  // Initialisierung mit Debug-Ausgaben
  dlog('init');
  // Falls Debug aktiv (Persistenz), Overlay herstellen
  if(__debug){ ensureOverlay(); }
  
  // Re-scan bei dynamischen Inhalten
  document.addEventListener('sectionContentChanged', () => {
  dlog('sectionContentChanged');
    setTimeout(scan, 50); // Kurz warten bis DOM geupdated
  });
  document.addEventListener('featuresTemplatesLoaded', () => {
  dlog('featuresTemplatesLoaded');
    setTimeout(scan, 50); // Kurz warten bis DOM geupdated  
  });
  
  // Sofortiger Scan wenn DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    setTimeout(scan, 10); // Kurz warten für andere Scripts
  }
  
  // MutationObserver für dynamische Inhalte
  const mutationObserver = new MutationObserver((mutations) => {
    let needsRescan = false;
    mutations.forEach(mutation => {
      if(mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if(node.nodeType === 1 && (
            node.matches && node.matches('[data-animation]') ||
            node.querySelector && node.querySelector('[data-animation]')
          )) {
            needsRescan = true;
          }
        });
      }
    });
    if(needsRescan) {
      setTimeout(scan, 50);
    }
  });
  
  // Features Section beobachten für dynamische Template-Inhalte
  const featuresSection = document.getElementById('section-features');
  if(featuresSection) {
    mutationObserver.observe(featuresSection, {
      childList: true,
      subtree: true
    });
  }

  // Cleanup bei Unload
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    mutationObserver.disconnect();
  });
})();
