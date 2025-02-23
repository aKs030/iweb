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
    this.activeNavItem = null; // cache current nav item
    this.scrollTimeout = null; // Neu: Scroll-Timeout
  }

  init() {
    this.setupNavigation();
    this.setupScrollObserver();
    window.addEventListener("scroll", this.debouncedScroll.bind(this));
  }

  setupNavigation() {
    this.navLinks.forEach(link => {
      link.addEventListener("click", (e) => this.handleNavClick(e));
    });
  }

  setupScrollObserver() {
    const observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      { threshold: 0.5, rootMargin: "0px 0px -50px 0px" }
    );
    this.sections.forEach(section => observer.observe(section));
  }

  handleNavClick(e) {
    e.preventDefault();
    const href = e.currentTarget.getAttribute("href");
    const targetId = href.substring(1);
    const targetSection = document.getElementById(`section-${targetId}`) || document.getElementById(targetId);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: "smooth", block: "center" });
      const newActive = document.querySelector(`.nav-item[data-section="${targetId}"]`);
      if (newActive && newActive !== this.activeNavItem) {
        this.updateActiveNavItem(newActive);
      }
      const updateEvent = new CustomEvent('sectionUpdate', {
        detail: { sectionId: targetId }
      });
      document.dispatchEvent(updateEvent);

      // Zusätzlicher Fix für mobile Ansicht: Entferne aktivierte Navitems nach kurzem Timeout
      if (window.matchMedia('(hover: none)').matches) {
        setTimeout(() => {
          this.navItems.forEach(item => item.classList.remove("active"));
        }, 1000);
      }
    }
    // ...existing code...
  }

  /* Neu: Debounced Scroll Handler */
  debouncedScroll() {
    if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      this.updateActiveNavOnScroll();
    }, 150);
  }

  /* Neu: Überprüft welche Section in Sicht ist und aktualisiert den Nav-Button */
  updateActiveNavOnScroll() {
    this.sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
        const sectionId = section.id.replace('section-', '');
        const newActive = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
        if (newActive && newActive !== this.activeNavItem) {
          this.updateActiveNavItem(newActive);
        }
      }
    });
  }

  handleIntersection(entries) {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        const sectionId = target.id.replace('section-', '');
        const newActive = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
        if (newActive && newActive !== this.activeNavItem) {
          this.updateActiveNavItem(newActive);
          const updateEvent = new CustomEvent('sectionUpdate', {
            detail: { sectionId }
          });
          document.dispatchEvent(updateEvent);
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
}
