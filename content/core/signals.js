/**
 * Lightweight Reactive Signals — TypeScript source
 *
 * Zero-dependency, fine-grained reactivity for the app's state management.
 * Provides `signal`, `computed`, `effect` and `batch` primitives.
 *
 * @module signals
 * @version 1.0.0
 */
// ---------------------------------------------------------------------------
// Internal bookkeeping
// ---------------------------------------------------------------------------
let _currentEffect = null;
let _batchQueue = null;
// ---------------------------------------------------------------------------
// signal(initialValue)
// ---------------------------------------------------------------------------
/**
 * Create a reactive signal.
 */
export function signal(initialValue) {
  let _value = initialValue;
  const _subscribers = new Set();
  const self = {
    get value() {
      if (_currentEffect) {
        _subscribers.add(_currentEffect);
      }
      return _value;
    },
    set value(next) {
      if (Object.is(_value, next)) return;
      _value = next;
      _notify(_subscribers);
    },
    peek() {
      return _value;
    },
    subscribe(fn) {
      const wrapper = () => fn(_value);
      _subscribers.add(wrapper);
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
 * Derive a read-only signal.
 */
export function computed(fn) {
  const s = signal(undefined);
  effect(() => {
    s.value = fn();
  });
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
 * Run `fn` immediately and re-run whenever any read signal changes.
 * Returns a dispose function.
 */
export function effect(fn) {
  let cleanup;
  let disposed = false;
  const execute = () => {
    if (disposed) return;
    if (typeof cleanup === 'function') {
      try {
        cleanup();
      } catch {
        /* keep resilient */
      }
    }
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
 * Group multiple signal writes so effects run only once at the end.
 */
export function batch(fn) {
  if (_batchQueue) {
    fn();
    return;
  }
  _batchQueue = new Set();
  try {
    fn();
  } finally {
    const queue = _batchQueue;
    _batchQueue = null;
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
// Internal
// ---------------------------------------------------------------------------
function _notify(subscribers) {
  if (_batchQueue) {
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
