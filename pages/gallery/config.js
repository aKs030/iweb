import { resolveR2Path } from '#config/media-urls.js';

/**
 * Gallery Configuration
 * Shared media URL resolution keeps localhost on /r2-proxy and production on R2.
 */

export const GALLERY_ITEMS = [
  {
    id: 'mond',
    type: 'image',
    url: resolveR2Path('Gallery/Mond.webp'),
    title: 'Mond',
    description: 'Mystischer Mondschein',
  },
  {
    id: 'urban',
    type: 'image',
    url: resolveR2Path('Gallery/Urbanes Kaleidoskop.webp'),
    title: 'Urbanes Kaleidoskop',
    description: 'Farbenspiel der Stadt',
  },
  {
    id: 'forest',
    type: 'image',
    url: resolveR2Path('Gallery/Wald-Schienen.webp'),
    title: 'Wald & Schienen',
    description: 'Verlassene Pfade',
  },
  {
    id: 'portrait',
    type: 'image',
    url: resolveR2Path('Gallery/abdulkerim-sesli-01.webp'),
    title: 'Portrait',
    description: 'Abdulkerim Sesli',
  },
  {
    id: 'video',
    type: 'video',
    url: resolveR2Path('Gallery/abdulkerim-sesli-video.mp4'),
    title: 'Cinematic Reel',
    description: 'Video Impressionen',
  },
];
