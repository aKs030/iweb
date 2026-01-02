import { layoutBatcher, rectCache } from '../../utils/layout-optimizer.js';

const logger = () => {
  try {
    return console;
  } catch (e) {
    return { warn: () => {}, error: () => {}, info: () => {} };
  }
};

let _instance = null;

class TypeWriter {
  constructor({ textEl, authorEl, quotes = [], wait = 2400, typeSpeed = 85, deleteSpeed = 40, shuffle = true, loop = true, onBeforeType = null }) {
    if (!textEl || !authorEl || !quotes?.length) {
      logger().error('TypeWriter: Missing required parameters');
      return;
    }

    this.textEl = textEl;
    this.authorEl = authorEl;
    this.quotes = quotes.filter(q => q && q.text);
    this.wait = wait;
    this.typeSpeed = typeSpeed;
    this.deleteSpeed = deleteSpeed;
    this.shuffle = shuffle;
    this.loop = loop;
    this.onBeforeType = onBeforeType;
    this.timerIds = new Set();

    this._isDeleting = false;
    this._txt = '';

    // Ensure space is reserved before typing starts
    this.textEl.classList.add('has-typingjs');
    // If JS can compute a reserve height quickly, set it synchronously
    requestAnimationFrame(() => {
      try {
        this.reserveSpaceForFirstQuote();
      } catch (e) { logger().warn('reserveSpace failed', e); }
      this._start();
    });

    _instance = this;
  }

  reserveSpaceForFirstQuote() {
    const first = this.quotes[0]?.text || '';
    if (!first) return;

    // Use a hidden measurer but batch reads/writes
    const measurer = document.createElement('div');
    measurer.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:normal;pointer-events:none;';
    document.body.appendChild(measurer);
    const cs = getComputedStyle(this.textEl);
    ['font-size','line-height','font-family','font-weight','letter-spacing','word-spacing','font-kerning','text-rendering','word-break','overflow-wrap','hyphens'].forEach(p => {
      try { measurer.style.setProperty(p, cs.getPropertyValue(p)); } catch (e) {}
    });

    // Read widths in a batch
    layoutBatcher.read(() => {
      const rect = this.textEl.getBoundingClientRect();
      const available = Math.max(0, window.innerWidth - (rect.left || 0) - 12);
      const width = Math.min(available || Math.min(window.innerWidth * .92, 820), Math.min(window.innerWidth * .92, 820));
      measurer.style.width = width + 'px';
    });

    // Calculate height and set CSS var in RAF to avoid reflow
    requestAnimationFrame(() => {
      measurer.innerHTML = `<span>${first}</span>`;
      const lineHeightPx = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * (parseFloat(cs.lineHeight) || 1.2);
      const totalHeight = measurer.firstChild?.getBoundingClientRect().height || lineHeightPx * 2;
      const reserve = Math.max(1, Math.round(totalHeight / (lineHeightPx || 16)));
      // set CSS vars atomically
      this.textEl.style.setProperty('--box-h', `${Math.max(0, Math.round(totalHeight))}px`);
      this.textEl.style.setProperty('--lines', String(reserve));
      this.textEl.setAttribute('data-lines', String(reserve));
      measurer.remove();
    });
  }

  _start() {
    this._queue = this._createQueue();
    this._index = this._queue.shift();
    this._current = this.quotes[this._index];
    this._tick();
  }

  _createQueue() { return this.shuffle ? [...Array(this.quotes.length).keys()].sort(() => Math.random() - 0.5) : [...Array(this.quotes.length).keys()]; }

  _nextQuote() {
    if (!this._queue.length) {
      if (!this.loop) return null;
      this._queue = this._createQueue();
    }
    this._index = this._queue.shift();
    this._current = this.quotes[this._index];
    return this._index;
  }

  _renderText(t) {
    if (!this.textEl) return;
    const lines = t.includes('\n') ? t.split('\n') : [t];
    this.textEl.innerHTML = '';
    lines.forEach(line => {
      const span = document.createElement('span');
      span.className = 'typed-line';
      span.textContent = line;
      this.textEl.appendChild(span);
    });
  }

  _tick() {
    if (!this._current?.text) return this._handleQuoteTransition();
    const full = String(this._current.text);
    const author = String(this._current.author || '');
    this._txt = this._isDeleting ? full.substring(0, Math.max(0, this._txt.length - 1)) : full.substring(0, this._txt.length + 1);
    this._renderText(this._txt);
    if (this.authorEl) this.authorEl.textContent = author;

    let delay = this._isDeleting ? this.deleteSpeed : this.typeSpeed;
    if (!this._isDeleting && this._txt.length) {
      delay += { ',': 120, '.': 300, '…': 400, '!': 250, '?': 250 }[this._txt.slice(-1)] || 0;
    }

    if (!this._isDeleting && this._txt === full) {
      try { document.dispatchEvent(new CustomEvent('hero:typingEnd', { detail: { text: full, author } })); } catch (e) {}
      delay = this.wait; this._isDeleting = true;
    } else if (this._isDeleting && !this._txt) {
      const res = this._handleQuoteTransition(); if (res === null) return;
      delay = res;
    }

    const id = setTimeout(() => this._tick(), delay);
    this.timerIds.add(id);
  }

  _handleQuoteTransition() {
    this._isDeleting = false;
    const next = this._nextQuote();
    if (next === null) { this.destroy(); return null; }
    if (this.onBeforeType) {
      const changed = this.onBeforeType(this.quotes[next].text);
      if (typeof changed === 'string') this.quotes[next].text = changed;
    }
    return 600;
  }

  destroy() {
    for (const id of this.timerIds) clearTimeout(id);
    this.timerIds.clear();
    this.textEl?.classList?.remove('has-typingjs');
    if (_instance === this) _instance = null;
  }
}

async function initHeroSubtitle({ heroDataModule, ensureHeroDataModule } = {}) {
  const t = document.querySelector('.typewriter-title');
  const textEl = document.getElementById('typedText');
  const authorEl = document.getElementById('typedAuthor');
  if (!t || !textEl || !authorEl) return false;

  let quotes = [];
  try {
    const mod = await import('./TypeWriterText.js');
    quotes = mod.default || [];
  } catch (e) {
    logger().warn('TypeWriter: load quotes failed', e);
    return false;
  }

  const instance = new TypeWriter({ textEl, authorEl, quotes, onBeforeType: (text) => {
    // Reserve space synchronously for each quote before typing
    try { instance.reserveSpaceForFirstQuote(); } catch (e) { logger().warn(e); }
    return text;
  }});

  return (window.__typewriterInstance = instance);
}

function getTypeWriterInstance() { return _instance; }

function stopHeroSubtitle() { try { getTypeWriterInstance()?.destroy(); } catch (e) {} }

export { TypeWriter as TypeWriter, getTypeWriterInstance as getTypeWriterInstance, initHeroSubtitle as initHeroSubtitle, stopHeroSubtitle as stopHeroSubtitle };