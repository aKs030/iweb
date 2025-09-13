import { createLogger } from '../../content/webentwicklung/utils/logger.js';import { createLogger } from '../../content/webentwicklung/utils/logger.js';import { createLogger } from '../../content/webentwicklung/utils/logger.js';

import { prefersReducedMotion } from '../../content/webentwicklung/utils/common-utils.js';

import { prefersReducedMotion } from '../../content/webentwicklung/utils/common-utils.js';import { prefersReducedMotion } from '../../content/webentwicklung/utils/common-utils.js';

(() => {

  'use strict';

  

  const log = createLogger('scroll-animations');(() => {(() => {

  const REDUCED_MOTION = prefersReducedMotion();

    'use strict';  'use strict';

  const ANIMATION_CONFIG = {

    threshold: 0.3,    

    rootMargin: '-10% 0px -10% 0px',

    staggerDelay: 150,  const log = createLogger('scroll-animations');  const log = createLogger('scroll-animations');

    cardAnimationDuration: 600,

  };  const REDUCED_MOTION = prefersReducedMotion();  const REDUCED_MOTION = prefersReducedMotion();



  let observer = null;    

  let animatedSections = new WeakSet();

  // Animation configuration  // Animation configuration

  function animateCard(card, delay) {

    card.style.transform = 'translateY(30px) scale(0.9)';  const ANIMATION_CONFIG = {  const ANIMATION_CONFIG = {

    card.style.opacity = '0';

    card.style.transition = '';    threshold: 0.3, // Trigger when 30% visible    threshold: 0.3, // Trigger when 30% visible

    

    setTimeout(() => {    rootMargin: '-10% 0px -10% 0px', // Snap-scroll detection zone    rootMargin: '-10% 0px -10% 0px', // Snap-scroll detection zone

      card.style.transition = `transform ${ANIMATION_CONFIG.cardAnimationDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity ${ANIMATION_CONFIG.cardAnimationDuration}ms ease-out`;

      card.style.transform = 'translateY(0) scale(1)';    staggerDelay: 150, // ms between card animations    staggerDelay: 150, // ms between card animations

      card.style.opacity = '1';

          cardAnimationDuration: 600, // ms for individual card animation    cardAnimationDuration: 600, // ms for individual card animation

      setTimeout(() => {

        card.classList.add('scroll-animated');  };  };

      }, ANIMATION_CONFIG.cardAnimationDuration);

    }, delay);

  }

  let observer = null;  let observer = null;

  function animateCards(container) {

    if (REDUCED_MOTION) {  let animatedSections = new WeakSet();  let animatedSections = new WeakSet();

      container.classList.add('animations-complete');

      return;

    }

  /**  /**

    const cards = container.querySelectorAll('.card');

       * Animate individual card with timing   * Animate individual card with timing

    cards.forEach((card, index) => {

      const delay = index * ANIMATION_CONFIG.staggerDelay;   */   */

      animateCard(card, delay);

    });  function animateCard(card, delay) {  function animateCard(card, delay) {

    

    const totalDuration = cards.length * ANIMATION_CONFIG.staggerDelay + ANIMATION_CONFIG.cardAnimationDuration;    // Reset card state    // Reset card state

    setTimeout(() => {

      container.classList.add('animations-complete');    card.style.transform = 'translateY(30px) scale(0.9)';    card.style.transform = 'translateY(30px) scale(0.9)';

    }, totalDuration);

  }    card.style.opacity = '0';    card.style.opacity = '0';



  function animateHeader(header) {    card.style.transition = '';    card.style.transition = '';

    if (REDUCED_MOTION) return;

            

    header.style.transform = 'translateY(-20px)';

    header.style.opacity = '0';    // Schedule animation    // Schedule animation

    header.style.transition = '';

        setTimeout(() => {    setTimeout(() => {

    requestAnimationFrame(() => {

      header.style.transition = 'transform 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 500ms ease-out';      card.style.transition = `      card.style.transition = `

      header.style.transform = 'translateY(0)';

      header.style.opacity = '1';        transform ${ANIMATION_CONFIG.cardAnimationDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94),        transform ${ANIMATION_CONFIG.cardAnimationDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94),

    });

  }        opacity ${ANIMATION_CONFIG.cardAnimationDuration}ms ease-out        opacity ${ANIMATION_CONFIG.cardAnimationDuration}ms ease-out



  function handleIntersection(entries) {      `;      `;

    entries.forEach(entry => {

      const section = entry.target;      card.style.transform = 'translateY(0) scale(1)';      card.style.transform = 'translateY(0) scale(1)';

      

      if (entry.isIntersecting && entry.intersectionRatio >= ANIMATION_CONFIG.threshold) {      card.style.opacity = '1';      card.style.opacity = '1';

        if (animatedSections.has(section)) return;

        animatedSections.add(section);            

        

        log.debug('Triggering scroll animations for section', { id: section.id });      // Mark as animated after completion      // Mark as animated after completion

        

        const header = section.querySelector('.section-header');      setTimeout(() => {      setTimeout(() => {

        if (header) {

          animateHeader(header);        card.classList.add('scroll-animated');        card.classList.add('scroll-animated');

        }

              }, ANIMATION_CONFIG.cardAnimationDuration);      }, ANIMATION_CONFIG.cardAnimationDuration);

        const cardsContainer = section.querySelector('.features-cards');

        if (cardsContainer) {    }, delay);    }, delay);

          setTimeout(() => animateCards(cardsContainer), 200);

        }  }  }

        

        const title = section.querySelector('.section-title')?.textContent || 'Section';

        if (window.announce) {

          window.announce(`${title} animiert`);  /**  /**

        }

      }   * Animate cards with staggered entrance   * Animate cards with staggered entrance

    });

  }   */   */



  function init() {  function animateCards(container) {  function animateCards(container) {

    if (observer) return;

        if (REDUCED_MOTION) {    if (REDUCED_MOTION) {

    log.debug('Initializing scroll-based card animations');

          container.classList.add('animations-complete');      container.classList.add('animations-complete');

    observer = new IntersectionObserver(handleIntersection, {

      threshold: [0, ANIMATION_CONFIG.threshold, 0.5, 1],      return;      return;

      rootMargin: ANIMATION_CONFIG.rootMargin

    });    }    }

    

    const sections = document.querySelectorAll('.full-screen-section, [data-scroll-animate]');

    sections.forEach(section => {

      const hasCards = section.querySelector('.features-cards');    const cards = container.querySelectorAll('.card');    const cards = container.querySelectorAll('.card');

      if (hasCards) {

        observer.observe(section);        

        log.debug('Observing section for scroll animations', { id: section.id || 'unnamed' });

      }    cards.forEach((card, index) => {    cards.forEach((card, index) => {

    });

          const delay = index * ANIMATION_CONFIG.staggerDelay;      const delay = index * ANIMATION_CONFIG.staggerDelay;

    document.addEventListener('visibilitychange', () => {

      if (document.visibilityState === 'visible') {      animateCard(card, delay);      animateCard(card, delay);

        setTimeout(() => {

          animatedSections = new WeakSet();    });    });

        }, 1000);

      }        

    });

  }    // Mark container as complete    // Mark container as complete



  function cleanup() {    const totalDuration = cards.length * ANIMATION_CONFIG.staggerDelay + ANIMATION_CONFIG.cardAnimationDuration;    const totalDuration = cards.length * ANIMATION_CONFIG.staggerDelay + ANIMATION_CONFIG.cardAnimationDuration;

    if (observer) {

      observer.disconnect();    setTimeout(() => {    setTimeout(() => {

      observer = null;

    }      container.classList.add('animations-complete');      container.classList.add('animations-complete');

    animatedSections = new WeakSet();

    log.debug('Scroll animations cleaned up');    }, totalDuration);    }, totalDuration);

  }

  }  }

  function rescan() {

    if (!observer) return;

    

    const sections = document.querySelectorAll('.full-screen-section, [data-scroll-animate]');  /**  /**

    sections.forEach(section => {

      const hasCards = section.querySelector('.features-cards');   * Animate section header   * Schedule header animation

      if (hasCards && !animatedSections.has(section)) {

        observer.observe(section);   */   */

        log.debug('Added new section to scroll animation observer', { id: section.id || 'unnamed' });

      }  function animateHeader(header) {  function scheduleHeaderAnimation(header) {

    });

  }    if (REDUCED_MOTION) return;    requestAnimationFrame(() => {



  window.ScrollAnimations = {          header.style.transition = 'transform 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 500ms ease-out';

    init,

    cleanup,    header.style.transform = 'translateY(-20px)';      header.style.transform = 'translateY(0)';

    rescan,

    version: '1.0.0'    header.style.opacity = '0';      header.style.opacity = '1';

  };

    header.style.transition = '';    });

  if (document.readyState === 'loading') {

    document.addEventListener('DOMContentLoaded', init);      }

  } else {

    setTimeout(init, 100);    requestAnimationFrame(() => {

  }

      header.style.transition = 'transform 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 500ms ease-out';  /**

  document.addEventListener('featuresTemplatesLoaded', () => {

    setTimeout(rescan, 100);      header.style.transform = 'translateY(0)';   * Animate section header

  });

      header.style.opacity = '1';   */

  log.debug('Scroll animations module loaded');

})();    });  function animateHeader(header) {

  }    if (REDUCED_MOTION) return;

    

  /**    header.style.transform = 'translateY(-20px)';

   * Handle intersection observer callback    header.style.opacity = '0';

   */    header.style.transition = '';

  function handleIntersection(entries) {    

    entries.forEach(entry => {    scheduleHeaderAnimation(header);

      const section = entry.target;  }

      

      if (entry.isIntersecting && entry.intersectionRatio >= ANIMATION_CONFIG.threshold) {  /**

        // Only animate once per section   * Handle intersection observer callback

        if (animatedSections.has(section)) return;   */

        animatedSections.add(section);  function handleIntersection(entries) {

            entries.forEach(entry => {

        log.debug('Triggering scroll animations for section', { id: section.id });      const section = entry.target;

              

        // Animate header first      if (entry.isIntersecting && entry.intersectionRatio >= ANIMATION_CONFIG.threshold) {

        const header = section.querySelector('.section-header');        // Only animate once per section

        if (header) {        if (animatedSections.has(section)) return;

          animateHeader(header);        animatedSections.add(section);

        }        

                log.debug('Triggering scroll animations for section', { id: section.id });

        // Animate cards with delay        

        const cardsContainer = section.querySelector('.features-cards');    /**

        if (cardsContainer) {   * Handle intersection observer callback

          setTimeout(() => animateCards(cardsContainer), 200);   */

        }  function handleIntersection(entries) {

            entries.forEach(entry => {

        // Announce to screen readers      const section = entry.target;

        const title = section.querySelector('.section-title')?.textContent || 'Section';      

        if (window.announce) {      if (entry.isIntersecting && entry.intersectionRatio >= ANIMATION_CONFIG.threshold) {

          window.announce(`${title} animiert`);        // Only animate once per section

        }        if (animatedSections.has(section)) return;

      }        animatedSections.add(section);

    });        

  }        log.debug('Triggering scroll animations for section', { id: section.id });

        

  /**        // Animate header first

   * Initialize scroll-based animations        const header = section.querySelector('.section-header');

   */        if (header) {

  function init() {          animateHeader(header);

    if (observer) return; // Already initialized        }

            

    log.debug('Initializing scroll-based card animations');        // Animate cards with delay

            const cardsContainer = section.querySelector('.features-cards');

    // Create intersection observer        if (cardsContainer) {

    observer = new IntersectionObserver(handleIntersection, {          setTimeout(() => animateCards(cardsContainer), 200);

      threshold: [0, ANIMATION_CONFIG.threshold, 0.5, 1],        }

      rootMargin: ANIMATION_CONFIG.rootMargin        

    });        // Announce to screen readers

            const title = section.querySelector('.section-title')?.textContent || 'Section';

    // Observe all feature sections        if (window.announce) {

    const sections = document.querySelectorAll('.full-screen-section, [data-scroll-animate]');          window.announce(`${title} animiert`);

    sections.forEach(section => {        }

      const hasCards = section.querySelector('.features-cards');      }

      if (hasCards) {    });

        observer.observe(section);  }

        log.debug('Observing section for scroll animations', { id: section.id || 'unnamed' });      }

      }    });

    });  }

    

    // Reset animations when page visibility changes (for testing)  /**

    document.addEventListener('visibilitychange', () => {   * Initialize scroll-based animations

      if (document.visibilityState === 'visible') {   */

        // Allow re-animation when page becomes visible again  function init() {

        setTimeout(() => {    if (observer) return; // Already initialized

          animatedSections = new WeakSet();    

        }, 1000);    log.debug('Initializing scroll-based card animations');

      }    

    });    // Create intersection observer

  }    observer = new IntersectionObserver(handleIntersection, {

      threshold: [0, ANIMATION_CONFIG.threshold, 0.5, 1],

  /**      rootMargin: ANIMATION_CONFIG.rootMargin

   * Cleanup function    });

   */    

  function cleanup() {    // Observe all feature sections

    if (observer) {    const sections = document.querySelectorAll('.full-screen-section, [data-scroll-animate]');

      observer.disconnect();    sections.forEach(section => {

      observer = null;      const hasCards = section.querySelector('.features-cards');

    }      if (hasCards) {

    animatedSections = new WeakSet();        observer.observe(section);

    log.debug('Scroll animations cleaned up');        log.debug('Observing section for scroll animations', { id: section.id || 'unnamed' });

  }      }

    });

  /**    

   * Re-scan for new sections (called after template loading)    // Reset animations when page visibility changes (for testing)

   */    document.addEventListener('visibilitychange', () => {

  function rescan() {      if (document.visibilityState === 'visible') {

    if (!observer) return;        // Allow re-animation when page becomes visible again

            setTimeout(() => {

    // Find new sections that aren't being observed yet          animatedSections = new WeakSet();

    const sections = document.querySelectorAll('.full-screen-section, [data-scroll-animate]');        }, 1000);

    sections.forEach(section => {      }

      const hasCards = section.querySelector('.features-cards');    });

      if (hasCards && !animatedSections.has(section)) {  }

        observer.observe(section);

        log.debug('Added new section to scroll animation observer', { id: section.id || 'unnamed' });  /**

      }   * Cleanup function

    });   */

  }  function cleanup() {

    if (observer) {

  // Public API      observer.disconnect();

  window.ScrollAnimations = {      observer = null;

    init,    }

    cleanup,    animatedSections = new WeakSet();

    rescan,    log.debug('Scroll animations cleaned up');

    version: '1.0.0'  }

  };

  /**

  // Auto-initialize when DOM is ready   * Re-scan for new sections (called after template loading)

  if (document.readyState === 'loading') {   */

    document.addEventListener('DOMContentLoaded', init);  function rescan() {

  } else {    if (!observer) return;

    // DOM already loaded, initialize immediately with small delay    

    setTimeout(init, 100);    // Find new sections that aren't being observed yet

  }    const sections = document.querySelectorAll('.full-screen-section, [data-scroll-animate]');

    sections.forEach(section => {

  // Re-scan when templates are loaded      const hasCards = section.querySelector('.features-cards');

  document.addEventListener('featuresTemplatesLoaded', () => {      if (hasCards && !animatedSections.has(section)) {

    setTimeout(rescan, 100);        observer.observe(section);

  });        log.debug('Added new section to scroll animation observer', { id: section.id || 'unnamed' });

      }

  log.debug('Scroll animations module loaded');    });

})();  }

  // Public API
  window.ScrollAnimations = {
    init,
    cleanup,
    rescan,
    version: '1.0.0'
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded, initialize immediately with small delay
    setTimeout(init, 100);
  }

  // Re-scan when templates are loaded
  document.addEventListener('featuresTemplatesLoaded', () => {
    setTimeout(rescan, 100);
  });

  log.debug('Scroll animations module loaded');
})();