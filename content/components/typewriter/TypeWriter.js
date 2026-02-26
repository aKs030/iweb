// @ts-check
/**
 * TypeWriter Component
 * Animated text typing effect with multi-line support
 * @version 2.0.0
 */
import { createLogger } from '../../core/logger.js';
import { getElementById } from '../../core/utils.js';
import { TimerManager } from '../../core/utils.js';

const log = createLogger('TypeWriter');

/**
 * Shuffle array using Fisher-Yates algorithm
 * @template T
 * @param {T[]} array - Array to shuffle
 * @returns {T[]} Shuffled array
 */
const shuffle = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
// Helper: EVENTS constant
const EVENTS = {
  HERO_TYPING_END: 'hero:typingEnd',
};

/** @type {TypeWriter|null} Internal instance reference */
let typeWriterInstance = null;

/**
 * Stop hero subtitle animation
 * @returns {boolean} Success status
 */
export function stopHeroSubtitle() {
  if (!typeWriterInstance) return false;
  try {
    typeWriterInstance.destroy();
  } catch {
    /* ignore */
  }
  typeWriterInstance = null;
  return true;
}

// Helper: CSS Variables setzen (set CSS variables)
/**
 * @param {HTMLElement} el
 * @param {Record<string, string>} vars
 */
const setCSSVars = (el, vars) =>
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));

// Helper: Line Measurer
/**
 * @param {HTMLElement} subtitleEl
 */
function makeLineMeasurer(subtitleEl) {
  const measurer = document.createElement('div');
  measurer.style.cssText =
    'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:normal;pointer-events:none';
  document.body.appendChild(measurer);

  const cs = getComputedStyle(subtitleEl);
  [
    'font-size',
    'line-height',
    'font-family',
    'font-weight',
    'letter-spacing',
    'word-spacing',
    'font-kerning',
    'font-variant-ligatures',
    'text-transform',
    'text-rendering',
    'word-break',
    'overflow-wrap',
    'hyphens',
  ].forEach((p) => measurer.style.setProperty(p, cs.getPropertyValue(p)));

  const getLineHeight = () => {
    const lh = cs.lineHeight.trim();
    if (lh.endsWith('px')) {
      const v = parseFloat(lh);
      if (!isNaN(v)) return v;
    }
    const num = parseFloat(lh);
    if (!isNaN(num)) {
      const fs = parseFloat(cs.fontSize);
      if (!isNaN(fs)) return num * fs;
    }
    measurer.innerHTML = '<span style="display:inline-block">A</span>';
    const firstChild = /** @type {HTMLElement|null} */ (measurer.firstChild);
    return firstChild?.getBoundingClientRect().height || 0;
  };

  /**
   * @param {string} text
   * @returns {string[]}
   */
  const getLines = (text) => {
    measurer.innerHTML = '';
    const words = text.split(' ');
    const lines = [];
    let currentLine = [];

    const rect = subtitleEl.getBoundingClientRect();
    const available = Math.max(0, window.innerWidth - (rect.left || 0) - 12);
    const cap = Math.min(window.innerWidth * 0.92, 820);
    measurer.style.width = Math.max(1, Math.min(available || cap, cap)) + 'px';

    const lh = getLineHeight();
    if (!lh) return [text];

    words.forEach((/** @type {string} */ word) => {
      const testLine = currentLine.length
        ? currentLine.join(' ') + ' ' + word
        : word;
      measurer.textContent = testLine;

      if (measurer.getBoundingClientRect().height > lh * 1.1) {
        if (currentLine.length) {
          lines.push(currentLine.join(' '));
          currentLine = [word];
        } else {
          lines.push(word);
          currentLine = [];
        }
      } else {
        currentLine.push(word);
      }
    });

    if (currentLine.length) {
      lines.push(currentLine.join(' '));
    }

    return lines.length ? lines : [text];
  };

  return {
    getLines,
    /**
     * @param {string} text
     * @returns {number}
     */
    reserveFor(text) {
      const lh = getLineHeight();
      const linesArr = getLines(text);
      const lines = linesArr.length;

      setCSSVars(subtitleEl, {
        '--lh-px': lh ? `${lh}px` : '0px',
        '--gap-px': lh ? `${lh * 0.25}px` : '0px',
        '--lines': String(lines),
      });

      subtitleEl.setAttribute('data-lines', String(lines));
      return lines;
    },
  };
}

/**
 * @typedef {Object} TypeWriterQuote
 * @property {string} text - Quote text
 * @property {string} [author] - Quote author
 */

/**
 * TypeWriter Class
 * Animated typing effect with configurable speed and behavior
 */
