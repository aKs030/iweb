/**
 * Projects Page Loader
 * @version 6.0.0
 */

import { initReactProjectsApp } from './app.js';
import { AppLoadManager } from '/content/core/load-manager.js';

const initPage = () => {
  try {
    initReactProjectsApp();
    AppLoadManager.hideLoader(100);
  } catch (error) {
    AppLoadManager.hideLoader(500);
    const root = document.getElementById('root');
    if (root && !root.innerHTML.trim()) {
      root.innerHTML = `
        <div class="project-load-error">
          <h2>Fehler beim Laden</h2>
          <p><strong>Details:</strong> <span id="error-detail"></span></p>
          <button onclick="location.reload()" class="project-load-error__button">
            Seite neu laden
          </button>
        </div>
      `;
      const errorSpan = root.querySelector('#error-detail');
      if (errorSpan) errorSpan.textContent = error.message;
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage, { once: true });
} else {
  initPage();
}
