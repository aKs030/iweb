"use strict";
/**
 * Universelles Animation System
 * - data-animation="fadeInUp" (ohne animate__ Präfix)
 * - data-delay="200" (optional)
 * - data-duration="1000" (optional, default 600ms)
 * - Triggert bei Sichtbarkeit (IntersectionObserver)
 * - Wiederholt bei erneutem Scroll ins Viewport
 */
(function(){
  const ATTR = 'data-animation';
  const DELAY_ATTR = 'data-delay';
  const DURATION_ATTR = 'data-duration';
  const ACTIVE_CLASS = 'is-animating';
  
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
    
    if(prefersReduced){
      el.classList.add('is-visible');
      return;
    }
  }

  function animateElement(el){
    if(el.classList.contains(ACTIVE_CLASS)) return;
    
    const delay = parseInt(el.getAttribute(DELAY_ATTR) || '0', 10);
    el.classList.add(ACTIVE_CLASS);
    
    setTimeout(() => {
      el.classList.add('is-visible');
    }, delay);
    
    // Nach Animation wieder entfernen für Re-Trigger
    setTimeout(() => {
      el.classList.remove(ACTIVE_CLASS);
    }, delay + parseInt(el.getAttribute(DURATION_ATTR) || '600', 10));
  }

  function resetElement(el){
    el.classList.remove('is-visible', ACTIVE_CLASS);
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

  function scan(){
    console.log('Scanning for animation elements');
    document.querySelectorAll(`[${ATTR}]`).forEach(el => {
      initElement(el);
      observer.observe(el);
    });
  }

  // API
  window.AnimationSystem = {
    scan,
    animate: animateElement,
    reset: resetElement
  };

  // Auto-Init
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  // Initialisierung mit Debug-Ausgaben
  console.log('AnimationSystem: Starting initialization');
  
  // Re-scan bei dynamischen Inhalten
  document.addEventListener('sectionContentChanged', () => {
    console.log('AnimationSystem: Section content changed');
    setTimeout(scan, 50); // Kurz warten bis DOM geupdated
  });
  document.addEventListener('featuresTemplatesLoaded', () => {
    console.log('AnimationSystem: Features templates loaded');
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
})();
