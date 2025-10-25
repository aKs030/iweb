import { createLogger } from '../shared-utilities.js';

/**
 * Footer Complete System - All-in-One JavaScript
 *
 * Kombiniert alle Footer-Funktionalitäten in einer Datei:
 * - Footer-Laden und Initialisierung
 * - Day/Night Theme Toggle
 * - Scroll-basierte Footer-Expansion
 * - Adaptive Resizing
 * - Newsletter-Formular
 * - Cookie-Settings
 * - Cookie Consent & Google Analytics
 *
 * KEINE EXTERNEN ABHÄNGIGKEITEN - Komplett eigenständig
 *
 * @author Abdulkerim Sesli
 * @version 1.2.0
 * @updated 2025-10-25 - Critical Observer Cleanup Fixes
 */

// =================================================================
// START: COOKIE CONSENT & GOOGLE ANALYTICS
// =================================================================

/**
 * Funktion zum Laden und Konfigurieren von Google Analytics
 * Aktiviert die blockierten Scripts mit data-consent="required"
 */
function loadGoogleAnalytics() {
  const blockedScripts = document.querySelectorAll(
    'script[data-consent="required"]'
  );

  if (blockedScripts.length === 0) {
    console.warn(
      "[Cookie Consent] Keine blockierten GA Scripts gefunden im Head"
    );
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
}

/**
 * Funktion zum Setzen eines Cookies
 * @param {string} name - Name des Cookies
 * @param {string} value - Wert des Cookies
 * @param {number} days - Gültigkeitsdauer in Tagen
 */
function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

/**
 * Funktion zum Lesen eines Cookies
 * @param {string} name - Name des Cookies
 * @returns {string|null} - Wert des Cookies oder null
 */
function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

/**
 * Initialisiert den Cookie Consent Banner
 * Prüft ob bereits eine Zustimmung vorliegt und zeigt ggf. den Banner an
 * Banner erscheint inline zwischen Copyright und Links
 */
function initializeConsentBanner() {
  const consentBanner = document.getElementById("cookie-consent-banner");
  const acceptButton = document.getElementById("accept-cookies-btn");

  if (!consentBanner || !acceptButton) {
    console.error("[Cookie Consent] Banner-Elemente nicht gefunden.");
    return;
  }

  const consent = getCookie("cookie_consent");
  if (consent === "accepted") {
    loadGoogleAnalytics();
    consentBanner.classList.add("hidden");
  } else if (consent === "rejected") {
    consentBanner.classList.add("hidden");
  } else {
    consentBanner.classList.remove("hidden");
  }

  acceptButton.addEventListener("click", () => {
    consentBanner.style.opacity = "0";
    consentBanner.style.transform = "scale(0.95)";

    setTimeout(() => {
      consentBanner.classList.add("hidden");
    }, 300);

    setCookie("cookie_consent", "accepted", 365);
    loadGoogleAnalytics();
  });

  const rejectButton = document.getElementById("reject-cookies-btn");
  if (rejectButton) {
    rejectButton.addEventListener("click", () => {
      consentBanner.style.opacity = "0";
      consentBanner.style.transform = "scale(0.95)";

      setTimeout(() => {
        consentBanner.classList.add("hidden");
      }, 300);

      setCookie("cookie_consent", "rejected", 365);
    });
  }

  const cookiesLink = document.querySelector(".footer-cookies-link");
  if (cookiesLink) {
    cookiesLink.addEventListener("click", (e) => {
      e.preventDefault();
      openFooterCookieSettings();
    });
  }
}

// Globaler IntersectionObserver für Section-Erkennung
let globalSectionObserver = null;

/**
 * Öffnet den Footer mit Cookie-Einstellungen
 */
function openFooterCookieSettings() {
  const footer = document.getElementById("site-footer");
  const footerMin = footer?.querySelector(".footer-minimized");
  const footerMax = footer?.querySelector(".footer-maximized");
  const cookieView = document.getElementById("footer-cookie-view");
  const normalContent = document.getElementById("footer-normal-content");
  const analyticsToggle = document.getElementById("footer-analytics-toggle");

  if (!footer || !footerMin || !footerMax || !cookieView) {
    console.error("[Cookie Settings] FEHLER - Fehlende Elemente:", {
      footer: !!footer,
      footerMin: !!footerMin,
      footerMax: !!footerMax,
      cookieView: !!cookieView,
    });
    return;
  }

  const consent = getCookie("cookie_consent");
  if (analyticsToggle) {
    analyticsToggle.checked = consent === "accepted";
  }

  footer.classList.add("footer-expanded");
  footerMin.classList.add("footer-hidden");
  footerMax.classList.remove("footer-hidden");
  cookieView.classList.remove("hidden");

  if (normalContent) {
    normalContent.style.display = "none";
  }

  const sections = document.querySelectorAll(
    "section[id]:not(#threeEarthContainer), main > section[id], [data-section]"
  );

  const initialVisibleSections = new Set();
  sections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
    if (isVisible) {
      const sectionId = section.id || section.dataset.section || "unknown";
      initialVisibleSections.add(sectionId);
    }
  });

  let hasTriggered = false;

  // ✅ KRITISCHER FIX: Cleanup existing observer
  if (globalSectionObserver) {
    globalSectionObserver.disconnect();
    globalSectionObserver = null;
  }

  globalSectionObserver = new IntersectionObserver(
    (entries) => {
      if (hasTriggered) return;

      const currentFooter = document.getElementById("site-footer");
      if (
        !currentFooter ||
        !currentFooter.classList.contains("footer-expanded")
      ) {
        if (globalSectionObserver) {
          globalSectionObserver.disconnect();
          globalSectionObserver = null;
        }
        return;
      }

      entries.forEach((entry) => {
        if (hasTriggered) return;

        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          const sectionId =
            entry.target.id || entry.target.dataset.section || "unknown";

          if (initialVisibleSections.has(sectionId)) {
            return;
          }

          hasTriggered = true;

          if (globalSectionObserver) {
            globalSectionObserver.disconnect();
            globalSectionObserver = null;
          }

          closeFooterCookieSettings();
        }
      });
    },
    {
      root: null,
      rootMargin: "0px",
      threshold: [0.5, 0.7],
    }
  );

  sections.forEach((section) => {
    globalSectionObserver.observe(section);
  });

  const closeBtn = document.getElementById("close-cookie-footer");
  if (closeBtn && !closeBtn.dataset.listenerAdded) {
    closeBtn.dataset.listenerAdded = "true";
    closeBtn.addEventListener("click", () => {
      if (globalSectionObserver) {
        globalSectionObserver.disconnect();
        globalSectionObserver = null;
      }
      closeFooterCookieSettings();
    });
  }

  const rejectAllBtn = document.getElementById("footer-reject-all");
  if (rejectAllBtn && !rejectAllBtn.dataset.listenerAdded) {
    rejectAllBtn.dataset.listenerAdded = "true";
    rejectAllBtn.addEventListener("click", () => {
      if (globalSectionObserver) {
        globalSectionObserver.disconnect();
        globalSectionObserver = null;
      }
      setCookie("cookie_consent", "rejected", 365);
      deleteAnalyticsCookies();
      closeFooterCookieSettings();

      const banner = document.getElementById("cookie-consent-banner");
      if (banner) banner.classList.add("hidden");

      setTimeout(() => window.location.reload(), 300);
    });
  }

  const acceptSelectedBtn = document.getElementById("footer-accept-selected");
  if (acceptSelectedBtn && !acceptSelectedBtn.dataset.listenerAdded) {
    acceptSelectedBtn.dataset.listenerAdded = "true";
    acceptSelectedBtn.addEventListener("click", () => {
      if (globalSectionObserver) {
        globalSectionObserver.disconnect();
        globalSectionObserver = null;
      }

      if (analyticsToggle && analyticsToggle.checked) {
        setCookie("cookie_consent", "accepted", 365);
        loadGoogleAnalytics();
      } else {
        setCookie("cookie_consent", "rejected", 365);
        deleteAnalyticsCookies();
      }

      closeFooterCookieSettings();

      const banner = document.getElementById("cookie-consent-banner");
      if (banner) banner.classList.add("hidden");

      setTimeout(() => window.location.reload(), 300);
    });
  }

  const acceptAllBtn = document.getElementById("footer-accept-all");
  if (acceptAllBtn && !acceptAllBtn.dataset.listenerAdded) {
    acceptAllBtn.dataset.listenerAdded = "true";
    acceptAllBtn.addEventListener("click", () => {
      if (globalSectionObserver) {
        globalSectionObserver.disconnect();
        globalSectionObserver = null;
      }
      setCookie("cookie_consent", "accepted", 365);
      loadGoogleAnalytics();
      closeFooterCookieSettings();

      const banner = document.getElementById("cookie-consent-banner");
      if (banner) banner.classList.add("hidden");

      setTimeout(() => window.location.reload(), 300);
    });
  }
}

