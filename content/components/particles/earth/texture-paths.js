const EARTH_TEXTURE_VERSION = "earth-eox-global-20260728-r1";
const EARTH_TEXTURE_CDN_URL = "/r2-proxy/earth/textures";
const EARTH_DETAIL_TILE_VERSION = "earth-detail-eox-2025-20260728-r1";
const EARTH_2K_MAX_RENDER_WIDTH = 1600;
const EARTH_8K_MIN_RENDER_WIDTH = 3200;
const EARTH_8K_MIN_UNKNOWN_MEMORY_RENDER_WIDTH = 3840;
const EARTH_8K_MIN_DEVICE_MEMORY_GB = 8;
const EARTH_MAX_RENDER_PIXEL_RATIO = 2;

function withTexturePath(filename) {
  return `${EARTH_TEXTURE_CDN_URL}/${filename}?v=${EARTH_TEXTURE_VERSION}`;
}

function withRegionalTexturePath(filename) {
  return `/content/media/img/earth/${filename}`;
}

const EARTH_TEXTURES = Object.freeze({
  DAY: withTexturePath("earth_eox_cloudless_2025_8k.webp"),
  DAY_KTX2: null,
  NIGHT: withTexturePath("earth_night_8k_nasa.jpg"),
  NIGHT_KTX2: withTexturePath("earth_night_4k.ktx2"),
  NORMAL: withTexturePath("earth_normal_4k.webp"),
  BUMP: withTexturePath("earth_bump_4k.webp"),
  CLOUDS: withTexturePath("earth_clouds_4k.jpg"),
  MOON: withTexturePath("moon_texture.webp"),
  MOON_BUMP: withTexturePath("moon_bump.webp"),
});

const EARTH_TEXTURES_STANDARD = Object.freeze({
  DAY: withTexturePath("earth_eox_cloudless_2025_4k.webp"),
  DAY_KTX2: null,
  NIGHT: withTexturePath("earth_night_4k.webp"),
  NIGHT_KTX2: withTexturePath("earth_night_4k.ktx2"),
  NORMAL: withTexturePath("earth_normal_4k.webp"),
  BUMP: withTexturePath("earth_bump_4k.webp"),
  CLOUDS: withTexturePath("earth_clouds_4k.jpg"),
  MOON: withTexturePath("moon_texture.webp"),
  MOON_BUMP: withTexturePath("moon_bump.webp"),
});

const EARTH_TEXTURES_MOBILE = Object.freeze({
  DAY: withTexturePath("earth_eox_cloudless_2025_2k.webp"),
  DAY_KTX2: null,
  NIGHT: withTexturePath("earth_night.webp"),
  NIGHT_KTX2: withTexturePath("earth_night.ktx2"),
  NORMAL: withTexturePath("earth_normal.webp"),
  BUMP: withTexturePath("earth_bump.webp"),
  CLOUDS: withTexturePath("earth_clouds_2k.jpg"),
  MOON: EARTH_TEXTURES.MOON,
  MOON_BUMP: EARTH_TEXTURES.MOON_BUMP,
});

export const EARTH_REGIONAL_TEXTURES = Object.freeze({
  TERRAIN: withRegionalTexturePath("berlin-mitte-truedop-sommer-2025-4k-r2.webp"),
  TERRAIN_MOBILE: withRegionalTexturePath("berlin-mitte-truedop-sommer-2025-2k-r2.webp"),
  WATER: withRegionalTexturePath("berlin-mitte-water-eox-2025-2k-r2.png"),
});

export function getEarthDetailTileUrl(row, column) {
  return `${EARTH_TEXTURE_CDN_URL}/tiles/eox-cloudless-2025/r${row}-c${column}.webp?v=${EARTH_DETAIL_TILE_VERSION}`;
}

function getEarthTextureSet({ isMobile = false, compact = false } = {}) {
  if (isMobile) return EARTH_TEXTURES_MOBILE;
  return compact ? EARTH_TEXTURES_STANDARD : EARTH_TEXTURES;
}

export function getEarthTextureSetForDisplay({
  isMobile = false,
  width = globalThis.innerWidth || 0,
  pixelRatio = globalThis.devicePixelRatio || 1,
  maxTextureSize = 8192,
  deviceMemory = Number(globalThis.navigator?.deviceMemory || 0),
  saveData = Boolean(globalThis.navigator?.connection?.saveData),
} = {}) {
  const safeWidth = Math.max(0, Number(width) || 0);
  const safePixelRatio = Math.min(
    EARTH_MAX_RENDER_PIXEL_RATIO,
    Math.max(1, Number(pixelRatio) || 1)
  );
  const renderedWidth = safeWidth * safePixelRatio;

  const effectiveType = globalThis.navigator?.connection?.effectiveType;
  const isSlowConnection =
    effectiveType === "2g" || effectiveType === "3g" || effectiveType === "slow-2g";

  const constrained =
    saveData ||
    isSlowConnection ||
    renderedWidth <= EARTH_2K_MAX_RENDER_WIDTH ||
    (deviceMemory > 0 && deviceMemory <= 2) ||
    maxTextureSize < 4096;
  const has8KMemory =
    deviceMemory >= EARTH_8K_MIN_DEVICE_MEMORY_GB ||
    (deviceMemory === 0 && renderedWidth >= EARTH_8K_MIN_UNKNOWN_MEMORY_RENDER_WIDTH);
  const supports8K =
    !isMobile &&
    !constrained &&
    renderedWidth >= EARTH_8K_MIN_RENDER_WIDTH &&
    has8KMemory &&
    maxTextureSize >= 8192;

  if (constrained) return getEarthTextureSet({ isMobile: true });

  if (isMobile) return getEarthTextureSet({ compact: true });

  return supports8K ? getEarthTextureSet() : getEarthTextureSet({ compact: true });
}
