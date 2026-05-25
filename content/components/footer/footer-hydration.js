import { whenFooterReady } from "./state.js";
import { cancelIdleTask, scheduleIdleTask } from "../../core/utils/index.js";
import { createLogger } from "../../core/logger.js";
import { resourceHints } from "../../core/seo/index.js";

const log = createLogger("head-footer");

const FOOTER_MODULE_HREF = "/content/components/footer/footer.js";
const FOOTER_TRIGGER_SELECTOR = '[data-footer-trigger], a[href="#footer"]';
const FOOTER_COOKIE_TRIGGER_SELECTOR = "[data-cookie-trigger]";
const FOOTER_CONSENT_ACTION_SELECTOR = "#accept-cookies, #reject-cookies";
const FOOTER_IDLE_HYDRATION_TIMEOUT_MS = 4000;
const SVG_NS = "http://www.w3.org/2000/svg";
const setAttributes = (node, attributes = {}) => {
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value == null) continue;
    if (name === "className") {
      node.setAttribute("class", value);
    } else if (value === true) {
      node.setAttribute(name, "");
    } else {
      node.setAttribute(name, String(value));
    }
  }
  return node;
};

const appendChildren = (node, children) => {
  for (const child of children) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
};

const el = (tagName, attributes = {}, ...children) =>
  appendChildren(setAttributes(document.createElement(tagName), attributes), children);

const svgEl = (tagName, attributes = {}, ...children) =>
  appendChildren(setAttributes(document.createElementNS(SVG_NS, tagName), attributes), children);

const translatedSpan = (key, text, className = "") =>
  el("span", { className, "data-i18n": key }, text);

const createFooterSymbol = (id, viewBox, ...children) =>
  svgEl("symbol", { id, viewBox }, ...children);

const createFooterIconSprite = () =>
  svgEl(
    "svg",
    {
      className: "footer-icon-sprite",
      "aria-hidden": "true",
      focusable: "false",
    },
    createFooterSymbol(
      "footer-icon-cookie",
      "0 0 24 24",
      svgEl("path", {
        d: "M21 12.8A9 9 0 1 1 11.2 3a4.8 4.8 0 0 0 5.6 5.6A4.8 4.8 0 0 0 21 12.8Z",
      }),
      svgEl("circle", { cx: "9", cy: "12", r: "1" }),
      svgEl("circle", { cx: "15.5", cy: "11", r: "1" }),
      svgEl("circle", { cx: "12.5", cy: "15", r: "1" })
    ),
    createFooterSymbol(
      "footer-icon-doc-check",
      "0 0 24 24",
      svgEl("path", {
        d: "M7 3h8l5 5v13a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 21V4.5A1.5 1.5 0 0 1 7 3Z",
      }),
      svgEl("path", { d: "M15 3v5h5" }),
      svgEl("path", { d: "m9 15 2 2 4-4" })
    ),
    createFooterSymbol(
      "footer-icon-shield",
      "0 0 24 24",
      svgEl("path", {
        d: "M12 22s7-3.5 7-9V6.2L12 3 5 6.2V13c0 5.5 7 9 7 9Z",
      })
    )
  );

const createFooterNavIcon = symbolId =>
  svgEl(
    "svg",
    {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "aria-hidden": "true",
    },
    svgEl("use", { href: `#${symbolId}` })
  );

