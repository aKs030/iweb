// cookie-loader.js
export class CookieBannerLoader {
  constructor(config, core) {
    this.config = config;
    this.core = core;
  }

  async handleAction(action, target) {
    if (action === 'show') {
      await this.loadBanner();
    }
  }

  async loadBanner() {
    // Lade das Banner HTML und füge es ein
    const response = await fetch(this.config.bannerPath);
    const html = await response.text();
    const container = document.createElement('div');
    container.id = 'cookie-banner';
    container.innerHTML = html;
    document.body.appendChild(container);

    // Banner anzeigen
    container.classList.remove('hidden');
    container.style.opacity = '1';
    container.style.transform = 'scale(1)';
  }
}
