/**
 * Three.js Asset Loading Timeout Manager
 * @version 1.0.0
 */

import { createLogger } from './logger.js';

const log = createLogger('ThreeEarthTimeout');

/**
 * Timeout configuration for Three.js asset loading
 */
export const ASSET_TIMEOUT_CONFIG = {
  TEXTURE_TIMEOUT: 15000, // 15 seconds for textures
  MODEL_TIMEOUT: 20000, // 20 seconds for models
  TOTAL_TIMEOUT: 30000, // 30 seconds total for all assets
};

/**
 * Create a timeout promise that rejects after specified time
 * @param {number} ms - Timeout in milliseconds
 * @param {string} message - Error message
 * @returns {Promise} Promise that rejects after timeout
 */
export function createTimeout(ms, message = 'Operation timed out') {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} errorMessage - Error message on timeout
 * @returns {Promise} Promise that rejects if timeout is exceeded
 */
export async function withTimeout(promise, timeout, errorMessage) {
  return Promise.race([promise, createTimeout(timeout, errorMessage)]);
}

/**
 * Load texture with timeout
 * @param {Object} loader - Three.js TextureLoader
 * @param {string} url - Texture URL
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Texture>} Loaded texture
 */
export async function loadTextureWithTimeout(
  loader,
  url,
  timeout = ASSET_TIMEOUT_CONFIG.TEXTURE_TIMEOUT,
) {
  log.debug(`Loading texture: ${url}`);

  const loadPromise = new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        log.debug(`Texture loaded: ${url}`);
        resolve(texture);
      },
      undefined, // onProgress
      (error) => {
        log.error(`Texture load failed: ${url}`, error);
        reject(error);
      },
    );
  });

  try {
    return await withTimeout(
      loadPromise,
      timeout,
      `Texture loading timed out: ${url}`,
    );
  } catch (error) {
    log.error(`Texture loading error: ${url}`, error);
    throw error;
  }
}

/**
 * Load multiple textures with timeout
 * @param {Object} loader - Three.js TextureLoader
 * @param {Array<{key: string, url: string}>} textures - Array of texture configs
 * @param {number} timeout - Total timeout in milliseconds
 * @returns {Promise<Object>} Object with loaded textures
 */
export async function loadTexturesWithTimeout(
  loader,
  textures,
  timeout = ASSET_TIMEOUT_CONFIG.TOTAL_TIMEOUT,
) {
  log.info(`Loading ${textures.length} textures with ${timeout}ms timeout`);

  const loadPromises = textures.map(({ key, url }) =>
    loadTextureWithTimeout(loader, url, ASSET_TIMEOUT_CONFIG.TEXTURE_TIMEOUT)
      .then((texture) => ({ key, texture, success: true }))
      .catch((error) => {
        log.warn(`Failed to load texture ${key}:`, error);
        return { key, texture: null, success: false, error };
      }),
  );

  try {
    const results = await withTimeout(
      Promise.all(loadPromises),
      timeout,
      'Total texture loading timed out',
    );

    const textureMap = {};
    const failed = [];

    results.forEach(({ key, texture, success, error }) => {
      if (success && texture) {
        textureMap[key] = texture;
      } else {
        failed.push({ key, error });
      }
    });

    if (failed.length > 0) {
      log.warn(`${failed.length} textures failed to load:`, failed);
    }

    log.info(
      `Successfully loaded ${Object.keys(textureMap).length}/${textures.length} textures`,
    );

    return { textures: textureMap, failed };
  } catch (error) {
    log.error('Texture loading failed:', error);
    throw error;
  }
}

/**
 * Create a fallback texture (solid color)
 * @param {Object} THREE - Three.js library
 * @param {number} color - Color hex value
 * @returns {Texture} Fallback texture
 */
export function createFallbackTexture(THREE, color = 0x333333) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 64, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  return texture;
}

/**
 * Asset loading manager with timeout and progress tracking
 */
export class AssetLoadingManager {
  constructor(THREE, timeout = ASSET_TIMEOUT_CONFIG.TOTAL_TIMEOUT) {
    this.THREE = THREE;
    this.timeout = timeout;
    this.startTime = null;
    this.loadedCount = 0;
    this.totalCount = 0;
    this.onProgressCallback = null;
    this.onCompleteCallback = null;
    this.onErrorCallback = null;
  }

  /**
   * Set progress callback
   * @param {Function} callback - Progress callback (loaded, total, progress)
   */
  onProgress(callback) {
    this.onProgressCallback = callback;
    return this;
  }

  /**
   * Set complete callback
   * @param {Function} callback - Complete callback
   */
  onComplete(callback) {
    this.onCompleteCallback = callback;
    return this;
  }

  /**
   * Set error callback
   * @param {Function} callback - Error callback
   */
  onError(callback) {
    this.onErrorCallback = callback;
    return this;
  }

  /**
   * Load assets with timeout
   * @param {Function} loadFunction - Function that loads assets
   * @returns {Promise} Promise that resolves with loaded assets
   */
  async load(loadFunction) {
    this.startTime = Date.now();

    try {
      const result = await withTimeout(
        loadFunction(this),
        this.timeout,
        `Asset loading timed out after ${this.timeout}ms`,
      );

      const duration = Date.now() - this.startTime;
      log.info(`Assets loaded in ${duration}ms`);

      if (this.onCompleteCallback) {
        this.onCompleteCallback(result);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - this.startTime;
      log.error(`Asset loading failed after ${duration}ms:`, error);

      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }

      throw error;
    }
  }

  /**
   * Update progress
   * @param {number} loaded - Number of loaded assets
   * @param {number} total - Total number of assets
   */
  updateProgress(loaded, total) {
    this.loadedCount = loaded;
    this.totalCount = total;

    if (this.onProgressCallback) {
      const progress = total > 0 ? loaded / total : 0;
      this.onProgressCallback(loaded, total, progress);
    }
  }
}
