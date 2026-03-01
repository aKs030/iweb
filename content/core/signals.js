/**
 * Lightweight Reactive Signals — zero-dependency, fine-grained reactivity.
 *
 * Inspired by @preact/signals-core but kept minimal (~120 LOC).
 * Provides `signal`, `computed`, `effect` and `batch` primitives that
 * integrate seamlessly with the existing UIStore & Event-Bus.
 *
 * @module signals
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// Internal bookkeeping
// ---------------------------------------------------------------------------

/** @type {(() => void) | null} */
let _currentEffect = null;

/** @type {Set<Set<() => void>> | null} */
let _batchQueue = null;

// ---------------------------------------------------------------------------
// signal(initialValue)
// ---------------------------------------------------------------------------

/**
 * Create a reactive signal.
 *
 * A signal is a container for a single value. When the value changes, every
 * `effect` or `computed` that read the signal is automatically re-evaluated.
 *
 * @template T
 * @param {T} initialValue
 * @returns {{ readonly value: T, peek: () => T, subscribe: (fn: (v: T) => void) => () => void }}
 */
export function signal(initialValue) {
  let _value = initialValue;
  /** @type {Set<() => void>} */
  const _subscribers = new Set();

  const self = {
    /** Read (and track) the current value */
    get value() {
      // Auto-track when read inside an effect/computed
      if (_currentEffect) {
        _subscribers.add(_currentEffect);
      }
      return _value;
    },
    /** Write a new value — notifies subscribers if changed */
    set value(next) {
      if (Object.is(_value, next)) return;
      _value = next;
      _notify(_subscribers);
    },
    /** Read without tracking (useful inside effects that must not re-trigger) */
    peek() {
      return _value;
    },
    /**
     * Manual subscribe (useful outside of effects, e.g. in Web Components).
     * The listener receives the new value immediately and on every change.
     *
     * @param {(v: T) => void} fn
     * @returns {() => void} Unsubscribe function
     */
    subscribe(fn) {
      const wrapper = () => fn(_value);
      _subscribers.add(wrapper);
      // Emit current value immediately
      try {
        fn(_value);
      } catch {
        /* keep resilient */
      }
      return () => _subscribers.delete(wrapper);
    },
  };

  return self;
}

// ---------------------------------------------------------------------------
// computed(fn)
// ---------------------------------------------------------------------------

/**
 * Derive a read-only signal whose value is recomputed when its dependencies
 * change.
 *
 * @template T
 * @param {() => T} fn — Pure derivation function that reads other signals.
 * @returns {{ readonly value: T, peek: () => T, subscribe: (fn: (v: T) => void) => () => void }}
 */
export function computed(fn) {
  const s = signal(/** @type {T} */ (undefined));

  effect(() => {
    s.value = fn();
  });

  // Return a read-only view
  return {
    get value() {
      return s.value;
    },
    peek: () => s.peek(),
    subscribe: (listener) => s.subscribe(listener),
  };
}

// ---------------------------------------------------------------------------
// effect(fn)
// ---------------------------------------------------------------------------

/**
 * Run `fn` immediately and re-run it whenever any signal it reads changes.
 * Returns a dispose function that stops the effect.
 *
 * @param {() => void | (() => void)} fn — May return a cleanup function.
 * @returns {() => void} Dispose — stops the effect and runs cleanup.
 */
export function effect(fn) {
  /** @type {(() => void) | void} */
  let cleanup;
  let disposed = false;

  const execute = () => {
    if (disposed) return;
    // Run previous cleanup
    if (typeof cleanup === 'function') {
      try {
        cleanup();
      } catch {
        /* keep resilient */
      }
    }
    // Set this effect as the tracking context
    const prev = _currentEffect;
    _currentEffect = execute;
    try {
      cleanup = fn();
    } finally {
      _currentEffect = prev;
    }
  };

  execute();

  return () => {
    disposed = true;
    if (typeof cleanup === 'function') {
      try {
        cleanup();
      } catch {
        /* keep resilient */
      }
    }
  };
}

// ---------------------------------------------------------------------------
// batch(fn)
// ---------------------------------------------------------------------------

/**
 * Group multiple signal writes so that effects run only once at the end.
 *
 * @param {() => void} fn
 */
export function batch(fn) {
  if (_batchQueue) {
    // Already inside a batch — just run
    fn();
    return;
  }
  _batchQueue = new Set();
  try {
    fn();
  } finally {
    const queue = _batchQueue;
    _batchQueue = null;
    // Flush all collected notifications once
    for (const subscriberSet of queue) {
      for (const cb of subscriberSet) {
        try {
          cb();
        } catch {
          /* keep resilient */
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Notify all subscribers — or defer to current batch.
 * @param {Set<() => void>} subscribers
 */
function _notify(subscribers) {
  if (_batchQueue) {
    // Defer: collect for end-of-batch flush
    _batchQueue.add(subscribers);
    return;
  }
  for (const cb of [...subscribers]) {
    try {
      cb();
    } catch {
      /* keep store resilient against listener errors */
    }
  }
}
