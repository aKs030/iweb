/**
 * Footer Complete System - Fully Optimized
 * Removed duplicate code, simplified logic, better performance
 * @version 8.0.0 OPTIMIZED
 */

import { createLogger, throttle } from '../shared-utilities.js';

const log = createLogger("FooterSystem");

// ===== Cookie Utilities =====
const CookieManager = {
  set(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `; expires=${date.toUTCString()}`;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${value || ""}${expires}; path=/; SameSite=Lax${secure}`;
  },

  get(name) {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(nameEQ)) {
        return cookie.substring(nameEQ.length);
      }
    }
    return null;
  },

  delete(name) {
    const domains = ["", window.location.hostname, `.${window.location.hostname}`];
    domains.forEach((domain) => {
      const domainPart = domain ? `; domain=${domain}` : "";
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/${domainPart}`;
    });
  },

  deleteAnalytics() {
    const analyticsCookies = ["_ga", "_gid", "_gat", "_gat_gtag_G_S0587RQ4CN"];
    analyticsCookies.forEach((name) => this.delete(name));
    log.info("Analytics cookies deleted");
  },
};

// ===== Google Analytics Loader =====
const GoogleAnalytics = {
  load() {
    const blockedScripts = document.querySelectorAll('script[data-consent="required"]');
    if (blockedScripts.length === 0) {
      log.warn("No blocked GA scripts found");
      return;
    }
    blockedScripts.forEach((script) => {
      const newScript = document.createElement("script");
      Array.from(script.attributes).forEach((attr) => {
        if (attr.name === "data-src") {
          newScript.setAttribute("src", attr.value);
        } else if (attr.name !== "data-consent" && attr.name !== "type") {
          newScript.setAttribute(attr.name, attr.value);
        }
      });
      if (script.innerHTML.trim()) {
        newScript.innerHTML = script.innerHTML;
      }
      script.parentNode.replaceChild(newScript, script);
    });
    log.info("Google Analytics loaded");
  },
};

// ===== Cookie Consent Banner =====
class ConsentBanner {
  constructor() {
    this.banner = document.getElementById("cookie-consent-banner");
    this.acceptBtn = document.getElementById("accept-cookies-btn");
    this.rejectBtn = document.getElementById("reject-cookies-btn");
  }

  init() {
    if (!this.banner || !this.acceptBtn) {
      log.error("Consent banner elements not found");
      return;
    }
    const consent = CookieManager.get("cookie_consent");
    if (consent === "accepted") {
      GoogleAnalytics.load();
      this.banner.classList.add("hidden");
    } else if (consent === "rejected") {
      this.banner.classList.add("hidden");
    } else {
      this.banner.classList.remove("hidden");
    }
    this.setupEventListeners();
    log.info("Consent banner initialized");
  }

  setupEventListeners() {
    this.acceptBtn.addEventListener("click", () => this.accept());
    if (this.rejectBtn) {
      this.rejectBtn.addEventListener("click", () => this.reject());
    }
  }

  accept() {
    this.hide();
    CookieManager.set("cookie_consent", "accepted");
    GoogleAnalytics.load();
  }

  reject() {
    this.hide();
    CookieManager.set("cookie_consent", "rejected");
  }

