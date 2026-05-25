import { scheduleIdleTask } from "../../../core/utils/index.js";
import { applyCspNonce } from "../../../core/utils/index.js";
import { upsertHeadLink } from "../../../core/utils/index.js";
import { createLogger } from "../../../core/logger.js";
import { resourceHints } from "../../../core/seo/index.js";
import { EARTH_PRIMARY_TEXTURE_URL } from "#components/particles/index.js";

const log = createLogger("head-assets");

function getNormalizedPathname() {
  return (globalThis.location?.pathname || "").replace(/\/+$/g, "") || "/";
}

function upsertInlineModule({ id, code }) {
  if (document.getElementById(id)) return;

  const script = document.createElement("script");
  script.id = id;
  script.type = "module";
  script.textContent = code;
  script.dataset.injectedBy = "head-inline";
  applyCspNonce(script);
  document.head.appendChild(script);
}

function upsertStyle(href) {
  if (document.head.querySelector(`link[href="${href}"]`)) return;

  upsertHeadLink({
    rel: "stylesheet",
    href,
    dataset: { injectedBy: "head-inline" },
  });
}

function injectHomeLcpHints() {
  if (getNormalizedPathname() !== "/") return;

  upsertHeadLink({
    rel: "prefetch",
    href: EARTH_PRIMARY_TEXTURE_URL,
    as: "image",
    dataset: { injectedBy: "head-inline", lcp: "hero-earth" },
  });
}

function getStylesForPath() {
  const pageSpecific = [];

  if (getNormalizedPathname() === "/") {
    pageSpecific.push(
      "/pages/home/home.css",
      "/pages/home/features.css",
      "/content/components/typewriter/typewriter.css"
    );
  }

  return pageSpecific;
}

function deferNonCriticalAssets() {
  try {
    scheduleIdleTask(
      () => {
        upsertInlineModule({
          id: "robot-companion-bootstrap",
          code: [
            'import { initRobotCompanion } from "/content/components/robot-companion/index.js";',
            "initRobotCompanion().catch(error => {",
            '  console.error("[robot-companion] init failed", error);',
            "});",
          ].join("\n"),
        });
      },
      {
        timeout: 2000,
        fallbackDelay: 1500,
      }
    );
  } catch (error) {
    log.warn("deferNonCriticalAssets failed", error);
  }
}

export function injectCoreAssets({
  runWhenDomReady,
  hasGtmId = false,
  hasGa4MeasurementId = false,
}) {
  try {
    runWhenDomReady(() => {
      if (hasGtmId) {
        resourceHints.dnsPrefetch("https://www.googletagmanager.com");
        resourceHints.dnsPrefetch("https://static.cloudflareinsights.com");
      }
      if (hasGa4MeasurementId) {
        resourceHints.dnsPrefetch("https://www.gstatic.com");
      }

      getStylesForPath().forEach(href => {
        upsertStyle(href);
      });

      injectHomeLcpHints();
      deferNonCriticalAssets();
    });
  } catch (error) {
    log.warn("injectCoreAssets failed", error);
  }
}

export function addLazyLoadingDefaults({ runWhenDomReady }) {
  try {
    runWhenDomReady(() => {
      document.querySelectorAll("img:not([loading])").forEach(img => {
        const isLcpCandidate =
          img.getAttribute("fetchpriority") === "high" ||
          /** @type {any} */ (img).dataset?.lcp === "true";
        img.setAttribute("loading", isLcpCandidate ? "eager" : "lazy");
      });

      document
        .querySelectorAll("img:not([decoding])")
        .forEach(img => img.setAttribute("decoding", "async"));
      document
        .querySelectorAll("iframe:not([loading])")
        .forEach(iframe => iframe.setAttribute("loading", "lazy"));
    });
  } catch (error) {
    log.warn("addLazyLoadingDefaults failed", error);
  }
}

export function ensureFontDisplaySwap({ runWhenDomReady }) {
  try {
    runWhenDomReady(() => {
      document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
        try {
          const el = /** @type {HTMLLinkElement} */ (link);
          if (!el.href.includes("display=swap")) {
            el.href += (el.href.includes("?") ? "&" : "?") + "display=swap";
          }
        } catch {
          /* ignore */
        }
      });
    });
  } catch (error) {
    log.warn("ensureFontDisplaySwap failed", error);
  }
}
