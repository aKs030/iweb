// ===== TypeWriter (mit Reservierung VOR dem Tippen + Lock) =====
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
    this._queue = this.shuffle ? this._shuffledIndices(this.quotes.length) : [...Array(this.quotes.length).keys()];
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

  _shuffledIndices(n) {
    const arr = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  _nextQuote() {
    if (this._queue.length === 0) {
      if (!this.loop) return null;

      // Optional: direkten Wiederholer über Zyklus-Grenzen verhindern
      const last = this._index;
      if (this.quotes.length <= 1) {
        this._queue = [0];
      } else if (this.avoidImmediateRepeat) {
        // So lange neu mischen, bis das erste Element nicht dem letzten entspricht
        do {
          this._queue = this.shuffle
            ? this._shuffledIndices(this.quotes.length)
            : [...Array(this.quotes.length).keys()];
        } while (this._queue[0] === last);
      } else {
        this._queue = this.shuffle
          ? this._shuffledIndices(this.quotes.length)
          : [...Array(this.quotes.length).keys()];
      }
    }

    this._index = this._queue.shift();
    this._current = this.quotes[this._index];
    return this._current;
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
    const parts = String(text).split(/(, )/);
    for (const part of parts) {
      if (part === ', ') {
        this.textEl.appendChild(document.createTextNode(','));
        this.textEl.appendChild(document.createElement('br'));
      } else {
        this.textEl.appendChild(document.createTextNode(part));
      }
    }
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
      const punctPause = { ',': 120, '.': 300, '…': 400, '!': 250, '?': 250, ';': 180, ':': 180 };
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