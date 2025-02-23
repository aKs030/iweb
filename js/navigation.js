export class NavigationManager {
  constructor() {
    this.navItems = document.querySelectorAll(".nav-item");
    this.sections = document.querySelectorAll("section");
    this.navLinks = document.querySelectorAll(".nav-link");
  }

  init() {
    this.setupNavigation();
    this.setupScrollObserver();
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
    const href = e.currentTarget.getAttribute("href");
    const targetId = href.substring(1);
    console.log("Clicked:", targetId);

    const targetSection = document.getElementById(`section-${targetId}`) || document.getElementById(targetId);
    console.log("Target Section:", targetSection);
    
    if (targetSection) {
      e.preventDefault();
      targetSection.scrollIntoView({ behavior: "smooth", block: "center" });
      
      const updateEvent = new CustomEvent('sectionUpdate', {
        detail: { sectionId: targetId }
      });
      document.dispatchEvent(updateEvent);
    }
    // Wenn targetSection nicht existiert, wird die Standardnavigation ausgeführt.
  }

  handleIntersection(entries) {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        const sectionId = target.id.replace('section-', '');
        this.updateActiveNavItem(
          document.querySelector(`.nav-item[data-section="${sectionId}"]`)
        );
        
        // Trigger content update through custom event
        const updateEvent = new CustomEvent('sectionUpdate', {
          detail: { sectionId }
        });
        document.dispatchEvent(updateEvent);
      }
    });
  }

  updateActiveNavItem(activeItem) {
    this.navItems.forEach(item => item.classList.remove("active"));
    if (activeItem) activeItem.classList.add("active");
  }
}
