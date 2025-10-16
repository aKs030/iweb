/* eslint no-console: ["warn", { allow: ["error", "warn", "info", "log"] }] */
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
 *
 * KEINE EXTERNEN ABHÄNGIGKEITEN - Komplett eigenständig
 *
 * @author Abdulkerim Sesli
 * @version 1.0.0
 * @updated 2025-10-16 - Optimierte All-in-One Version
 */

// ===== SHARED UTILITIES =====
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
let globalLogLevel = LOG_LEVELS.warn;

// Debug-Modus
if (typeof window !== "undefined") {
  const urlParams = new URLSearchParams(window.location.search);
  if (
    urlParams.get("debug") === "true" ||
    window.localStorage?.getItem("iweb-debug") === "true"
  ) {
    globalLogLevel = LOG_LEVELS.debug;
  }
}

function createLogger(category) {
  const prefix = `[${category}]`;
  return {
    error: (msg, ...args) =>
      globalLogLevel >= LOG_LEVELS.error && console.error(prefix, msg, ...args),
    warn: (msg, ...args) =>
      globalLogLevel >= LOG_LEVELS.warn && console.warn(prefix, msg, ...args),
    info: (msg, ...args) =>
      globalLogLevel >= LOG_LEVELS.info && console.info(prefix, msg, ...args),
    debug: (msg, ...args) =>
      globalLogLevel >= LOG_LEVELS.debug && console.log(prefix, msg, ...args),
  };
}

const elementCache = new Map();
function getElementById(id, useCache = true) {
  if (useCache && elementCache.has(id)) {
    const cached = elementCache.get(id);
    if (cached && document.contains(cached)) return cached;
    elementCache.delete(id);
  }
  const element = document.getElementById(id);
  if (useCache && element && elementCache.size < 20) {
    elementCache.set(id, element);
  }
  return element;
}

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
    // Theme sofort anwenden (bevor Footer geladen ist)
    this.applyTheme(this.currentTheme);

    // Button-Event-Listener wird später hinzugefügt (wenn Footer geladen ist)
    themeLog.info(
      "Theme System initialisiert (Warte auf Footer für Toggle-Button)"
    );
  }

  initToggleButton() {
    const toggle = getElementById("dayNightToggle");
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
    const container = getElementById("footer-container");
    if (!container) {
      loaderLog.warn("Footer Container nicht gefunden");
      return false;
    }

    try {
      await this.loadContent(container);
      this.updateYears();
      this.setupInteractions();

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
    // Newsletter Form
    const form = document.querySelector(".newsletter-form-enhanced");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = form.querySelector('input[type="email"]');
        if (input?.value) {
          loaderLog.info("Newsletter-Anmeldung:", input.value);
          console.warn("Danke für deine Anmeldung! (Demo-Modus)");
          input.value = "";
        }
      });
    }

    // Cookie Settings
    const cookieBtn = document.querySelector(".footer-cookie-btn");
    if (cookieBtn) {
      cookieBtn.addEventListener("click", () => {
        loaderLog.info("Cookie-Einstellungen öffnen");
        console.warn("Cookie-Einstellungen (Demo-Modus)");
      });
    }

    // Smooth Scrolling für interne Links
    const footer = getElementById("site-footer");
    if (footer) {
      footer.addEventListener("click", (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (!link) return;

        const targetId = link.getAttribute("href").substring(1);
        const target = getElementById(targetId);

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

class ScrollHandler {
  constructor() {
    this.expanded = false;
    this.observer = null;
  }

  init() {
    const footer = getElementById("site-footer");
    const trigger = getElementById("footer-trigger-zone");

    if (!footer || !trigger) {
      scrollLog.warn("Footer oder Trigger-Zone nicht gefunden");
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target.id === "footer-trigger-zone") {
            const shouldExpand =
              entry.isIntersecting && entry.intersectionRatio >= 0.1;
            this.toggleExpansion(shouldExpand);
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -50% 0px",
        threshold: [0.1, 0.5],
      }
    );

    this.observer.observe(trigger);
    scrollLog.info("Scroll Handler initialisiert");
  }

  toggleExpansion(shouldExpand) {
    const footer = getElementById("site-footer");
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
  }

  init() {
    this.apply();

    const onResize = throttle(() => {
      requestAnimationFrame(() => this.apply());
    }, this.config.THROTTLE_DELAY);

    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    // Zusätzliche Trigger
    setTimeout(() => this.apply(), 250);
    setTimeout(() => this.apply(), 1200);

    if (document.fonts) {
      document.fonts.ready.then(() => setTimeout(() => this.apply(), 30));
    }

    resizerLog.info("Footer Resizer initialisiert");
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
    const footer = getElementById("site-footer");
    const target = footer ?? document.documentElement;
    target.style.setProperty(name, value);
  }

  apply() {
    const footer = getElementById("site-footer");
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

    // Theme sofort anwenden (noch ohne Toggle-Button)
    this.theme.init();

    // Footer laden
    const loaded = await this.loader.init();

    if (loaded) {
      // WICHTIG: Toggle-Button erst NACH Footer-Laden initialisieren
      this.theme.initToggleButton();

      // Nach erfolgreichem Laden: Scroll & Resize
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

// Export für manuelle Initialisierung (optional)
if (typeof window !== "undefined") {
  window.FooterSystem = FooterSystem;
}