/**
 * Schließt die Cookie-Einstellungen und minimiert Footer
 */
function closeFooterCookieSettings() {
  const footer = document.getElementById("site-footer");
  const footerMin = footer?.querySelector(".footer-minimized");
  const footerMax = footer?.querySelector(".footer-maximized");
  const cookieView = document.getElementById("footer-cookie-view");
  const normalContent = document.getElementById("footer-normal-content");

  // ✅ KRITISCHER FIX: Cleanup observer
  if (globalSectionObserver) {
    globalSectionObserver.disconnect();
    globalSectionObserver = null;
  }

  if (footer && footerMin && footerMax && cookieView) {
    cookieView.classList.add("hidden");

    footer.classList.remove("footer-expanded");
    document.body.classList.remove("footer-expanded");
    footerMax.classList.add("footer-hidden");
    footerMin.classList.remove("footer-hidden");

    if (globalScrollHandler) {
      globalScrollHandler.expanded = false;
    }

    if (normalContent) {
      normalContent.style.display = "block";
    }
  } else {
    console.warn(
      "[Cookie Settings] Konnte nicht schließen - Elemente fehlen:",
      {
        footer: !!footer,
        footerMin: !!footerMin,
        footerMax: !!footerMax,
        cookieView: !!cookieView,
      }
    );
  }
}

