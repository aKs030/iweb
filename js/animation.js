export class AnimationManager {
  constructor() {
    this.animateElements = document.querySelectorAll(".scroll-animate, .text-animate");
    this.fullVisibleElements = document.querySelectorAll(".full-visible");
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
    const animationClass = element.dataset.animation || "animate__fadeInUp";
    const delayInS = (parseFloat(element.dataset.delay) || 0) / 1000;
    element.style.transitionDelay = `${delayInS}s`;
    
    if (isIntersecting) {
      element.classList.add("visible", "animate__animated", animationClass);
    } else {
      element.classList.remove("visible", "animate__animated", animationClass);
    }
  }
}
