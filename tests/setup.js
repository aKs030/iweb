// matchMedia Mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (q) => ({
    matches: false, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    dispatchEvent: () => false
  })
});

// requestAnimationFrame Fallback
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 16);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
