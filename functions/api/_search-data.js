/**
 * Search Data Constants
 * Shared configuration and static data for search functionality
 */

export const SEARCH_SYSTEM_PROMPT =
  'Du bist ein Suchassistent fuer abdulkerimsesli.de. Fasse Suchergebnisse in 1-2 praegnanten Saetzen zusammen (max. 120 Zeichen). Fokus auf konkrete Inhalte, keine generischen Aussagen.';

export const FAST_INTENT_PATHS = new Set([
  '/about',
  '/contact',
  '/datenschutz',
  '/impressum',
]);

export const ROUTE_FALLBACK_PATHS = [
  '/',
  '/about/',
  '/contact/',
  '/datenschutz/',
  '/impressum/',
  '/projekte/',
  '/blog/',
  '/gallery/',
  '/videos/',
  '/abdul-sesli/',
];

export const DEFAULT_NO_RESULT_SUGGESTIONS = [
  { title: 'Projekte entdecken', url: '/projekte' },
  { title: 'Blog durchsuchen', url: '/blog' },
  { title: 'Kontakt aufnehmen', url: '/contact' },
];

export const INTENT_FALLBACK_SUGGESTIONS = {
  '/about': { title: 'Über mich ansehen', url: '/about' },
  '/contact': { title: 'Kontakt öffnen', url: '/contact' },
  '/datenschutz': { title: 'Datenschutz öffnen', url: '/datenschutz' },
  '/impressum': { title: 'Impressum öffnen', url: '/impressum' },
  '/projekte': { title: 'Projekte öffnen', url: '/projekte' },
  '/blog': { title: 'Blog öffnen', url: '/blog' },
  '/gallery': { title: 'Galerie öffnen', url: '/gallery' },
  '/videos': { title: 'Videos öffnen', url: '/videos' },
};
