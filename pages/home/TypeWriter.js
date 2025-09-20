// ===== TypeWriter (mit Reservierung VOR dem Tippen + Lock) =====
// Verwende zentrale shuffle-Implementierung (nutzt sichere Zufallsquelle wenn verfügbar)
import { shuffle, getElementById } from '../../content/webentwicklung/utils/common-utils.js';
const createShuffledIndices = (length) => shuffle([...Array(length).keys()]);

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
    delay = this._applyPunctuationPause(delay);

    if (!this._isDeleting && this._txt === full) {
      // Vollständiger Text getippt -> Event feuern (einmal pro Quote)
      try {
        const ev = new CustomEvent('hero:typingEnd', { detail: { text: full, author } });
        document.dispatchEvent(ev);
      } catch {
        // Event dispatch failed, continue silently
      }
      delay = this.wait;
      this._isDeleting = true;
    } else if (this._isDeleting && this._txt === '') {
      delay = this._handleQuoteTransition();
      if (delay === null) return;
    }

    this._clearTimer();
    this._schedule(delay);
  }

  _applyPunctuationPause(delay) {
    if (!this._isDeleting && this._txt.length > 0) {
      const ch = this._txt[this._txt.length - 1];
      const punctPause = { ',': 120, '.': 300, '…': 400, '!': 250, '?': 250, ';': 180, ':': 180, '—': 220, '–': 180 };
      if (punctPause[ch]) return delay + punctPause[ch];
    }
    return delay;
  }

  _handleQuoteTransition() {
    this._isDeleting = false;
    if (this.containerEl) this.containerEl.classList.remove('is-locked'); // Lock weg

    const next = this._nextQuote();
    if (!next) { this.destroy(); return null; }

    if (this.onBeforeType) this.onBeforeType(next.text);
    return 600;
  }
}

// Ehemalige exportierte typewriterConfig entfernt (Konfiguration stammt zentral aus hero-data.js)

// Initialisierungsfunktion
export async function initHeroSubtitle({ ensureHeroDataModule, makeLineMeasurer, quotes, TypeWriterClass }) {
  try {
    const subtitleEl  = document.querySelector('.hero-subtitle');
    const typedText   = getElementById('typedText');
    const typedAuthor = getElementById('typedAuthor');
    
    if (!subtitleEl || !typedText || !typedAuthor || !TypeWriterClass || !makeLineMeasurer || !quotes?.length) {
      return false;
    }
    
    let twCfg = {};
    try { 
      const mod = await ensureHeroDataModule(); 
      twCfg = mod?.typewriterConfig || {}; 
    } catch {
      /* Fallback */ 
    }
    
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
  } catch { 
    return false; 
  }
}