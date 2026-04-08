import { resolveR2Path } from '../../content/config/media-urls.js';
import { inferGalleryAssetType, isImageMediaPath } from './media-assets.js';

const RANGE_PROBE_BYTES = 8192;

function stripExtension(filename = '') {
  return String(filename || '').replace(/\.[^/.]+$/, '');
}

function humanizeFilename(filename = '') {
  return stripExtension(filename)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toTitleCase(value = '') {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function hashString(value = '') {
  let hash = 2166136261;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toChannel = (channel) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toChannel(r)}${toChannel(g)}${toChannel(b)}`;
}

function derivePreviewColor(key = '') {
  const hash = hashString(key);
  const hue = hash % 360;
  const saturation = 55 + (hash % 18);
  const lightness = 42 + (hash % 10);
  return hslToHex(hue, saturation, lightness);
}

function createBlurPlaceholder(color = '#1f2937', title = '') {
  const safeColor = String(color || '#1f2937');
  const safeTitle = String(title || '').slice(0, 48);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" preserveAspectRatio="none">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.92" />
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.98" />
        </linearGradient>
      </defs>
      <rect width="160" height="90" fill="url(#g)" />
      <circle cx="32" cy="24" r="18" fill="#ffffff" fill-opacity="0.08" />
      <circle cx="126" cy="66" r="26" fill="#ffffff" fill-opacity="0.06" />
      <text x="14" y="78" fill="#ffffff" fill-opacity="0.5" font-family="Arial, sans-serif" font-size="8">${safeTitle}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function inferOrientation(width, height, fallbackType = 'image') {
  if (Number.isFinite(width) && Number.isFinite(height)) {
    if (width === height) return 'square';
    return width > height ? 'landscape' : 'portrait';
  }

  return fallbackType === 'video' ? 'landscape' : 'unknown';
}

function buildCaption(title, type, orientation) {
  const medium = type === 'video' ? 'Video' : 'Moment';
  const orientationCopy =
    orientation === 'portrait'
      ? 'im Hochformat'
      : orientation === 'square'
        ? 'im quadratischen Format'
        : orientation === 'landscape'
          ? 'im Querformat'
          : 'aus der Galerie';
  return `${title} ${medium.toLowerCase()} ${orientationCopy}.`;
}

function readUint16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint16BE(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes, offset) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function parsePngDimensions(bytes) {
  if (bytes.length < 24) return null;
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }

  return {
    width: readUint32BE(bytes, 16),
    height: readUint32BE(bytes, 20),
  };
}

function parseGifDimensions(bytes) {
  if (bytes.length < 10) return null;
  if (
    bytes[0] !== 0x47 ||
    bytes[1] !== 0x49 ||
    bytes[2] !== 0x46 ||
    bytes[3] !== 0x38
  ) {
    return null;
  }

  return {
    width: readUint16LE(bytes, 6),
    height: readUint16LE(bytes, 8),
  };
}

function parseJpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    offset += 2;

    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 1 >= bytes.length) break;

    const segmentLength = readUint16BE(bytes, offset);
    if (!segmentLength || offset + segmentLength > bytes.length) break;

    const isSofMarker =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isSofMarker && offset + 7 < bytes.length) {
      return {
        height: readUint16BE(bytes, offset + 3),
        width: readUint16BE(bytes, offset + 5),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function parseWebpDimensions(bytes) {
  if (bytes.length < 30) return null;
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff !== 'RIFF' || webp !== 'WEBP') return null;

  const chunkType = String.fromCharCode(...bytes.slice(12, 16));

  if (chunkType === 'VP8X' && bytes.length >= 30) {
    return {
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1,
    };
  }

  if (chunkType === 'VP8 ' && bytes.length >= 30) {
    return {
      width: readUint16LE(bytes, 26) & 0x3fff,
      height: readUint16LE(bytes, 28) & 0x3fff,
    };
  }

  if (chunkType === 'VP8L' && bytes.length >= 25) {
    const width = 1 + (((bytes[21] | (bytes[22] << 8)) & 0x3fff) >>> 0);
    const height =
      1 +
      ((((bytes[22] >> 6) | (bytes[23] << 2) | (bytes[24] << 10)) & 0x3fff) >>>
        0);
    return { width, height };
  }

  return null;
}

function parseSvgDimensions(bytes) {
  const text = new TextDecoder('utf-8').decode(bytes);
  const svgMatch = text.match(/<svg\b[^>]*>/i);
  if (!svgMatch) return null;

  const widthMatch = svgMatch[0].match(/\bwidth=["']?([\d.]+)/i);
  const heightMatch = svgMatch[0].match(/\bheight=["']?([\d.]+)/i);
  const viewBoxMatch = svgMatch[0].match(
    /\bviewBox=["']?\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/i,
  );

  const width = Number.parseFloat(widthMatch?.[1] || viewBoxMatch?.[1] || '');
  const height = Number.parseFloat(heightMatch?.[1] || viewBoxMatch?.[2] || '');

  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

function parseImageDimensions(bytes, key = '') {
  const lowerKey = String(key || '').toLowerCase();
  if (lowerKey.endsWith('.png')) return parsePngDimensions(bytes);
  if (lowerKey.endsWith('.gif')) return parseGifDimensions(bytes);
  if (lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg')) {
    return parseJpegDimensions(bytes);
  }
  if (lowerKey.endsWith('.webp')) return parseWebpDimensions(bytes);
  if (lowerKey.endsWith('.svg')) return parseSvgDimensions(bytes);
  return null;
}

async function probeImageDimensions(bucket, key) {
  if (!bucket?.get || !isImageMediaPath(key)) return null;

  try {
    const object = await bucket.get(key, {
      range: { offset: 0, length: RANGE_PROBE_BYTES },
    });
    if (!object) return null;

    const arrayBuffer = await object.arrayBuffer();
    if (!arrayBuffer) return null;

    return parseImageDimensions(new Uint8Array(arrayBuffer), key);
  } catch {
    return null;
  }
}

/**
 * @param {any} bucket
 * @param {any} obj
 * @returns {Promise<any>}
 */
export async function enrichGalleryObject(bucket, obj) {
  const key = obj.key;
  const filename = key.split('/').pop() || key;
  const type = inferGalleryAssetType(filename);
  const title = toTitleCase(humanizeFilename(filename));
  const dimensions =
    type === 'image' ? await probeImageDimensions(bucket, key) : null;
  const orientation = inferOrientation(
    dimensions?.width,
    dimensions?.height,
    type,
  );
  const dominantColor = derivePreviewColor(key);

  return {
    ...obj,
    presentationMeta: {
      caption: buildCaption(title, type, orientation),
      orientation,
      dominantColor,
      blurPlaceholder: createBlurPlaceholder(dominantColor, title),
      width: Number.isFinite(dimensions?.width)
        ? Math.round(dimensions.width)
        : null,
      height: Number.isFinite(dimensions?.height)
        ? Math.round(dimensions.height)
        : null,
    },
  };
}

/**
 * @param {any} obj
 * @param {URL} url
 * @returns {Record<string, unknown>}
 */
export function buildGalleryItemPayload(obj, url) {
  const key = obj.key;
  const filename = key.split('/').pop() || key;
  const type = inferGalleryAssetType(filename);
  const title = toTitleCase(humanizeFilename(filename));
  const presentationMeta =
    obj.presentationMeta && typeof obj.presentationMeta === 'object'
      ? obj.presentationMeta
      : {};

  return {
    id: key,
    type,
    url: resolveR2Path(key, url),
    title,
    caption: String(presentationMeta.caption || '').trim(),
    description: 'Taken by Abdulkerim Sesli',
    size: obj.size,
    uploaded: obj.uploaded,
    orientation: String(presentationMeta.orientation || 'unknown'),
    dominantColor: String(
      presentationMeta.dominantColor || derivePreviewColor(key),
    ),
    blurPlaceholder: String(
      presentationMeta.blurPlaceholder ||
        createBlurPlaceholder(derivePreviewColor(key), title),
    ),
    width: Number.isFinite(presentationMeta.width)
      ? presentationMeta.width
      : null,
    height: Number.isFinite(presentationMeta.height)
      ? presentationMeta.height
      : null,
  };
}