const createCookieBanner = () =>
  el(
    "div",
    {
      id: "cookie-banner",
      className: "cookie-inline hidden",
      role: "dialog",
      "aria-label": "Cookie-Einstellungen",
    },
    el("span", { className: "cookie-emoji", "aria-hidden": "true" }, "🍪"),
    el(
      "span",
      { className: "cookie-text" },
      translatedSpan("footer.cookie_banner.text", "Wir nutzen Analytics", "full"),
      translatedSpan("footer.cookie_banner.text_short", "Analytics?", "short")
    ),
    el(
      "button",
      {
        id: "accept-cookies",
        className: "btn-accept",
        type: "button",
        "aria-label": "Cookies akzeptieren",
      },
      translatedSpan("footer.cookie_banner.accept", "Akzeptieren", "full"),
      translatedSpan("footer.cookie_banner.accept_short", "✓", "short")
    ),
    el(
      "button",
      {
        id: "reject-cookies",
        className: "btn-reject",
        type: "button",
        "aria-label": "Cookies ablehnen",
      },
      translatedSpan("footer.cookie_banner.decline", "Ablehnen", "full"),
      translatedSpan("footer.cookie_banner.decline_short", "✗", "short")
    )
  );

const createFooterShell = () => {
  const copyright = el(
    "span",
    { className: "footer-copyright" },
    "© ",
    el("span", { className: "year" }, "2026"),
    " ",
    el(
      "a",
      { href: "/", className: "brand-link", "aria-label": "Zur Startseite" },
      el("span", { className: "full-name" }, "Abdulkerim Sesli"),
      el("span", { className: "short-name" }, "aKs")
    )
  );

  const nav = el(
    "nav",
    { className: "footer-nav", "aria-label": "Footer Navigation" },
    el(
      "button",
      {
        id: "cookie-btn",
        className: "nav-btn",
        type: "button",
        "data-cookie-trigger": true,
        "aria-label": "Cookie-Einstellungen öffnen",
      },
      createFooterNavIcon("footer-icon-cookie"),
      translatedSpan("footer.legal.cookies", "Cookies")
    ),
    el(
      "a",
      { href: "/impressum/", className: "nav-btn", "aria-label": "Impressum" },
      createFooterNavIcon("footer-icon-doc-check"),
      translatedSpan("footer.legal.impressum", "Legal")
    ),
    el(
      "a",
      {
        href: "/datenschutz/",
        className: "nav-btn",
        "aria-label": "Datenschutz",
      },
      createFooterNavIcon("footer-icon-shield"),
      translatedSpan("footer.legal.privacy", "Privacy")
    )
  );

  return el(
    "footer",
    { className: "site-footer", role: "contentinfo" },
    createFooterIconSprite(),
    el(
      "div",
      { className: "footer-min" },
      el("div", { className: "footer-min-main" }, copyright, createCookieBanner(), nav),
      el(
        "button",
        {
          className: "footer-expand-toggle",
          type: "button",
          "data-footer-trigger": true,
          "aria-expanded": "false",
          "aria-controls": "footer-content",
          "aria-label": "Footer erweitern",
        },
        el("span", { "aria-hidden": "true" }, "+"),
        el("span", { className: "visually-hidden" }, "Footer erweitern")
      )
    )
  );
};

let footerModulePromise = null;
let footerHydrationAttached = false;

const getFooterTrigger = target => {
  if (!(target instanceof Element)) return null;
  return target.closest(FOOTER_TRIGGER_SELECTOR);
};

const getCookieTrigger = target => {
  if (!(target instanceof Element)) return null;
  return target.closest(FOOTER_COOKIE_TRIGGER_SELECTOR);
};

const getConsentActionTrigger = target => {
  if (!(target instanceof Element)) return null;
  return target.closest(FOOTER_CONSENT_ACTION_SELECTOR);
};

const preloadFooterModule = () => {
  resourceHints.modulePreload(FOOTER_MODULE_HREF);
};

const loadFooterModule = async () => {
  if (customElements.get("site-footer")) return null;
  if (footerModulePromise) return footerModulePromise;

  preloadFooterModule();
  footerModulePromise = import("./footer.js").catch(error => {
    footerModulePromise = null;
    log.warn("failed to load footer module", error);
    return null;
  });

  return footerModulePromise;
};

const isFooterReady = () => {
  const footer = document.querySelector("site-footer");
  return Boolean(
    footer &&
    typeof (/** @type {any} */ (footer).open) === "function" &&
    footer.querySelector("footer.site-footer")
  );
};

