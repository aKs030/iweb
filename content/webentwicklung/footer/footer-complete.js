/**
 * Footer Complete System - Fully Optimized
 * Removed duplicate code, simplified logic, better performance
 * @version 8.0.1 - FIX: Minimized footer visibility
 */

import { createLogger } from '../shared-utilities.js';

const log = createLogger('FooterSystem');
// (duplicate constants removed)

// Tunable constants (avoid magic numbers throughout file)
const PROGRAMMATIC_SCROLL_MARK_DURATION = 1000; // ms to mark upcoming programmatic scrolls
const PROGRAMMATIC_SCROLL_WATCH_TIMEOUT = 5000; // ms fallback for watching smooth scroll completion
const _PROGRAMMATIC_SCROLL_TRIGGER_FALLBACK = 800; // ms used when triggering fallback smooth scroll (unused, keep for future)
const PROGRAMMATIC_SCROLL_WATCH_THRESHOLD = 6; // px threshold to consider scroll reached
const PROGRAMMATIC_SCROLL_DEFAULT_DURATION = 600; // default token duration when not specified
// ===== Cookie Utilities =====
const CookieManager = {
  set(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `; expires=${date.toUTCString()}`;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${value || ''}${expires}; path=/; SameSite=Lax${secure}`;
  },

  get(name) {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(nameEQ)) {
        return cookie.substring(nameEQ.length);
      }
    }
    return null;
  },

  delete(name) {
    const domains = ['', window.location.hostname, `.${window.location.hostname}`];
    domains.forEach((domain) => {
      const domainPart = domain ? `; domain=${domain}` : '';
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/${domainPart}`;
    });
  },

  deleteAnalytics() {
    const analyticsCookies = ['_ga', '_gid', '_gat', '_gat_gtag_G_S0587RQ4CN'];
    analyticsCookies.forEach((name) => this.delete(name));
    log.info('Analytics cookies deleted');
  }
};

