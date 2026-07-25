const EARTH_TEXTURE_VERSION = "earth-20260725-r3";
const EARTH_TEXTURE_CDN_URL = "https://img.abdulkerimsesli.de/earth/textures";

function withTexturePath(filename) {
  return `${EARTH_TEXTURE_CDN_URL}/${filename}?v=${EARTH_TEXTURE_VERSION}`;
}

const EARTH_TEXTURES = Object.freeze({
  DAY: withTexturePath("earth_day_relief_8k.jpg"),
  DAY_KTX2: withTexturePath("earth_day_relief_8k.ktx2"),
  NIGHT: withTexturePath("earth_night_8k.jpg"),
  NIGHT_KTX2: withTexturePath("earth_night_8k.ktx2"),
  NORMAL: withTexturePath("earth_normal_4k.webp"),
  BUMP: withTexturePath("earth_bump_4k.webp"),
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

export function getEarthTextureSet({ isMobile = false, compact = false } = {}) {
  if (isMobile) return EARTH_TEXTURES_MOBILE;
  return compact ? EARTH_TEXTURES_STANDARD : EARTH_TEXTURES;
}
