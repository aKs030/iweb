/**
 * Projects Page Loader
 * @version 6.0.0
 */

import { initReactProjectsApp } from './app.js';
import { hideLoader } from '/content/core/global-loader.js';

const initPage = () => {
  try {
    initReactProjectsApp();
    hideLoader(100);
  } catch (error) {
    hideLoader(500);
    const root = document.getElementById('root');
    if (root && !root.innerHTML.trim()) {
      root.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #ef4444; background: rgba(0,0,0,0.8); border-radius: 1rem; margin: 2rem;">
          <h2>Fehler beim Laden</h2>
          <p><strong>Details:</strong> <span id="error-detail"></span></p>
          <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; background: #4444ff; color: white; border: none; border-radius: 4px;">
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