// ===== Global Close Handlers (click outside / user scroll to close maximized footer) =====
// Programmatic scroll token manager — create a token when starting a programmatic scroll
// ===== Global Close Handlers (click outside / user scroll to close maximized footer) =====
// Programmatic scroll token manager — create a token when starting a programmatic scroll
const ProgrammaticScroll = (() => {
  let activeToken = null;
  let timer = null;
  const watchers = new Map();
  return {
    create(duration = PROGRAMMATIC_SCROLL_DEFAULT_DURATION) {
      try {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      } catch (e) {
        /* ignored */
      }
      const token = Symbol('progScroll');
      activeToken = token;
      if (duration > 0) {
        timer = setTimeout(() => {
          if (activeToken === token) activeToken = null;
          timer = null;
        }, duration);
      }
      log.debug('ProgrammaticScroll: token created for', duration, 'ms');
      return token;
    },
    clear(token) {
      if (!activeToken) return;
      if (!token || activeToken === token) {
        activeToken = null;
        try {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        } catch (e) {
          /* ignored */
        }
        log.debug('ProgrammaticScroll: token cleared');
        // clear any watcher associated with this token
        if (watchers.has(token)) {
          const watcher = watchers.get(token);
          try {
            if (watcher.listener)
              window.removeEventListener('scroll', watcher.listener, { passive: true });
          } catch (e) {
            /* ignored */
          }
          try {
            if (watcher.observer) watcher.observer.disconnect();
          } catch (e) {
            /* ignored */
          }
          try {
            if (watcher.timeoutId) clearTimeout(watcher.timeoutId);
          } catch (e) {
            /* ignored */
          }
          watchers.delete(token);
        }
      }
    },
    hasActive() {
      return !!activeToken;
    },
    // Watch until the scroll reaches the target Y (or bottom). getTarget may be a number or a function returning number.
    watchUntil(
      token,
      getTarget,
      timeout = PROGRAMMATIC_SCROLL_WATCH_TIMEOUT,
      threshold = PROGRAMMATIC_SCROLL_WATCH_THRESHOLD
    ) {
      if (!token) return;
      let finished = false;

      // resolve target: can be selector string, Element, number, or function that returns number/element
      const resolve = () => {
        try {
          if (typeof getTarget === 'function') return getTarget();
          if (typeof getTarget === 'string') return document.querySelector(getTarget);
          return getTarget;
        } catch (e) {
          return null;
        }
      };

      const resolved = resolve();

      // If target is an Element, use IntersectionObserver for robust detection
      if (resolved instanceof Element && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (finished) return;
              if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                finished = true;
                try {
                  ProgrammaticScroll.clear(token);
                } catch (e) {
                  /* ignored */
                }
              }
            });
          },
          { root: null, threshold: [0.5, 0.75, 0.9, 1] }
        );

        // initial check
        try {
          const rect = resolved.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            finished = true;
            try {
              ProgrammaticScroll.clear(token);
            } catch (e) {
              /* ignored */
            }
            return token;
          }
        } catch (e) {
          /* ignored */
        }

        try {
          observer.observe(resolved);
        } catch (e) {
          /* ignored */
        }
        const timeoutId = setTimeout(() => {
          if (!finished) {
            try {
              ProgrammaticScroll.clear(token);
            } catch (e) {
              /* ignored */
            }
          }
          try {
            observer.disconnect();
          } catch (e) {
            /* ignored */
          }
        }, timeout);

        watchers.set(token, { observer, timeoutId });
        log.debug(
          'ProgrammaticScroll: watching token via IntersectionObserver until target or timeout',
          timeout
        );
        return token;
      }

      // fallback: numeric target or bottom detection
      const resolveTarget = typeof getTarget === 'function' ? getTarget : () => Number(getTarget);
      const check = () => {
        try {
          const targetY = resolveTarget();
          const current =
            window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
          const atBottom = window.innerHeight + current >= document.body.scrollHeight - threshold;
          if (!isNaN(Number(targetY)) && Math.abs(current - Number(targetY)) <= threshold) {
            finished = true;
            try {
              ProgrammaticScroll.clear(token);
            } catch (e) {
              /* ignored */
            }
          } else if (atBottom) {
            finished = true;
            try {
              ProgrammaticScroll.clear(token);
            } catch (e) {
              /* ignored */
            }
          }
        } catch (e) {
          /* ignored */
        }
      };

      const listener = () => {
        if (finished) return;
        check();
      };

      // initial check
      check();

      // attach listener and a fallback timeout
      try {
        window.addEventListener('scroll', listener, { passive: true });
      } catch (e) {
        /* ignored */
      }
      const timeoutId = setTimeout(() => {
        if (!finished) {
          try {
            ProgrammaticScroll.clear(token);
          } catch (e) {
            /* ignored */
          }
        }
      }, timeout);

      watchers.set(token, { listener, timeoutId });
      log.debug('ProgrammaticScroll: watching token until target or timeout', timeout);
      return token;
    }
  };
})();

const GlobalClose = (() => {
  let closeHandler = null;
  let bound = false;
  const onDocClick = (e) => {
    try {
      const footer = document.getElementById('site-footer');
      if (!footer || !footer.classList.contains('footer-expanded')) return;
      // If click is inside footer, ignore
      if (e.target.closest && e.target.closest('#site-footer')) return;
      // otherwise close
      if (typeof closeHandler === 'function') closeHandler();
    } catch (err) {
      log.warn('GlobalClose onDocClick error', err);
    }
  };

  const onUserScroll = (_e) => {
    try {
      // If there's an active programmatic scroll token, ignore this user-scroll event
      if (ProgrammaticScroll.hasActive()) return;
      const footer = document.getElementById('site-footer');
      if (!footer || !footer.classList.contains('footer-expanded')) return;
      // close on user scroll/wheel/touch
      if (typeof closeHandler === 'function') closeHandler();
    } catch (err) {
      log.warn('GlobalClose onUserScroll error', err);
    }
  };

  return {
    setCloseHandler(fn) {
      closeHandler = fn;
    },
    bind() {
      if (bound) return;
      document.addEventListener('click', onDocClick, true);
      window.addEventListener('wheel', onUserScroll, { passive: true });
      window.addEventListener('touchstart', onUserScroll, { passive: true });
      bound = true;
      log.debug('GlobalClose: bound');
    },
    unbind() {
      if (!bound) return;
      document.removeEventListener('click', onDocClick, true);
      window.removeEventListener('wheel', onUserScroll);
      window.removeEventListener('touchstart', onUserScroll);
      bound = false;
      log.debug('GlobalClose: unbound');
    }
  };
})();

