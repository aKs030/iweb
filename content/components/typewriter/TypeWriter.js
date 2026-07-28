// @ts-check
/**
 * TypeWriter Component
 * Animated text typing effect with multi-line support
 * @version 2.0.0
 */
import { activeOverlay } from "../../core/state/overlay-state.js";
import { i18n } from "../../core/i18n.js";
import { createLogger } from "../../core/logger.js";
import { fetchJSON, getElementById, TimerManager } from "../../core/utils/index.js";

const log = createLogger("TypeWriter");

/**
 * Shuffle array using Fisher-Yates algorithm
 * @template T
 * @param {T[]} array - Array to shuffle
 * @returns {T[]} Shuffled array
 */
const shuffle = array => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
// Helper: EVENTS constant
const EVENTS = {
  HERO_TYPING_END: "hero:typingEnd",
};
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const prefersReducedMotion = () =>
  typeof globalThis !== "undefined" &&
  typeof globalThis.matchMedia === "function" &&
  globalThis.matchMedia(REDUCED_MOTION_QUERY).matches;

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
  const measurer = document.createElement("div");
  measurer.className = "typewriter-line-measurer";
  document.body.appendChild(measurer);

  const cs = getComputedStyle(subtitleEl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const letterSpacing = parseFloat(cs.letterSpacing) || 0;
  const wordSpacing = parseFloat(cs.wordSpacing) || 0;
  let cachedLineHeight = 0;
  let cachedMeasurement = null;

  if (context) {
    context.font = cs.font;
    if ("fontKerning" in context) context.fontKerning = cs.fontKerning;
  }

  const getLineHeight = () => {
    if (cachedLineHeight) return cachedLineHeight;
    const lh = cs.lineHeight.trim();
    if (lh.endsWith("px")) {
      const v = parseFloat(lh);
      if (!isNaN(v)) {
        cachedLineHeight = v;
        return cachedLineHeight;
      }
    }
    const num = parseFloat(lh);
    if (!isNaN(num)) {
      const fs = parseFloat(cs.fontSize);
      if (!isNaN(fs)) {
        cachedLineHeight = num * fs;
        return cachedLineHeight;
      }
    }
    const probe = document.createElement("span");
    probe.className = "typewriter-measure-probe";
    probe.textContent = "A";
    measurer.replaceChildren(probe);
    const firstChild = /** @type {HTMLElement|null} */ (measurer.firstChild);
    cachedLineHeight = firstChild?.getBoundingClientRect().height || 0;
    return cachedLineHeight;
  };

  const measureTextWidth = text => {
    if (!context) return 0;
    const spaces = text.split(" ").length - 1;
    return (
      context.measureText(text).width +
      Math.max(0, text.length - 1) * letterSpacing +
      spaces * wordSpacing
    );
  };

  /**
   * @param {string} text
   * @returns {string[]}
   */
  const getLines = text => {
    const rect = subtitleEl.getBoundingClientRect();
    const cap = Math.min(window.innerWidth * 0.92, 820);
    const measuredMaxWidth = parseFloat(cs.maxWidth);
    const fallbackAvailable = Math.max(0, window.innerWidth - (rect.left || 0) - 12);
    const availableWidth = Math.max(
      1,
      Math.min(
        Number.isFinite(measuredMaxWidth) && measuredMaxWidth > 0
          ? measuredMaxWidth
          : fallbackAvailable || cap,
        cap
      )
    );
    const cacheKey = `${text}\n${availableWidth}`;
    if (cachedMeasurement?.key === cacheKey) return cachedMeasurement.lines;

    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let currentLine = [];

    words.forEach((/** @type {string} */ word) => {
      const testLine = currentLine.length ? currentLine.join(" ") + " " + word : word;
      if (currentLine.length && context && measureTextWidth(testLine) > availableWidth) {
        if (currentLine.length) {
          lines.push(currentLine.join(" "));
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
      lines.push(currentLine.join(" "));
    }

    const measuredLines = lines.length ? lines : [text];
    cachedMeasurement = { key: cacheKey, lines: measuredLines };
    return measuredLines;
  };

  return {
    getLines,
    /**
     * @param {string} text
     * @returns {number}
     */
    reserveFor(text, measuredLines = null) {
      const lh = getLineHeight();
      const linesArr = measuredLines || getLines(text);
      const lines = linesArr.length;

      setCSSVars(subtitleEl, {
        "--lh-px": lh ? `${lh}px` : "0px",
        "--gap-px": lh ? `${lh * 0.25}px` : "0px",
      });

      return lines;
    },
    /** Remove the off-screen measurer element from the DOM */
    destroy() {
      measurer.remove();
      canvas.remove();
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
      log.error("TypeWriter: Missing required parameters");
      return /** @type {any} */ (undefined);
    }

    this.quotes = quotes.filter(q => q?.text);
    if (!this.quotes.length) {
      log.error("No valid quotes");
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
    this._txt = "";

    this._queue = this._createQueue();
    /** @type {number} */
    this._index = this._queue.shift() ?? 0;
    this._current = this.quotes[this._index];

    document.body.classList.add("has-typingjs");
    if (this.onBeforeType) {
      const res = this.onBeforeType(this._current.text);
      if (typeof res === "string") this._current.text = res;
    }

    if (prefersReducedMotion()) {
      const text = String(this._current.text);
      const author = String(this._current.author ?? "");
      this._txt = text;
      this._renderText(text);
      if (this.authorEl) this.authorEl.textContent = author;
      try {
        document.dispatchEvent(
          new CustomEvent(EVENTS.HERO_TYPING_END, {
            detail: { text, author },
          })
        );
      } catch (err) {
        log.warn("TypeWriter: dispatch hero:typingEnd failed", err);
      }
      return;
    }

    this._tick();
  }

  destroy() {
    if (!this.timerManager) return;
    this.timerManager.clearAll();
    document.body.classList.remove("has-typingjs");
    // Call teardown for external event listeners
    try {
      const instance = /** @type {any} */ (this);
      if (typeof instance.__teardown === "function") {
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

    const lines = text.includes("\n") ? text.split("\n") : [text];
    const existingSpans = this.textEl.children;

    for (let i = 0; i < lines.length; i++) {
      if (i < existingSpans.length) {
        if (existingSpans[i].textContent !== lines[i]) {
          existingSpans[i].textContent = lines[i];
        }
      } else {
        const span = document.createElement("span");
        span.className = "typed-line";
        span.textContent = lines[i];
        this.textEl.appendChild(span);
      }
    }

    while (existingSpans.length > lines.length) {
      if (this.textEl.lastChild) {
        this.textEl.removeChild(this.textEl.lastChild);
      } else {
        break; // Safety fallback
      }
    }
  }

  _tick() {
    if (!this._current?.text || !this.timerManager) return this._handleQuoteTransition();

    const full = String(this._current.text);
    const author = String(this._current.author ?? "");

    this._txt = this._isDeleting
      ? full.substring(0, Math.max(0, this._txt.length - 1))
      : full.substring(0, this._txt.length + 1);

    this._renderText(this._txt);
    if (this.authorEl) this.authorEl.textContent = author;

    let delay = this._isDeleting ? this.deleteSpeed : this.typeSpeed;

    // Punctuation pauses (Satzzeichen-Pausen)
    if (!this._isDeleting && this._txt.length) {
      const pauseMap = {
        ",": 120,
        ".": 300,
        "…": 400,
        "!": 250,
        "?": 250,
        ";": 180,
        ":": 180,
        "—": 220,
        "–": 180,
      };
      delay += pauseMap[this._txt.slice(-1)] || 0;
    }

    if (!this._isDeleting && this._txt === full) {
      try {
        document.dispatchEvent(
          new CustomEvent(EVENTS.HERO_TYPING_END, {
            detail: { text: full, author },
          })
        );
      } catch (err) {
        log.warn("TypeWriter: dispatch hero:typingEnd failed", err);
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
      if (typeof res === "string") next.text = res;
    }
    return 600;
  }
}

// ===== Hero Init Helper =====
export async function initHeroSubtitle(options = {}) {
  try {
    const subtitleEl = /** @type {HTMLElement | null} */ (
      document.querySelector(".typewriter-title")
    );
    const typedText = getElementById("typedText");
    const typedAuthor = getElementById("typedAuthor");

    if (!subtitleEl || !typedText || !typedAuthor) return false;

    let quotes = null;
    try {
      const quotesUrl =
        i18n.currentLang === "en"
          ? "/content/data/typewriter-quotes.en.json"
          : "/content/data/typewriter-quotes.json";
      quotes = await fetchJSON(quotesUrl, {
        retries: 1,
      });
    } catch {
      quotes = null;
    }

    if (!quotes || !quotes.length) return false;
    try {
      // B) Personalisierung der UI & Typewriter-Titel
      const { getProfileState } = await import("#components/robot-companion/index.js");
      const profile = getProfileState();
      if (profile && profile.name && profile.name.toLowerCase() !== "jules") {
        quotes.unshift({
          text: "Willkommen zurück! Schön, dass du wieder da bist.",
          author: "Jules (AI)",
        });
      }
    } catch (err) {
      log.warn("TypeWriter: Could not load profile state", err);
    }

    let cfg = {};
    if (options.heroDataModule?.typewriterConfig) {
      cfg = options.heroDataModule.typewriterConfig;
    } else if (options.ensureHeroDataModule) {
      try {
        cfg = (await options.ensureHeroDataModule())?.typewriterConfig || {};
      } catch (err) {
        log.warn("TypeWriter: ensureHeroDataModule failed", err);
      }
    }

    const measurer = makeLineMeasurer(subtitleEl);
    const initialBottom = parseFloat(getComputedStyle(subtitleEl).bottom);
    const fallbackBottom = subtitleEl.classList.contains("typewriter-title--fixed") ? 24 : 16;
    const baseBottom = Number.isFinite(initialBottom) ? initialBottom : fallbackBottom;
    let overlapFrame = 0;
    let footerResizeObserver = null;

    const getFooterElement = () => {
      const siteFooterHost = /** @type {HTMLElement | null} */ (
        document.querySelector("site-footer")
      );
      return /** @type {HTMLElement | null} */ (
        siteFooterHost?.shadowRoot?.querySelector(".site-footer") ||
          document.querySelector("site-footer .site-footer") ||
          document.querySelector("footer.site-footer") ||
          siteFooterHost
      );
    };

    // Local helper to keep subtitle anchored directly above the footer edge
    /**
     * @param {HTMLElement} el
     */
    const checkFooterOverlap = el => {
      try {
        const footerGap = 8;
        const footer = getFooterElement();
        if (!footer) {
          setCSSVars(el, { bottom: `${Math.round(baseBottom)}px` });
          return;
        }

        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const fRect = footer.getBoundingClientRect();
        const anchoredBottom = Math.max(baseBottom, viewportHeight - fRect.top + footerGap);

        setCSSVars(el, { bottom: `${Math.round(anchoredBottom)}px` });
      } catch (err) {
        log.warn("TypeWriter: checkFooterOverlap failed", err);
      }
    };

    const scheduleOverlapCheck = () => {
      if (overlapFrame) cancelAnimationFrame(overlapFrame);
      overlapFrame = requestAnimationFrame(() => {
        overlapFrame = 0;
        checkFooterOverlap(subtitleEl);
      });
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
        onBeforeType: text => {
          subtitleEl.classList.add("is-locked");

          // Calculate lines and format text with newlines
          const linesArr = measurer.getLines(text);
          const formattedText = linesArr.join("\n");

          const lines = measurer.reserveFor(text, linesArr);
          const cs = getComputedStyle(subtitleEl);
          const lh = parseFloat(cs.getPropertyValue("--lh-px")) || 0;
          const gap = parseFloat(cs.getPropertyValue("--gap-px")) || 0;

          setCSSVars(subtitleEl, {
            "--box-h": `${Math.max(0, lines * lh + (lines - 1) * gap)}px`,
          });
          // Use rAF to ensure layout is updated before measuring
          scheduleOverlapCheck();

          return formattedText;
        },
      });

      // Remove lock after typing ends (released for next measure)
      const onHeroTypingEnd = () => {
        try {
          subtitleEl.classList.remove("is-locked");
        } catch (err) {
          log.warn("TypeWriter: remove lock failed", err);
        }
      };
      document.addEventListener(EVENTS.HERO_TYPING_END, onHeroTypingEnd);

      scheduleOverlapCheck();
      const footer = getFooterElement();
      if (footer && typeof ResizeObserver === "function") {
        footerResizeObserver = new ResizeObserver(scheduleOverlapCheck);
        footerResizeObserver.observe(footer);
      }

      const unsubscribeOverlayState = activeOverlay.subscribe(() => {
        scheduleOverlapCheck();
      });
      // And on resize
      const onResize = scheduleOverlapCheck;
      window.addEventListener("resize", onResize, { passive: true });

      typeWriterInstance = tw;
      // Add teardown method for cleanup
      const instance = /** @type {any} */ (typeWriterInstance);
      instance.__teardown = () => {
        document.removeEventListener(EVENTS.HERO_TYPING_END, onHeroTypingEnd);
        unsubscribeOverlayState();
        window.removeEventListener("resize", onResize);
        footerResizeObserver?.disconnect();
        footerResizeObserver = null;
        if (overlapFrame) cancelAnimationFrame(overlapFrame);
        tw.timerManager?.clearAll?.();
        measurer.destroy();
      };
    };

    await (document.fonts?.ready ?? Promise.resolve());
    start();
    return typeWriterInstance;
  } catch (e) {
    log.error("Init failed", e);
    return false;
  }
}
