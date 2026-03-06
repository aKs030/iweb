export class PwaPrompt extends HTMLElement {
  constructor() {
    super();
    this.storageKey = 'aks_pwa_prompt_dismissed';
  }

  connectedCallback() {
    // Prüfen ob Nutzer das Popup schon mal geschlossen hat
    if (localStorage.getItem(this.storageKey)) return;

    // Nur auf iOS Apple-Geräten anzeigen, die NICHT im Standalone (App) Modus sind
    const isIos = /iphone|ipad|ipod/.test(
      window.navigator.userAgent.toLowerCase(),
    );
    const isStandalone =
      'standalone' in window.navigator && window.navigator.standalone;

    if (isIos && !isStandalone) {
      this.render();
    }
  }

  render() {
    this.innerHTML = `
      <div class="pwa-toast">
        <div class="pwa-toast-content">
          <p><strong>Bessere 3D-Erfahrung?</strong></p>
          <p>Tippe unten auf das Teilen-Icon <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg><br>und dann <em>"Zum Home-Bildschirm"</em>.</p>
        </div>
        <button class="pwa-toast-close" aria-label="Schließen">×</button>
      </div>
    `;

    // Minimales CSS direkt injiziert für Portabilität
    const style = document.createElement('style');
    style.textContent = `
      .pwa-toast {
        position: fixed;
        bottom: calc(var(--safe-bottom) + 80px); /* Über deinem Menü */
        left: 50%;
        transform: translateX(-50%);
        background: var(--surface-toast-bg, rgba(10, 10, 10, 0.95));
        border: 1px solid var(--border-color);
        backdrop-filter: blur(12px);
        color: white;
        padding: 12px 16px;
        border-radius: 12px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        z-index: 99999;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        animation: slideUp 0.5s var(--ease-spring);
        width: max-content;
        max-width: 90vw;
      }
      .pwa-toast p { margin: 0; font-size: 13px; line-height: 1.4; color: #ddd; }
      .pwa-toast p strong { color: white; font-size: 14px; }
      .pwa-toast-close { background: transparent; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; line-height: 1; opacity: 0.7; }
      @keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
    `;
    this.appendChild(style);

    this.querySelector('.pwa-toast-close').addEventListener('click', () => {
      localStorage.setItem(this.storageKey, 'true'); // Merken, dass es weggeklickt wurde
      this.remove();
    });
  }
}

customElements.define('pwa-prompt', PwaPrompt);
