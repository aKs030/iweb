// public/js/menu.js - Erweiterte Menü-Funktionalität

// ===== Menü-System Initialisierung =====
class MenuSystem {
  constructor() {
    this.elements = {
      header: null,
      mobileToggle: null,
      mobileMenu: null,
      searchToggle: null,
      searchOverlay: null,
      searchInput: null,
      searchClose: null,
      themeToggle: null,
      progressBar: null
    };
    
    this.state = {
      mobileMenuOpen: false,
      searchOpen: false,
      theme: localStorage.getItem('theme') || 'dark',
      lastScroll: 0,
      scrollDirection: 'up'
    };
    
    this.searchableContent = [];
    // Asynchrone Initialisierung außerhalb des Konstruktors
    setTimeout(() => { this.init(); }, 0);
  }

  async init() {
    // Lade CSS
    await this.loadCSS();
    
    // Lade HTML
    await this.loadHTML();
    
    // Initialisiere nach DOM-Load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  loadCSS() {
    return new Promise((resolve) => {
      if (document.querySelector('link[href*="menu.css"]')) {
        resolve();
        return;
      }
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'public/css/menu.css';
      link.onload = resolve;
      document.head.appendChild(link);
    });
  }

  async loadHTML() {
    try {
      const response = await fetch('/public/menu.html');
      const html = await response.text();
      
      const menuContainer = document.createElement('div');
      menuContainer.innerHTML = html;
      
      // Füge Skip-Link hinzu
      const skipLink = document.createElement('a');
      skipLink.href = '#main';
      skipLink.className = 'skip-to-content';
      skipLink.textContent = 'Zum Hauptinhalt springen';
      
      document.body.insertBefore(skipLink, document.body.firstChild);
      document.body.insertBefore(menuContainer, document.body.firstChild.nextSibling);
      
      // Setze Padding für Body
      document.body.style.paddingTop = '70px';
    } catch (error) {
      console.error('Fehler beim Laden des Menüs:', error);
    }
  }

  setup() {
    this.cacheElements();
    this.bindEvents();
    this.setActiveLink();
    this.initTheme();
    this.initScrollBehavior();
    this.initProgressBar();
    // this.initSearch(); // entfernt, da nicht definiert
    this.initAccessibility();
  }

  cacheElements() {
    this.elements = {
      header: document.getElementById('mainHeader'),
      mobileToggle: document.getElementById('mobileToggle'),
      mobileMenu: document.getElementById('mobileMenu'),
      searchToggle: document.getElementById('searchToggle'),
      mobileSearchBtn: document.getElementById('mobileSearchBtn'),
      searchOverlay: document.getElementById('searchOverlay'),
      searchInput: document.getElementById('searchInput'),
      searchClose: document.getElementById('searchClose'),
      themeToggle: document.getElementById('themeToggle'),
      mobileThemeToggle: document.getElementById('mobileThemeToggle'),
      progressBar: document.getElementById('progressBar'),
      navLinks: document.querySelectorAll('.nav-link, .mobile-nav-link'),
      dropdownToggles: document.querySelectorAll('.mobile-dropdown-toggle')
    };
  }

