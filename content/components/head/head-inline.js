import { createLogger } from "../../utils/shared-utilities.js";

const log = createLogger("head-inline");

// Head inline helpers moved to external file to comply with CSP
// 1) gtag configuration (kept separate from gtag.js external loader)
//    NOTE: Host-based GTM/GA4 mapping. Update HOST_GTM_MAP below to add or change site-specific containers.
const HOST_GTM_MAP = {
  // Production
  "abdulkerimsesli.de": {
    gtm: "GTM-5F5ZSTTL",
    ga4: "G-757KWG0PG4",
    aw: "AW-1036079663",
  },
  "www.abdulkerimsesli.de": {
    gtm: "GTM-5F5ZSTTL",
    ga4: "G-757KWG0PG4",
    aw: "AW-1036079663",
  },
  // Development
  "meine-webseite.local": {
    gtm: "GT-TQTFN4NN",
    ga4: "G-S0587RQ4CN",
    aw: "AW-17819941793",
  },
  default: { gtm: "GT-TQTFN4NN", ga4: "G-S0587RQ4CN", aw: "AW-17819941793" },
};

const detectHostConfig = (host) => {
  try {
    const h = (host || (globalThis?.location?.hostname) || "").toLowerCase();
    if (!h) return HOST_GTM_MAP.default;
    // exact match or strip www.
    if (HOST_GTM_MAP[h]) return HOST_GTM_MAP[h];
    const stripped = h.replace(/^www\./, "");
    if (HOST_GTM_MAP[stripped]) return HOST_GTM_MAP[stripped];
    return HOST_GTM_MAP.default;
  } catch {
    return HOST_GTM_MAP.default;
  }
};

// Expose for tests/debug
globalThis.__getGtmConfigForHost = detectHostConfig;

const { gtm: GTM_ID, ga4: GA4_MEASUREMENT_ID } = detectHostConfig();


const dataLayer = (globalThis.dataLayer = globalThis.dataLayer || []);
function gtag() {
  dataLayer.push(arguments);
}
gtag("js", Date.now());
// ===== Migration note =====
// Move all GA4 and Google Ads tags into Google Tag Manager (GTM) to avoid double-tracking.
// Expose IDs to the dataLayer so GTM can read them and configure tags/variables centrally.
// Ads conversion ID is host-dependent; use the mapping above.
const hostCfg = detectHostConfig();
const ADS_CONVERSION_ID = hostCfg?.aw ?? null;
dataLayer.push({
  gtm_autoconfig: true,
  ads_conversion_id: ADS_CONVERSION_ID,
  ga4_measurement_id: GA4_MEASUREMENT_ID,
  gtm_id: GTM_ID,
});

// IMPORTANT: Do NOT call `gtag('config', ...)` here when GTM is enabled — that causes double-tracking.
// If GTM is not configured, the existing GA4 fallback will load gtag.js using `GA4_MEASUREMENT_ID`.

// Direct GA4 fallback loader: only used if GTM is not enabled/configured
(function injectGA4Fallback() {
  try {
    if (!GA4_MEASUREMENT_ID || GA4_MEASUREMENT_ID.indexOf("G-") !== 0) return;
    // If GTM is configured, prefer GTM for GA4 (avoid double-tracking)
    if (GTM_ID && GTM_ID !== "GTM-XXXXXXX") {
      log?.info?.("GTM present — configure GA4 inside GTM instead of direct gtag load");
      return;
    }

    // Load gtag.js if not already present
    if (
      !document.querySelector(`script[src*="gtag/js?id=${GA4_MEASUREMENT_ID}"]`)
    ) {
      const s = document.createElement("script");
      s.async = true;
      s.src =
        "https://www.googletagmanager.com/gtag/js?id=" + GA4_MEASUREMENT_ID;
      document.head.appendChild(s);
    }

    gtag("config", GA4_MEASUREMENT_ID);
  } catch (err) {
    log?.warn?.("head-inline: GA4 fallback failed", err);
  }
})();

// 1b) Google Tag Manager loader (recommended): inject gtm.js if GTM_ID is set.
//     Create a GTM Container at tagmanager.google.com and add your GA4 and other tags there.
(function injectGTM() {
  try {
    if (!GTM_ID || GTM_ID === "GTM-XXXXXXX") {
      log?.info?.("GTM not configured — set GTM_ID in head-inline.js to enable");
      return;
    }

    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ "gtm.start": Date.now(), event: "gtm.js" });
      const f = d.getElementsByTagName(s)[0];
      const j = d.createElement(s);
      j.async = true;
      j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + "&l=" + l;
      f.parentNode.insertBefore(j, f);
    })(globalThis, document, "script", "dataLayer", GTM_ID);
  } catch (err) {
    log?.warn?.("head-inline: GTM injection failed", err);
  }
})();

