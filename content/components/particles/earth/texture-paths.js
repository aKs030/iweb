import { resolveR2Path } from "../../../config/media-urls.js";

const EARTH_TEXTURE_BASE_PATH = "content/media/img/earth/textures";

function withTexturePath(filename) {
  const resolved = resolveR2Path(`${EARTH_TEXTURE_BASE_PATH}/${filename}`);
  // If dev server doesn't provide R2 proxy, fall back to local static path
  if (typeof resolved === "string" && resolved.startsWith("/r2-proxy")) {
    return `/${EARTH_TEXTURE_BASE_PATH}/${filename}`;
  }
  return resolved;
}

export const EARTH_TEXTURES = Object.freeze({
  DAY: withTexturePath("earth_day.webp"),
  NIGHT: withTexturePath("earth_night.webp"),
  NORMAL: withTexturePath("earth_normal.webp"),
  BUMP: withTexturePath("earth_bump.webp"),
  CLOUDS: withTexturePath("earth_clouds_1024.webp"),
  MOON: withTexturePath("moon_texture.webp"),
  MOON_BUMP: withTexturePath("moon_bump.webp"),
});

export const EARTH_PRIMARY_TEXTURE_URL = EARTH_TEXTURES.DAY;
export const EARTH_SECONDARY_TEXTURE_URLS = Object.freeze([
  EARTH_TEXTURES.NIGHT,
  EARTH_TEXTURES.NORMAL,
  EARTH_TEXTURES.BUMP,
]);
export const EARTH_FALLBACK_BACKGROUND_URL = EARTH_TEXTURES.DAY;
