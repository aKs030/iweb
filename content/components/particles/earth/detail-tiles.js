import { CONFIG } from "./config.js";
import { getEarthDetailTileUrl } from "./texture-paths.js";

const COLUMNS = 8;
const ROWS = 4;
const RETIRE_DELAY_MS = 1600;
const STARTUP_DELAY_MS = 900;
const ENABLE_STABILITY_MS = 450;
const TILE_ENABLE_SCALE = 0.98;
const TILE_DISABLE_SCALE = 0.88;
const TILE_RETRY_DELAY_MS = 15000;
const MAX_TILE_LOAD_ATTEMPTS = 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damping = (rate, delta) => 1 - Math.exp(-rate * Math.min(delta, 1 / 15));

export class EarthDetailTileManager {
  constructor(THREE, earthMesh, renderer, isMobileDevice, qualityLevel) {
    this.THREE = THREE;
    this.earthMesh = earthMesh;
    this.renderer = renderer;
    this.isMobileDevice = isMobileDevice;
    this.qualityLevel = qualityLevel;
    this.loader = new THREE.TextureLoader();
    this.group = new THREE.Group();
    this.group.name = "earth-visible-detail-tiles";
    this.group.renderOrder = 2;
    this.group.visible = false;
    this.tiles = new Map();
    this.cameraLocal = new THREE.Vector3();
    this.desiredKeys = new Set();
    this.failedTiles = new Map();
    this.enabled = false;
    this.eligibleSince = null;
    this.startupReadyAt = performance.now() + STARTUP_DELAY_MS;
    this.disposed = false;
    this.fadeTexture = this._createFadeTexture();
    earthMesh.add(this.group);
  }

  setQualityLevel(qualityLevel) {
    this.qualityLevel = qualityLevel;
  }

  update(camera, mode, scale, delta, suppressed = false) {
    const now = performance.now();
    const scaleThreshold = this.enabled ? TILE_DISABLE_SCALE : TILE_ENABLE_SCALE;
    const eligible =
      !suppressed &&
      this.qualityLevel !== "LOW" &&
      this.renderer.capabilities.maxTextureSize >= 4096 &&
      mode === "day" &&
      scale >= scaleThreshold;

    if (!eligible || now < this.startupReadyAt) {
      this.enabled = false;
      this.eligibleSince = null;
    } else if (!this.enabled) {
      this.eligibleSince ??= now;
      if (now - this.eligibleSince >= ENABLE_STABILITY_MS) {
        this.enabled = true;
      }
    }

    this.desiredKeys.clear();

    if (this.enabled) {
      this.earthMesh.updateWorldMatrix(true, false);
      this.cameraLocal.copy(camera.position);
      this.earthMesh.worldToLocal(this.cameraLocal);
      this.cameraLocal.normalize();

      const u = (0.5 - Math.atan2(this.cameraLocal.z, this.cameraLocal.x) / (Math.PI * 2) + 1) % 1;
      const v = Math.acos(clamp(this.cameraLocal.y, -1, 1)) / Math.PI;
      const columnPosition = u * COLUMNS;
      const rowPosition = clamp(v * ROWS, 0, ROWS - Number.EPSILON);
      const column = Math.floor(columnPosition);
      const row = Math.floor(rowPosition);
      const horizontalNeighbor =
        (column + (columnPosition - column < 0.5 ? -1 : 1) + COLUMNS) % COLUMNS;
      const verticalNeighbor = clamp(row + (rowPosition - row < 0.5 ? -1 : 1), 0, ROWS - 1);

      this._requestTile(row, column);
      if (!this.isMobileDevice || this.qualityLevel === "HIGH") {
        this._requestTile(row, horizontalNeighbor);
      }
      if (!this.isMobileDevice && this.qualityLevel === "HIGH" && verticalNeighbor !== row) {
        this._requestTile(verticalNeighbor, column);
      }
    }

    const fade = damping(5.5, delta);
    let visibleTiles = 0;
    this.tiles.forEach((tile, key) => {
      const desired = this.desiredKeys.has(key);
      tile.lastUsed = desired ? now : tile.lastUsed;
      const targetOpacity = desired && tile.mesh ? 1 : 0;
      tile.opacity += (targetOpacity - tile.opacity) * fade;
      if (tile.mesh) {
        tile.mesh.material.opacity = tile.opacity;
        tile.mesh.visible = tile.opacity > 0.004;
        if (tile.mesh.visible) visibleTiles++;
      }
      if (
        !desired &&
        tile.opacity < 0.005 &&
        now - tile.lastUsed > RETIRE_DELAY_MS &&
        (!this.enabled || this.tiles.size > 3)
      ) {
        this._disposeTile(key, tile);
      }
    });
    this.group.visible = visibleTiles > 0;
  }

