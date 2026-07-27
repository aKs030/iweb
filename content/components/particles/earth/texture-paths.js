const EARTH_TEXTURE_VERSION = "earth-20260725-r4";
const EARTH_REGIONAL_TEXTURE_VERSION = "earth-regional-20260726-r2";
const EARTH_TEXTURE_CDN_URL = "https://img.abdulkerimsesli.de/earth/textures";

function withTexturePath(filename) {
  return `${EARTH_TEXTURE_CDN_URL}/${filename}?v=${EARTH_TEXTURE_VERSION}`;
}

function withRegionalTexturePath(filename) {
  return `${EARTH_TEXTURE_CDN_URL}/${filename}?v=${EARTH_REGIONAL_TEXTURE_VERSION}`;
}

const EARTH_TEXTURES = Object.freeze({
  DAY: withTexturePath("earth_day_relief_8k.jpg"),
  DAY_KTX2: withTexturePath("earth_day_relief_8k.ktx2"),
  NIGHT: withTexturePath("earth_night_8k_nasa.jpg"),
  NIGHT_KTX2: null,
  NORMAL: withTexturePath("earth_normal_4k.webp"),
  BUMP: withTexturePath("earth_displacement_16b_8k.png"),
  CLOUDS: withTexturePath("earth_clouds_4k.jpg"),
  CLOUDS_KTX2: withTexturePath("earth_clouds_4k.ktx2"),
  MOON: withTexturePath("moon_texture.webp"),
  MOON_BUMP: withTexturePath("moon_bump.webp"),
});

const EARTH_TEXTURES_STANDARD = Object.freeze({
  DAY: withTexturePath("earth_day_relief_4k.jpg"),
  DAY_KTX2: withTexturePath("earth_day_relief_4k.ktx2"),
  NIGHT: withTexturePath("earth_night_4k.webp"),
  NIGHT_KTX2: withTexturePath("earth_night_4k.ktx2"),
  NORMAL: withTexturePath("earth_normal_4k.webp"),
  BUMP: withTexturePath("earth_bump_4k.webp"),
  CLOUDS: withTexturePath("earth_clouds_4k.jpg"),
  CLOUDS_KTX2: EARTH_TEXTURES.CLOUDS_KTX2,
  MOON: withTexturePath("moon_texture.webp"),
  MOON_BUMP: withTexturePath("moon_bump.webp"),
});

const EARTH_TEXTURES_MOBILE = Object.freeze({
  DAY: withTexturePath("earth_day_relief_2k.jpg"),
  DAY_KTX2: withTexturePath("earth_day_relief_2k.ktx2"),
  NIGHT: withTexturePath("earth_night.webp"),
  NIGHT_KTX2: withTexturePath("earth_night.ktx2"),
  NORMAL: withTexturePath("earth_normal.webp"),
  BUMP: withTexturePath("earth_bump.webp"),
  CLOUDS: EARTH_TEXTURES.CLOUDS,
  CLOUDS_KTX2: EARTH_TEXTURES.CLOUDS_KTX2,
  MOON: EARTH_TEXTURES.MOON,
  MOON_BUMP: EARTH_TEXTURES.MOON_BUMP,
});

export const EARTH_REGIONAL_TEXTURES = Object.freeze({
  TERRAIN: withRegionalTexturePath("closeup-terrain-v14.webp"),
  TERRAIN_MOBILE: withRegionalTexturePath("closeup-terrain-v14-2k.webp"),
  HEIGHT: withRegionalTexturePath("closeup-height-v14.webp"),
  NORMAL: withRegionalTexturePath("closeup-normal-v14.webp"),
  CLOUDS: withTexturePath("earth_clouds_4k.jpg"),
});

export function getEarthTextureSet({ isMobile = false, compact = false } = {}) {
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
  // Use the physical screen resolution as the capability signal, not just the
  // current browser window width. A narrow/un-maximized window on a high-res or
  // retina display previously got downgraded to the 4K set even though the
  // hardware (and bandwidth, in most cases) can easily handle 8K.
  const screenWidth = globalThis.screen?.width || width;
  const referenceWidth = Math.max(width, screenWidth);
  const renderedWidth = referenceWidth * pixelRatio;

  const effectiveType = globalThis.navigator?.connection?.effectiveType;
  const isSlowConnection =
    effectiveType === "2g" || effectiveType === "3g" || effectiveType === "slow-2g";

  const compact =
    saveData ||
    isSlowConnection ||
    renderedWidth <= 2600 ||
    (deviceMemory > 0 && deviceMemory <= 4) ||
    maxTextureSize < 8192;

  return getEarthTextureSet({ isMobile, compact });
}
