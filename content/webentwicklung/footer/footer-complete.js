/**
 * Footer Complete System - Optimized
 *
 * This version incorporates several improvements over the original footer implementation.
 *
 * Changes introduced:
 * 1. **Cookie security**: Cookies now include `SameSite=Lax` and, when served over HTTPS,
 *    the `Secure` flag. This reduces the risk of CSRF and cross-site attacks.
 * 2. **Event listener cleanup**: Click handlers for the cookie settings
 *    (close, reject, accept selected, accept all) are stored on the element
 *    and explicitly removed when the cookie settings are closed. This prevents
 *    memory leaks and duplicate handler registrations on repeated opens.
 * 3. **No forced page reload**: The consent actions no longer trigger a full
 *    `window.location.reload()` after a short timeout. Instead the banner is
 *    hidden immediately and consent state is persisted via cookies.
 *
 * Note: The rest of the footer system remains unchanged but is included
 *       here for completeness.
 */

import { createLogger, throttle } from '../shared-utilities.js';

const log = createLogger("FooterSystem");

// ===== Cookie Utilities =====

const CookieManager = {
  set(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `; expires=${date.toUTCString()}`;
    // Add SameSite and Secure flags to cookies. Secure is only applied when using HTTPS.
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
      // Copy attributes
      Array.from(script.attributes).forEach((attr) => {
        if (attr.name === "data-src") {
          newScript.setAttribute("src", attr.value);
        } else if (attr.name !== "data-consent" && attr.name !== "type") {
          newScript.setAttribute(attr.name, attr.value);
        }
      });
      // Copy inline content
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
    if (this.cookiesLink) {
      this.cookiesLink.addEventListener("click", (e) => {
        e.preventDefault();
        CookieSettings.open();
      });
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
    // Store initially visible sections
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

  /**
   * Remove click event handlers from cookie settings elements. The handler
   * references are stored on the element as `_clickHandler`. After removal
   * the `listenerAdded` flag is cleared so handlers can be reattached on
   * subsequent opens. This prevents accumulating duplicate listeners.
   */
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
        // store handler on the element to allow cleanup later
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
      // No reload – UI updates happen immediately.
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

  function open() {
    const elements = getElements();
    if (!elements.footer || !elements.cookieView) {
      log.error("Cookie settings elements not found");
      return;
    }
    // Set analytics toggle
    const consent = CookieManager.get("cookie_consent");
    if (elements.analyticsToggle) {
      elements.analyticsToggle.checked = consent === "accepted";
    }
    // Expand footer
    elements.footer.classList.add("footer-expanded");
    elements.footerMin?.classList.add("footer-hidden");
    elements.footerMax?.classList.remove("footer-hidden");
    elements.cookieView.classList.remove("hidden");
    if (elements.normalContent) {
      elements.normalContent.style.display = "none";
    }
    // Setup observers and listeners
    setupSectionObserver(elements);
    setupEventListeners(elements);
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
    // Reset scroll handler state
    if (window.footerScrollHandler) {
      window.footerScrollHandler.expanded = false;
    }
    // Remove click listeners to prevent memory leaks
    cleanupClickListeners(elements);
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
      this.updateYears();
      this.setupInteractions();
      // Initialize consent banner
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
          submitButton.textContent = "✓ Angemeldet!";
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
    const cookieBtn = document.querySelector(".footer-cookie-btn");
    if (cookieBtn) {
      cookieBtn.addEventListener("click", () => CookieSettings.open());
    }
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
    this.config = {
      MOBILE_BREAKPOINT: 768,
      MAX_FOOTER_RATIO_MOBILE: 0.92,
      MAX_FOOTER_RATIO_DESKTOP: 0.6,
      MIN_FOOTER_HEIGHT_MOBILE: 420,
      MIN_FOOTER_HEIGHT_DESKTOP: 380,
      THROTTLE_DELAY: 150,
    };
    this.lastSnapshot = "";
    this.rafId = null;
    this.resizeObserver = null;
  }
  init() {
    this.apply();
    const onResize = throttle(() => {
      requestAnimationFrame(() => this.apply());
    }, this.config.THROTTLE_DELAY);
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    this.setupResizeObserver();
    this.setupFontObserver();
    log.info("Footer resizer initialized");
  }
  setupResizeObserver() {
    const content = document.querySelector("#site-footer .footer-enhanced-content");
    if (content && window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(() => {
          this.apply();
          this.rafId = null;
        });
      });
      this.resizeObserver.observe(content);
      log.debug("ResizeObserver activated");
    } else {
      // Fallbacks ensure the footer height is calculated at least once on load
      setTimeout(() => this.apply(), 250);
      setTimeout(() => this.apply(), 1200);
    }
  }
  setupFontObserver() {
    if (document.fonts) {
      document.fonts.ready.then(() => {
        requestAnimationFrame(() => this.apply());
      });
    }
  }
  cleanup() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  measureViewport() {
    const layoutHeight = Math.max(
      window.innerHeight || 0,
      document.documentElement?.clientHeight || 0,
      1
    );
    const visualHeight = window.visualViewport?.height || 0;
    const usable = Math.max(layoutHeight, visualHeight, 1);
    return { layoutHeight, visualHeight, usable };
  }
  setCSSVar(name, value) {
    const footer = document.getElementById("site-footer");
    const target = footer ?? document.documentElement;
    target.style.setProperty(name, value);
  }
  apply() {
    const footer = document.getElementById("site-footer");
    if (!footer) return;
    const { usable } = this.measureViewport();
    this.setCSSVar("--vh", `${usable * 0.01}px`);
    const isMobile = window.innerWidth <= this.config.MOBILE_BREAKPOINT;
    const maxRatio = isMobile ? this.config.MAX_FOOTER_RATIO_MOBILE : this.config.MAX_FOOTER_RATIO_DESKTOP;
    const minHeight = isMobile ? this.config.MIN_FOOTER_HEIGHT_MOBILE : this.config.MIN_FOOTER_HEIGHT_DESKTOP;
    const baseMax = Math.round(usable * maxRatio);
    const maxFooter = Math.min(usable, Math.max(baseMax, minHeight));
    this.setCSSVar("--footer-max-height", `${maxFooter}px`);
    const content = document.querySelector("#site-footer .footer-enhanced-content");
    if (content) {
      const naturalHeight = Math.max(1, content.scrollHeight || 0);
      const actual = Math.min(naturalHeight, maxFooter);
      this.setCSSVar("--footer-actual-height", `${actual}px`);
      const snapshot = `${naturalHeight}|${isMobile}|${maxFooter}|${actual}`;
      if (this.lastSnapshot !== snapshot) {
        log.debug(`Content: ${naturalHeight}px, Mobile: ${isMobile}, Max: ${maxFooter}px, Viewport: ${actual}px`);
        this.lastSnapshot = snapshot;
      }
    } else {
      this.setCSSVar("--footer-actual-height", `${maxFooter}px`);
    }
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
      this.resizer.init();
      log.info("✅ Footer system fully initialized");
    } else {
      log.error("❌ Footer failed to load");
    }
  }
  cleanup() {
    this.scroller.cleanup();
    this.resizer.cleanup();
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