class TypeWriter {
  /**
   * @param {Object} config - Configuration object
   * @param {HTMLElement} config.textEl - Text container element
   * @param {HTMLElement} config.authorEl - Author container element
   * @param {TypeWriterQuote[]} config.quotes - Array of quotes
   * @param {number} [config.wait=2400] - Wait time after typing
   * @param {number} [config.typeSpeed=85] - Typing speed in ms
   * @param {number} [config.deleteSpeed=40] - Delete speed in ms
   * @param {boolean} [config.shuffle=true] - Shuffle quotes
   * @param {boolean} [config.loop=true] - Loop quotes
   * @param {((text: string) => string | void) | null} [config.onBeforeType] - Callback before typing
   */
  constructor({
    textEl,
    authorEl,
    quotes,
    wait = 2400,
    typeSpeed = 85,
    deleteSpeed = 40,
    shuffle: doShuffle = true,
    loop = true,
    onBeforeType = null,
  }) {
    if (!textEl || !authorEl || !quotes?.length) {
      log.error('TypeWriter: Missing required parameters');
      return /** @type {any} */ (undefined);
    }

    this.quotes = quotes.filter((q) => q?.text);
    if (!this.quotes.length) {
      log.error('No valid quotes');
      return /** @type {any} */ (undefined);
    }

    // Initialize instance properties
    this.textEl = textEl;
    this.authorEl = authorEl;
    this.wait = wait;
    this.typeSpeed = typeSpeed;
    this.deleteSpeed = deleteSpeed;
    this.shuffle = doShuffle;
    this.loop = loop;
    /** @type {((text: string) => string | void) | null} */
    this.onBeforeType = onBeforeType || null;
    this.timerManager = new TimerManager();
    this._isDeleting = false;
    this._txt = '';

    this._queue = this._createQueue();
    /** @type {number} */
    this._index = this._queue.shift() ?? 0;
    this._current = this.quotes[this._index];

    document.body.classList.add('has-typingjs');
    if (this.onBeforeType) {
      const res = this.onBeforeType(this._current.text);
      if (typeof res === 'string') this._current.text = res;
    }
    this._tick();
  }

  destroy() {
    if (!this.timerManager) return;
    this.timerManager.clearAll();
    document.body.classList.remove('has-typingjs');
    // Call teardown for external event listeners
    try {
      const instance = /** @type {any} */ (this);
      if (typeof instance.__teardown === 'function') {
        instance.__teardown();
        instance.__teardown = null;
      }
    } catch {
      /* ignore */
    }
    // Clear internal instance if this is the active one
    try {
      if (typeWriterInstance === this) typeWriterInstance = null;
    } catch {
      /* ignore */
    }
  }

  _createQueue() {
    if (!this.quotes) return [];
    return this.shuffle
      ? shuffle([...Array(this.quotes.length).keys()])
      : [...Array(this.quotes.length).keys()];
  }

  _nextQuote() {
    if (!this._queue || !this.quotes) return null;
    if (!this._queue.length) {
      if (!this.loop) return null;
      this._queue = this._generateQueue();
    }
    this._index = this._queue.shift() ?? 0;
    return (this._current = this.quotes[this._index]);
  }

  _generateQueue() {
    if (!this.quotes || this.quotes.length <= 1) return [0];
    return this._createQueue();
  }

  /**
   * @param {string} text
   */
  _renderText(text) {
    if (!this.textEl) return;

    const lines = text.includes('\n') ? text.split('\n') : [text];
    this.textEl.innerHTML = '';
    lines.forEach((/** @type {string} */ line) => {
      const span = document.createElement('span');
      span.textContent = line;
      span.className = 'typed-line';
      this.textEl.appendChild(span);
    });
  }

  _tick() {
    if (!this._current?.text || !this.timerManager)
      return this._handleQuoteTransition();

    const full = String(this._current.text);
    const author = String(this._current.author ?? '');

    this._txt = this._isDeleting
      ? full.substring(0, Math.max(0, this._txt.length - 1))
      : full.substring(0, this._txt.length + 1);

    this._renderText(this._txt);
    if (this.authorEl) this.authorEl.textContent = author;

    let delay = this._isDeleting ? this.deleteSpeed : this.typeSpeed;

    // Punctuation pauses (Satzzeichen-Pausen)
    if (!this._isDeleting && this._txt.length) {
      const pauseMap = {
        ',': 120,
        '.': 300,
        '…': 400,
        '!': 250,
        '?': 250,
        ';': 180,
        ':': 180,
        '—': 220,
        '–': 180,
      };
      delay += pauseMap[this._txt.slice(-1)] || 0;
    }

    if (!this._isDeleting && this._txt === full) {
      try {
        document.dispatchEvent(
          new CustomEvent(EVENTS.HERO_TYPING_END, {
            detail: { text: full, author },
          }),
        );
      } catch (err) {
        log.warn('TypeWriter: dispatch hero:typingEnd failed', err);
      }
      delay = this.wait ?? 2400;
      this._isDeleting = true;
    } else if (this._isDeleting && !this._txt) {
      const transitionDelay = this._handleQuoteTransition();
      if (transitionDelay === null) return;
      delay = transitionDelay;
    }

    if (this.timerManager) {
      this.timerManager.setTimeout(() => this._tick(), delay);
    }
  }