/**
 * Entfernt Google Analytics Cookies (bei Widerruf)
 */
function deleteAnalyticsCookies() {
  const cookiesToDelete = ["_ga", "_gid", "_gat", "_gat_gtag_G_S0587RQ4CN"];

  cookiesToDelete.forEach((cookieName) => {
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    const domain = window.location.hostname;
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain}`;
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain}`;
  });
}

// =================================================================
// ENDE: COOKIE CONSENT & GOOGLE ANALYTICS
// =================================================================

// ===== SHARED UTILITIES =====
function throttle(func, delay) {
  let timeout = null;
  let lastRan = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastRan >= delay) {
      func.apply(this, args);
      lastRan = now;
    } else {
      clearTimeout(timeout);
      timeout = setTimeout(
        () => {
          func.apply(this, args);
          lastRan = Date.now();
        },
        delay - (now - lastRan)
      );
    }
  };
}

// ===== THEME SYSTEM =====
const themeLog = createLogger("ThemeSystem");

class ThemeSystem {
  constructor() {
    this.currentTheme = this.loadTheme();
    this.ripples = [];
  }

  loadTheme() {
    const saved = localStorage.getItem("preferred-theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  saveTheme(theme) {
    localStorage.setItem("preferred-theme", theme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    this.currentTheme = theme;
    this.saveTheme(theme);
    themeLog.debug(`Theme angewendet: ${theme}`);
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
    themeLog.info(
      "Theme System initialisiert (Warte auf Footer für Toggle-Button)"
    );
  }

  initToggleButton() {
    const toggle = document.getElementById("dayNightToggle");
    if (!toggle) {
      themeLog.warn("Day/Night Toggle Button nicht gefunden");
      return false;
    }

    toggle.addEventListener("click", (e) => {
      const rect = toggle.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.createRipple(toggle, x, y);
      this.toggleTheme();
    });

    themeLog.info("Theme Toggle Button verbunden");
    return true;
  }
}

// ===== FOOTER LOADER =====
const loaderLog = createLogger("FooterLoader");

class FooterLoader {
  async init() {
    const container = document.getElementById("footer-container");
    if (!container) {
      loaderLog.warn("Footer Container nicht gefunden");
      return false;
    }

    try {
      await this.loadContent(container);
      this.updateYears();
      this.setupInteractions();

      initializeConsentBanner();

      loaderLog.info("Footer erfolgreich geladen");
      document.dispatchEvent(
        new CustomEvent("footer:loaded", {
          detail: { footerId: "site-footer" },
        })
      );

      return true;
    } catch (error) {
      loaderLog.error("Footer-Ladefehler:", error);
      this.showFallback(container);
      return false;
    }
  }

  async loadContent(container) {
    const src =
      container.dataset.footerSrc ||
      "/content/webentwicklung/footer/footer.html";
    loaderLog.debug(`Lade Footer: ${src}`);

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
    const form = document.querySelector(".newsletter-form-enhanced");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = form.querySelector('input[type="email"]');
        if (input?.value) {
          const email = input.value;
          loaderLog.info("Newsletter-Anmeldung:", email);

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

    const cookieBtn = document.querySelector(".footer-cookie-btn");
    if (cookieBtn) {
      cookieBtn.addEventListener("click", () => {
        openFooterCookieSettings();
      });
    }

    const footer = document.getElementById("site-footer");
    if (footer) {
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
  }

  showFallback(container) {
    container.innerHTML = `
      <footer class="site-footer-fixed" style="padding: 16px; text-align: center;">
        <p>© ${new Date().getFullYear()} Abdulkerim Sesli</p>
      </footer>
    `;
  }
}

// ===== SCROLL HANDLER =====
const scrollLog = createLogger("ScrollHandler");

let globalScrollHandler = null;

class ScrollHandler {
  constructor() {
    this.expanded = false;
    this.observer = null;
    this.EXPAND_THRESHOLD = 0.05;
    this.COLLAPSE_THRESHOLD = 0.02;

    globalScrollHandler = this;
  }

  init() {
    const footer = document.getElementById("site-footer");
    const trigger = document.getElementById("footer-trigger-zone");

    if (!footer || !trigger) {
      scrollLog.warn("Footer oder Trigger-Zone nicht gefunden");
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target.id === "footer-trigger-zone") {
            const threshold = this.expanded
              ? this.COLLAPSE_THRESHOLD
              : this.EXPAND_THRESHOLD;

            const shouldExpand =
              entry.isIntersecting && entry.intersectionRatio >= threshold;

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
    scrollLog.info("Scroll Handler mit Hysterese initialisiert");
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
      scrollLog.debug("Footer expandiert");
    } else if (!shouldExpand && this.expanded) {
      footer.classList.remove("footer-expanded");
      document.body.classList.remove("footer-expanded");
      maximized.classList.add("footer-hidden");
      this.expanded = false;
      scrollLog.debug("Footer kollabiert");
    }
  }

  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// ===== FOOTER RESIZER =====
const resizerLog = createLogger("FooterResizer");

class FooterResizer {
  constructor() {
    this.config = {
      MOBILE_BREAKPOINT: 768,
      MAX_FOOTER_RATIO_MOBILE: 0.7,
      MAX_FOOTER_RATIO_DESKTOP: 0.6,
      MIN_SCALE_MOBILE: 0.75,
      MIN_SCALE_DESKTOP: 0.5,
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

    const content = document.querySelector(
      "#site-footer .footer-enhanced-content"
    );

    if (content && "ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
        }
        this.rafId = requestAnimationFrame(() => {
          this.apply();
          this.rafId = null;
        });
      });

      this.resizeObserver.observe(content);
      resizerLog.debug("ResizeObserver für Footer-Content aktiviert");
    } else {
      setTimeout(() => this.apply(), 250);
      setTimeout(() => this.apply(), 1200);
    }

    if (document.fonts) {
      document.fonts.ready.then(() => {
        requestAnimationFrame(() => this.apply());
      });
    }

    resizerLog.info("Footer Resizer initialisiert");
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
    const vv = window.visualViewport;
    const h = Math.max(1, vv?.height ?? window.innerHeight ?? 0);
    return { h, usable: h };
  }

  computeScale() {
    const w = Math.max(320, window.innerWidth);
    return Math.max(0.8, Math.min(1, 0.88 + w / 2000));
  }

  setCSSVar(name, value) {
    const footer = document.getElementById("site-footer");
    const target = footer ?? document.documentElement;
    target.style.setProperty(name, value);
  }

  apply() {
    const footer = document.getElementById("site-footer");
    if (!footer) {
      resizerLog.debug("Footer noch nicht geladen");
      return;
    }

    const { usable } = this.measureViewport();
    this.setCSSVar("--vh", `${usable * 0.01}px`);

    const isMobile = window.innerWidth <= this.config.MOBILE_BREAKPOINT;
    const maxRatio = isMobile
      ? this.config.MAX_FOOTER_RATIO_MOBILE
      : this.config.MAX_FOOTER_RATIO_DESKTOP;
    const maxFooter = Math.round(usable * maxRatio);
    this.setCSSVar("--footer-max-height", `${maxFooter}px`);

    const content = document.querySelector(
      "#site-footer .footer-enhanced-content"
    );
    if (content) {
      this.setCSSVar("--footer-scale", "1");
      void content.offsetHeight;

      const naturalHeight = content.scrollHeight;
      const base = Math.max(1, naturalHeight || 0);
      let scale =
        base > 0 ? Math.min(1, maxFooter / base) : this.computeScale();

      const minScale = isMobile
        ? this.config.MIN_SCALE_MOBILE
        : this.config.MIN_SCALE_DESKTOP;
      scale = Math.max(minScale, Number(scale.toFixed(3)));

      this.setCSSVar("--footer-scale", String(scale));
      const actual = Math.round(base * scale);
      this.setCSSVar("--footer-actual-height", `${actual}px`);

      const snapshot = `${scale}|${isMobile}|${maxFooter}|${actual}`;
      if (this.lastSnapshot !== snapshot) {
        resizerLog.debug(
          `Scale: ${scale}, Mobile: ${isMobile}, Max: ${maxFooter}px, Actual: ${actual}px`
        );
        this.lastSnapshot = snapshot;
      }
    } else {
      this.setCSSVar("--footer-scale", String(this.computeScale()));
      this.setCSSVar("--footer-actual-height", `${maxFooter}px`);
    }
  }
}

// ===== MAIN INITIALIZATION =====
const mainLog = createLogger("FooterSystem");

class FooterSystem {
  constructor() {
    this.theme = new ThemeSystem();
    this.loader = new FooterLoader();
    this.scroller = new ScrollHandler();
    this.resizer = new FooterResizer();
  }

  async init() {
    mainLog.info("Initialisiere Footer-System...");

    this.theme.init();

    const loaded = await this.loader.init();

    if (loaded) {
      this.theme.initToggleButton();

      this.scroller.init();
      this.resizer.init();

      mainLog.info("✅ Footer-System vollständig initialisiert");
    } else {
      mainLog.error("❌ Footer konnte nicht geladen werden");
    }
  }
}

// ===== AUTO-START =====
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    const system = new FooterSystem();
    system.init();
  });
} else {
  const system = new FooterSystem();
  system.init();
}

if (typeof window !== "undefined") {
  window.FooterSystem = FooterSystem;
}