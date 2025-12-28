/**
 * About Module - Optimized Version
 * - Enhanced error handling with retry logic
 * - Performance optimization with timeout
 * - Better logging for debugging
 * - Improved code structure
 */

(async function () {
  const RETRY_ATTEMPTS = 2;
  const FETCH_TIMEOUT = 5000;

  let logger;

  try {
    const { createLogger } =
      await import("../../content/utils/shared-utilities.js");
    logger = createLogger("AboutModule");
  } catch (err) {
    logger?.warn?.("AboutModule: failed to import createLogger", err);
    // Fallback to no-op logger if import fails
    logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };
  }

  const host = document.querySelector("section#about[data-about-src]");

  if (!host) {
    logger.warn("About section host not found");
    return;
  }

  const src = host.getAttribute("data-about-src");

  if (!src) {
    logger.error("data-about-src attribute is missing");
    return;
  }

  /**
   * Fetch with timeout
   */
  async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        cache: "no-cache",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Load about content with retry logic
   */
  async function loadAboutContent(retries = RETRY_ATTEMPTS) {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(`Retry attempt ${attempt}/${retries}`);
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }

        const response = await fetchWithTimeout(src);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();

        if (!html.trim()) {
          throw new Error("Empty response received");
        }

        host.innerHTML = html;

        // Set page-specific metadata (title, description, canonical, OG/Twitter) and add page-level JSON-LD
        (function setAboutPageMeta() {
          try {
            const pageTitle =
              "Über mich — Abdulkerim — Digital Creator Portfolio";
            const description =
              "Über mich — Abdulkerim Sesli, Webentwickler aus Berlin. Portfolio, Projekte und persönliche Hintergründe.";
            const canonical = new URL(window.location.origin + "/about/").href;
            document.title = pageTitle;

            const upsertMeta = (attrName, attrValue, isProperty = false) => {
              const selector = isProperty
                ? `meta[property="${attrName}"]`
                : `meta[name="${attrName}"]`;
              let el = document.querySelector(selector);
              if (el) {
                el.setAttribute(isProperty ? "property" : "name", attrName);
                el.setAttribute("content", attrValue);
              } else {
                el = document.createElement("meta");
                if (isProperty) el.setAttribute("property", attrName);
                else el.setAttribute("name", attrName);
                el.setAttribute("content", attrValue);
                document.head.appendChild(el);
              }
            };

            upsertMeta("description", description);
            upsertMeta("twitter:description", description);
            upsertMeta("twitter:title", pageTitle);
            upsertMeta("og:description", description, true);
            upsertMeta("og:title", pageTitle, true);

            // Canonical link
            let canonicalEl = document.querySelector('link[rel="canonical"]');
            if (!canonicalEl) {
              canonicalEl = document.createElement("link");
              canonicalEl.setAttribute("rel", "canonical");
              document.head.appendChild(canonicalEl);
            }
            canonicalEl.setAttribute("href", canonical);

            // OG/Twitter url
            const setMetaValue = (selector, attr, value) => {
              const el = document.querySelector(selector);
              if (el) el.setAttribute(attr, value);
            };
            setMetaValue('meta[property="og:url"]', "content", canonical);
            setMetaValue('meta[name="twitter:url"]', "content", canonical);

            // Insert page-specific Person JSON-LD (mainEntityOfPage)
            const ldId = "about-person-ld";
            if (!document.getElementById(ldId)) {
              const script = document.createElement("script");
              script.type = "application/ld+json";
              script.id = ldId;
              script.textContent = JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Person",
                name: "Abdulkerim Sesli",
                url: "https://abdulkerimsesli.de/about/",
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": canonical,
                },
                image:
                  "https://abdulkerimsesli.de/content/assets/img/icons/icon-512.png",
              });
              document.head.appendChild(script);
            }
          } catch (e) {
            // Non-critical; don't break page
            logger?.warn?.("about: could not set page meta", e);
          }
        })();

        // Dispatch success event
        document.dispatchEvent(
          new CustomEvent("about:loaded", {
            detail: { success: true, attempts: attempt + 1 },
          }),
        );

        logger.info("About content loaded successfully");
        return true;
      } catch (err) {
        lastError = err;
        logger.warn(`Load attempt ${attempt + 1} failed:`, err.message);
      }
    }

    // All attempts failed
    logger.error("Failed to load about content after retries", lastError);

    // Display fallback content (no inline handlers)
    host.innerHTML = `
      <div class="about__container">
        <div class="about__error">
          <p>Inhalt konnte nicht geladen werden.</p>
          <button class="btn btn-primary about-reload">Seite neu laden</button>
        </div>
      </div>
    `;

    // Attach event listener to the injected reload button
    const aboutReload = host.querySelector(".about-reload");
    if (aboutReload) {
      aboutReload.addEventListener("click", () => location.reload(), {
        once: true,
      });
    }

    // Dispatch error event
    document.dispatchEvent(
      new CustomEvent("about:error", {
        detail: { error: lastError, attempts: RETRY_ATTEMPTS + 1 },
      }),
    );

    return false;
  }

  // Start loading
  await loadAboutContent();
})();
