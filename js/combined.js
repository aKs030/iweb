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
    this.isMobile = window.matchMedia('(hover: none)').matches;
    this.touchStartY = 0;
    this.lastScrollTime = 0;
  }

  init() {
    this.setupNavigation();
    this.setupScrollObserver();
    this.setupMobileHandling();
  }

  setupNavigation() {
    this.navLinks.forEach(link => link.addEventListener("click", this.handleNavClick.bind(this)));
  }

  setupMobileHandling() {
    if (this.isMobile) {
      this.navLinks.forEach(link => {
        link.addEventListener('touchstart', (e) => {
          // Verhindere Standard-Touch-Verhalten
          e.preventDefault();
          
          // Entferne sofort alle aktiven Zustände
          this.navItems.forEach(item => item.classList.remove("active"));
          
          const href = link.getAttribute('href');
          const targetSection = document.querySelector(href);
          if (targetSection) {
            targetSection.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
          
          // Entferne den Fokus
          link.blur();
        }, { passive: false });

        link.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.touchStartY = e.touches[0].clientY;
          
          // Sofortige visuelle Rückmeldung
          const navItem = link.closest('.nav-item');
          navItem.classList.add('touching');
        }, { passive: false });

        link.addEventListener('touchend', (e) => {
          e.preventDefault();
          const navItem = link.closest('.nav-item');
          navItem.classList.remove('touching');
          
          // Verhindere zu schnelles wiederholtes Scrollen
          const now = Date.now();
          if (now - this.lastScrollTime < 500) return;
          this.lastScrollTime = now;

          const href = link.getAttribute('href');
          const targetSection = document.querySelector(href);
          if (targetSection) {
            targetSection.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        }, { passive: false });
      });

      // Scroll-Event-Listener für bessere Sektion-Erkennung
      window.addEventListener('scroll', () => {
        requestAnimationFrame(this.updateActiveSection.bind(this));
      }, { passive: true });
    }
  }

  setupScrollObserver() {
    const observer = new IntersectionObserver(
      entries => this.handleIntersection(entries),
      { 
        threshold: [0.5],  // Einzelner Schwellenwert für bessere Snap-Erkennung
        rootMargin: "-10% 0px" 
      }
    );
    this.sections.forEach(section => observer.observe(section));
  }

  handleNavClick(e) {
    e.preventDefault();
    const targetId = e.currentTarget.getAttribute("href").substring(1);
    const targetSection = document.getElementById(`section-${targetId}`) || document.getElementById(targetId);
    if (targetSection) {
      // Sofort den aktiven Zustand entfernen
      this.navItems.forEach(item => item.classList.remove("active"));
      e.currentTarget.blur();
      
      targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
      
      // Nach dem Scrollen den Fokus entfernen
      setTimeout(() => {
        e.currentTarget.blur();
        document.activeElement.blur();
      }, 100);

      this.dispatchSectionUpdate(targetId);
    }
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        const sectionId = entry.target.id.replace('section-', '');
        const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
        
        if (navItem) {
          this.updateActiveNavItem(navItem);
          this.dispatchSectionUpdate(sectionId);
        }
      }
    });
  }

  updateActiveNavItem(activeItem) {
    if (this.activeNavItem === activeItem) return;
    
    // Entferne alle aktiven Zustände
    this.navItems.forEach(item => {
      item.classList.remove("active");
      item.querySelector('.nav-link')?.blur();
    });
    
    if (activeItem) {
      activeItem.classList.add("active");
      this.activeNavItem = activeItem;
      
      // Auf Mobilgeräten NICHT den aktiven Status entfernen
      // Entfernt: setTimeout für das Entfernen der active-Klasse
    } else {
      this.activeNavItem = null;
    }
  }

  updateActiveSection() {
    const scrollPosition = window.scrollY + window.innerHeight / 2;
    
    let activeSection = null;
    this.sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      const sectionTop = rect.top + window.scrollY;
      const sectionBottom = sectionTop + rect.height;
      
      if (scrollPosition >= sectionTop && scrollPosition <= sectionBottom) {
        activeSection = section;
      }
    });

    if (activeSection) {
      const sectionId = activeSection.id;
      const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
      if (navItem) {
        this.updateActiveNavItem(navItem);
      }
    }
  }

  dispatchSectionUpdate(sectionId) {
    document.dispatchEvent(new CustomEvent('sectionUpdate', { detail: { sectionId } }));
  }
}
