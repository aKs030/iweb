import assert from "node:assert/strict";
import { scheduleSchemaInjection } from "../content/components/head/head-complete.js";

console.log("Running scheduleSchemaInjection tests...");

// 1) requestIdleCallback present and runs callback
{
  let called = false;
  globalThis.requestIdleCallback = (cb, opts) => {
    // simulate idle callback invocation
    cb({});
    return 42;
  };

  const id = scheduleSchemaInjection(() => (called = true), 1500, 1200);
  assert.strictEqual(id, 42);
  assert.strictEqual(called, true);

  delete globalThis.requestIdleCallback;
}

// 2) requestIdleCallback throws -> fallback to setTimeout
{
  globalThis.requestIdleCallback = () => {
    throw new Error("boom");
  };
  let called = false;
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (cb, delay) => {
    cb();
    return 99;
  };

  const id = scheduleSchemaInjection(() => (called = true), 1500, 777);
  assert.strictEqual(id, 99);
  assert.strictEqual(called, true);

  globalThis.setTimeout = originalSetTimeout;
  delete globalThis.requestIdleCallback;
}

// 3) requestIdleCallback absent -> setTimeout used
{
  let called = false;
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (cb, delay) => {
    assert.strictEqual(delay, 1200);
    cb();
    return 7;
  };

  const id = scheduleSchemaInjection(() => (called = true), 1500, 1200);
  assert.strictEqual(id, 7);
  assert.strictEqual(called, true);

  globalThis.setTimeout = originalSetTimeout;
}

console.log("scheduleSchemaInjection tests passed");
