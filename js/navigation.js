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
    e.preventDefault();
    const targetId = e.currentTarget.getAttribute("href").substring(1);
    const targetSection = document.getElementById(targetId);
    
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
      this.updateActiveNavItem(e.currentTarget.closest(".nav-item"));
    }
  }

  handleIntersection(entries) {
    entries.forEach(({ target, isIntersecting }) => {
      if (target.id && isIntersecting) {
        this.updateActiveNavItem(
          document.querySelector(`.nav-item[data-section="${target.id}"]`)
        );
      }
    });
  }

  updateActiveNavItem(activeItem) {
    this.navItems.forEach(item => item.classList.remove("active"));
    if (activeItem) activeItem.classList.add("active");
  }
}
