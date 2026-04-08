const EARTH_TEXTURE_BASE_PATH = '/content/media/img/earth/textures';

function withTexturePath(filename) {
  return `${EARTH_TEXTURE_BASE_PATH}/${filename}`;
}

export const EARTH_TEXTURES = Object.freeze({
  DAY: withTexturePath('earth_day.webp'),
  NIGHT: withTexturePath('earth_night.webp'),
  NORMAL: withTexturePath('earth_normal.webp'),
  BUMP: withTexturePath('earth_bump.webp'),
  CLOUDS: withTexturePath('earth_clouds_1024.webp'),
  MOON: withTexturePath('moon_texture.webp'),
  MOON_BUMP: withTexturePath('moon_bump.webp'),
});

export const EARTH_CRITICAL_TEXTURE_URL = EARTH_TEXTURES.DAY;
export const EARTH_SECONDARY_TEXTURE_URLS = Object.freeze([
  EARTH_TEXTURES.NIGHT,
  EARTH_TEXTURES.NORMAL,
  EARTH_TEXTURES.BUMP,
]);
export const EARTH_FALLBACK_BACKGROUND_URL = EARTH_TEXTURES.DAY;
