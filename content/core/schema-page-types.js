import { normalizeSchemaText, uniqueSchemaList } from './schema-shared.js';

const SCHEMA_HOMEPAGE_DISCOVERY_TEXT =
  'Die Startseite bündelt Portfolio, Bildgalerie, Videoinhalte, Blogartikel und technische Schwerpunkte in einem zentralen Einstiegspunkt. Suchmaschinen und KI-Suchen erhalten dadurch einen klaren Überblick über Bilder, Videos und redaktionelle Inhalte auf dieser Domain.';

const SCHEMA_PAGE_TYPE_CONFIG = Object.freeze({
  home: Object.freeze({
    discoveryText:
      'Diese Hauptseite verweist auf alle zentralen Inhaltsbereiche: Blog, Galerie, Videos, Projekte und Profilinformationen.',
    schemaKeywords: [
      'Hauptseite',
      'Bildgalerie',
      'Video-Portfolio',
      'Tech Blog',
    ],
    seoTopics: [
      'Hauptseite',
      'Portfolio Übersicht',
      'Bilder und Videos',
      'Blog Artikel',
      'Code Projekte',
    ],
    aboutTopics: ['Portfolio', 'Webentwicklung', 'Fotografie', 'Video', 'Blog'],
  }),
  blog: Object.freeze({
    discoveryText:
      'Der Blog enthält ausführliche Artikel mit technischen Erklärungen, strukturierten Überschriften, Bildern und ergänzenden Medien.',
    schemaKeywords: ['Blog', 'Tutorials', 'SEO', 'Performance', 'TypeScript'],
    seoTopics: [
      'Tech Blog',
      'Tutorial',
      'Performance',
      'SEO Inhalte',
      'Frontend Wissen',
    ],
    aboutTopics: [
      'Portfolio',
      'Webentwicklung',
      'Fotografie',
      'Video',
      'Blog',
      'Technik Artikel',
      'SEO',
      'Performance',
    ],
  }),
  videos: Object.freeze({
    discoveryText:
      'Die Videoseite bündelt Video-Landingpages und eingebettete Inhalte mit beschreibenden Titeln und Vorschaubildern.',
    schemaKeywords: ['Video', 'YouTube', 'Behind the Scenes'],
    seoTopics: [
      'Video Inhalte',
      'YouTube Videos',
      'Short Clips',
      'Making-of',
      'Video Landingpages',
    ],
    aboutTopics: [
      'Portfolio',
      'Webentwicklung',
      'Fotografie',
      'Video',
      'Blog',
      'Videoinhalte',
      'YouTube',
    ],
  }),
  gallery: Object.freeze({
    discoveryText:
      'Die Galerie fokussiert auf visuelle Inhalte mit Bildmetadaten, Alt-Texten und strukturierter Bildzuordnung für die Suche.',
    schemaKeywords: ['Fotogalerie', 'Urban Photography', 'Portrait'],
    seoTopics: [
      'Bildgalerie',
      'Fotografie',
      'Portrait',
      'Street Photography',
      'Visuelle Serien',
    ],
    aboutTopics: [
      'Portfolio',
      'Webentwicklung',
      'Fotografie',
      'Video',
      'Blog',
      'Bildersuche',
      'Bildmetadaten',
      'Fotogalerie',
    ],
  }),
  projects: Object.freeze({
    discoveryText:
      'Die Projektseite zeigt interaktive Frontend-Projekte mit inhaltlichen Beschreibungen, Kategorien und weiterführenden Verweisen.',
    schemaKeywords: ['Code Projekte', 'Web Apps', 'Frontend Experimente'],
    seoTopics: [
      'Code Projekte',
      'Web Apps',
      'Frontend Experimente',
      'JavaScript Projekte',
      'Interaktive Demos',
    ],
    aboutTopics: [
      'Portfolio',
      'Webentwicklung',
      'Fotografie',
      'Video',
      'Blog',
      'JavaScript Projekte',
      'Interaktive Web Apps',
    ],
  }),
  about: Object.freeze({
    discoveryText:
      'Die Profilseite beschreibt Abdulkerim Sesli als Autor der Inhalte und verknüpft die wichtigsten Themen dieser Website.',
    schemaKeywords: ['Profil', 'Über Abdulkerim Sesli', 'Autor'],
    seoTopics: [
      'Über Abdulkerim Sesli',
      'Profil',
      'Technischer Hintergrund',
      'Themenfelder',
    ],
    aboutTopics: [
      'Portfolio',
      'Webentwicklung',
      'Fotografie',
      'Video',
      'Blog',
      'Autor',
      'Profil',
    ],
  }),
  generic: Object.freeze({
    discoveryText:
      'Diese Seite ist Teil des Portfolios von Abdulkerim Sesli und ergänzt den Gesamtzusammenhang aus Text, Bild und Video.',
    schemaKeywords: ['Portfolio', 'Webentwicklung', 'Fotografie'],
    seoTopics: ['Portfolio', 'Web', 'Foto', 'Video'],
    aboutTopics: ['Portfolio', 'Webentwicklung', 'Fotografie', 'Video', 'Blog'],
  }),
});