// ===== Google Analytics Loader =====
const GoogleAnalytics = {
  load() {
    const blockedScripts = document.querySelectorAll('script[data-consent="required"]');
    if (blockedScripts.length === 0) {
      log.warn('No blocked GA scripts found');
      return;
    }
    blockedScripts.forEach((script) => {
      const newScript = document.createElement('script');
      Array.from(script.attributes).forEach((attr) => {
        if (attr.name === 'data-src') {
          newScript.setAttribute('src', attr.value);
        } else if (attr.name !== 'data-consent' && attr.name !== 'type') {
          newScript.setAttribute(attr.name, attr.value);
        }
      });
      if (script.innerHTML.trim()) {
        newScript.innerHTML = script.innerHTML;
      }
      script.parentNode.replaceChild(newScript, script);
    });
    log.info('Google Analytics loaded');
  }
};

// ===== Cookie Consent Banner =====
class ConsentBanner {
  constructor() {
    this.banner = document.getElementById('cookie-consent-banner');
    this.acceptBtn = document.getElementById('accept-cookies-btn');
    this.rejectBtn = document.getElementById('reject-cookies-btn');
  }

  init() {
    if (!this.banner || !this.acceptBtn) {
      log.error('Consent banner elements not found');
      return;
    }
    const consent = CookieManager.get('cookie_consent');
    if (consent === 'accepted') {
      GoogleAnalytics.load();
      this.banner.classList.add('hidden');
    } else if (consent === 'rejected') {
      this.banner.classList.add('hidden');
    } else {
      this.banner.classList.remove('hidden');
    }
    this.setupEventListeners();
    log.info('Consent banner initialized');
  }

  setupEventListeners() {
    this.acceptBtn.addEventListener('click', () => this.accept());
    if (this.rejectBtn) {
      this.rejectBtn.addEventListener('click', () => this.reject());
    }
  }

  accept() {
    this.hide();
    CookieManager.set('cookie_consent', 'accepted');
    GoogleAnalytics.load();
  }

  reject() {
    this.hide();
    CookieManager.set('cookie_consent', 'rejected');
  }

  hide() {
    this.banner.style.opacity = '0';
    this.banner.style.transform = 'scale(0.95)';
    setTimeout(() => {
      this.banner.classList.add('hidden');
    }, 300);
  }
}