  hide() {
    this.banner.style.opacity = "0";
    this.banner.style.transform = "scale(0.95)";
    setTimeout(() => {
      this.banner.classList.add("hidden");
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
      footer: document.getElementById("site-footer"),
      footerMin: document.querySelector(".footer-minimized"),
      footerMax: document.querySelector(".footer-maximized"),
      cookieView: document.getElementById("footer-cookie-view"),
      normalContent: document.getElementById("footer-normal-content"),
      analyticsToggle: document.getElementById("footer-analytics-toggle"),
      closeBtn: document.getElementById("close-cookie-footer"),
      rejectAllBtn: document.getElementById("footer-reject-all"),
      acceptSelectedBtn: document.getElementById("footer-accept-selected"),
      acceptAllBtn: document.getElementById("footer-accept-all"),
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
      "section[id]:not(#threeEarthContainer), main > section[id], [data-section]"
    );
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const id = section.id || section.dataset.section || "unknown";
        initialVisibleSections.add(id);
      }
    });
    sectionObserver = new IntersectionObserver(
      (entries) => {
        if (hasTriggered || !elements.footer.classList.contains("footer-expanded")) {
          cleanup();
          return;
        }
        entries.forEach((entry) => {
          if (hasTriggered) return;
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const id = entry.target.id || entry.target.dataset.section || "unknown";
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
        rootMargin: "0px",
        threshold: [0.5, 0.7],
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
        CookieManager.set("cookie_consent", "rejected");
        CookieManager.deleteAnalytics();
        close();
        const banner = document.getElementById("cookie-consent-banner");
        if (banner) banner.classList.add("hidden");
      },
      acceptSelectedBtn: () => {
        cleanup();
        if (elements.analyticsToggle?.checked) {
          CookieManager.set("cookie_consent", "accepted");
          GoogleAnalytics.load();
        } else {
          CookieManager.set("cookie_consent", "rejected");
          CookieManager.deleteAnalytics();
        }
        close();
        const banner = document.getElementById("cookie-consent-banner");
        if (banner) banner.classList.add("hidden");
      },
      acceptAllBtn: () => {
        cleanup();
        CookieManager.set("cookie_consent", "accepted");
        GoogleAnalytics.load();
        close();
        const banner = document.getElementById("cookie-consent-banner");
        if (banner) banner.classList.add("hidden");
      },
    };

    Object.entries(handlers).forEach(([key, handler]) => {
      const element = elements[key];
      if (element && !boundHandlers.has(element)) {
        element.addEventListener("click", handler);
        boundHandlers.set(element, handler);
      }
    });
  }

  function removeButtonHandlers(elements) {
    ["closeBtn", "rejectAllBtn", "acceptSelectedBtn", "acceptAllBtn"].forEach((key) => {
      const element = elements[key];
      if (element && boundHandlers.has(element)) {
        element.removeEventListener("click", boundHandlers.get(element));
        boundHandlers.delete(element);
      }
    });
  }

  const COOKIE_TRIGGER_SELECTOR = "[data-cookie-trigger]";

  function setTriggerExpanded(value) {
    document.querySelectorAll(COOKIE_TRIGGER_SELECTOR).forEach((trigger) => {
      trigger.setAttribute("aria-expanded", value ? "true" : "false");
    });
  }

  function getPrimaryTrigger() {
    return document.querySelector(COOKIE_TRIGGER_SELECTOR);
  }

  function open() {
    const elements = getElements();
    
    if (!elements.footer || !elements.cookieView) {
      log.error("Cookie settings elements not found");
      return;
    }
    
    const consent = CookieManager.get("cookie_consent");
    if (elements.analyticsToggle) {
      elements.analyticsToggle.checked = consent === "accepted";
    }
    
    elements.footer.classList.add("footer-expanded");
    document.body.classList.add("footer-expanded");
    elements.footerMin?.classList.add("footer-hidden");
    elements.footerMax?.classList.remove("footer-hidden");
    elements.cookieView.classList.remove("hidden");
    if (elements.normalContent) {
      elements.normalContent.style.display = "none";
    }
    
    requestAnimationFrame(() => {
      try {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
      } catch (e) {
        /* noop */
      }
    });
    setupSectionObserver(elements);
    setupButtonHandlers(elements);
    setTriggerExpanded(true);
    const firstFocusable = elements.cookieView.querySelector('button, [href], input, select, textarea');
    if (firstFocusable) {
      firstFocusable.focus({ preventScroll: true });
    }
    log.info("Cookie settings opened");
  }

  function close() {
    cleanup();
    const elements = getElements();
    if (!elements.footer) return;
    elements.cookieView?.classList.add("hidden");
    elements.footer.classList.remove("footer-expanded");
    document.body.classList.remove("footer-expanded");
    elements.footerMax?.classList.add("footer-hidden");
    elements.footerMin?.classList.remove("footer-hidden");
    if (elements.normalContent) {
      elements.normalContent.style.display = "block";
    }
    if (window.footerScrollHandler) {
      window.footerScrollHandler.expanded = false;
    }
    removeButtonHandlers(elements);
    setTriggerExpanded(false);
    const trigger = getPrimaryTrigger();
    if (trigger) trigger.focus({ preventScroll: true });
    log.info("Cookie settings closed");
  }
  return { open, close };
})();

// ===== Theme System =====
class ThemeSystem {
  constructor() {
    this.currentTheme = this.loadTheme();
  }
  loadTheme() {
    const saved = localStorage.getItem("preferred-theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  saveTheme(theme) {
    localStorage.setItem("preferred-theme", theme);
  }
  applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    this.currentTheme = theme;
    this.saveTheme(theme);
    log.debug(`Theme applied: ${theme}`);
  }
  toggleTheme() {
    const newTheme = this.currentTheme === "light" ? "dark" : "light";
    this.applyTheme(newTheme);
    return newTheme;
  }
  createRipple(button, x, y) {
    const ripple = document.createElement("div");
    ripple.className = "artwork-ripple";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 800);
  }
  init() {
    this.applyTheme(this.currentTheme);
    log.info("Theme system initialized");
  }
  initToggleButton() {
    const toggle = document.getElementById("dayNightToggle");
    if (!toggle) {
      log.warn("Day/Night toggle button not found");
      return false;
    }
    toggle.addEventListener("click", (e) => {
      const rect = toggle.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.createRipple(toggle, x, y);
      this.toggleTheme();
    });
    log.info("Theme toggle button initialized");
    return true;
  }
}

