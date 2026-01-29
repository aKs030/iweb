// @ts-check
/**
 * TypeWriter Web Component
 * Declarative wrapper for TypeWriter functionality
 * @version 1.0.0
 */

import { TypeWriter } from './TypeWriter.js';
import { createLogger } from '/content/core/logger.js';

const log = createLogger('TypeWriterElement');

/**
 * TypeWriter Custom Element
 * @extends HTMLElement
 *
 * @example
 * <type-writer
 *   quotes='[{"text":"Hello","author":"World"}]'
 *   type-speed="100"
 *   delete-speed="50"
 *   wait="3000"
 *   shuffle="true"
 *   loop="true">
 *   <div class="text" slot="text"></div>
 *   <div class="author" slot="author"></div>
 * </type-writer>
 */
export class TypeWriterElement extends HTMLElement {
  constructor() {
    super();
    /** @type {TypeWriter|null} */
    this.typeWriter = null;
    this.initialized = false;
  }

  static get observedAttributes() {
    return ['quotes', 'type-speed', 'delete-speed', 'wait', 'shuffle', 'loop'];
  }

  connectedCallback() {
    if (this.initialized) return;

    try {
      this.init();
      this.initialized = true;
      log.info('TypeWriter initialized');
    } catch (error) {
      log.error('TypeWriter initialization failed:', error);
    }
  }

  disconnectedCallback() {
    if (this.typeWriter) {
      this.typeWriter.destroy();
      this.typeWriter = null;
    }
    this.initialized = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (!this.initialized) return;

    // Restart with new config
    this.disconnectedCallback();
    this.connectedCallback();
  }

  init() {
    // Get slot elements
    const textEl = this.querySelector('[slot="text"]');
    const authorEl = this.querySelector('[slot="author"]');

    if (!textEl || !authorEl) {
      throw new Error('TypeWriter requires text and author slots');
    }

    // Parse quotes
    const quotesAttr = this.getAttribute('quotes');
    let quotes = [];

    if (quotesAttr) {
      try {
        quotes = JSON.parse(quotesAttr);
      } catch (e) {
        log.error('Failed to parse quotes attribute:', e);
        return;
      }
    }

    if (!quotes.length) {
      log.warn('No quotes provided');
      return;
    }

    // Parse config
    const config = {
      textEl,
      authorEl,
      quotes,
      typeSpeed: parseInt(this.getAttribute('type-speed') || '85', 10),
      deleteSpeed: parseInt(this.getAttribute('delete-speed') || '40', 10),
      wait: parseInt(this.getAttribute('wait') || '2400', 10),
      shuffle: this.getAttribute('shuffle') !== 'false',
      loop: this.getAttribute('loop') !== 'false',
    };

    // Create TypeWriter instance
    this.typeWriter = new TypeWriter(config);

    this.dispatchEvent(
      new CustomEvent('typewriter:loaded', {
        bubbles: true,
        detail: { typeWriter: this.typeWriter },
      }),
    );
  }

  /**
   * Get TypeWriter instance
   * @returns {TypeWriter|null}
   */
  getTypeWriter() {
    return this.typeWriter;
  }

  /**
   * Stop typing animation
   */
  stop() {
    if (this.typeWriter) {
      this.typeWriter.destroy();
    }
  }
}

// Define custom element
customElements.define('type-writer', TypeWriterElement);
