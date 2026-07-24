/* Accessibility Manager */
import { closeOverlay } from "./overlay-manager.js";

class AccessibilityManager {
  constructor() {
    this._initialized = false;
    this.init();
  }

  init() {
    if (this._initialized) return;
    this.setupKeyboardNav();
    this.setupSkipLinks();
    this._initialized = true;
  }

  destroy() {
    try {
      if (this._onKeyboardNav) document.removeEventListener("keydown", this._onKeyboardNav);
      if (this._skipRemovers?.length) this._skipRemovers.forEach(r => r());
    } catch {
      // Ignore cleanup errors
    }
  }

  setupKeyboardNav() {
    this._onKeyboardNav = e => {
      if (e.key === "Escape") {
        this.handleEscape();
      }
    };
    document.addEventListener("keydown", this._onKeyboardNav);
  }

  setupSkipLinks() {
    const skipLinks = document.querySelectorAll(".skip-link");
    this._skipRemovers = [];
    skipLinks.forEach(link => {
      const _onSkipClick = e => {
        e.preventDefault();
        const href = link.getAttribute("href");
        if (!href) return;
        const target = /** @type {HTMLElement} */ (document.querySelector(href));
        if (!target) return;
        target.setAttribute("tabindex", "-1");
        target.focus();
        target.addEventListener(
          "blur",
          () => {
            try {
              target.removeAttribute("tabindex");
            } catch {
              /* ignored */
            }
          },
          { once: true }
        );
      };
      link.addEventListener("click", _onSkipClick);
      this._skipRemovers.push(() => link.removeEventListener("click", _onSkipClick));
    });
  }

  async handleEscape() {
    const closedOverlay = await closeOverlay(null, {
      reason: "escape",
      restoreFocus: true,
    });
    if (closedOverlay) return;

    const footerSr = document.querySelector("site-footer")?.shadowRoot;
    const cookieModal = (footerSr || document).querySelector("#cookie-settings:not(.hidden)");
    if (cookieModal) {
      const closeBtn = /** @type {HTMLElement} */ (cookieModal.querySelector("#close-settings"));
      if (closeBtn) closeBtn.click();
      return;
    }
  }

  announce(message, { priority = "polite", clearPrevious = true } = {}) {
    if (!message) return;
    if (typeof window?.announce === "function") {
      try {
        window.announce(message, { assertive: priority === "assertive" });
        return;
      } catch {
        // Fallback to direct DOM manipulation
      }
    }

    const region =
      priority === "assertive"
        ? document.getElementById("live-region-assertive")
        : document.getElementById("live-region-status");
    if (!region) return;

    if (clearPrevious) region.textContent = "";
    setTimeout(() => {
      try {
        region.textContent = message;
      } catch {
        // Ignore errors
      }
    }, 100);
  }
}

// Global instance (guard for SSR / non-browser environments)
const a11y = typeof window !== "undefined" ? new AccessibilityManager() : null;
if (typeof window !== "undefined") /** @type {any} */ (window).a11y = a11y;
export { a11y };

export function createAnnouncer() {
  const cache = new Map();

  return (message, { assertive = false, dedupe = false } = {}) => {
    if (!message) return;

    if (dedupe && cache.has(message)) return;
    if (dedupe) {
      cache.set(message, true);
      setTimeout(() => cache.delete(message), 3000);
    }

    try {
      const id = assertive ? "live-region-assertive" : "live-region-status";
      const region = document.getElementById(id);
      if (!region) return;

      region.textContent = "";
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    } catch {
      // Ignore announcement errors
    }
  };
}
