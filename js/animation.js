export class AnimationManager {
  constructor() {
    this.animateElements = document.querySelectorAll(".scroll-animate, .text-animate");
    this.fullVisibleElements = document.querySelectorAll(".full-visible");
    // Animation-Konfiguration
    this.animations = {
      fadeInUp: {
        class: 'animate__fadeInUp',
        duration: '0.8s',
        timing: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    };
  }

  init() {
    this.setupScrollAnimations();
    this.setupFullVisibleAnimations();
  }

  setupScrollAnimations() {
    const observer = new IntersectionObserver(
      (entries) => this.handleScrollAnimations(entries),
      { threshold: 0.5, rootMargin: "0px 0px -50px 0px" }
    );
    this.animateElements.forEach(el => observer.observe(el));
  }

  setupFullVisibleAnimations() {
    const observer = new IntersectionObserver(
      (entries, observer) => this.handleFullVisibleAnimations(entries, observer),
      { threshold: 1.0 }
    );
    this.fullVisibleElements.forEach(el => observer.observe(el));
  }

  handleScrollAnimations(entries) {
    entries.forEach(({ target, isIntersecting }) => {
      if (!target.classList.contains("full-visible")) {
        this.animateElement(target, isIntersecting);
      }
    });
  }

  handleFullVisibleAnimations(entries, observer) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        this.animateElement(entry.target, true);
        observer.unobserve(entry.target);
      }
    });
  }

  animateElement(element, isIntersecting) {
    // Prüfe auf fadeInUp Animation
    const isFadeInUp = element.dataset.animation === 'animate__fadeInUp';
    const delay = (parseFloat(element.dataset.delay) || 0);
    
    if (isIntersecting) {
      // Element vorbereiten
      element.style.opacity = '0';
      element.style.transform = 'translateY(20px)';
      element.style.visibility = 'visible';
      
      // Verzögerung anwenden
      setTimeout(() => {
        // Animate.css Klassen
        element.classList.add('animate__animated', 'animate__fadeInUp');
        
        // Custom Styling
        element.style.animationDuration = this.animations.fadeInUp.duration;
        element.style.animationTimingFunction = this.animations.fadeInUp.timing;
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
        
        // Cleanup nach Animation
        element.addEventListener('animationend', () => {
          element.classList.remove('animate__animated', 'animate__fadeInUp');
          // Finale Styles beibehalten
          element.style.opacity = '1';
          element.style.transform = 'translateY(0)';
        }, { once: true });
      }, delay);
    } else {
      // Reset Styles
      element.style.opacity = '0';
      element.style.transform = 'translateY(20px)';
      element.classList.remove('animate__animated', 'animate__fadeInUp');
    }
  }
}