// ===== Cookie Settings Manager =====
const CookieSettings = (() => {
  let sectionObserver = null;
  let initialVisibleSections = new Set();
  let hasTriggered = false;
  let boundHandlers = new WeakMap();

  function getElements() {
    return {
      footer: document.getElementById('site-footer'),
      footerMin: document.querySelector('.footer-minimized'),
      footerMax: document.querySelector('.footer-maximized'),
      cookieView: document.getElementById('footer-cookie-view'),
      normalContent: document.getElementById('footer-normal-content'),
      analyticsToggle: document.getElementById('footer-analytics-toggle'),
      closeBtn: document.getElementById('close-cookie-footer'),
      rejectAllBtn: document.getElementById('footer-reject-all'),
      acceptSelectedBtn: document.getElementById('footer-accept-selected'),
      acceptAllBtn: document.getElementById('footer-accept-all')
    };
  }

  function cleanup() {
    if (sectionObserver) {
      sectionObserver.disconnect();
      sectionObserver = null;
    }
    hasTriggered = false;
    initialVisibleSections.clear();
  }

  function setupSectionObserver(elements) {
    cleanup();
    const sections = document.querySelectorAll(
      'section[id]:not(#threeEarthContainer), main > section[id], [data-section]'
    );
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const id = section.id || section.dataset.section || 'unknown';
        initialVisibleSections.add(id);
      }
    });
    sectionObserver = new IntersectionObserver(
      (entries) => {
        if (hasTriggered || !elements.footer.classList.contains('footer-expanded')) {
          cleanup();
          return;
        }
        entries.forEach((entry) => {
          if (hasTriggered) return;
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const id = entry.target.id || entry.target.dataset.section || 'unknown';
            if (!initialVisibleSections.has(id)) {
              hasTriggered = true;
              cleanup();
              close();
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: [0.5, 0.7]
      }
    );
    sections.forEach((section) => sectionObserver.observe(section));
  }

  // ===== OPTIMIZED: Unified Button Handler =====
  function setupButtonHandlers(elements) {
    const handlers = {
      closeBtn: () => {
        cleanup();
        close();
      },
      rejectAllBtn: () => {
        cleanup();
        CookieManager.set('cookie_consent', 'rejected');
        CookieManager.deleteAnalytics();
        close();
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) banner.classList.add('hidden');
      },
      acceptSelectedBtn: () => {
        cleanup();
        if (elements.analyticsToggle?.checked) {
          CookieManager.set('cookie_consent', 'accepted');
          GoogleAnalytics.load();
        } else {
          CookieManager.set('cookie_consent', 'rejected');
          CookieManager.deleteAnalytics();
        }
        close();
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) banner.classList.add('hidden');
      },
      acceptAllBtn: () => {
        cleanup();
        CookieManager.set('cookie_consent', 'accepted');
        GoogleAnalytics.load();
        close();
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) banner.classList.add('hidden');
      }
    };

    Object.entries(handlers).forEach(([key, handler]) => {
      const element = elements[key];
      if (element && !boundHandlers.has(element)) {
        element.addEventListener('click', handler);
        boundHandlers.set(element, handler);
      }
    });
  }

  function removeButtonHandlers(elements) {
    ['closeBtn', 'rejectAllBtn', 'acceptSelectedBtn', 'acceptAllBtn'].forEach((key) => {
      const element = elements[key];
      if (element && boundHandlers.has(element)) {
        element.removeEventListener('click', boundHandlers.get(element));
        boundHandlers.delete(element);
      }
    });
  }

  const COOKIE_TRIGGER_SELECTOR = '[data-cookie-trigger]';

  function setTriggerExpanded(value) {
    document.querySelectorAll(COOKIE_TRIGGER_SELECTOR).forEach((trigger) => {
      trigger.setAttribute('aria-expanded', value ? 'true' : 'false');
    });
  }

  function getPrimaryTrigger() {
    return document.querySelector(COOKIE_TRIGGER_SELECTOR);
  }

  function open() {
    const elements = getElements();

    if (!elements.footer || !elements.cookieView) {
      log.error('Cookie settings elements not found');
      return;
    }

    const consent = CookieManager.get('cookie_consent');
    if (elements.analyticsToggle) {
      elements.analyticsToggle.checked = consent === 'accepted';
    }

    elements.footer.classList.add('footer-expanded');
    document.body.classList.add('footer-expanded');
    elements.footerMin?.classList.add('footer-hidden'); // Explizit minimiert ausblenden
    elements.footerMax?.classList.remove('footer-hidden');
    elements.cookieView.classList.remove('hidden');
    if (elements.normalContent) {
      elements.normalContent.style.display = 'none';
    }

    requestAnimationFrame(() => {
      try {
        // programmatic instant scroll to bottom (no smooth)
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
      } catch (e) {
        /* ignored */
      }
    });
    // Bind global close handlers (click outside, user scroll)
    try {
      ProgrammaticScroll.create(PROGRAMMATIC_SCROLL_MARK_DURATION); // mark upcoming programmatic scrolls to ignore
      GlobalClose.bind();
    } catch (e) {
      /* ignored */
    }
    setupSectionObserver(elements);
    setupButtonHandlers(elements);
    setTriggerExpanded(true);
    const firstFocusable = elements.cookieView.querySelector(
      'button, [href], input, select, textarea'
    );
    if (firstFocusable) {
      firstFocusable.focus({ preventScroll: true });
    }
    log.info('Cookie settings opened');
  }

  function close() {
    cleanup();
    const elements = getElements();
    if (!elements.footer) return;
    elements.cookieView?.classList.add('hidden');
    elements.footer.classList.remove('footer-expanded');
    document.body.classList.remove('footer-expanded');
    elements.footerMax?.classList.add('footer-hidden');
    elements.footerMin?.classList.remove('footer-hidden'); // Explizit minimiert einblenden
    if (elements.normalContent) {
      elements.normalContent.style.display = 'block';
    }
    if (window.footerScrollHandler) {
      window.footerScrollHandler.expanded = false;
    }
    // Unbind global close handlers when footer closed
    try {
      GlobalClose.unbind();
    } catch (e) {
      /* ignored */
    }

    removeButtonHandlers(elements);
    setTriggerExpanded(false);
    const trigger = getPrimaryTrigger();
    if (trigger) trigger.focus({ preventScroll: true });
    log.info('Cookie settings closed');
  }
  return { open, close };
})();

