/**
 * Gallery Configuration
 * Assets are hosted on Cloudflare R2 via custom domain (img.abdulkerimsesli.de).
 *
 * Localhost: Uses /r2-proxy/ to avoid CORS issues
 * Production: Direct R2 custom domain access
 */
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

const R2_BASE_URL = isLocalhost
  ? '/r2-proxy'
  : 'https://img.abdulkerimsesli.de';

export const GALLERY_ITEMS = [
  {
    id: 'mond',
    type: 'image',
    url: `${R2_BASE_URL}/Gallery/Mond.webp`,
    title: 'Mond',
    description: 'Mystischer Mondschein',
  },
  {
    id: 'urban',
    type: 'image',
    url: `${R2_BASE_URL}/Gallery/Urbanes%20Kaleidoskop.webp`,
    title: 'Urbanes Kaleidoskop',
    description: 'Farbenspiel der Stadt',
  },
  {
    id: 'forest',
    type: 'image',
    url: `${R2_BASE_URL}/Gallery/Wald-Schienen.webp`,
    title: 'Wald & Schienen',
    description: 'Verlassene Pfade',
  },
  {
    id: 'portrait',
    type: 'image',
    url: `${R2_BASE_URL}/Gallery/abdulkerim-sesli-01.webp`,
    title: 'Portrait',
    description: 'Abdulkerim Sesli',
  },
  {
    id: 'video',
    type: 'video',
    url: `${R2_BASE_URL}/Gallery/abdulkerim-sesli-video.mp4`,
    title: 'Cinematic Reel',
    description: 'Video Impressionen',
  },
];
