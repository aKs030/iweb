import { MenuController } from '/components/menu/modules/MenuController.js';
import { createConfig } from '/components/menu/modules/MenuConfig.js';
import { createLogger } from '/core/logger.js';
import '../menu/menu.css';

const logger = createLogger('site-menu');

export class SiteMenu extends HTMLElement {
  constructor() {
    super();
    this.controller = null;
  }

  async connectedCallback() {
    if (this.controller) return;

    logger.debug('SiteMenu connected');

    // Create the container element expected by the menu system
    // We keep the ID for now to maintain compatibility with internal CSS/JS that might reference it
    // But ideally we should scope everything to this component.
    this.innerHTML = '<div id="menu-container"></div>';
    const container = this.querySelector('#menu-container');

    try {
      const config = createConfig();
      // We pass the container explicitly to the controller
      // Note: We need to modify MenuController to accept this,
      // or we rely on it finding #menu-container which we just created.
      // Since we just created it in the DOM (this is in the DOM), getElementById might find it
      // if we are in the main document. ShadowDOM would hide it.
      // For now we don't use ShadowDOM to let global styles apply easily.

      this.controller = new MenuController(config);

      // Monkey-patch or update getContainer to return our element?
      // Better: Update MenuController to accept container instance.
      // Assuming we will update MenuController.js in the next step.
      this.controller.explicitContainer = container;

      await this.controller.init();
      logger.info('SiteMenu initialized');
    } catch (error) {
      logger.error('SiteMenu initialization failed:', error);
    }
  }

  disconnectedCallback() {
    if (this.controller) {
      this.controller.destroy();
      this.controller = null;
    }
  }
}

customElements.define('site-menu', SiteMenu);
