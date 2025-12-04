// ===== TypeWriter (mit Reservierung VOR dem Tippen + Lock) =====

// ===== Shared Utilities Import =====
import { createLogger, getElementById, shuffle, TimerManager, splitTextIntoLines } from '../shared-utilities.js';

const createShuffledIndices = (length) => shuffle([...Array(length).keys()]);
const log = createLogger('TypeWriter');

// ===== TypeWriter-Klasse =====

class TypeWriter {
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

// ===== Globale TypeWriter Registry =====

// Globale Registry für TypeWriter-Module
const TypeWriterRegistry = (() => {
  let makeLineMeasurer = null;
  let quotes = [];
  let loadPromise = null;
  let isLoaded = false;

  /**
   * Lädt alle TypeWriter-Module asynchron
   * @returns {Promise<boolean>} True wenn erfolgreich geladen
   */
  async function loadModules() {
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        log.debug('Lade TypeWriter-Module...');

        // TypeWriter-Klasse ist bereits lokal verfügbar, keine weitere Aktionen nötig

        const modules = [
          [
            './TypeWriterZeilen.js',
            (m) => {
              makeLineMeasurer = m.makeLineMeasurer;
            }
          ],
          [
            './TypeWriterText.js',
            (m) => {
              quotes = m.default || m.quotes || [];
            }
          ]
        ];

        for (const [path, handler] of modules) {
          try {
            const module = await import(path);
            handler(module);
            log.debug(`Modul geladen: ${path}`);
          } catch (error) {
            log.error(`Fehler beim Laden von ${path}:`, error);
            return false;
          }
        }

        isLoaded = true;
        log.debug('Alle TypeWriter-Module erfolgreich geladen');

        // Event für andere Module
        document.dispatchEvent(
          new CustomEvent('typewriter:modules-loaded', {
            detail: { TypeWriter, makeLineMeasurer, quotes }
          })
        );

        return true;
      } catch (error) {
        log.error('Fehler beim Laden der TypeWriter-Module:', error);
        isLoaded = false;
        return false;
      }
    })();

    return loadPromise;
  }

  /**
   * Gibt die TypeWriter-Klasse zurück (lädt Module falls nötig)
   * @returns {Promise<Class|null>}
   */
  async function getTypeWriter() {
    if (!isLoaded) await loadModules();
    return TypeWriter;
  }

  /**
   * Gibt die makeLineMeasurer-Funktion zurück (lädt Module falls nötig)
   * @returns {Promise<Function|null>}
   */
  async function getLineMeasurer() {
    if (!isLoaded) await loadModules();
    return makeLineMeasurer;
  }

  /**
   * Gibt die Zitate-Array zurück (lädt Module falls nötig)
   * @returns {Promise<Array>}
   */
  async function getQuotes() {
    if (!isLoaded) await loadModules();
    return quotes || [];
  }

  /**
   * Gibt alle Module gleichzeitig zurück
   * @returns {Promise<{TypeWriter, makeLineMeasurer, quotes}>}
   */
  async function getAllModules() {
    if (!isLoaded) await loadModules();
    return { TypeWriter, makeLineMeasurer, quotes };
  }

  /**
   * Prüft ob die Module bereits geladen sind
   * @returns {boolean}
   */
  function isReady() {
    return isLoaded && TypeWriter && makeLineMeasurer && quotes.length > 0;
  }

  /**
   * Initialisiert TypeWriter für Hero-Bereich (Convenience-Funktion)
   * @param {Object} options - Optionen für die Initialisierung
   * @returns {Promise<boolean>}
   */
  async function initHeroSubtitle(options = {}) {
    try {
      const modules = await getAllModules();
      if (!modules.TypeWriter || !modules.makeLineMeasurer || !modules.quotes.length) {
        log.warn('TypeWriter-Module nicht vollständig geladen');
        return false;
      }

      // Verwende die lokale initHeroSubtitle Funktion
      return initHeroSubtitleImpl({
        // Akzeptiere heroDataModule direkt, falls übergeben (Entfernt Abhängigkeit von globalem Getter)
        heroDataModule: options.heroDataModule,
        ensureHeroDataModule: options.ensureHeroDataModule,
        makeLineMeasurer: modules.makeLineMeasurer,
        quotes: modules.quotes,
        TypeWriterClass: modules.TypeWriter,
        ...options
      });
    } catch (error) {
      log.error('Fehler bei TypeWriter-Title-Initialisierung:', error);
      return false;
    }
  }

  // Public API
  return {
    loadModules,
    getTypeWriter,
    getLineMeasurer,
    getQuotes,
    getAllModules,
    isReady,
    initHeroSubtitle
  };
})();

// Globale Verfügbarkeit
window.TypeWriterRegistry = TypeWriterRegistry;

// Initialisierungsfunktion (intern)
async function initHeroSubtitleImpl({
  heroDataModule,
  ensureHeroDataModule,
  makeLineMeasurer,
  quotes,
  TypeWriterClass
}) {
  try {
    const subtitleEl = document.querySelector('.typewriter-title');
    const typedText = getElementById('typedText');
    const typedAuthor = getElementById('typedAuthor');

    if (
      !subtitleEl ||
      !typedText ||
      !typedAuthor ||
      !TypeWriterClass ||
      !makeLineMeasurer ||
      !quotes?.length
    ) {
      return false;
    }

    let twCfg = {};
    
    // Config laden: Entweder direktes Modul (bevorzugt) oder via async getter
    if (heroDataModule) {
       twCfg = heroDataModule?.typewriterConfig || {};
    } else if (ensureHeroDataModule) {
      try {
        const mod = await ensureHeroDataModule();
        twCfg = mod?.typewriterConfig || {};
      } catch {
        /* ignore */
      }
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
          const cs = getComputedStyle(subtitleEl);
          const lh = parseFloat(cs.getPropertyValue('--lh-px')) || 0;
          const gap = parseFloat(cs.getPropertyValue('--gap-px')) || 0;
          const boxH = 1 * lh + lines * lh + gap;
          subtitleEl.style.setProperty('--box-h', `${boxH}px`);
        }
      });
      // Optional für Debugging, aber nicht für die Logik erforderlich
      if (window.location.search.includes('debug')) {
        window.__typeWriter = _typeWriter;
      }
    };

    const fontsReady = document.fonts?.ready;
    (fontsReady ?? Promise.resolve()).then(startTypewriter);
    return true;
  } catch {
    return false;
  }
}

// Exports
export { initHeroSubtitleImpl as initHeroSubtitle, TypeWriter, TypeWriterRegistry };
export default TypeWriterRegistry;