// Register CookieSettings.close with GlobalClose so handlers can call it
// Register CookieSettings.close with GlobalClose so handlers can call it
try {
  GlobalClose.setCloseHandler(() => {
    try {
      CookieSettings.close();
    } catch (e) {
      log.warn('GlobalClose: CookieSettings.close failed', e);
    }
  });
} catch (e) {
  /* ignored */
}

// ===== Theme System =====
class ThemeSystem {
  constructor() {
    this.currentTheme = this.loadTheme();
  }
  loadTheme() {
    const saved = localStorage.getItem('preferred-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  saveTheme(theme) {
    localStorage.setItem('preferred-theme', theme);
  }
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;
    this.saveTheme(theme);
    log.debug(`Theme applied: ${theme}`);
  }
  toggleTheme() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
    return newTheme;
  }
  createRipple(button, x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'artwork-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 800);
  }
  init() {
    this.applyTheme(this.currentTheme);
    log.info('Theme system initialized');
  }
  initToggleButton() {
    const toggle = document.getElementById('dayNightToggle');
    if (!toggle) {
      log.warn('Day/Night toggle button not found');
      return false;
    }
    toggle.addEventListener('click', (e) => {
      const rect = toggle.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.createRipple(toggle, x, y);
      this.toggleTheme();
    });
    log.info('Theme toggle button initialized');
    return true;
  }
}

// ===== Footer Loader =====
class FooterLoader {
  async init() {
    const container = document.getElementById('footer-container');
    if (!container) {
      log.warn('Footer container not found');
      return false;
    }
    try {
      await this.loadContent(container);
      this.ensureDefaultCards();
      this.updateYears();
      this.setupInteractions();
      const consentBanner = new ConsentBanner();
      consentBanner.init();
      log.info('Footer loaded successfully');
      document.dispatchEvent(
        new CustomEvent('footer:loaded', {
          detail: { footerId: 'site-footer' }
        })
      );
      return true;
    } catch (error) {
      log.error('Footer load failed:', error);
      this.showFallback(container);
      return false;
    }
  }
  async loadContent(container) {
    const src = container.dataset.footerSrc || '/content/webentwicklung/footer/footer.html';
    log.debug(`Loading footer: ${src}`);
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    container.innerHTML = html;
  }
  updateYears() {
    const year = new Date().getFullYear();
    document.querySelectorAll('.current-year').forEach((el) => {
      el.textContent = year;
    });
  }

