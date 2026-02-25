/**
 * Scroll Navigation Component
 * Creates and manages a dot navigation for scroll-snap sections.
 */

export class ScrollNav {
  constructor(
    containerId = 'scroll-nav-container',
    sectionSelector = '.scroll-section',
  ) {
    this.containerId = containerId;
    this.sectionSelector = sectionSelector;
    this.observer = null;
    this.sections = [];
  }

  init() {
    this.sections = Array.from(document.querySelectorAll(this.sectionSelector));
    if (this.sections.length === 0) return;

    this.createNav();
    this.setupObserver();
  }

  createNav() {
    // Remove existing nav if present
    const existingNav = document.getElementById(this.containerId);
    if (existingNav) existingNav.remove();

    const nav = document.createElement('nav');
    nav.id = this.containerId;
    nav.className = 'scroll-nav';
    nav.setAttribute('aria-label', 'Section Navigation');

    this.sections.forEach((section, index) => {
      const dot = document.createElement('button');
      dot.className = 'scroll-nav__dot';
      dot.setAttribute(
        'aria-label',
        section.getAttribute('aria-label') || `Section ${index + 1}`,
      );
      dot.setAttribute('aria-current', index === 0 ? 'true' : 'false');

      if (index === 0) dot.classList.add('active');

      dot.addEventListener('click', () => {
        // window-based scrolling for compatibility
        section.scrollIntoView({ behavior: 'smooth' });
        this.updateActiveDot(section);
      });

      nav.appendChild(dot);
    });

    document.body.appendChild(nav);
  }

  setupObserver() {
    const options = {
      root: null, // viewport
      threshold: 0.5, // trigger when 50% visible
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.updateActiveDot(entry.target);
        }
      });
    }, options);

    this.sections.forEach((section) => {
      this.observer.observe(section);
    });
  }

  updateActiveDot(targetSection) {
    const index = this.sections.indexOf(targetSection);
    const dots = document.querySelectorAll('.scroll-nav__dot');

    dots.forEach((dot, i) => {
      if (i === index) {
        dot.classList.add('active');
        dot.setAttribute('aria-current', 'true');
      } else {
        dot.classList.remove('active');
        dot.setAttribute('aria-current', 'false');
      }
    });
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    const nav = document.getElementById(this.containerId);
    if (nav) nav.remove();
  }
}
