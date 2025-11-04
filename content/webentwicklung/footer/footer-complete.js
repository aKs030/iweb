/**
 * Footer Complete System - Final Optimized
 * Optimiert für kompakte Darstellung ohne Scrolling
 * @version 7.0.0 FINAL
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
    this.cookiesLink = document.querySelector(".footer-cookies-link");
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
    if (this.cookiesLink && !this.cookiesLink.dataset.cookieTriggerBound) {
      this.cookiesLink.addEventListener("click", (e) => {
        e.preventDefault();
        CookieSettings.open();
      });
      this.cookiesLink.dataset.cookieTriggerBound = "true";
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

  function cleanupObserver() {
    if (sectionObserver) {
      sectionObserver.disconnect();
      sectionObserver = null;
    }
    hasTriggered = false;
    initialVisibleSections.clear();
  }

  function setupSectionObserver(elements) {
    cleanupObserver();
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
          cleanupObserver();
          return;
        }
        entries.forEach((entry) => {
          if (hasTriggered) return;
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const id = entry.target.id || entry.target.dataset.section || "unknown";
            if (!initialVisibleSections.has(id)) {
              hasTriggered = true;
              cleanupObserver();
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

  function cleanupClickListeners(elements) {
    ["closeBtn", "rejectAllBtn", "acceptSelectedBtn", "acceptAllBtn"].forEach((key) => {
      const el = elements[key];
      if (el && el.dataset.listenerAdded) {
        if (typeof el._clickHandler === 'function') {
          el.removeEventListener('click', el._clickHandler);
        }
        delete el._clickHandler;
        delete el.dataset.listenerAdded;
      }
    });
  }

  function setupEventListeners(elements) {
    const addOnce = (element, handler) => {
      if (element && !element.dataset.listenerAdded) {
        const wrapper = handler;
        element._clickHandler = wrapper;
        element.dataset.listenerAdded = "true";
        element.addEventListener("click", wrapper);
      }
    };
    addOnce(elements.closeBtn, () => {
      cleanupObserver();
      close();
    });
    addOnce(elements.rejectAllBtn, () => {
      cleanupObserver();
      CookieManager.set("cookie_consent", "rejected");
      CookieManager.deleteAnalytics();
      close();
      const banner = document.getElementById("cookie-consent-banner");
      if (banner) banner.classList.add("hidden");
    });
    addOnce(elements.acceptSelectedBtn, () => {
      cleanupObserver();
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
    });
    addOnce(elements.acceptAllBtn, () => {
      cleanupObserver();
      CookieManager.set("cookie_consent", "accepted");
      GoogleAnalytics.load();
      close();
      const banner = document.getElementById("cookie-consent-banner");
      if (banner) banner.classList.add("hidden");
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
    setupSectionObserver(elements);
    setupEventListeners(elements);
    // Accessibility: mark triggers as expanded and move focus into the panel
    setTriggerExpanded(true);
    // Focus first interactive element inside the cookie view
    const firstFocusable = elements.cookieView.querySelector('button, [href], input, select, textarea');
    if (firstFocusable) {
      firstFocusable.focus({ preventScroll: true });
    }
    log.info("Cookie settings opened");
  }

  function close() {
    cleanupObserver();
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
    cleanupClickListeners(elements);
    // Accessibility: reset aria-expanded on triggers and return focus
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
      // Ensure expected card markup exists (some environments may strip or
      // transform injected HTML). This guarantees at least the default set of
      // cards are present so the resizer and layout behave predictably.
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

  /**
   * Make sure the footer-cards-grid contains the expected card elements.
   * If cards are missing (e.g. server trimmed markup or runtime transformations),
   * replace the grid content with a minimal, predictable set.
   */
  ensureDefaultCards() {
    try {
      const grid = document.querySelector('#site-footer .footer-cards-grid');
      if (!grid) return;
      const existing = grid.querySelectorAll('.footer-card');
      if (existing.length >= 3) return; // enough cards present (removed Connect card)

      grid.innerHTML = `
        <article class="footer-card">
          <div class="footer-card-header"><h3 class="footer-card-title">About</h3><div class="footer-card-accent"></div></div>
          <div class="footer-card-content"><p class="footer-profile-name">Abdulkerim Sesli</p><p class="footer-profile-role">Full‑Stack Developer • Photographer</p><a href="mailto:hello@abdulkerimsesli.de" class="footer-contact-cta">Kontakt</a></div>
        </article>
        <article class="footer-card">
          <div class="footer-card-header"><h3 class="footer-card-title">Work</h3><div class="footer-card-accent"></div></div>
          <div class="footer-card-content"><nav class="footer-work-nav"><a href="#portfolio" class="footer-work-link">Portfolio</a><a href="#projekte" class="footer-work-link">Projekte</a><a href="#lab" class="footer-work-link">Code Lab</a></nav></div>
        </article>
        <article class="footer-card footer-card-newsletter">
          <div class="footer-card-header"><h3 class="footer-card-title">Newsletter</h3><div class="footer-card-accent"></div></div>
          <div class="footer-card-content"><p class="newsletter-description">Kurze Updates & Insights — direkt in dein Postfach.</p><form class="newsletter-form-enhanced"><div class="newsletter-input-wrapper"><input type="email" class="newsletter-input-enhanced" placeholder="deine@email.de" required><button type="submit" class="newsletter-submit-enhanced"><span class="btn-text-full">Abonnieren</span><span class="btn-text-short">→</span></button></div></form></div>
        </article>
      `;

      // If a FooterResizer exists, trigger a recalculation
      if (window.footerScrollHandler && window.footerScrollHandler.expanded !== undefined) {
        // no-op; scroll handler presence is fine
      }
      if (window.FooterSystem) {
        // try to nudge the resizer if available
        try {
          const sys = window.FooterSystem;
          // if user instantiated (global constructor), we can't access instance
          // but we can call a global resizer if set on document
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      log.warn('ensureDefaultCards failed', e);
    }
  }
  setupInteractions() {
    this.setupNewsletter();
    this.setupCookieButton();
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
  setupCookieButton() {
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

// ===== Footer Resizer =====

class FooterResizer {
  constructor() {
    this.rAF = null;
    this.resizeObserver = null;
    this.onResize = this.onResize.bind(this);
    this.onVisualResize = this.onResize.bind(this);
  }

  init() {
    // initial measurement
    this.apply();
    // listen to common resize events
    window.addEventListener('resize', this.onResize, { passive: true });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this.onVisualResize, { passive: true });

    // observe content changes inside footer so we can recompute if cards change
    const content = document.querySelector('#site-footer .footer-enhanced-content');
    if (content && window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.apply());
      this.resizeObserver.observe(content);
    }
  }

  apply() {
    const footer = document.getElementById('site-footer');
    const content = footer?.querySelector('.footer-enhanced-content');
    // prefer measured content height, fall back to footer height or a safe fraction
    let height = 0;
    if (content) {
      // Try the straightforward measurement first
      height = Math.max(0, content.scrollHeight || content.offsetHeight || 0);
      // If the content is hidden or collapsed (offsetHeight === 0) the
      // scrollHeight may be incorrect. Measure by cloning off-DOM to get
      // the natural content height without affecting layout/visibility.
      if ((height <= 1 || content.offsetHeight === 0) && typeof document !== 'undefined') {
        try {
          const clone = content.cloneNode(true);
          // Make clone invisible and out of flow but measurable
          clone.style.position = 'absolute';
          clone.style.visibility = 'hidden';
          clone.style.height = 'auto';
          clone.style.maxHeight = 'none';
          clone.style.overflow = 'visible';
          // Ensure the clone uses the same width so text wraps similarly
          const width = content.getBoundingClientRect().width || content.offsetWidth || window.innerWidth;
          clone.style.width = `${width}px`;
          document.body.appendChild(clone);
          const measured = Math.max(clone.scrollHeight || clone.offsetHeight || 0, height);
          document.body.removeChild(clone);
          height = measured;
        } catch (e) {
          // fallback: keep previous height
          log.debug('FooterResizer: clone-measure failed', e);
        }
      }
    } else if (footer) {
      height = Math.max(0, footer.scrollHeight || footer.offsetHeight || 0);
    } else {
      height = Math.round((window.innerHeight || 600) * 0.5);
    }

    // cap the height to viewport minus a small gap (approximate safe-area)
    const gap = 24; // matches CSS fallback calc(100dvh - 24px - safe-area)
    const cap = Math.max(0, Math.round((window.innerHeight || 600) - gap));
    if (height > cap) height = cap;

    // write to :root so CSS uses the computed value
    try {
      document.documentElement.style.setProperty('--footer-actual-height', `${height}px`);
    } catch (e) {
      // ignore write errors in odd embed contexts
      // eslint-disable-next-line no-console
      log.warn('FooterResizer: could not set CSS var --footer-actual-height', e);
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
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', this.onVisualResize);
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
      // init resizer after footer content is loaded
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