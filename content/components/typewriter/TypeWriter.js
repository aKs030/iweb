// ===== TypeWriter (mit Reservierung VOR dem Tippen + Lock) =====

// ===== Shared Utilities Import =====
import {
  createLogger,
  getElementById,
  shuffle,
  TimerManager,
  splitTextIntoLines
} from '../../utils/shared-utilities.js';

const createShuffledIndices = (length) => shuffle([...Array(length).keys()]);
const log = createLogger('TypeWriter');

// ===== TypeWriter-Klasse =====

export class TypeWriter {
  constructor({
    textEl,
    authorEl,
    quotes,
    wait = 2400,
    typeSpeed = 85,
    deleteSpeed = 40,
    shuffle = true,
    loop = true,
    smartBreaks = true,
    avoidImmediateRepeat = true,
    containerEl = null, // .typewriter-title zum Locken
    onBeforeType = null // Hook: vor dem Tippen reservieren + locken
  }) {
    // ✅ Strikte Validierung
    if (!textEl || !authorEl) {
      log.error('TypeWriter: textEl and authorEl are required');
      return;
    }

    if (!Array.isArray(quotes) || quotes.length === 0) {
      log.error('TypeWriter: quotes must be a non-empty array');
      return;
    }

    // ✅ Validiere Quote-Format
    const invalidQuotes = quotes.filter((q) => !q.text || typeof q.text !== 'string');
    if (invalidQuotes.length > 0) {
      log.warn('TypeWriter: Some quotes have invalid format, filtering them out');
      this.quotes = quotes.filter((q) => q.text && typeof q.text === 'string');
      if (this.quotes.length === 0) {
        log.error('TypeWriter: No valid quotes remaining');
        return;
      }
    } else {
      this.quotes = quotes.slice();
    }
    this.textEl = textEl;
    this.authorEl = authorEl;
    this.wait = Math.max(0, +wait);
    this.typeSpeed = Math.max(10, +typeSpeed);
    this.deleteSpeed = Math.max(10, +deleteSpeed);
    this.shuffle = !!shuffle;
    this.loop = !!loop;
    this.smartBreaks = !!smartBreaks;
    this.avoidImmediateRepeat = !!avoidImmediateRepeat;
    this.containerEl = containerEl;
    this.onBeforeType = typeof onBeforeType === 'function' ? onBeforeType : null;

    // Timer Manager für sauberes Cleanup
    this.timerManager = new TimerManager();
    this._isDeleting = false;
    this._txt = '';
    // ✅ Sichere Queue-Initialisierung
    try {
      this._queue = this.shuffle
        ? createShuffledIndices(this.quotes.length)
        : [...Array(this.quotes.length).keys()];
      this._index = this._queue.shift();
      this._current = this.quotes[this._index];
    } catch (error) {
      log.error('TypeWriter: Queue initialization failed', error);
      return;
    }

    document.body.classList.add('has-typingjs'); // CSS-Fallback ausschalten

    if (this.onBeforeType) {
      try {
        this.onBeforeType(this._current.text);
      } catch (error) {
        log.warn('TypeWriter: onBeforeType callback failed', error);
      }
    }
    this._tick();
  }

  destroy() {
    this.timerManager.clearAll();
    document.body.classList.remove('has-typingjs');
  }

  _nextQuote() {
    if (this._queue.length === 0) {
      if (!this.loop) return null;

      this._queue = this._generateQueue(this._index);
    }

    this._index = this._queue.shift();
    this._current = this.quotes[this._index];
    return this._current;
  }

  _generateQueue(lastIndex) {
    if (this.quotes.length <= 1) {
      return [0];
    }

    if (this.avoidImmediateRepeat) {
      let newQueue;
      do {
        newQueue = this.shuffle
          ? createShuffledIndices(this.quotes.length)
          : [...Array(this.quotes.length).keys()];
      } while (newQueue[0] === lastIndex);
      return newQueue;
    }

    return this.shuffle
      ? createShuffledIndices(this.quotes.length)
      : [...Array(this.quotes.length).keys()];
  }

  _schedule(ms) {
    this.timerManager.setTimeout(() => this._tick(), ms);
  }

  _renderText(text) {
    if (!this.textEl) return;
    try {
      this.textEl.textContent = '';

      if (!this.smartBreaks) {
        this.textEl.textContent = text;
        return;
      }

      const frag = splitTextIntoLines(text);
      this.textEl.appendChild(frag);
    } catch (error) {
      log.warn('TypeWriter: Text rendering failed', error);
      // Fallback zu einfachem Text
      this.textEl.textContent = text;
    }
  }

