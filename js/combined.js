"use strict";
// -------------------- AnimationManager (aus animation.js) --------------------
export class AnimationManager {
  constructor() {
    this.animateElements = document.querySelectorAll(".scroll-animate, .text-animate");
    this.fullVisibleElements = document.querySelectorAll(".full-visible");
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
      (entries) => this.handleScrollAnimations(entries)
    );
    this.animateElements.forEach(el => observer.observe(el));
  }

  setupFullVisibleAnimations() {
    const observer = new IntersectionObserver(
      (entries, observer) => this.handleFullVisibleAnimations(entries, observer)
    );
    this.fullVisibleElements.forEach(el => observer.observe(el));
  }

  handleScrollAnimations(entries) {
    entries.forEach(({ target, isIntersecting }) => {
      if (!target.classList.contains("full-visible")) {
        this.animateElement(target, isIntersecting);
      } else if (!isIntersecting) {
        this.resetAnimation(target);
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
    const delay = parseFloat(element.dataset.delay) || 0;
    const offset = window.innerWidth < 768 ? 10 : 20;
    if (isIntersecting) {
      element.style.opacity = '0';
      element.style.transform = `translateY(${offset}px)`;
      element.style.visibility = 'visible';
      setTimeout(() => {
        requestAnimationFrame(() => {
          element.classList.add('animate__animated', this.animations.fadeInUp.class);
          element.style.animationDuration = this.animations.fadeInUp.duration;
          element.style.animationTimingFunction = this.animations.fadeInUp.timing;
          element.style.opacity = '1';
          element.style.transform = 'translateY(0)';
          // Einheitlicher animationend-Listener
          element.addEventListener('animationend', () => {
            element.classList.remove('animate__animated', this.animations.fadeInUp.class);
            element.classList.add('visible');
          }, { once: true });
        });
      }, delay);
    } else {
      this.resetAnimation(element);
    }
  }

  resetAnimation(element) {
    const offset = window.innerWidth < 768 ? 10 : 20;
    element.style.opacity = '0';
    element.style.transform = `translateY(${offset}px)`;
    element.classList.remove('animate__animated', this.animations.fadeInUp.class);
    element.classList.remove('visible');
  }
}

// -------------------- FeatureCardsManager (aus features.js) --------------------
export class FeatureCardsManager {
  constructor() {
    this.cards = document.querySelectorAll("#section-features .card");
    this.activeIndex = 0;
    this.initialLoad = true;
  }

  init() {
    this.setupCardObserver();
    this.setupInteractionHandlers();
    this.setActiveCard(this.activeIndex);
  }

  setupCardObserver() {
    const observer = new IntersectionObserver(
      (entries) => this.handleCardIntersection(entries)
    );
    this.cards.forEach(card => observer.observe(card));
  }

  setupInteractionHandlers() {
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    if (isTouchDevice) {
      this.setupTouchHandlers();
    } else {
      this.setupMouseHandlers();
    }
  }

  setupTouchHandlers() {
    this.cards.forEach(card => {
      card.addEventListener("touchstart", () => card.classList.add("active"));
      card.addEventListener("touchend", () => {
        setTimeout(() => card.classList.remove("active"), 500);
      });
    });
  }

  setupMouseHandlers() {
    this.cards.forEach(card => {
      card.addEventListener("mouseenter", () => card.classList.add("active"));
      card.addEventListener("mouseleave", () => card.classList.remove("active"));
    });
  }

  handleCardIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = Array.from(this.cards).indexOf(entry.target);
        if (index !== this.activeIndex) {
          this.activeIndex = index;
          this.setActiveCard(this.activeIndex);
        }
      }
    });
  }

  setActiveCard(index) {
    this.cards.forEach((card, i) => {
      card.classList.toggle("active", i === index);
      if (!this.initialLoad && i === index) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }
}
