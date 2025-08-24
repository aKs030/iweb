// ===== Gemeinsame Utility-Funktionen =====
// Zentrale Sammlung aller wiederverwendbaren Funktionen

// ===== Timing Utilities =====
export function debounce(func, wait = 200) {
  let timeout;
  function debounced(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  }
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
}

export function throttle(func, limit = 250) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ===== Array Utilities =====
export function shuffle(array) {
  const arr = [...array]; // Kopie erstellen
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(randomFloat(0, i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffleIndices(length) {
  return shuffle([...Array(length).keys()]);
}

// ===== DOM Utilities =====
const elementCache = new Map();

export function getElementById(id, useCache = true) {
  if (useCache && elementCache.has(id)) {
    const cached = elementCache.get(id);
    // Prüfen ob Element noch im DOM ist
    if (cached && document.contains(cached)) {
      return cached;
    }
    elementCache.delete(id);
  }
  
  const element = document.getElementById(id);
  if (useCache && element) {
    elementCache.set(id, element);
  }
  return element;
}

export function querySelector(selector, useCache = false) {
  if (useCache && elementCache.has(selector)) {
    const cached = elementCache.get(selector);
    if (cached && document.contains(cached)) {
      return cached;
    }
    elementCache.delete(selector);
  }
  
  const element = document.querySelector(selector);
  if (useCache && element) {
    elementCache.set(selector, element);
  }
  return element;
}

export function clearElementCache() {
  elementCache.clear();
}

// ===== Accessibility & UX Utilities =====
let reducedMotionCache = null;

export function prefersReducedMotion() {
  if (reducedMotionCache === null) {
    try {
      const saved = localStorage.getItem('pref-reduce-motion');
      reducedMotionCache = saved === '1' || 
        (saved === null && matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      reducedMotionCache = matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }
  return reducedMotionCache;
}

export function setReducedMotion(enabled) {
  reducedMotionCache = enabled;
  document.body.classList.toggle('reduce-motion', enabled);
  try {
    localStorage.setItem('pref-reduce-motion', enabled ? '1' : '0');
  } catch {}
}

export function toggleReducedMotion(force) {
  const newValue = force !== undefined ? !!force : !prefersReducedMotion();
  setReducedMotion(newValue);
  return newValue;
}

// ===== Animation Utilities =====
export function createAnimationObserver(callback, options = {}) {
  const defaultOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  return new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        callback(entry.target, entry);
      }
    });
  }, { ...defaultOptions, ...options });
}

// ===== Timer Utilities =====
export class TimerManager {
  constructor() {
    this.timers = new Set();
  }
  
  setTimeout(callback, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
    return timer;
  }
  
  clearTimeout(timer) {
    clearTimeout(timer);
    this.timers.delete(timer);
  }
  
  clearAll() {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

// ===== Math Utilities =====
export function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export function randomInt(min, max) {
  return Math.floor(randomFloat(min, max + 1)) + min;
}

export function randomFloat(min, max) {
  // Prefer secure randomness when available, fall back to Math.random
  return secureRandomFloat() * (max - min) + min;
}

// Prefer Web Crypto API where available. This isn't used for cryptographic secrets
// here, but improves unpredictability for any code that might need it.
export function secureRandomFloat() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      // divide by 2^32 to get [0,1)
      return (arr[0] >>> 0) / 4294967296;
    }
  } catch {
    // ignore and fall through to Math.random
  }
  return Math.random();
}

// ===== Cryptographic helpers (CSPRNG) =====
// Returns a Uint8Array filled with secure random bytes when possible.
export function secureRandomBytes(length) {
  const len = Math.max(0, Number(length) | 0);
  const out = new Uint8Array(len);
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(out);
      return out;
    }
  } catch {
    // fall back to insecure generation below
  }
  // Fallback: best-effort using Math.random (NOT cryptographically secure)
  for (let i = 0; i < len; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

// Convenience: returns a hex string of secure random bytes (2 chars per byte)
export function randomHex(bytes = 16) {
  const b = secureRandomBytes(bytes);
  let s = '';
  for (const byte of b) {
    s += (byte < 16 ? '0' : '') + byte.toString(16);
  }
  return s;
}

// ===== Scroll Utilities =====
export function smoothScrollTo(target, offset = 80) {
  const element = typeof target === 'string' ? querySelector(target) : target;
  if (!element) return;
  
  const top = element.getBoundingClientRect().top + window.pageYOffset - offset;
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
  
  window.scrollTo({ top, behavior });
}

export function getScrollPosition() {
  return {
    x: window.pageXOffset || document.documentElement.scrollLeft,
    y: window.pageYOffset || document.documentElement.scrollTop
  };
}

// ===== Export für Legacy-Kompatibilität =====
export default {
  debounce,
  throttle,
  shuffle,
  shuffleIndices,
  getElementById,
  querySelector,
  clearElementCache,
  prefersReducedMotion,
  setReducedMotion,
  toggleReducedMotion,
  createAnimationObserver,
  TimerManager,
  clamp,
  randomInt,
  randomFloat,
  smoothScrollTo,
  getScrollPosition
};