  ensureDefaultCards() {
    try {
      const grid = document.querySelector('#site-footer .footer-cards-grid');
      if (!grid) return;
      const existing = grid.querySelectorAll('.footer-card');
      if (existing.length >= 4) return;

      grid.innerHTML = `
        <article class="footer-card">
          <div class="footer-card-header"><h3 class="footer-card-title">About</h3><div class="footer-card-accent"></div></div>
          <div class="footer-card-content"><p class="footer-profile-name">Abdulkerim Sesli</p><p class="footer-profile-role">Full‑Stack Developer • Photographer</p><a href="mailto:hello@abdulkerimsesli.de" class="footer-contact-cta">Kontakt</a></div>
        </article>
        <article class="footer-card">
          <div class="footer-card-header"><h3 class="footer-card-title">Work</h3><div class="footer-card-accent"></div></div>
          <div class="footer-card-content"><nav class="footer-work-nav"><a href="#portfolio" class="footer-work-link">Portfolio</a><a href="#projekte" class="footer-work-link">Projekte</a><a href="#lab" class="footer-work-link">Code Lab</a></nav></div>
        </article>
        <article class="footer-card">
          <div class="footer-card-header"><h3 class="footer-card-title">Connect</h3><div class="footer-card-accent"></div></div>
          <div class="footer-card-content"><div class="footer-social-grid"><a href="https://github.com/aKs030" class="footer-social-card" target="_blank" rel="noopener"><svg class="social-card-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>GitHub</a><a href="https://linkedin.com/in/abdulkerim-sesli" class="footer-social-card" target="_blank" rel="noopener"><svg class="social-card-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>LinkedIn</a><a href="https://instagram.com/abdul.codes" class="footer-social-card" target="_blank" rel="noopener"><svg class="social-card-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="m16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>Instagram</a></div></div>
        </article>
        <article class="footer-card footer-card-newsletter">
          <div class="footer-card-header"><h3 class="footer-card-title">Newsletter</h3><div class="footer-card-accent"></div></div>
          <div class="footer-card-content"><p class="newsletter-description">Kurze Updates & Insights – direkt in dein Postfach.</p><form class="newsletter-form-enhanced"><div class="newsletter-input-wrapper"><input type="email" class="newsletter-input-enhanced" placeholder="deine@email.de" required><button type="submit" class="newsletter-submit-enhanced">Abonnieren</button></div></form></div>
        </article>
      `;
    } catch (e) {
      log.warn('ensureDefaultCards failed', e);
    }
  }

  setupInteractions() {
    this.setupNewsletter();
    this.setupCookieTriggers(); // OPTIMIZED: Renamed for clarity
    this.setupFooterTriggers(); // Bind generic footer-open triggers (data-footer-trigger)
    this.setupSmoothScroll();
  }