  /**
   * @returns {number | null}
   */
  _handleQuoteTransition() {
    this._isDeleting = false;
    // minimal: no container locking

    const next = this._nextQuote();
    if (!next) {
      this.destroy();
      return null;
    }

    if (this.onBeforeType) {
      const res = this.onBeforeType(next.text);
      if (typeof res === 'string') next.text = res;
    }
    return 600;
  }
}

// ===== Hero Init Helper =====
export async function initHeroSubtitle(options = {}) {
  try {
    const subtitleEl = /** @type {HTMLElement | null} */ (
      document.querySelector('.typewriter-title')
    );
    const typedText = getElementById('typedText');
    const typedAuthor = getElementById('typedAuthor');

    if (!subtitleEl || !typedText || !typedAuthor) return false;

    let quotes = null;
    try {
      const response = await fetch('/content/config/typewriter-quotes.json');
      quotes = await response.json();
    } catch {
      quotes = null;
    }

    if (!quotes?.length) return false;

    let cfg = {};
    if (options.heroDataModule?.typewriterConfig) {
      cfg = options.heroDataModule.typewriterConfig;
    } else if (options.ensureHeroDataModule) {
      try {
        cfg = (await options.ensureHeroDataModule())?.typewriterConfig || {};
      } catch (err) {
        log.warn('TypeWriter: ensureHeroDataModule failed', err);
      }
    }

    const measurer = makeLineMeasurer(subtitleEl);

    // Local helper to check and adjust bottom spacing to prevent footer overlap
    /**
     * @param {HTMLElement} el
     */
    const checkFooterOverlap = (el) => {
      try {
        el.style.removeProperty('bottom');
        const rect = el.getBoundingClientRect();
        // use the custom element itself instead of an ID
        const footer = /** @type {HTMLElement | null} */ (
          document.querySelector('site-footer')
        );
        if (!footer) return;
        const fRect = footer.getBoundingClientRect();
        const overlap = Math.max(0, rect.bottom - (fRect.top - 24));
        if (overlap > 0) {
          const base = document.body.classList.contains('footer-expanded')
            ? 'clamp(8px,1.5vw,16px)'
            : el.classList.contains('typewriter-title--fixed')
              ? 'clamp(16px,2.5vw,32px)'
              : 'clamp(12px,2vw,24px)';
          setCSSVars(el, { bottom: `calc(${base} + ${overlap}px)` });
        }
      } catch (err) {
        log.warn('TypeWriter: checkFooterOverlap failed', err);
      }
    };

    const start = () => {
      const tw = new TypeWriter({
        textEl: typedText,
        authorEl: typedAuthor,
        quotes,
        wait: 2400,
        typeSpeed: 85,
        deleteSpeed: 40,
        shuffle: true,
        loop: true,
        // minimal: don't use smart breaks here
        ...cfg,
        /**
         * @param {string} text
         * @returns {string}
         */
        onBeforeType: (text) => {
          subtitleEl.classList.add('is-locked');

          // Calculate lines and format text with newlines
          const linesArr = measurer.getLines(text);
          const formattedText = linesArr.join('\n');

          const lines = measurer.reserveFor(text);
          const cs = getComputedStyle(subtitleEl);
          const lh = parseFloat(cs.getPropertyValue('--lh-px')) || 0;
          const gap = parseFloat(cs.getPropertyValue('--gap-px')) || 0;

          setCSSVars(subtitleEl, {
            '--box-h': `${Math.max(0, lines * lh + (lines - 1) * gap)}px`,
          });
          // Use rAF to ensure layout is updated before measuring
          if (subtitleEl) {
            requestAnimationFrame(() => checkFooterOverlap(subtitleEl));
          }

          return formattedText;
        },
      });

      // Remove lock after typing ends (released for next measure)
      const onHeroTypingEnd = () => {
        try {
          subtitleEl.classList.remove('is-locked');
        } catch (err) {
          log.warn('TypeWriter: remove lock failed', err);
        }
      };
      document.addEventListener(EVENTS.HERO_TYPING_END, onHeroTypingEnd);

      // Robust polling to fix race conditions on initial load
      const pollOverlap = () => {
        if (subtitleEl) checkFooterOverlap(subtitleEl);
      };

      // Check immediately, then poll for a short duration
      pollOverlap();
      const pollInterval = setInterval(pollOverlap, 100);
      setTimeout(() => clearInterval(pollInterval), 2000);

      // Also check when footer explicitly reports loaded
      document.addEventListener('footer:loaded', pollOverlap, { once: true });
      // And on resize
      const onResize = () => {
        if (subtitleEl) requestAnimationFrame(pollOverlap);
      };
      window.addEventListener('resize', onResize, { passive: true });

      typeWriterInstance = tw;
      // Add teardown method for cleanup
      const instance = /** @type {any} */ (typeWriterInstance);
      instance.__teardown = () => {
        document.removeEventListener(EVENTS.HERO_TYPING_END, onHeroTypingEnd);
        window.removeEventListener('resize', onResize);
      };
    };

    await (document.fonts?.ready ?? Promise.resolve());
    start();
    return typeWriterInstance;
  } catch (e) {
    log.error('Init failed', e);
    return false;
  }
}
