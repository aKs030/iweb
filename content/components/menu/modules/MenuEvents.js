/**
 * Menu Events - Event handling and interactions
 */

import { EVENTS } from '/content/core/events.js';

function addListener(target, event, handler, options = {}) {
  if (!target?.addEventListener) return () => {};
  const finalOptions = { passive: true, ...options };
  try {
    target.addEventListener(event, handler, finalOptions);
    return () => target.removeEventListener(event, handler, finalOptions);
  } catch {
    return () => {};
  }
}

export class MenuEvents {
  constructor(container, state, renderer, config = {}) {
    this.container = container;
    this.state = state;
    this.renderer = renderer;
    this.config = config;
    this.cleanupFns = [];
  }

  init() {
    this.setupToggle();
    this.setupSearch();
    this.setupNavigation();
    this.setupLogo();
    this.setupGlobalListeners();
    this.setupPageSpecific();
    this.setActiveLink();
  }

  setupToggle() {
    const toggle = this.container.querySelector('.site-menu__toggle');
    const menu = this.container.querySelector('.site-menu');

    if (!toggle || !menu) return;

    const handleToggle = () => {
      const isOpen = !this.state.isOpen;
      this.state.setOpen(isOpen);

      menu.classList.toggle('open', isOpen);
      toggle.classList.toggle('active', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      menu.setAttribute('aria-hidden', String(!isOpen));
    };

    this.cleanupFns.push(
      addListener(toggle, 'click', handleToggle),
      addListener(toggle, 'keydown', (e) => {
        if (e.key === 'Enter') handleToggle();
      }),
    );
  }

  setupSearch() {
    const searchTrigger = this.container.querySelector('.search-trigger');
    if (!searchTrigger) return;

    const handleSearch = async (e) => {
      e.preventDefault();
      this.closeMenu();

      try {
        const module = await import('/content/components/search/search.js');
        if (module.openSearch) module.openSearch();
      } catch (err) {
        console.error('Failed to load search:', err);
      }
    };

    this.cleanupFns.push(addListener(searchTrigger, 'click', handleSearch));
  }

  setupNavigation() {
    const links = this.container.querySelectorAll('.site-menu a[href]');

    links.forEach((link) => {
      const handleClick = (e) => {
        const href = link.getAttribute('href');
        const isExternal = /^https?:\/\//i.test(href);
        const isAnchor = href?.startsWith('#');

        this.closeMenu();

        if (window.innerWidth <= 768 && href && !isExternal && !isAnchor) {
          e.preventDefault();
          setTimeout(() => (window.location.href = href), 160);
        }
      };

      this.cleanupFns.push(addListener(link, 'click', handleClick));
    });
  }

  setupLogo() {
    const logoContainer = this.container.querySelector('.site-logo__container');
    if (!logoContainer) return;

    const handleContext = (e) => {
      e.preventDefault?.();
      window.location.href = '/';
    };

    this.cleanupFns.push(
      addListener(logoContainer, 'contextmenu', handleContext),
    );
  }

  setupGlobalListeners() {
    const handleDocClick = (e) => {
      const isInside = this.container.contains(e.target);
      const isToggle = e.target.closest('.site-menu__toggle');
      if (!isInside && !isToggle) this.closeMenu();
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        this.closeMenu();
        this.container.querySelector('.site-menu__toggle')?.focus();
      }
    };

    this.cleanupFns.push(
      addListener(document, 'click', handleDocClick),
      addListener(document, 'keydown', handleEscape),
    );

    window.addEventListener('hashchange', () => this.setActiveLink());
    window.addEventListener('popstate', () => this.setActiveLink());
  }

  setupPageSpecific() {
    this.fixSubpageLinks();
    this.setSiteTitle();

    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') {
      this.initScrollDetection();
    }
  }

  fixSubpageLinks() {
    const path = window.location.pathname;
    const isHomePage = path === '/' || path === '/index.html';

    if (!isHomePage) {
      const links = this.container.querySelectorAll('.site-menu a[href^="#"]');
      links.forEach((link) => {
        const hash = link.getAttribute('href');
        link.setAttribute('href', `/${hash}`);
      });
    }
  }

  setSiteTitle() {
    const path = window.location.pathname;
    const titleMap = this.config.TITLE_MAP || {};
    const pageTitle = titleMap[path] || document.title || 'Website';
    this.state.setTitle(pageTitle);
  }

  initScrollDetection() {
    const handleSnapChange = (event) => {
      const { index, id } = event.detail || {};
      let sectionId = id === 'site-footer' ? 'contact' : id;

      if (!sectionId && typeof index === 'number') {
        const sections = Array.from(
          document.querySelectorAll(
            'main .section, .section, footer#site-footer',
          ),
        );
        const section = sections[index];
        sectionId = section?.id === 'site-footer' ? 'contact' : section?.id;
      }

      if (sectionId) {
        const { title, subtitle } = this.extractSectionInfo(sectionId);
        this.state.setTitle(title, subtitle);
      }
    };

    const start = () => {
      window.addEventListener('snapSectionChange', handleSnapChange);
      const { title, subtitle } = this.extractSectionInfo('hero');
      this.state.setTitle(title, subtitle);
    };

    if (
      document.querySelector('#hero') &&
      document.querySelector('#site-footer')
    ) {
      start();
    } else {
      document.addEventListener(EVENTS.MODULES_READY, start, { once: true });
      document.addEventListener('footer:loaded', start, { once: true });
    }
  }

  extractSectionInfo(sectionId) {
    const fallbackTitles = this.config.FALLBACK_TITLES || {};
    const section = document.querySelector(`#${sectionId}`);
    if (!section) {
      return fallbackTitles[sectionId] || { title: 'Startseite', subtitle: '' };
    }

    if (['hero', 'features', 'section3', 'contact'].includes(sectionId)) {
      const headers = section.querySelectorAll(
        '.section-header, .section-subtitle',
      );
      headers.forEach((header) => {
        header.style.display = 'none';
        header.style.visibility = 'hidden';
      });
      return fallbackTitles[sectionId] || { title: 'Startseite', subtitle: '' };
    }

    const header = section.querySelector('.section-header');
    if (!header) {
      return fallbackTitles[sectionId] || { title: 'Startseite', subtitle: '' };
    }

    const titleEl = header.querySelector('.section-title, h1, h2, h3');
    const subtitleEl = header.querySelector('.section-subtitle');

    const title =
      titleEl?.textContent?.trim() ||
      fallbackTitles[sectionId]?.title ||
      'Startseite';
    const subtitle =
      subtitleEl?.textContent?.trim() ||
      fallbackTitles[sectionId]?.subtitle ||
      '';

    return { title, subtitle };
  }

  setActiveLink() {
    const path = window.location.pathname.replace(/index\.html$/, '');
    const hash = window.location.hash;

    document.querySelectorAll('.site-menu a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;

      if (href.startsWith('#')) {
        const isIndexPath =
          path === '/' || path === '/index.html' || path === '';
        if (href === hash || (isIndexPath && hash === '' && href === '#hero')) {
          a.classList.add('active');
        } else {
          a.classList.remove('active');
        }
        return;
      }

      const norm = href.replace(/index\.html$/, '');
      const linkPath = norm.split('#')[0];
      const linkHash = a.hash;

      if (norm === path || (linkPath === path && linkHash === hash)) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
  }

  closeMenu() {
    const toggle = this.container.querySelector('.site-menu__toggle');
    const menu = this.container.querySelector('.site-menu');

    if (!toggle || !menu) return;

    this.state.setOpen(false);
    menu.classList.remove('open');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
  }

  destroy() {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }
}
