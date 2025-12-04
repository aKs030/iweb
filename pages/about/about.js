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
    const { createLogger } = await import('../../content/shared-utilities.js');
    logger = createLogger('AboutModule');
  } catch (err) {
    // Fallback to no-op logger if import fails
    logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };
  }

  const host = document.querySelector('section#about[data-about-src]');

  if (!host) {
    logger.warn('About section host not found');
    return;
  }

  const src = host.getAttribute('data-about-src');

  if (!src) {
    logger.error('data-about-src attribute is missing');
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
        cache: 'no-cache',
        signal: controller.signal
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
          throw new Error('Empty response received');
        }

        host.innerHTML = html;

        // Dispatch success event
        document.dispatchEvent(
          new CustomEvent('about:loaded', {
            detail: { success: true, attempts: attempt + 1 }
          })
        );

        logger.info('About content loaded successfully');
        return true;
      } catch (err) {
        lastError = err;
        logger.warn(`Load attempt ${attempt + 1} failed:`, err.message);
      }
    }

    // All attempts failed
    logger.error('Failed to load about content after retries', lastError);

    // Display fallback content
    host.innerHTML = `
      <div class="about__container">
        <div class="about__error">
          <p>Inhalt konnte nicht geladen werden.</p>
          <button onclick="location.reload()" class="btn btn-primary">
            Seite neu laden
          </button>
        </div>
      </div>
    `;

    // Dispatch error event
    document.dispatchEvent(
      new CustomEvent('about:error', {
        detail: { error: lastError, attempts: RETRY_ATTEMPTS + 1 }
      })
    );

    return false;
  }

  // Start loading
  await loadAboutContent();
})();
