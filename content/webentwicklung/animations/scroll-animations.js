/**
 * Advanced Scroll Animations mit GSAP-ähnlicher Syntax aber CSS-basiert
 * @author Abdulkerim Sesli
 */

export class ScrollAnimationController {
  constructor() {
    this.elements = new Map();
    this.scrollTriggers = new Set();
    this.rafId = null;
    this.lastScrollY = 0;
    this.velocity = 0;
    
    this.init();
  }

  init() {
    this.injectScrollStyles();
    this.bindEvents();
  }

  injectScrollStyles() {
    if (document.getElementById('scroll-animation-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'scroll-animation-styles';
    style.textContent = `
      /* Scroll-basierte Animationen */
      .scroll-reveal {
        opacity: 0;
        transform: translateY(60px);
        transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        will-change: opacity, transform;
      }
      
      .scroll-reveal.revealed {
        opacity: 1;
        transform: translateY(0);
      }
      
      /* Parallax-Effekte */
      .parallax-element {
        transform: translateZ(0);
        will-change: transform;
      }
      
      /* Velocity-basierte Animationen */
      .velocity-scale {
        transition: transform 0.3s ease-out;
      }
      
      .velocity-blur {
        transition: filter 0.2s ease-out;
      }
      
      /* Progress-basierte Animationen */
      .progress-scale {
        transform-origin: center;
        will-change: transform;
      }
      
      .progress-fade {
        will-change: opacity;
      }
      
      /* Magnetic Cursor Effect */
      .magnetic-element {
        transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
        will-change: transform;
      }
      
      /* Advanced Text Reveals */
      .text-reveal-word {
        display: inline-block;
        overflow: hidden;
      }
      
      .text-reveal-char {
        display: inline-block;
        transform: translateY(100%);
        transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        transition-delay: var(--char-delay, 0s);
      }
      
      .text-reveal-word.revealed .text-reveal-char {
        transform: translateY(0);
      }
      
      /* Scroll Progress Indicators */
      .scroll-progress {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background: linear-gradient(90deg, var(--primary-color), var(--primary-light));
        transform-origin: left;
        transform: scaleX(0);
        z-index: 9999;
        will-change: transform;
      }
      
      /* Performance Optimierungen */
      @media (prefers-reduced-motion: reduce) {
        .scroll-reveal,
        .parallax-element,
        .velocity-scale,
        .velocity-blur,
        .progress-scale,
        .progress-fade,
        .magnetic-element,
        .text-reveal-char {
          transform: none !important;
          filter: none !important;
          opacity: 1 !important;
          transition: none !important;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  // Scroll Progress Indicator
  createScrollProgress() {
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    document.body.appendChild(progressBar);
    
    return progressBar;
  }

  // Text Reveal Animation
  setupTextReveal(element) {
    const text = element.textContent;
    const words = text.split(' ');
    
    element.innerHTML = words.map(word => {
      const chars = word.split('').map((char, index) => 
        `<span class="text-reveal-char" style="--char-delay: ${index * 0.05}s">${char}</span>`
      ).join('');
      
      return `<span class="text-reveal-word">${chars}</span>`;
    }).join(' ');
  }

  // Parallax Effect
  createParallax(element, speed = 0.5) {
    const elementData = {
      element,
      speed,
      offset: 0
    };
    
    this.elements.set(element, elementData);
    element.classList.add('parallax-element');
    
    return elementData;
  }

  // Magnetic Effect für Buttons/Cards
  createMagneticEffect(element, strength = 0.3) {
    element.classList.add('magnetic-element');
    
    element.addEventListener('mouseenter', () => {
      element.style.transition = 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
    });
    
    element.addEventListener('mousemove', (e) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const deltaX = (e.clientX - centerX) * strength;
      const deltaY = (e.clientY - centerY) * strength;
      
      element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    });
    
    element.addEventListener('mouseleave', () => {
      element.style.transform = 'translate(0, 0)';
    });
  }

  // Velocity-basierte Effekte
  updateVelocityEffects() {
    const velocityElements = document.querySelectorAll('.velocity-scale, .velocity-blur');
    
    velocityElements.forEach(el => {
      const velocityFactor = Math.min(Math.abs(this.velocity) / 10, 1);
      
      if (el.classList.contains('velocity-scale')) {
        const scale = 1 + velocityFactor * 0.02;
        el.style.transform = `scale(${scale})`;
      }
      
      if (el.classList.contains('velocity-blur')) {
        const blur = velocityFactor * 2;
        el.style.filter = `blur(${blur}px)`;
      }
    });
  }

  // Scroll-basierte Animationen
  updateScrollAnimations() {
    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    // Velocity berechnen
    this.velocity = scrollY - this.lastScrollY;
    this.lastScrollY = scrollY;
    
    // Progress für Scroll Progress Bar
    const progress = scrollY / (documentHeight - viewportHeight);
    const progressBar = document.querySelector('.scroll-progress');
    if (progressBar) {
      progressBar.style.transform = `scaleX(${Math.min(progress, 1)})`;
    }
    
    // Parallax-Elemente updaten
    this.elements.forEach(data => {
      const { element, speed } = data;
      const rect = element.getBoundingClientRect();
      
      if (rect.bottom >= 0 && rect.top <= viewportHeight) {
        const yPos = -(scrollY * speed);
        element.style.transform = `translate3d(0, ${yPos}px, 0)`;
      }
    });
    
    // Velocity-Effekte
    this.updateVelocityEffects();
    
    // Scroll Reveals
    this.updateScrollReveals();
  }

  updateScrollReveals() {
    const revealElements = document.querySelectorAll('.scroll-reveal:not(.revealed)');
    const viewportHeight = window.innerHeight;
    
    revealElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const threshold = el.dataset.threshold ? parseFloat(el.dataset.threshold) : 0.1;
      
      if (rect.top < viewportHeight * (1 - threshold)) {
        el.classList.add('revealed');
        
        // Text Reveal animieren falls vorhanden
        if (el.classList.contains('text-reveal-container')) {
          const words = el.querySelectorAll('.text-reveal-word');
          words.forEach((word, index) => {
            setTimeout(() => {
              word.classList.add('revealed');
            }, index * 100);
          });
        }
      }
    });
  }

  bindEvents() {
    // Optimierter Scroll-Handler
    let ticking = false;
    
    const updateAnimations = () => {
      this.updateScrollAnimations();
      ticking = false;
    };
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateAnimations);
        ticking = true;
      }
    }, { passive: true });
    
    // Resize-Handler
    window.addEventListener('resize', () => {
      // Viewport-Änderungen handhaben
      this.elements.forEach(data => {
        // Parallax-Offsets neu berechnen
        data.offset = 0;
      });
    }, { passive: true });
  }

  // Public API
  addParallax(selector, speed = 0.5) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => this.createParallax(el, speed));
  }

  addMagnetic(selector, strength = 0.3) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => this.createMagneticEffect(el, strength));
  }

  addTextReveal(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      this.setupTextReveal(el);
      el.classList.add('text-reveal-container');
    });
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    
    this.elements.clear();
    this.scrollTriggers.clear();
    
    // Event-Listener entfernen
    window.removeEventListener('scroll', this.updateScrollAnimations);
    window.removeEventListener('resize', this.handleResize);
  }
}

// Auto-Initialisierung
if (typeof window !== 'undefined') {
  window.ScrollAnimationController = ScrollAnimationController;
  
  // Auto-Start
  document.addEventListener('DOMContentLoaded', () => {
    window.scrollAnimController = new ScrollAnimationController();
  });
}
