import assert from "node:assert/strict";

console.log("Running three-earth helpers tests...");

(async () => {
  // Provide minimal window for modules that read devicePixelRatio at import-time
  globalThis.window = globalThis.window || { devicePixelRatio: 1, location: { search: '' }, addEventListener: () => {}, removeEventListener: () => {} };

  // Minimal document event support for Node tests
  if (!globalThis.document) {
    const __listeners = Object.create(null);
    globalThis.document = {
      addEventListener(name, cb) { (__listeners[name] ||= []).push(cb); },
      removeEventListener(name, cb) { if (!__listeners[name]) return; __listeners[name] = __listeners[name].filter((f) => f !== cb); },
      dispatchEvent(ev) { (__listeners[ev.type] || []).slice().forEach((cb) => cb(ev)); },
      getElementById() { return null; },
    };
  }

  const mod = await import("../content/components/particles/three-earth-system.js");
  const { _createLoadingManager, _mapId, __setIsSystemActive } = mod;

  // 1) _mapId translates footer-trigger-zone
  {
    const out = _mapId("footer-trigger-zone");
    assert.strictEqual(out, "site-footer");
  }

  // 2) _mapId returns other ids unchanged
  {
    const id = "features";
    assert.strictEqual(_mapId(id), id);
  }

  // 3) _createLoadingManager sets dataset and dispatches three-ready on onLoad
  {
    // Minimal mock for THREE.LoadingManager
    const THREE = {
      LoadingManager: class LoadingManager {
        constructor() {}
      },
    };

    const container = { dataset: {} };

    let received = null;
    const listener = (e) => { received = e; };
    document.addEventListener("three-ready", listener);

    const lm = _createLoadingManager(THREE, container);

    // simulate onLoad while system active
    __setIsSystemActive(true);
    lm.onLoad();

    assert.strictEqual(container.dataset.threeReady, "1", "dataset.threeReady should be set");
    assert.ok(received && received.type === "three-ready", "three-ready event dispatched");

    __setIsSystemActive(false);
    document.removeEventListener("three-ready", listener);
  }

  console.log("three-earth helpers tests passed");
})();
