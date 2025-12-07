// ===== TypeWriter (Final Optimiert) =====
import {
  createLogger,
  getElementById,
  shuffle,
  TimerManager,
  splitTextIntoLines
} from '../../utils/shared-utilities.js';

const log = createLogger('TypeWriter');

// Helper: CSS Variables setzen
const setCSSVars = (el, vars) =>
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));

export class TypeWriter {
  constructor({
    textEl,
    authorEl,
    quotes,
    wait = 2400,
    typeSpeed = 85,
    deleteSpeed = 40,
    shuffle: doShuffle = true,
    loop = true,
    smartBreaks = true,
    avoidImmediateRepeat = true,
    containerEl = null,
    onBeforeType = null
  }) {
    if (!textEl || !authorEl || !quotes?.length) {
      log.error('TypeWriter: Missing required parameters');
      return;
    }

    this.quotes = quotes.filter((q) => q?.text);
    if (!this.quotes.length) return log.error('No valid quotes');

    Object.assign(this, {
      textEl,
      authorEl,
      wait,
      typeSpeed,
      deleteSpeed,
      shuffle: doShuffle,
      loop,
      smartBreaks,
      avoidImmediateRepeat,
      containerEl,
      onBeforeType,
      timerManager: new TimerManager(),
      _isDeleting: false,
      _txt: ''
    });

    this._queue = this._createQueue();
    this._index = this._queue.shift();
    this._current = this.quotes[this._index];

    document.body.classList.add('has-typingjs');
    this.onBeforeType?.(this._current.text);
    this._tick();
  }

  destroy() {
    this.timerManager.clearAll();
    document.body.classList.remove('has-typingjs');
  }

  _createQueue() {
    return this.shuffle
      ? shuffle([...Array(this.quotes.length).keys()])
      : [...Array(this.quotes.length).keys()];
  }

  _nextQuote() {
    if (!this._queue.length) {
      if (!this.loop) return null;
      this._queue = this._generateQueue(this._index);
    }
    this._index = this._queue.shift();
    return (this._current = this.quotes[this._index]);
  }

  _generateQueue(lastIndex) {
    if (this.quotes.length <= 1) return [0];
    if (!this.avoidImmediateRepeat) return this._createQueue();

    let queue;
    do {
      queue = this._createQueue();
    } while (queue[0] === lastIndex);
    return queue;
  }

  _renderText(text) {
    if (!this.textEl) return;
    try {
      this.textEl.textContent = '';
      if (this.smartBreaks) {
        this.textEl.appendChild(splitTextIntoLines(text));
      } else {
        this.textEl.textContent = text;
      }
    } catch (e) {
      this.textEl.textContent = text;
    }
  }

  _tick() {
    if (!this._current?.text) return this._handleQuoteTransition();

    const full = String(this._current.text);
    const author = String(this._current.author || '');

    this._txt = this._isDeleting
      ? full.substring(0, Math.max(0, this._txt.length - 1))
      : full.substring(0, this._txt.length + 1);

    this._renderText(this._txt);
    if (this.authorEl) this.authorEl.textContent = author;

    let delay = this._isDeleting ? this.deleteSpeed : this.typeSpeed;

    // Satzzeichen-Pausen
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
        '–': 180
      };
      delay += pauseMap[this._txt.slice(-1)] || 0;
    }

    if (!this._isDeleting && this._txt === full) {
      try {
        document.dispatchEvent(
          new CustomEvent('hero:typingEnd', { detail: { text: full, author } })
        );
      } catch (e) {}
      delay = this.wait;
      this._isDeleting = true;
    } else if (this._isDeleting && !this._txt) {
      delay = this._handleQuoteTransition();
      if (delay === null) return;
    }

    this.timerManager.setTimeout(() => this._tick(), delay);
  }

  _handleQuoteTransition() {
    this._isDeleting = false;
    this.containerEl?.classList.remove('is-locked');

    const next = this._nextQuote();
    if (!next) {
      this.destroy();
      return null;
    }

    this.onBeforeType?.(next.text);
    return 600;
  }
}

// ===== Hero Init Helper =====
export async function initHeroSubtitle(options = {}) {
  try {
    const subtitleEl = document.querySelector('.typewriter-title');
    const typedText = getElementById('typedText');
    const typedAuthor = getElementById('typedAuthor');

    if (!subtitleEl || !typedText || !typedAuthor) return false;

    const [{ makeLineMeasurer }, { default: quotes }] = await Promise.all([
      import('./TypeWriterZeilen.js'),
      import('./TypeWriterText.js')
    ]);

    if (!makeLineMeasurer || !quotes?.length) return false;

    let cfg = {};
    if (options.heroDataModule?.typewriterConfig) {
      cfg = options.heroDataModule.typewriterConfig;
    } else if (options.ensureHeroDataModule) {
      try {
        cfg = (await options.ensureHeroDataModule())?.typewriterConfig || {};
      } catch {}
    }

    const measurer = makeLineMeasurer(subtitleEl);

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
        smartBreaks: true,
        ...cfg,
        containerEl: subtitleEl,
        onBeforeType: (text) => {
          subtitleEl.classList.add('is-locked');
          const lines = measurer.reserveFor(text, true);
          const cs = getComputedStyle(subtitleEl);
          const lh = parseFloat(cs.getPropertyValue('--lh-px')) || 0;
          const gap = parseFloat(cs.getPropertyValue('--gap-px')) || 0;

          setCSSVars(subtitleEl, {
            '--box-h': `${Math.max(0, lines * lh + (lines - 1) * gap)}px`
          });

          // Footer overlap check
          try {
            // Reset bottom first to measure natural position
            subtitleEl.style.removeProperty('bottom');

            const rect = subtitleEl.getBoundingClientRect();
            const footer = document.querySelector('#site-footer');
            if (!footer) return;

            const fRect = footer.getBoundingClientRect();
            // Ensure at least 24px distance to footer
            const overlap = Math.max(0, rect.bottom - (fRect.top - 24));
            
            if (overlap > 0) {
              const base = document.body.classList.contains('footer-expanded')
                ? 'clamp(8px,1.5vw,16px)'
                : subtitleEl.classList.contains('typewriter-title--fixed')
                  ? 'clamp(16px,2.5vw,32px)'
                  : 'clamp(12px,2vw,24px)';
              setCSSVars(subtitleEl, { bottom: `calc(${base} + ${overlap}px)` });
            }
          } catch {}
        }
      });

      if (window.location.search.includes('debug')) window.__typeWriter = tw;
    };

    (document.fonts?.ready ?? Promise.resolve()).then(start);
    return true;
  } catch (e) {
    log.error('Init failed', e);
    return false;
  }
}
