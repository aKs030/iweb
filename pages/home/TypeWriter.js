// ===== TypeWriter (mit Reservierung VOR dem Tippen + Lock) =====
// Fallback-Implementierung für Kompatibilität
const createShuffledIndices = (length) => {
  const arr = [...Array(length).keys()];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export default class TypeWriter {
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
    containerEl = null,          // .hero-subtitle zum Locken
    onBeforeType = null          // Hook: vor dem Tippen reservieren + locken
  }) {
    if (!textEl || !authorEl || !Array.isArray(quotes) || quotes.length === 0) return;
    this.textEl = textEl;
    this.authorEl = authorEl;
    this.quotes = quotes.slice();
    this.wait = +wait;
    this.typeSpeed = +typeSpeed;
    this.deleteSpeed = +deleteSpeed;
    this.shuffle = !!shuffle;
    this.loop = !!loop;
    this.smartBreaks = !!smartBreaks;
    this.avoidImmediateRepeat = !!avoidImmediateRepeat;
    this.containerEl = containerEl;
    this.onBeforeType = typeof onBeforeType === 'function' ? onBeforeType : null;

    this._timer = null;
    this._isDeleting = false;
    this._txt = '';
    this._queue = this.shuffle ? createShuffledIndices(this.quotes.length) : [...Array(this.quotes.length).keys()];
    this._index = this._queue.shift();
    this._current = this.quotes[this._index];

    document.body.classList.add('has-typingjs'); // CSS-Fallback ausschalten

    if (this.onBeforeType) this.onBeforeType(this._current.text); // vor erstem Tippen
    this._tick();
  }

  destroy() {
    this._clearTimer();
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

  _schedule(ms) { this._timer = setTimeout(() => this._tick(), ms); }
  _clearTimer() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } }

  _renderText(text) {
    // smartBreaks: ", " → Komma behalten + <br>
    this.textEl.textContent = '';
    if (!this.smartBreaks) {
      this.textEl.textContent = text;
      return;
    }
    const frag = document.createDocumentFragment();
    const parts = String(text).split(/(, )/);
    for (const part of parts) {
      if (part === ', ') {
        frag.appendChild(document.createTextNode(','));
        frag.appendChild(document.createElement('br'));
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    }
    this.textEl.appendChild(frag);
  }

  _tick() {
    const full = String(this._current.text || '');
    const author = String(this._current.author || '');

    this._txt = this._isDeleting
      ? full.substring(0, Math.max(0, this._txt.length - 1))
      : full.substring(0, Math.min(full.length, this._txt.length + 1));

    this._renderText(this._txt);
    this.authorEl.textContent = author.trim() ? author : '';

    let delay = this._isDeleting ? this.deleteSpeed : this.typeSpeed;
    if (!this._isDeleting && this._txt.length > 0) {
      const ch = this._txt[this._txt.length - 1];
      const punctPause = { ',': 120, '.': 300, '…': 400, '!': 250, '?': 250, ';': 180, ':': 180, '—': 220, '–': 180 };
      if (punctPause[ch]) delay += punctPause[ch];
    }

    if (!this._isDeleting && this._txt === full) {
      delay = this.wait;
      this._isDeleting = true;
    } else if (this._isDeleting && this._txt === '') {
      this._isDeleting = false;
      if (this.containerEl) this.containerEl.classList.remove('is-locked'); // Lock weg

      const next = this._nextQuote();
      if (!next) { this.destroy(); return; }

      if (this.onBeforeType) this.onBeforeType(next.text);
      delay = 600;
    }

    this._clearTimer();
    this._schedule(delay);
  }
}

// TypeWriter Optionen 
export const typewriterConfig = {
  wait: 2400,
  typeSpeed: 85,
  deleteSpeed: 40,
  shuffle: true,
  loop: true,
  smartBreaks: true
};

// Neue Initialisierungsfunktion (aus main.js extrahiert)
import { createLogger } from '../../content/webentwicklung/utils/logger.js';
const logTW = createLogger('typewriter');

export async function initHeroSubtitle({ ensureHeroDataModule, makeLineMeasurer, quotes, TypeWriterClass }) {
  try {
    const subtitleEl  = document.querySelector('.hero-subtitle');
    const typedText   = document.getElementById('typedText');
    const typedAuthor = document.getElementById('typedAuthor');
    if (!subtitleEl || !typedText || !typedAuthor || !TypeWriterClass || !makeLineMeasurer || !quotes?.length) return false;
    let twCfg = {};
  try { const mod = await ensureHeroDataModule(); twCfg = mod?.typewriterConfig || {}; }
  catch(e){ logTW.warn('typewriterConfig load failed', e); }
    const measurer = makeLineMeasurer(subtitleEl);
    const startTypewriter = () => {
      const _typeWriter = new TypeWriterClass({
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
          // Lock EIN, damit die Boxhöhe nicht springt
          subtitleEl.classList.add('is-locked');

          const lines = measurer.reserveFor(fullText, true);
          const cs  = getComputedStyle(subtitleEl);
          const lh  = parseFloat(cs.getPropertyValue('--lh-px')) || 0;
          const gap = parseFloat(cs.getPropertyValue('--gap-px')) || 0;
          const boxH = (1 * lh) + (lines * lh) + gap;
          subtitleEl.style.setProperty('--box-h', `${boxH}px`);
        }
      });
      window.__typeWriter = _typeWriter;
    };
    const fontsReady = document.fonts?.ready;
    (fontsReady ?? Promise.resolve()).then(startTypewriter);
    return true;
  } catch(err){ logTW.warn('initHeroSubtitle error', err); return false; }
}