/**
 * Projects Page Loader
 * @version 5.0.0 - Deep cleanup
 */

import { initReactProjectsApp } from './app.js';
import { createLogger } from '/content/core/logger.js';
import { updateLoader, hideLoader } from '/content/core/global-loader.js';
import { i18n } from '/content/core/i18n.js';

const log = createLogger('ProjectsLoader');

/**
 * Initialize page with progress tracking
 */
const initPage = async () => {
  try {
    // Ensure i18n is ready
    await i18n.init();

    updateLoader(0.1, i18n.t('loader.init'));

    // Initialize React Projects App
    updateLoader(0.4, i18n.t('loader.loading_app'));

    try {
      initReactProjectsApp();
    } catch (reactError) {
      log.error(`React App failed: ${reactError.message}`);
      throw reactError;
    }

    updateLoader(0.9, i18n.t('loader.almost_ready'));

    setTimeout(() => {
      updateLoader(1, i18n.t('loader.ready'));
      hideLoader(100);
    }, 100);

    log.info('Projects page initialized successfully');
  } catch (error) {
    log.error('Projects page initialization failed:', error);
    updateLoader(1, i18n.t('loader.failed'));
    hideLoader(500);

    // Show error in the root element if app failed to initialize
    const rootEl = document.getElementById('root');
    if (rootEl && !rootEl.innerHTML.trim()) {
      rootEl.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #ef4444; background: rgba(0,0,0,0.8); border-radius: 1rem; margin: 2rem;">
          <h2>${i18n.t('error.load_failed_title')}</h2>
          <p><strong>${i18n.t('error.details')}:</strong> ${error.message}</p>
          <p><strong>${i18n.t('error.time')}:</strong> ${new Date().toLocaleTimeString()}</p>
          <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; background: #4444ff; color: white; border: none; border-radius: 4px;">
            ${i18n.t('error.reload_page')}
          </button>
        </div>
      `;
    }
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  globalThis.addEventListener('DOMContentLoaded', initPage, { once: true });
} else {
  initPage();
}