  setupNewsletter() {
    const form = document.querySelector('.newsletter-form-enhanced');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      if (input?.value) {
        const email = input.value;
        log.info('Newsletter signup:', email);
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
          const originalText = submitButton.textContent;
          submitButton.textContent = '✓ Done!';
          submitButton.disabled = true;
          setTimeout(() => {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
          }, 3000);
        }
        input.value = '';
      }
    });
  }

  // ===== OPTIMIZED: Unified Cookie Trigger Setup =====
  setupCookieTriggers() {
    const triggers = document.querySelectorAll('[data-cookie-trigger]');
    if (!triggers.length) return;

    triggers.forEach((trigger) => {
      if (trigger.dataset.cookieTriggerBound) return;

      const handler = (event) => {
        const tag = trigger.tagName.toLowerCase();
        if (tag === 'a') {
          const href = trigger.getAttribute('href') || '';
          if (!href || href.startsWith('#')) {
            event.preventDefault();
          }
        }
        CookieSettings.open();
      };

      trigger.addEventListener('click', handler);
      trigger.dataset.cookieTriggerBound = 'true';
    });

    log.info(`Setup ${triggers.length} cookie triggers`);
  }

  // ===== Footer Trigger Setup (open maximized footer without cookie settings) =====
  // ===== Footer Trigger Setup (open maximized footer without cookie settings) =====
  setupFooterTriggers() {
    const triggers = document.querySelectorAll('[data-footer-trigger]');
    if (!triggers.length) return;

    triggers.forEach((trigger) => {
      if (trigger.dataset.footerTriggerBound) return;

      const handler = (event) => {
        const tag = trigger.tagName.toLowerCase();
        if (tag === 'a') {
          const href = trigger.getAttribute('href') || '';
          if (!href || href.startsWith('#')) {
            event.preventDefault();
          }
        }

        // Prefer existing scroll handler API
        try {
          // If there's a scroll handler, use its toggle API. That will also bind global handlers via toggleExpansion below.
          if (
            window.footerScrollHandler &&
            typeof window.footerScrollHandler.toggleExpansion === 'function'
          ) {
            window.footerScrollHandler.toggleExpansion(true);
          } else {
            // Fallback: manipulate DOM similarly to CookieSettings.open() but without showing cookie view
            const footer = document.getElementById('site-footer');
            if (!footer) return;
            const footerMin = footer.querySelector('.footer-minimized');
            const footerMax = footer.querySelector('.footer-maximized');
            footer.classList.add('footer-expanded');
            document.body.classList.add('footer-expanded');
            footerMin?.classList.add('footer-hidden');
            footerMax?.classList.remove('footer-hidden');
            try {
              // Programmatic smooth scroll — create token and watch until the footer viewport becomes visible
              const token = ProgrammaticScroll.create(PROGRAMMATIC_SCROLL_DEFAULT_DURATION);
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
              // Observe the maximized footer viewport element for arrival instead of relying on document height
              ProgrammaticScroll.watchUntil(
                token,
                '.footer-maximized-viewport',
                PROGRAMMATIC_SCROLL_WATCH_TIMEOUT
              );
            } catch (e) {
              /* ignored */
            }
          }
        } catch (e) {
          log.warn('setupFooterTriggers handler failed', e);
        }

        // update aria state for accessibility
        try {
          trigger.setAttribute('aria-expanded', 'true');
        } catch (e) {
          /* ignored */
        }
      };

      trigger.addEventListener('click', handler);
      trigger.dataset.footerTriggerBound = 'true';
    });

    log.info(`Setup ${triggers.length} footer triggers`);
  }

  setupSmoothScroll() {
    const footer = document.getElementById('site-footer');
    if (!footer) return;
    footer.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const targetId = link.getAttribute('href').substring(1);
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
  showFallback(container) {
    container.innerHTML = `
      <footer class="site-footer-fixed" style="padding: 16px; text-align: center;">
        <p>© ${new Date().getFullYear()} Abdulkerim Sesli</p>
      </footer>
    `;
  }
}

// ===== Scroll Handler =====
class ScrollHandler {
  constructor() {
    this.expanded = false;
    this.observer = null;
    this.EXPAND_THRESHOLD = 0.05;
    this.COLLAPSE_THRESHOLD = 0.02;
    window.footerScrollHandler = this;
  }
  init() {
    const footer = document.getElementById('site-footer');
    const trigger = document.getElementById('footer-trigger-zone');
    if (!footer || !trigger) {
      log.warn('Footer or trigger zone not found');
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target.id === 'footer-trigger-zone') {
            const threshold = this.expanded ? this.COLLAPSE_THRESHOLD : this.EXPAND_THRESHOLD;
            const shouldExpand = entry.isIntersecting && entry.intersectionRatio >= threshold;
            this.toggleExpansion(shouldExpand);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -10% 0px',
        threshold: [0, 0.02, 0.05, 0.1, 0.25, 0.5, 0.75, 1]
      }
    );
    this.observer.observe(trigger);
    log.info('Scroll handler initialized');
  }
  toggleExpansion(shouldExpand) {
    const footer = document.getElementById('site-footer');
    if (!footer) return;
    const minimized = footer.querySelector('.footer-minimized');
    const maximized = footer.querySelector('.footer-maximized');
    if (!minimized || !maximized) return;
    if (shouldExpand && !this.expanded) {
      // mark upcoming programmatic scrolls and bind global close handlers
      try {
        ProgrammaticScroll.create(PROGRAMMATIC_SCROLL_MARK_DURATION);
      } catch (e) {
        /* ignored */
      }
      try {
        GlobalClose.bind();
      } catch (e) {
        /* ignored */
      }
      footer.classList.add('footer-expanded');
      document.body.classList.add('footer-expanded');
      maximized.classList.remove('footer-hidden');
      minimized?.classList.add('footer-hidden'); // Explizit minimiert ausblenden

      this.expanded = true;
      log.debug('Footer expanded');
    } else if (!shouldExpand && this.expanded) {
      footer.classList.remove('footer-expanded');
      document.body.classList.remove('footer-expanded');
      maximized.classList.add('footer-hidden');
      minimized?.classList.remove('footer-hidden'); // Explizit minimiert einblenden
      this.expanded = false;
      // unbind global close handlers
      try {
        GlobalClose.unbind();
      } catch (e) {
        /* ignored */
      }
      log.debug('Footer collapsed');
    }
  }
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// ===== Footer Resizer (OPTIMIZED) =====
class FooterResizer {
  constructor() {
    this.rAF = null;
    this.resizeObserver = null;
    this.onResize = this.onResize.bind(this);
    this.onVisualResize = this.onResize.bind(this);
  }

