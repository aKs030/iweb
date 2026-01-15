// Small helper utilities to centralize IntersectionObserver usage
// Exports:
// - createObserver(callback, options): returns { observe(el), unobserve(el), disconnect(), raw }.
// - observeOnce(el, onIntersect, options): observes and disconnects after first intersect; returns a `disconnect` function.

/* eslint-disable-next-line import/no-unused-modules */
export function createObserver(callback, options = {}) {
  const observer = new IntersectionObserver(callback, options);
  return {
    observe: (el) => observer.observe(el),
    unobserve: (el) => observer.unobserve(el),
    disconnect: () => observer.disconnect(),
    raw: observer,
  };
}

/* eslint-disable-next-line import/no-unused-modules */
export function observeOnce(target, onIntersect, options = {}) {
  if (!target) return () => {};
  const obs = new IntersectionObserver((entries, o) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        try {
          onIntersect(entry);
        } finally {
          o.disconnect();
        }
        break;
      }
    }
  }, options);

  obs.observe(target);
  return () => obs.disconnect();
}

// Higher-level convenience helpers removed — unused in the codebase.
// If needed in future, reintroduce implementations similar to previous versions.
