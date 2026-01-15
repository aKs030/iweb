// Small helper utilities to centralize IntersectionObserver usage
// Exports:
// - createObserver(callback, options): returns { observe(el), unobserve(el), disconnect(), raw }.
// - observeOnce(el, onIntersect, options): observes and disconnects after first intersect; returns a `disconnect` function.

export function createObserver(callback, options = {}) {
  const observer = new IntersectionObserver(callback, options);
  return {
    observe: (el) => observer.observe(el),
    unobserve: (el) => observer.unobserve(el),
    disconnect: () => observer.disconnect(),
    raw: observer,
  };
}

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

// Higher-level convenience helpers
export function createVisibilityWatcher(
  target,
  { onEnter, onExit, threshold = 0.01, rootMargin = '0px' } = {},
) {
  if (!target) return { disconnect: () => {} };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > threshold) {
          if (typeof onEnter === 'function') onEnter(entry);
        } else {
          if (typeof onExit === 'function') onExit(entry);
        }
      }
    },
    { threshold: [threshold], rootMargin },
  );
  observer.observe(target);
  return {
    observe: (el) => observer.observe(el),
    unobserve: (el) => observer.unobserve(el),
    disconnect: () => observer.disconnect(),
    raw: observer,
  };
}

export function createViewportPauser(
  container,
  { onPause, onResume, threshold = 0, rootMargin = '50px' } = {},
) {
  if (!container) return { disconnect: () => {} };
  let isPaused = null;
  const check = (entry) => {
    const visible = entry.isIntersecting && entry.intersectionRatio > threshold;
    if (isPaused === null) {
      isPaused = !visible;
      if (isPaused && typeof onPause === 'function') onPause();
      if (!isPaused && typeof onResume === 'function') onResume();
      return;
    }
    if (!visible && !isPaused) {
      isPaused = true;
      if (typeof onPause === 'function') onPause();
    } else if (visible && isPaused) {
      isPaused = false;
      if (typeof onResume === 'function') onResume();
    }
  };

  const observer = new IntersectionObserver(
    (entries) => entries.forEach(check),
    { threshold: [threshold], rootMargin },
  );
  observer.observe(container);
  return { disconnect: () => observer.disconnect(), raw: observer };
}