const BASE_SCHEMA_KEYWORDS = Object.freeze([
  'Abdulkerim Sesli',
  'Abdülkerim Sesli',
  'Abdul Sesli',
  'Portfolio',
  'Webentwicklung',
  'Fotografie',
  'Bilder',
  'Videos',
  'Google Bilder',
  'Google Videos',
  'KI Suche',
  'AI Integration',
  'Web Components',
  'Three.js',
  'JavaScript',
]);

const BASE_SEO_KEYWORDS = Object.freeze([
  'Abdulkerim Sesli',
  'Abdülkerim Sesli',
  'Abdul Sesli',
  'Portfolio',
  'Webentwicklung',
  'Fotografie',
  'Bilder',
  'Videos',
  'Blog',
  'Web Components',
  'Three.js',
  'JavaScript',
  'TypeScript',
  'AI Integration',
  'Performance Engineering',
  'Frontend',
  'UI',
  'SEO',
  'Google Bilder',
  'Google Videos',
  'KI Suche',
]);

const SCHEMA_TITLE_SPLIT_RE = /[\s|,–—:/]+/;
const SEO_TITLE_SPLIT_RE = /[\s,.;:/()[\]|!?-]+/;

export function detectSchemaPageType(pathname = '/') {
  const path = String(pathname || '/').toLowerCase();

  if (path === '/' || path === '' || path === '/index.html') return 'home';
  if (path.startsWith('/blog')) return 'blog';
  if (path.startsWith('/videos')) return 'videos';
  if (path.startsWith('/gallery')) return 'gallery';
  if (path.startsWith('/projekte')) return 'projects';
  if (path.startsWith('/about')) return 'about';
  return 'generic';
}

function getSchemaPageTypeConfig(pathname = '/') {
  const pageType = detectSchemaPageType(pathname);
  return SCHEMA_PAGE_TYPE_CONFIG[pageType] || SCHEMA_PAGE_TYPE_CONFIG.generic;
}

export function getSchemaSectionDiscoveryText(pathname = '/') {
  return getSchemaPageTypeConfig(pathname).discoveryText;
}

export function getSeoPageTopics(pathname = '/') {
  return [...getSchemaPageTypeConfig(pathname).seoTopics];
}

export function buildSchemaKeywordList(pageData, pathname = '/') {
  const config = getSchemaPageTypeConfig(pathname);
  const titleTokens = normalizeSchemaText(pageData?.title || '')
    .split(SCHEMA_TITLE_SPLIT_RE)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  return uniqueSchemaList([
    ...BASE_SCHEMA_KEYWORDS,
    ...config.schemaKeywords,
    ...titleTokens,
  ]).slice(0, 24);
}

export function buildSeoKeywordList(
  pageData,
  pathname = '/',
  extraKeywords = [],
) {
  const config = getSchemaPageTypeConfig(pathname);
  const titleTokens = normalizeSchemaText(pageData?.title || '')
    .split(SEO_TITLE_SPLIT_RE)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  return uniqueSchemaList([
    ...BASE_SEO_KEYWORDS,
    ...config.seoTopics,
    ...titleTokens,
    ...(Array.isArray(extraKeywords) ? extraKeywords : []),
  ]).slice(0, 40);
}

export function buildSeoAbstractText(pageData, pathname = '/') {
  const topics = getSeoPageTopics(pathname);
  return [
    pageData?.description || '',
    getSchemaSectionDiscoveryText(pathname),
    `Inhaltsschwerpunkte: ${topics.join(', ')}.`,
    'Diese Seite ist auf organische Suche für Bilder, Videos und redaktionelle Inhalte optimiert.',
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getSchemaAboutTopics(pathname = '/') {
  return uniqueSchemaList(getSchemaPageTypeConfig(pathname).aboutTopics).map(
    (name) => ({ '@type': 'Thing', name }),
  );
}

export function shouldIncludeSchemaSkillsList(pageUrl, baseUrl) {
  const normalizedBaseUrl = String(baseUrl || '').replace(/\/$/, '');
  const normalizedPageUrl = String(pageUrl || '').replace(/\/$/, '');

  return (
    normalizedPageUrl === normalizedBaseUrl ||
    normalizedPageUrl.endsWith('/about')
  );
}

export { SCHEMA_HOMEPAGE_DISCOVERY_TEXT };
