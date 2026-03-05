/**
 * Lightweight Reactive Signals
 *
 * Zero-dependency, fine-grained reactivity for browser-first state management.
 * Provides `signal`, `computed`, `effect`, `batch`, `untracked`, and `subscribe`.
 *
 * @module signals
 * @version 1.2.0
 */

let _currentEffect = null;
let _batchDepth = 0;
const _batchedSubscribers = new Set();

/**
 * Create a reactive signal.
 * @template T
 * @param {T} initialValue
 * @returns {{
 *   value: T,
 *   peek: () => T,
 *   subscribe: (fn: (value: T) => void) => () => boolean
 * }}
 */
export function signal(initialValue) {
  let _value = initialValue;
  const _subscribers = new Set();

  return {
    get value() {
      _track(_subscribers);
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
      if (typeof fn !== 'function') return () => false;

      const wrapper = () => fn(_value);
      _subscribers.add(wrapper);
      _safeCall(wrapper);

      return () => _subscribers.delete(wrapper);
    },
  };
}

/**
 * Derive a read-only signal.
 * @template T
 * @param {() => T} fn
 * @returns {{
 *   readonly value: T,
 *   peek: () => T,
 *   subscribe: (listener: (value: T) => void) => () => boolean
 * }}
 */
export function computed(fn) {
  const derived = signal(undefined);

  effect(() => {
    derived.value = fn();
  });

  return {
    get value() {
      return derived.value;
    },
    peek: () => derived.peek(),
    subscribe: (listener) => derived.subscribe(listener),
  };
}

/**
 * Run `fn` immediately and re-run whenever any read signal changes.
 * Returns a dispose function.
 *
 * @param {() => void | (() => void)} fn
 * @returns {() => void}
 */
export function effect(fn) {
  const effectState = {
    cleanup: undefined,
    deps: new Set(),
    disposed: false,
    run: /** @type {(() => void)|null} */ (null),
  };

  const execute = () => {
    if (effectState.disposed) return;

    _cleanupDeps(effectState);
    _safeCall(effectState.cleanup);

    const previous = _currentEffect;
    _currentEffect = effectState;

    try {
      effectState.cleanup = fn();
    } finally {
      _currentEffect = previous;
    }
  };

  effectState.run = execute;
  execute();

  return () => {
    if (effectState.disposed) return;
    effectState.disposed = true;
    _cleanupDeps(effectState);
    _safeCall(effectState.cleanup);
    effectState.cleanup = undefined;
  };
}

/**
 * Group multiple signal writes so subscribers run once at the end.
 *
 * @param {() => void} fn
 */
export function batch(fn) {
  _batchDepth += 1;

  try {
    fn();
  } finally {
    _batchDepth -= 1;

    if (_batchDepth === 0 && _batchedSubscribers.size > 0) {
      const queue = [..._batchedSubscribers];
      _batchedSubscribers.clear();

      queue.forEach((subscriber) => _safeCall(subscriber));
    }
  }
}

/**
 * Read signals without tracking them as dependencies of the current effect.
 *
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function untracked(fn) {
  const previous = _currentEffect;
  _currentEffect = null;

  try {
    return fn();
  } finally {
    _currentEffect = previous;
  }
}

/**
 * High-level reactive subscription helper.
 *
 * Wraps `effect()` with common options (skip initial emission,
 * error isolation) that would otherwise be duplicated in every store.
 *
 * @template T
 * @param {() => T} selector   — runs inside `effect`, should read one or more signals
 * @param {(value: T) => void} listener — called with the selected value on changes
 * @param {{ emitImmediately?: boolean }} [options]
 * @returns {() => void} dispose function
 */
export function subscribe(selector, listener, options = {}) {
  if (typeof selector !== 'function' || typeof listener !== 'function') {
    return () => { };
  }

  const { emitImmediately = true } = options;
  let hasRun = false;

  return effect(() => {
    const value = selector();

    if (!emitImmediately && !hasRun) {
      hasRun = true;
      return;
    }

    hasRun = true;

    try {
      listener(value);
    } catch {
      /* keep subscribers isolated */
    }
  });
}

function _track(subscribers) {
  if (!_currentEffect?.run) return;

  subscribers.add(_currentEffect.run);
  _currentEffect.deps.add(subscribers);
}

function _notify(subscribers) {
  const queue = [...subscribers];

  if (_batchDepth > 0) {
    queue.forEach((subscriber) => _batchedSubscribers.add(subscriber));
    return;
  }

  queue.forEach((subscriber) => _safeCall(subscriber));
}

function _cleanupDeps(effectState) {
  effectState.deps.forEach((subscribers) => {
    subscribers.delete(effectState.run);
  });
  effectState.deps.clear();
}

function _safeCall(fn) {
  if (typeof fn !== 'function') return;

  try {
    fn();
  } catch {
    /* keep resilient */
  }
}
