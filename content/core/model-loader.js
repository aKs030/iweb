// @ts-check
/**
 * Compressed 3D Model Loader
 *
 * Supports Draco- and Meshopt-compressed glTF/GLB models via Three.js addons.
 * Designed for a No-Build CDN architecture — all dependencies are loaded from
 * the import map (`three/addons/…`).
 *
 * ### Why compression matters
 * Draco reduces mesh geometry size by ~70-95 %.
 * Meshopt achieves ~60-80 % reduction with faster decompression.
 * In a no-build pipeline without automatic asset processing, pre-compressing
 * models offline and decompressing in the browser is the most effective
 * strategy for keeping load times low.
 *
 * ### Usage
 * ```js
 * import { loadCompressedModel } from '/content/core/model-loader.js';
 *
 * const gltf = await loadCompressedModel('/content/assets/models/robot.glb');
 * scene.add(gltf.scene);
 * ```
 *
 * @version 1.0.0
 * @module model-loader
 */

import { createLogger } from './logger.js';
import { THREE_VERSION } from '../config/constants.js';

const log = createLogger('ModelLoader');

// ───────────────────────────────────────────
// CDN paths for decoder WASM/JS files
// ───────────────────────────────────────────

const THREE_CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;

/**
 * Path to the Draco decoder directory on CDN.
 * Three.js ships Draco WASM decoders under `examples/jsm/libs/draco/`.
 */
const DRACO_DECODER_PATH = `${THREE_CDN}/examples/jsm/libs/draco/`;

// ───────────────────────────────────────────
// Singleton loader instances
// ───────────────────────────────────────────

/** @type {import('three/addons/loaders/GLTFLoader.js').GLTFLoader|null} */
let _gltfLoader = null;

/** @type {import('three/addons/loaders/DRACOLoader.js').DRACOLoader|null} */
let _dracoLoader = null;

/** @type {boolean} */
let _meshoptReady = false;

/**
 * Lazily imports and configures the GLTFLoader with Draco & Meshopt support.
 *
 * Loader instances are created once and reused for all subsequent calls.
 * Draco uses the WASM decoder for best performance across browsers.
 *
 * @param {import('three').LoadingManager} [loadingManager] - Optional THREE.LoadingManager
 * @returns {Promise<import('three/addons/loaders/GLTFLoader.js').GLTFLoader>} Configured GLTFLoader instance
 */
export async function getConfiguredGLTFLoader(loadingManager) {
  if (_gltfLoader) return _gltfLoader;

  log.info('Initializing GLTFLoader with Draco & Meshopt support…');

  // Dynamic imports — resolved via the import map `three/addons/…`
  const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] =
    await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/loaders/DRACOLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js'),
    ]);

  // ── Draco ──────────────────────────────
  _dracoLoader = new DRACOLoader(loadingManager);
  _dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
  _dracoLoader.setDecoderConfig({ type: 'js' }); // JS fallback; WASM auto-detected
  _dracoLoader.preload();
  log.info('Draco decoder configured', { path: DRACO_DECODER_PATH });

  // ── GLTFLoader ─────────────────────────
  _gltfLoader = new GLTFLoader(loadingManager);
  _gltfLoader.setDRACOLoader(_dracoLoader);

  // ── Meshopt ────────────────────────────
  if (MeshoptDecoder) {
    // MeshoptDecoder.ready is a Promise that resolves when WASM is compiled
    if (typeof MeshoptDecoder.ready === 'function') {
      await MeshoptDecoder.ready();
    } else if (MeshoptDecoder.ready instanceof Promise) {
      await MeshoptDecoder.ready;
    }
    _gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    _meshoptReady = true;
    log.info('Meshopt decoder ready');
  }

  return _gltfLoader;
}

// ───────────────────────────────────────────
// Public API
// ───────────────────────────────────────────

/**
 * @typedef {Object} ModelLoadOptions
 * @property {any}      [loadingManager]  - THREE.LoadingManager instance
 * @property {number}   [timeout=15000]   - Timeout in ms before aborting
 * @property {(event: ProgressEvent) => void} [onProgress] - Progress callback
 */

/**
 * Load a glTF / GLB model with automatic Draco & Meshopt decompression.
 *
 * @param {string} url - Path to the `.gltf` or `.glb` file
 * @param {ModelLoadOptions} [options]
 * @returns {Promise<import('three/addons/loaders/GLTFLoader.js').GLTF>} Loaded GLTF object (`{ scene, animations, … }`)
 *
 * @example
 * ```js
 * const gltf = await loadCompressedModel('/content/assets/models/robot.glb');
 * scene.add(gltf.scene);
 *
 * // With options
 * const gltf = await loadCompressedModel('/content/assets/models/robot.glb', {
 *   timeout: 20000,
 *   onProgress: (xhr) => console.log(`${(xhr.loaded / xhr.total * 100)}%`),
 * });
 * ```
 */
export async function loadCompressedModel(url, options = {}) {
  const { loadingManager, timeout = 15000, onProgress } = options;

  const loader = await getConfiguredGLTFLoader(loadingManager);

  log.info(`Loading model: ${url}`);
  const start = performance.now();

  return new Promise((resolve, reject) => {
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let timer;

    if (timeout > 0) {
      timer = setTimeout(() => {
        reject(new Error(`Model loading timeout after ${timeout}ms: ${url}`));
      }, timeout);
    }

    loader.load(
      url,
      (gltf) => {
        if (timer) clearTimeout(timer);
        const elapsed = (performance.now() - start).toFixed(0);
        log.info(`Model loaded in ${elapsed}ms: ${url}`, {
          animations: gltf.animations?.length ?? 0,
          scenes: gltf.scenes?.length ?? 0,
        });
        resolve(gltf);
      },
      onProgress,
      (error) => {
        if (timer) clearTimeout(timer);
        log.error(`Failed to load model: ${url}`, error);
        reject(error);
      },
    );
  });
}

/**
 * Preload a model into the Three.js cache without adding it to a scene.
 * Useful for warming the cache during idle time.
 *
 * @param {string} url - Model URL
 * @param {ModelLoadOptions} [options]
 * @returns {Promise<void>}
 */
export async function preloadModel(url, options = {}) {
  try {
    await loadCompressedModel(url, options);
    log.info(`Model preloaded: ${url}`);
  } catch (err) {
    log.warn(`Model preload failed (non-critical): ${url}`, err);
  }
}

/**
 * Clean up Draco decoder resources.
 * Call this when 3D content is permanently removed from the page.
 */
export function disposeModelLoader() {
  if (_dracoLoader) {
    _dracoLoader.dispose();
    _dracoLoader = null;
    log.info('Draco decoder disposed');
  }
  _gltfLoader = null;
  _meshoptReady = false;
}

/**
 * Returns whether the Meshopt decoder has been initialised.
 * @returns {boolean}
 */
export function isMeshoptReady() {
  return _meshoptReady;
}