const waitForFooterReady = () =>
  new Promise(resolve => {
    if (isFooterReady()) {
      resolve(document.querySelector("site-footer"));
      return;
    }

    whenFooterReady({ timeout: 1500 })
      .catch(() => null)
      .finally(() => {
        resolve(document.querySelector("site-footer"));
      });
  });

const setupFooterModuleHydration = siteFooter => {
  if (footerHydrationAttached || !siteFooter || customElements.get("site-footer")) {
    return;
  }

  footerHydrationAttached = true;

  let observer = null;
  let idleHandle = null;

  const cleanup = () => {
    document.removeEventListener("pointerover", handleTriggerIntent);
    document.removeEventListener("focusin", handleTriggerIntent);
    document.removeEventListener("click", handleTriggerClick, true);

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    cancelIdleTask(idleHandle);
    idleHandle = null;
  };

  const hydrateFooterModule = async () => {
    try {
      await loadFooterModule();
    } finally {
      cleanup();
    }
  };

  const handleTriggerIntent = event => {
    if (
      !getFooterTrigger(event.target) &&
      !getCookieTrigger(event.target) &&
      !getConsentActionTrigger(event.target)
    ) {
      return;
    }
    preloadFooterModule();
  };

  const handleTriggerClick = async event => {
    if (customElements.get("site-footer") && isFooterReady()) return;
    const footerTrigger = getFooterTrigger(event.target);
    const cookieTrigger = getCookieTrigger(event.target);
    const consentActionTrigger = getConsentActionTrigger(event.target);
    if (!footerTrigger && !cookieTrigger && !consentActionTrigger) return;

    event.preventDefault();

    const footerModule = await loadFooterModule();
    const footer = await waitForFooterReady();

    try {
      if (consentActionTrigger instanceof HTMLElement && consentActionTrigger.id) {
        const hydratedConsentTrigger = footer?.querySelector?.(`#${consentActionTrigger.id}`);
        if (hydratedConsentTrigger instanceof HTMLButtonElement) {
          hydratedConsentTrigger.click();
          return;
        }
      }

      if (cookieTrigger) {
        const hydratedCookieTrigger = footer?.querySelector?.(FOOTER_COOKIE_TRIGGER_SELECTOR);
        if (
          hydratedCookieTrigger instanceof HTMLButtonElement ||
          hydratedCookieTrigger instanceof HTMLAnchorElement
        ) {
          hydratedCookieTrigger.click();
          return;
        }
      }

      await footerModule?.openFooter?.();
      /** @type {any} */ (footer)?.open?.();
    } catch (error) {
      log.warn("failed to open lazily hydrated footer", error);
    }
  };

  document.addEventListener("pointerover", handleTriggerIntent, {
    passive: true,
  });
  document.addEventListener("focusin", handleTriggerIntent);

  document.addEventListener("click", handleTriggerClick, true);

  try {
    idleHandle = scheduleIdleTask(hydrateFooterModule, {
      timeout: FOOTER_IDLE_HYDRATION_TIMEOUT_MS,
      fallbackDelay: 1500,
    });
  } catch (error) {
    log.warn("schedule idle hydration failed", error);
  }
};

export const ensureFooterAndTrigger = () => {
  try {
    // Insert footer shell synchronously if not present
    if (!document.querySelector("site-footer")) {
      const shell = createFooterShell();
      // Attach to header if present, else body
      const header = document.querySelector("header.site-header");
      if (header && header.parentNode) header.parentNode.insertBefore(shell, header.nextSibling);
      else if (document.body) document.body.appendChild(shell);
    }

    // Setup hydration + triggers
    setupFooterModuleHydration(document.querySelector("site-footer"));
  } catch (error) {
    log.warn("ensureFooterAndTrigger failed", error);
  }
};