  _requestTile(row, column) {
    const key = `${row}:${column}`;
    this.desiredKeys.add(key);
    const existing = this.tiles.get(key);
    if (existing) return;

    const now = performance.now();
    const previousFailure = this.failedTiles.get(key);
    if (
      previousFailure &&
      (previousFailure.attempts >= MAX_TILE_LOAD_ATTEMPTS || now < previousFailure.retryAt)
    ) {
      return;
    }

    const tile = { mesh: null, opacity: 0, lastUsed: now, cancelled: false };
    this.tiles.set(key, tile);
    this.loader
      .loadAsync(getEarthDetailTileUrl(row, column))
      .then(texture => {
        if (tile.cancelled) {
          texture.dispose();
          return;
        }
        this.failedTiles.delete(key);
        texture.colorSpace = this.THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);
        texture.wrapS = this.THREE.ClampToEdgeWrapping;
        texture.wrapT = this.THREE.ClampToEdgeWrapping;
        texture.minFilter = this.THREE.LinearMipmapLinearFilter;
        texture.magFilter = this.THREE.LinearFilter;
        texture.needsUpdate = true;

        const geometry = new this.THREE.SphereGeometry(
          CONFIG.EARTH.RADIUS + 0.015,
          44,
          28,
          (column / COLUMNS) * Math.PI * 2,
          (Math.PI * 2) / COLUMNS,
          (row / ROWS) * Math.PI,
          Math.PI / ROWS
        );
        const material = new this.THREE.MeshStandardMaterial({
          map: texture,
          alphaMap: this.fadeTexture,
          color: 0xffffff,
          roughness: 0.88,
          metalness: 0,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const mesh = new this.THREE.Mesh(geometry, material);
        mesh.name = `earth-detail-tile-${row}-${column}`;
        mesh.renderOrder = 2;
        tile.mesh = mesh;
        this.group.add(mesh);
      })
      .catch(() => {
        if (this.tiles.get(key) === tile) this.tiles.delete(key);
        if (tile.cancelled || this.disposed) return;

        const attempts = (previousFailure?.attempts || 0) + 1;
        this.failedTiles.set(key, {
          attempts,
          retryAt: performance.now() + TILE_RETRY_DELAY_MS * attempts,
        });
      });
  }

  _disposeTile(key, tile) {
    tile.cancelled = true;
    if (tile.mesh) {
      this.group.remove(tile.mesh);
      tile.mesh.geometry.dispose();
      tile.mesh.material.map?.dispose();
      tile.mesh.material.dispose();
    }
    this.tiles.delete(key);
  }

  _createFadeTexture() {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
        const normalized = clamp(edge / (size * 0.075), 0, 1);
        const alpha = Math.round(normalized * normalized * (3 - 2 * normalized) * 255);
        const offset = (y * size + x) * 4;
        data[offset] = data[offset + 1] = data[offset + 2] = alpha;
        data[offset + 3] = 255;
      }
    }
    const texture = new this.THREE.DataTexture(
      data,
      size,
      size,
      this.THREE.RGBAFormat,
      this.THREE.UnsignedByteType
    );
    texture.minFilter = this.THREE.LinearFilter;
    texture.magFilter = this.THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  dispose() {
    this.disposed = true;
    this.enabled = false;
    this.eligibleSince = null;
    this.tiles.forEach((tile, key) => this._disposeTile(key, tile));
    this.tiles.clear();
    this.failedTiles.clear();
    this.group.removeFromParent();
    this.fadeTexture.dispose();
  }
}