// ===== Footer Loader =====
class FooterLoader {
  async init() {
    const container = document.getElementById("footer-container");
    if (!container) {
      log.warn("Footer container not found");
      return false;
    }
    try {
      await this.loadContent(container);
      this.ensureDefaultCards();
      this.updateYears();
      this.setupInteractions();
      const consentBanner = new ConsentBanner();
      consentBanner.init();
      log.info("Footer loaded successfully");
      document.dispatchEvent(
        new CustomEvent("footer:loaded", {
          detail: { footerId: "site-footer" },
        })
      );
      return true;
    } catch (error) {
      log.error("Footer load failed:", error);
      this.showFallback(container);
      return false;
    }
  }
  async loadContent(container) {
    const src = container.dataset.footerSrc || "/content/webentwicklung/footer/footer.html";
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
    document.querySelectorAll(".current-year").forEach((el) => {
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
    this.setupSmoothScroll();
  }

  setupNewsletter() {
    const form = document.querySelector(".newsletter-form-enhanced");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      if (input?.value) {
        const email = input.value;
        log.info("Newsletter signup:", email);
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
          const originalText = submitButton.textContent;
          submitButton.textContent = "✓ Done!";
          submitButton.disabled = true;
          setTimeout(() => {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
          }, 3000);
        }
        input.value = "";
      }
    });
  }

  // ===== OPTIMIZED: Unified Cookie Trigger Setup =====
  setupCookieTriggers() {
    const triggers = document.querySelectorAll("[data-cookie-trigger]");
    if (!triggers.length) return;

    triggers.forEach((trigger) => {
      if (trigger.dataset.cookieTriggerBound) return;
      
      const handler = (event) => {
        const tag = trigger.tagName.toLowerCase();
        if (tag === "a") {
          const href = trigger.getAttribute("href") || "";
          if (!href || href.startsWith("#")) {
            event.preventDefault();
          }
        }
        CookieSettings.open();
      };
      
      trigger.addEventListener("click", handler);
      trigger.dataset.cookieTriggerBound = "true";
    });
    
    log.info(`Setup ${triggers.length} cookie triggers`);
  }

  setupSmoothScroll() {
    const footer = document.getElementById("site-footer");
    if (!footer) return;
    footer.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const targetId = link.getAttribute("href").substring(1);
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
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
    const footer = document.getElementById("site-footer");
    const trigger = document.getElementById("footer-trigger-zone");
    if (!footer || !trigger) {
      log.warn("Footer or trigger zone not found");
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target.id === "footer-trigger-zone") {
            const threshold = this.expanded ? this.COLLAPSE_THRESHOLD : this.EXPAND_THRESHOLD;
            const shouldExpand = entry.isIntersecting && entry.intersectionRatio >= threshold;
            this.toggleExpansion(shouldExpand);
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -10% 0px",
        threshold: [0, 0.02, 0.05, 0.1, 0.25, 0.5, 0.75, 1],
      }
    );
    this.observer.observe(trigger);
    log.info("Scroll handler initialized");
  }
  toggleExpansion(shouldExpand) {
    const footer = document.getElementById("site-footer");
    if (!footer) return;
    const minimized = footer.querySelector(".footer-minimized");
    const maximized = footer.querySelector(".footer-maximized");
    if (!minimized || !maximized) return;
    if (shouldExpand && !this.expanded) {
      footer.classList.add("footer-expanded");
      document.body.classList.add("footer-expanded");
      maximized.classList.remove("footer-hidden");
      this.expanded = true;
      log.debug("Footer expanded");
    } else if (!shouldExpand && this.expanded) {
      footer.classList.remove("footer-expanded");
      document.body.classList.remove("footer-expanded");
      maximized.classList.add("footer-hidden");
      this.expanded = false;
      log.debug("Footer collapsed");
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
    log.info("Initializing footer system...");
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
      log.info("✅ Footer system fully initialized");
    } else {
      log.error("❌ Footer failed to load");
    }
  }
  cleanup() {
    this.scroller.cleanup();
    try {
      this.resizer.cleanup();
    } catch (e) {
      // ignore
    }
    log.info("Footer system cleanup completed");
  }
}

// ===== Auto-Start =====
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    const system = new FooterSystem();
    system.init();
  }, { once: true });
} else {
  const system = new FooterSystem();
  system.init();
}

// Export for external use
if (typeof window !== "undefined") {
  window.FooterSystem = FooterSystem;
  window.CookieSettings = CookieSettings;
}