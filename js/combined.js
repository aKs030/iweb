"use strict";
// -------------------- AnimationManager (aus animation.js) --------------------
export class AnimationManager {
  constructor() {
    this.animateElements = document.querySelectorAll(".scroll-animate, .text-animate");
    this.fullVisibleElements = document.querySelectorAll(".full-visible");
    // ...existing code...
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
    const isFadeInUp = element.dataset.animation === 'animate__fadeInUp';
    const delay = (parseFloat(element.dataset.delay) || 0);
    if (isIntersecting) {
      element.style.opacity = '0';
      element.style.transform = 'translateY(20px)';
      element.style.visibility = 'visible';
      setTimeout(() => {
        element.classList.add('animate__animated', 'animate__fadeInUp');
        element.style.animationDuration = this.animations.fadeInUp.duration;
        element.style.animationTimingFunction = this.animations.fadeInUp.timing;
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
        element.addEventListener('animationend', () => {
          element.classList.remove('animate__animated', 'animate__fadeInUp');
          element.style.opacity = '1';
          element.style.transform = 'translateY(0)';
        }, { once: true });
      }, delay);
    } else {
      element.style.opacity = '0';
      element.style.transform = 'translateY(20px)';
      element.classList.remove('animate__animated', 'animate__fadeInUp');
    }
  }
}

// -------------------- FeatureCardsManager (aus features.js) --------------------
export class FeatureCardsManager {
  constructor() {
    this.cards = document.querySelectorAll("#features .card");
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
      (entries) => this.handleCardIntersection(entries),
      { threshold: 0.5 }
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

// -------------------- NavigationManager (aus navigation.js) --------------------
export class NavigationManager {
  constructor() {
    this.navItems = document.querySelectorAll(".nav-item");
    this.sections = document.querySelectorAll("section");
    this.navLinks = document.querySelectorAll(".nav-link");
    this.activeNavItem = null;
  }

  init() {
    this.setupNavigation();
    this.setupScrollObserver();
  }

  setupNavigation() {
    this.navLinks.forEach(link => link.addEventListener("click", this.handleNavClick.bind(this)));
  }

  setupScrollObserver() {
    const observer = new IntersectionObserver(
      entries => this.handleIntersection(entries),
      { threshold: 0.5, rootMargin: "0px 0px -50px 0px" }
    );
    this.sections.forEach(section => observer.observe(section));
  }

  handleNavClick(e) {
    e.preventDefault();
    const targetId = e.currentTarget.getAttribute("href").substring(1);
    const targetSection = document.getElementById(`section-${targetId}`) || document.getElementById(targetId);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: "smooth", block: "center" });
      // Entferne aktive Klassen von allen Nav-Elementen, damit das geklickte nicht dauerhaft aktiv bleibt
      this.navItems.forEach(item => item.classList.remove("active"));
      e.currentTarget.blur();
      this.dispatchSectionUpdate(targetId);
    }
  }

  handleIntersection(entries) {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        const sectionId = target.id.replace('section-', '');
        const newActive = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
        if (newActive && newActive !== this.activeNavItem) {
          this.updateActiveNavItem(newActive);
          this.dispatchSectionUpdate(sectionId);
        }
      }
    });
  }

  updateActiveNavItem(activeItem) {
    if (this.activeNavItem === activeItem) return;
    this.navItems.forEach(item => item.classList.remove("active"));
    activeItem.classList.add("active");
    this.activeNavItem = activeItem;
  }

  dispatchSectionUpdate(sectionId) {
    document.dispatchEvent(new CustomEvent('sectionUpdate', { detail: { sectionId } }));
  }
}