  init() {
    this.apply();
    window.addEventListener('resize', this.onResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.onVisualResize, { passive: true });
    }

    const content = document.querySelector('#site-footer .footer-enhanced-content');
    if (content && window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.apply());
      this.resizeObserver.observe(content);
    }
  }

  // ===== OPTIMIZED: Simplified measurement =====
  apply() {
    const footer = document.getElementById('site-footer');
    const content = footer?.querySelector('.footer-enhanced-content');

    let height = 0;

    if (content) {
      // Primary measurement
      height = Math.max(0, content.scrollHeight || content.offsetHeight || 0);

      // Fallback: use fixed percentage if content is hidden/collapsed
      if (height <= 1) {
        height = Math.round((window.innerHeight || 600) * 0.5);
      }
    } else if (footer) {
      height = Math.max(0, footer.scrollHeight || footer.offsetHeight || 0);
    } else {
      // Ultimate fallback
      height = Math.round((window.innerHeight || 600) * 0.5);
    }

    // Cap to viewport minus safe-area
    const gap = 24;
    const cap = Math.max(0, Math.round((window.innerHeight || 600) - gap));
    if (height > cap) height = cap;

    try {
      document.documentElement.style.setProperty('--footer-actual-height', `${height}px`);
    } catch (e) {
      log.warn('FooterResizer: could not set CSS var', e);
    }
  }

  onResize() {
    if (this.rAF) cancelAnimationFrame(this.rAF);
    this.rAF = requestAnimationFrame(() => {
      this.apply();
      this.rAF = null;
    });
  }

  cleanup() {
    window.removeEventListener('resize', this.onResize);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.onVisualResize);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.rAF) cancelAnimationFrame(this.rAF);
  }
}

// ===== Main Footer System =====
class FooterSystem {
  constructor() {
    this.theme = new ThemeSystem();
    this.loader = new FooterLoader();
    this.scroller = new ScrollHandler();
    this.resizer = new FooterResizer();
  }
  async init() {
    log.info('Initializing footer system...');
    this.theme.init();
    const loaded = await this.loader.init();
    if (loaded) {
      this.theme.initToggleButton();
      this.scroller.init();
      try {
        this.resizer.init();
      } catch (e) {
        log.warn('FooterResizer init failed', e);
      }
      log.info('✅ Footer system fully initialized');
    } else {
      log.error('❌ Footer failed to load');
    }
  }
  cleanup() {
    this.scroller.cleanup();
    try {
      this.resizer.cleanup();
    } catch (e) {
      // ignore
    }
    log.info('Footer system cleanup completed');
  }
}

// ===== Auto-Start =====
if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      const system = new FooterSystem();
      system.init();
    },
    { once: true }
  );
} else {
  const system = new FooterSystem();
  system.init();
}

// Export for external use
if (typeof window !== 'undefined') {
  window.FooterSystem = FooterSystem;
  window.CookieSettings = CookieSettings;
}