// Ensure GTM noscript iframe is placed immediately after the opening <body> for non-JS environments
(function ensureGTMNoScript() {
  try {
    if (!GTM_ID || GTM_ID === "GTM-XXXXXXX") return;
    const insert = () => {
      try {
        if (document.getElementById("gtm-noscript")) return;
        const ns = document.createElement("noscript");
        ns.id = "gtm-noscript";
        ns.innerHTML = `<iframe title="Google Tag Manager (noscript)" src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
        if (document.body?.firstChild) {
          document.body.insertBefore(ns, document.body.firstChild);
        } else if (document.body) {
          document.body.appendChild(ns);
        }
      } catch (err) {
        log?.warn?.("head-inline: insert noscript failed", err);
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", insert, { once: true });
    } else {
      insert();
    }
  } catch (err) {
    log?.warn?.("head-inline: GTM noscript setup failed", err);
  }
})();

// 2) ensureTrigger helper: inject a footer trigger zone if missing
(function ensureFooterAndTrigger() {
  try {
    const run = function () {
      // Ensure menu container exists in a header - create header if missing
      let menuContainer = document.getElementById("menu-container");
      if (!menuContainer) {
        let headerEl = document.querySelector("header.site-header");
        if (!headerEl) {
          headerEl = document.createElement("header");
          headerEl.className = "site-header";
          // Insert at top of body for consistent layout
          document.body.insertBefore(headerEl, document.body.firstChild);
        }
        menuContainer = document.createElement("div");
        menuContainer.id = "menu-container";
        menuContainer.dataset.injectedBy = "head-inline";
        headerEl.appendChild(menuContainer);
      }

      // If both footer trigger and container already present, nothing else to do
      if (
        document.getElementById("footer-trigger-zone") &&
        document.getElementById("footer-container")
      )
        return;

      // Ensure footer container exists so FooterLoader can attach
      let footerContainer = document.getElementById("footer-container");
      if (!footerContainer) {
        footerContainer = document.createElement("div");
        footerContainer.id = "footer-container";
        footerContainer.dataset.footerSrc = "/content/components/footer/footer";
        // Not hidden: the loaded footer will control visibility
        footerContainer.setAttribute("aria-hidden", "false");
        document.body.appendChild(footerContainer);
      }

      // Ensure trigger exists and is placed immediately before the footer container
      if (!document.getElementById("footer-trigger-zone")) {
        const trigger = document.createElement("div");
        trigger.id = "footer-trigger-zone";
        trigger.className = "footer-trigger-zone";

        // Make the trigger non-interactive but detectable by IntersectionObserver
        trigger.setAttribute("aria-hidden", "true");
        trigger.setAttribute("role", "presentation");
        trigger.style.pointerEvents = "none";
        // Slightly larger minHeight to make intersection detection more robust on first scroll
        trigger.style.minHeight = "96px";
        trigger.style.width = "100%";

        // Default thresholds (can be overridden per page by setting data attributes)
        // Small numbers increase sensitivity so even the smallest scroll can trigger the footer on desktop
        // Further reduce thresholds to improve first-scroll reliability in headless/CI and real browsers
        trigger.dataset.expandThreshold =
          trigger.dataset.expandThreshold || "0.002";
        trigger.dataset.collapseThreshold =
          trigger.dataset.collapseThreshold || "0.0008";

        // Default lock and debounce (ms) — can be overridden per-page using data attributes
        // Keep desktop more forgiving by default
        trigger.dataset.expandLockMs = trigger.dataset.expandLockMs || "1000";
        trigger.dataset.collapseDebounceMs =
          trigger.dataset.collapseDebounceMs || "250";

        if (footerContainer?.parentNode) {
          footerContainer.parentNode.insertBefore(trigger, footerContainer);
        } else {
          document.body.appendChild(trigger);
        }
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      // If DOMContentLoaded already fired, run immediately
      setTimeout(run, 0);
    }
  } catch (err) {
    log?.warn?.("head-inline: ensure footer/trigger setup failed", err);
  }
})();

// --- 3) Asset helper: non-blocking injection of core CSS/JS used across pages
(function injectCoreAssets() {
  try {
    const STYLES = [
      "/content/styles/root.css",
      "/content/styles/main.css",
      "/content/components/menu/menu.css",
      "/content/components/robot-companion/robot-companion.css",
      "/content/components/footer/footer.css",
    ];

    const SCRIPTS = [
      { src: "/content/main.js", module: true, preload: true },
      { src: "/content/components/menu/menu.js", module: true },
      {
        src: "/content/components/robot-companion/robot-companion.js",
        module: true,
      },
      { src: "/content/components/footer/footer-complete.js", module: true },
    ];

    const upsertStyle = (href) => {
      if (!document.head.querySelector(`link[href="${href}"]`)) {
        const l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = href;
        l.dataset.injectedBy = "head-inline";
        document.head.appendChild(l);
      }
    };

    const upsertModulePreload = (href) => {
      if (
        !document.head.querySelector(
          `link[rel="modulepreload"][href="${href}"]`,
        )
      ) {
        const l = document.createElement("link");
        l.rel = "modulepreload";
        l.href = href;
        // ensure crossorigin matches module script fetch mode to avoid credential-mode mismatch
        l.crossOrigin = "anonymous";
        l.dataset.injectedBy = "head-inline";
        document.head.appendChild(l);
      }
    };

    const upsertScript = ({ src, module }) => {
      if (!document.head.querySelector(`script[src="${src}"]`)) {
        const s = document.createElement("script");
        s.src = src;
        if (module) {
          s.type = "module";
          s.crossOrigin = "anonymous";
        } else s.defer = true;
        s.dataset.injectedBy = "head-inline";
        document.head.appendChild(s);
      }
    };

    const performInjection = () => {
      STYLES.forEach(upsertStyle);
      SCRIPTS.filter((s) => s.preload).forEach((s) =>
        upsertModulePreload(s.src),
      );
      SCRIPTS.forEach(upsertScript);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", performInjection, {
        once: true,
      });
    } else {
      performInjection();
    }
  } catch (err) {
    log?.warn?.("head-inline: injectCoreAssets failed", err);
  }
})();

// === Hide branding (site name) from human users (keep it in server-rendered <title> for SEO/bots)
(function hideBrandingFromUsers() {
  try {
    const ua = (navigator.userAgent || "").toLowerCase();
    const isBot = /(bot|googlebot|bingbot|slurp|duckduckgo|baiduspider|yandex|facebookexternalhit|embedly|twitterbot)/i.test(ua);

    const BRAND_REGEX = /\s*(?:[—–-]\s*Abdulkerim Sesli|\|\s*Abdulkerim Sesli|Abdulkerim\s*—\s*Digital Creator Portfolio)\s*$/i;
    const sanitize = (s) => (String(s || "").replace(BRAND_REGEX, "")).trim();

    // Small page→emoji mapping for concise tab titles
    const SHORT_MAP = {
      videos: 'Videos 🎬',
      video: 'Videos 🎬',
      projekte: 'Projekte 💼',
      projekt: 'Projekte 💼',
      blog: 'Blog ✍️',
      start: 'Startseite 🏠',
      startseite: 'Startseite 🏠',
      kontakt: 'Kontakt ✉️',
      impressum: 'Impressum ℹ️',
      datenschutz: 'Datenschutz 🔒',
      home: 'Startseite 🏠',
    };

    const makeShortTitle = (s) => {
      try {
        if (!s) return '';
        const low = s.toLowerCase();
        // prefer exact/contains matches from mapping
        for (const k of Object.keys(SHORT_MAP)) {
          if (low.includes(k)) return SHORT_MAP[k];
        }
        // fallback: first word with globe emoji
        const first = String(s).split(/[—–\-|:]/)[0].trim().split(/\s+/)[0] || '';
        if (!first) return '';
        return first.charAt(0).toUpperCase() + first.slice(1) + ' 🌐';
      } catch (e) {
        return '';
      }
    };

    // Sanitize existing title immediately (if not bot)
    if (!isBot) {
      try {
        const cleaned = sanitize(document.title);
        document.title = cleaned;
        // Also set a short tab-friendly title (one word + emoji)
        const short = makeShortTitle(cleaned);
        if (short) document.title = short;
      } catch (e) {}
    }

    // Observe <title> changes and sanitize for humans; also map to short tab title
    try {
      const titleEl = document.querySelector('title');
      if (titleEl && !isBot) {
        new MutationObserver(() => {
          try {
            const t = document.title;
            const s = sanitize(t);
            const short = makeShortTitle(s);
            const newTitle = short || s;
            if (newTitle !== t) document.title = newTitle;
          } catch (e) {}
        }).observe(titleEl, { childList: true, characterData: true, subtree: true });
      }
    } catch (e) {
      /* ignore */
    }

    // Sanitize visible headings on page and watch for added nodes
    const sanitizeHeadings = () => {
      try {
        document.querySelectorAll('h1,h2,.section-title,.section-header,.page-title,.site-title').forEach((el) => {
          if (!el || !el.textContent) return;
          const cleaned = sanitize(el.textContent);
          if (cleaned !== el.textContent) el.textContent = cleaned;
        });
      } catch (e) {}
    };

    sanitizeHeadings();

    // Watch for DOM additions and sanitize newly inserted headings
    try {
      const mo = new MutationObserver((mutations) => {
        let changed = false;
        for (const m of mutations) {
          if (m.addedNodes && m.addedNodes.length) {
            changed = true;
            break;
          }
        }
        if (changed) sanitizeHeadings();
      });
      mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (e) {}
  } catch (err) {
    log?.warn?.('hideBrandingFromUsers failed', err);
  }
})();