  bindEvents() {
    // Mobile Menu
    this.elements.mobileToggle?.addEventListener('click', () => this.toggleMobileMenu());
    
    // Search
    this.elements.searchToggle?.addEventListener('click', () => this.openSearch());
    this.elements.mobileSearchBtn?.addEventListener('click', () => {
      this.closeMobileMenu();
      this.openSearch();
    });
    this.elements.searchClose?.addEventListener('click', () => this.closeSearch());
    this.elements.searchOverlay?.addEventListener('click', (e) => {
      if (e.target === this.elements.searchOverlay) {
        this.closeSearch();
      }
    });
    
    // Theme Toggle
    this.elements.themeToggle?.addEventListener('click', () => this.toggleTheme());
    this.elements.mobileThemeToggle?.addEventListener('click', () => this.toggleTheme());
    
    // Mobile Dropdowns
    this.elements.dropdownToggles.forEach(toggle => {
      toggle.addEventListener('click', () => this.toggleMobileDropdown(toggle));
    });
    
    // Navigation Links
    this.elements.navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (this.state.mobileMenuOpen) {
          this.closeMobileMenu();
        }
      });
    });
    
    // Keyboard Events
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    
    // Window Events
    window.addEventListener('scroll', () => this.handleScroll());
    window.addEventListener('resize', () => this.handleResize());
  }

  // ===== Mobile Menu Functions =====
  toggleMobileMenu() {
    this.state.mobileMenuOpen = !this.state.mobileMenuOpen;
    
    this.elements.mobileToggle.classList.toggle('active');
    this.elements.mobileMenu.classList.toggle('active');
    
    // Prevent body scroll when menu is open
    document.body.style.overflow = this.state.mobileMenuOpen ? 'hidden' : '';
    
    // Accessibility
    this.elements.mobileToggle.setAttribute('aria-expanded', this.state.mobileMenuOpen);
    this.elements.mobileMenu.setAttribute('aria-hidden', !this.state.mobileMenuOpen);
    
    // Focus management
    if (this.state.mobileMenuOpen) {
      this.trapFocus(this.elements.mobileMenu);
    } else {
      this.releaseFocus();
    }
  }

  closeMobileMenu() {
    if (this.state.mobileMenuOpen) {
      this.toggleMobileMenu();
    }
  }

  toggleMobileDropdown(toggle) {
    const dropdownId = toggle.dataset.dropdown;
    const dropdown = document.getElementById(`${dropdownId}-dropdown`);
    
    if (!dropdown) return;
    
    const isActive = dropdown.classList.contains('active');
    
    // Close all dropdowns
    document.querySelectorAll('.mobile-dropdown-content').forEach(d => {
      d.classList.remove('active');
    });
    document.querySelectorAll('.mobile-dropdown-toggle').forEach(t => {
      t.classList.remove('active');
    });
    
    // Open clicked dropdown
    if (!isActive) {
      dropdown.classList.add('active');
      toggle.classList.add('active');
    }
  }

  // ===== Search Functions =====
  openSearch() {
    this.state.searchOpen = true;
    this.elements.searchOverlay.classList.add('active');
    this.elements.searchInput.focus();
    document.body.style.overflow = 'hidden';
    
    // Load searchable content
    this.loadSearchableContent();
  }

  closeSearch() {
    this.state.searchOpen = false;
    this.elements.searchOverlay.classList.remove('active');
    this.elements.searchInput.value = '';
    document.body.style.overflow = '';
    
    // Clear search results
    const resultsContainer = document.getElementById('searchResults');
    if (resultsContainer) {
      resultsContainer.style.display = 'none';
    }
  }

  async loadSearchableContent() {
    if (this.searchableContent.length > 0) return;
    
    // Define searchable pages
    const pages = [
      { title: 'Startseite', url: '/', keywords: ['home', 'start', 'portfolio'] },
      { title: 'Webentwicklung', url: '/pages/webentwicklung/', keywords: ['web', 'development', 'coding', 'programmierung'] },
      { title: 'Fotogalerie', url: '/pages/fotogalerie/', keywords: ['fotos', 'bilder', 'gallery', 'photography'] },
      { title: 'Spiele', url: '/pages/spiele/', keywords: ['games', 'memory', 'puzzle', 'spielen'] },
      { title: 'Über mich', url: '/pages/ueber-mich/', keywords: ['about', 'über', 'person', 'info'] },
      { title: 'Blog', url: '/pages/blog/', keywords: ['artikel', 'posts', 'neuigkeiten'] },
      { title: 'Kontakt', url: '/pages/kontakt/', keywords: ['contact', 'email', 'nachricht'] }
    ];
    
    this.searchableContent = pages;
    
    // Setup search input listener
    this.elements.searchInput.addEventListener('input', (e) => {
      this.performSearch(e.target.value);
    });
  }

  performSearch(query) {
    if (!query || query.length < 2) {
      document.getElementById('searchResults').style.display = 'none';
      return;
    }
    
    const results = this.searchableContent.filter(page => {
      const searchText = query.toLowerCase();
      return page.title.toLowerCase().includes(searchText) ||
             page.keywords.some(keyword => keyword.includes(searchText));
    });
    
    this.displaySearchResults(results);
  }

  displaySearchResults(results) {
    const resultsContainer = document.getElementById('searchResults');
    const resultsList = document.getElementById('searchResultsList');
    
    if (!resultsContainer || !resultsList) return;
    
    resultsList.innerHTML = '';
    
    if (results.length === 0) {
      resultsList.innerHTML = '<li>Keine Ergebnisse gefunden</li>';
    } else {
      results.forEach(result => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = result.url;
        a.textContent = result.title;
        a.addEventListener('click', () => this.closeSearch());
        li.appendChild(a);
        resultsList.appendChild(li);
      });
    }
    
    resultsContainer.style.display = 'block';
  }

  // ===== Theme Functions =====
  initTheme() {
    // Apply saved theme
    document.documentElement.setAttribute('data-theme', this.state.theme);
    this.updateThemeIcon();
  }

  toggleTheme() {
    this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.state.theme);
    localStorage.setItem('theme', this.state.theme);
    this.updateThemeIcon();
    
    // Animate theme change
    document.documentElement.style.transition = 'background-color 0.3s ease';
  }

  updateThemeIcon() {
    const sunIcon = this.elements.themeToggle?.querySelector('.sun-icon');
    const moonIcon = this.elements.themeToggle?.querySelector('.moon-icon');
    const mobileThemeText = this.elements.mobileThemeToggle?.querySelector('span:last-child');
    const mobileThemeIcon = this.elements.mobileThemeToggle?.querySelector('.theme-icon');
    
    if (this.state.theme === 'dark') {
      sunIcon?.style.setProperty('display', 'block');
      moonIcon?.style.setProperty('display', 'none');
      if (mobileThemeText) mobileThemeText.textContent = 'Light Mode';
      if (mobileThemeIcon) mobileThemeIcon.textContent = '☀️';
    } else {
      sunIcon?.style.setProperty('display', 'none');
      moonIcon?.style.setProperty('display', 'block');
      if (mobileThemeText) mobileThemeText.textContent = 'Dark Mode';
      if (mobileThemeIcon) mobileThemeIcon.textContent = '🌙';
    }
  }

  // ===== Scroll Functions =====
  initScrollBehavior() {
    let ticking = false;
    
    this.handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          this.updateScrollState();
          ticking = false;
        });
        ticking = true;
      }
    };
  }

  updateScrollState() {
    const currentScroll = window.pageYOffset;
    
    // Add/remove scrolled class
    if (currentScroll > 50) {
      this.elements.header?.classList.add('scrolled');
    } else {
      this.elements.header?.classList.remove('scrolled');
    }
    
    // Hide/show header on scroll
    if (currentScroll > this.state.lastScroll && currentScroll > 100) {
      // Scrolling down
      this.elements.header?.classList.add('hide');
    } else {
      // Scrolling up
      this.elements.header?.classList.remove('hide');
    }
    
    this.state.lastScroll = currentScroll <= 0 ? 0 : currentScroll;
    
    // Update progress bar
    this.updateProgressBar();
  }

  // ===== Progress Bar =====
  initProgressBar() {
    this.updateProgressBar();
  }

  updateProgressBar() {
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    
    if (this.elements.progressBar) {
      this.elements.progressBar.style.width = scrolled + '%';
    }
  }

  // ===== Active Link =====
  setActiveLink() {
    const currentPath = window.location.pathname;
    
    this.elements.navLinks.forEach(link => {
      const linkPath = new URL(link.href).pathname;
      
      if (linkPath === currentPath || 
          (currentPath !== '/' && currentPath.startsWith(linkPath) && linkPath !== '/')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // ===== Keyboard Navigation =====
  handleKeyboard(e) {
    // ESC key
    if (e.key === 'Escape') {
      if (this.state.searchOpen) {
        this.closeSearch();
      } else if (this.state.mobileMenuOpen) {
        this.closeMobileMenu();
      }
    }
    
    // Search shortcut (Ctrl/Cmd + K)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      this.openSearch();
    }
  }

  // ===== Resize Handler =====
  handleResize() {
    // Close mobile menu on resize to desktop
    if (window.innerWidth > 768 && this.state.mobileMenuOpen) {
      this.closeMobileMenu();
    }
  }

  // ===== Accessibility =====
  initAccessibility() {
    // ARIA labels
    this.elements.mobileToggle?.setAttribute('aria-label', 'Menü öffnen');
    this.elements.mobileToggle?.setAttribute('aria-expanded', 'false');
    this.elements.mobileMenu?.setAttribute('aria-hidden', 'true');
    
    // Focus trap for mobile menu
    this.focusableElements = [];
  }

  trapFocus(container) {
    const focusableSelectors = 'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select';
    this.focusableElements = container.querySelectorAll(focusableSelectors);
    
    if (this.focusableElements.length === 0) return;
    
    this.firstFocusableElement = this.focusableElements[0];
    this.lastFocusableElement = this.focusableElements[this.focusableElements.length - 1];
    
    // Focus first element
    this.firstFocusableElement.focus();
    
    // Add focus trap listener
    this.focusTrapHandler = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === this.firstFocusableElement) {
            e.preventDefault();
            this.lastFocusableElement.focus();
          }
        } else if (document.activeElement === this.lastFocusableElement) {
          e.preventDefault();
          this.firstFocusableElement.focus();
        }
      }
    };
    
    document.addEventListener('keydown', this.focusTrapHandler);
  }

  releaseFocus() {
    if (this.focusTrapHandler) {
      document.removeEventListener('keydown', this.focusTrapHandler);
      this.focusTrapHandler = null;
    }
  }
}

// ===== Initialize Menu System =====
const menuSystem = new MenuSystem();

// Export for use in other scripts
window.MenuSystem = menuSystem;