  _tick() {
    // ✅ Guard gegen ungültige States
    if (!this._current || !this._current.text) {
      log.warn('TypeWriter: Invalid current quote, skipping');
      this._handleQuoteTransition();
      return;
    }

    const full = String(this._current.text || '');
    const author = String(this._current.author || '');

    this._txt = this._isDeleting
      ? full.substring(0, Math.max(0, this._txt.length - 1))
      : full.substring(0, Math.min(full.length, this._txt.length + 1));

    this._renderText(this._txt);

    // ✅ Sichere Author-Anzeige
    if (this.authorEl) {
      try {
        this.authorEl.textContent = author.trim() ? author : '';
      } catch (error) {
        log.warn('TypeWriter: Author update failed', error);
      }
    }

    let delay = this._isDeleting ? this.deleteSpeed : this.typeSpeed;
    delay = this._applyPunctuationPause(delay);

    if (!this._isDeleting && this._txt === full) {
      // Vollständiger Text getippt -> Event feuern (einmal pro Quote)
      // ✅ Event Dispatch mit Fehlerbehandlung
      try {
        const ev = new CustomEvent('hero:typingEnd', {
          detail: { text: full, author }
        });
        document.dispatchEvent(ev);
      } catch (e) {
        log.warn('Failed to dispatch hero:typingEnd event:', e);
      }
      delay = this.wait;
      this._isDeleting = true;
    } else if (this._isDeleting && this._txt === '') {
      delay = this._handleQuoteTransition();
      if (delay === null) return;
    }

    this._schedule(delay);
  }

  _applyPunctuationPause(delay) {
    if (!this._isDeleting && this._txt.length > 0) {
      const ch = this._txt[this._txt.length - 1];
      const punctPause = {
        ',': 120,
        '.': 300,
        '…': 400,
        '!': 250,
        '?': 250,
        ';': 180,
        ':': 180,
        '—': 220,
        '–': 180
      };
      if (punctPause[ch]) return delay + punctPause[ch];
    }
    return delay;
  }

  _handleQuoteTransition() {
    this._isDeleting = false;
    if (this.containerEl) this.containerEl.classList.remove('is-locked'); // Lock weg

    const next = this._nextQuote();
    if (!next) {
      this.destroy();
      return null;
    }

    if (this.onBeforeType) this.onBeforeType(next.text);
    return 600;
  }
}

// ===== Simplified Helper for Hero Section =====

/**
 * Initialisiert TypeWriter für Hero-Bereich
 * Handles dynamic import internally.
 */
export async function initHeroSubtitle(options = {}) {
  try {
    const subtitleEl = document.querySelector('.typewriter-title');
    const typedText = getElementById('typedText');
    const typedAuthor = getElementById('typedAuthor');

    if (!subtitleEl || !typedText || !typedAuthor) {
      return false;
    }

    // Dynamic import to keep main bundle small
    const [
        { makeLineMeasurer },
        { default: quotes }
    ] = await Promise.all([
        import('./TypeWriterZeilen.js'),
        import('./TypeWriterText.js')
    ]);

    if (!makeLineMeasurer || !quotes || !quotes.length) {
       log.warn('TypeWriter modules invalid');
       return false;
    }

    let twCfg = {};

    // Config loading
    if (options.heroDataModule) {
      twCfg = options.heroDataModule?.typewriterConfig || {};
    } else if (options.ensureHeroDataModule) {
      try {
        const mod = await options.ensureHeroDataModule();
        twCfg = mod?.typewriterConfig || {};
      } catch {
        /* ignore */
      }
    }

    const measurer = makeLineMeasurer(subtitleEl);
    
    const startTypewriter = () => {
      const _typeWriter = new TypeWriter({
        textEl: typedText,
        authorEl: typedAuthor,
        quotes,
        wait: 2400,
        typeSpeed: 85,
        deleteSpeed: 40,
        shuffle: true,
        loop: true,
        smartBreaks: true,
        ...twCfg,
        containerEl: subtitleEl,
        onBeforeType: (fullText) => {
          subtitleEl.classList.add('is-locked');
          const lines = measurer.reserveFor(fullText, true);
          const cs = getComputedStyle(subtitleEl);
          const lh = parseFloat(cs.getPropertyValue('--lh-px')) || 0;
          const gap = parseFloat(cs.getPropertyValue('--gap-px')) || 0;
          // Correct box height: lines * line-height + (lines - 1) * gap_between_lines
          const boxH = Math.max(0, lines * lh + Math.max(0, lines - 1) * gap);
          subtitleEl.style.setProperty('--box-h', `${boxH}px`);

          // Recomputed layout, prüfe ob ein Footer vorhanden ist und ob eine Überschneidung besteht
          try {
            const rect = subtitleEl.getBoundingClientRect();
            const footerEl = document.querySelector('#site-footer');
            const safeMargin = 8; // Mindestabstand in px
            if (footerEl) {
              const fRect = footerEl.getBoundingClientRect();
              const overlap = Math.max(0, rect.bottom - (fRect.top - safeMargin));
              const isFixed = subtitleEl.classList.contains('typewriter-title--fixed');
              const isExpanded = document.body.classList.contains('footer-expanded');
              let baseOffset;
              if (isExpanded) baseOffset = 'clamp(8px, 1.5vw, 16px)';
              else if (isFixed) baseOffset = 'clamp(16px, 2.5vw, 32px)';
              else baseOffset = 'clamp(12px, 2vw, 24px)';

              if (overlap > 0) {
                subtitleEl.style.setProperty('bottom', `calc(${baseOffset} + ${Math.round(overlap)}px)`);
              } else {
                subtitleEl.style.removeProperty('bottom');
              }
            }
          } catch (e) {
            /* ignore layout errors */
          }
        }
      });
      
      // Debug support
      if (window.location.search.includes('debug')) {
        window.__typeWriter = _typeWriter;
      }
    };

    const fontsReady = document.fonts?.ready;
    (fontsReady ?? Promise.resolve()).then(startTypewriter);
    return true;
  } catch (error) {
    log.error('TypeWriter initialization failed', error);
    return false;
  }
}
