/**
 * Modern Schema.org Generator
 * @version 4.1.0 - Enhanced with image/video enrichment and neutral entity profile
 */

import { createLogger } from './logger.js';
import { ENV } from '../config/env.config.js';
import { iconUrl } from '../config/constants.js';

const log = createLogger('Schema');

// Business FAQs for homepage
const BUSINESS_FAQS = [
  {
    q: 'Welche Themen deckt diese Website ab?',
    a: 'Der Fokus liegt auf Webentwicklung, Performance, JavaScript, TypeScript, React, Three.js sowie visuellen Inhalten aus Fotografie und Video.',
  },
  {
    q: 'Was finde ich auf der Startseite?',
    a: 'Die Startseite verknüpft die wichtigsten Bereiche: Projekte, Blog, Galerie, Videos und Hintergrundinformationen.',
  },
  {
    q: 'Sind Bilder und Videos strukturiert auffindbar?',
    a: 'Ja. Die Website verwendet strukturierte Daten für Bild- und Videoinhalte sowie eigene Sitemaps für die Google-Indexierung.',
  },
  {
    q: 'Ist diese Website von Abdülkerim Bardakcı oder Sesli Kitap?',
    a: 'Nein. Diese Website gehört zu Abdulkerim Sesli und zeigt ausschließlich eigene Inhalte zu Webentwicklung, Fotografie und Videos.',
  },
];

const HOMEPAGE_DISCOVERY_TEXT =
  'Die Startseite bündelt Portfolio, Bildgalerie, Videoinhalte, Blogartikel und technische Schwerpunkte in einem zentralen Einstiegspunkt. Suchmaschinen und KI-Suchen erhalten dadurch einen klaren Überblick über Bilder, Videos und redaktionelle Inhalte auf dieser Domain.';

const SECTION_DISCOVERY_TEXT = {
  home: 'Diese Hauptseite verweist auf alle zentralen Inhaltsbereiche: Blog, Galerie, Videos, Projekte und Profilinformationen.',
  blog: 'Der Blog enthält ausführliche Artikel mit technischen Erklärungen, strukturierten Überschriften, Bildern und ergänzenden Medien.',
  videos:
    'Die Videoseite bündelt Video-Landingpages und eingebettete Inhalte mit beschreibenden Titeln und Vorschaubildern.',
  gallery:
    'Die Galerie fokussiert auf visuelle Inhalte mit Bildmetadaten, Alt-Texten und strukturierter Bildzuordnung für die Suche.',
  projects:
    'Die Projektseite zeigt interaktive Frontend-Projekte mit inhaltlichen Beschreibungen, Kategorien und weiterführenden Verweisen.',
  about:
    'Die Profilseite beschreibt Abdulkerim Sesli als Autor der Inhalte und verknüpft die wichtigsten Themen dieser Website.',
  generic:
    'Diese Seite ist Teil des Portfolios von Abdulkerim Sesli und ergänzt den Gesamtzusammenhang aus Text, Bild und Video.',
};

const DEFAULT_IMAGE_DIMENSIONS = {
  width: 1200,
  height: 630,
};

const KNOWN_IMAGE_DIMENSIONS = {
  'favicon-512.webp': { width: 512, height: 512 },
  'og-home-800.png': { width: 800, height: 420 },
  'og-projekte-800.png': { width: 800, height: 420 },
  'og-videos-800.png': { width: 800, height: 420 },
  'og-design-800.png': { width: 800, height: 420 },
  'og-photography-800.png': { width: 800, height: 420 },
  'og-threejs-800.png': { width: 800, height: 420 },
  'og-react-800.png': { width: 800, height: 420 },
  'og-pwa-800.png': { width: 800, height: 420 },
  'og-seo-800.png': { width: 800, height: 420 },
  'og-performance-800.png': { width: 800, height: 420 },
  'og-webcomponents-800.png': { width: 800, height: 420 },
  'og-css-800.png': { width: 800, height: 420 },
  'og-typescript-800.png': { width: 800, height: 420 },
};
const PERSON_FALLBACK_ICON = iconUrl('favicon-512.webp');

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAbsoluteUrl(url, base = ENV.BASE_URL) {
  if (!url) return '';
  try {
    return new URL(url, base).toString();
  } catch {
    return String(url);
  }
}

function getFilename(url) {
  try {
    const parsed = new URL(toAbsoluteUrl(url));
    return parsed.pathname.split('/').pop() || '';
  } catch {
    return '';
  }
}

function inferImageMimeType(url) {
  const filename = getFilename(url).toLowerCase();
  if (filename.endsWith('.svg')) return 'image/svg+xml';
  if (filename.endsWith('.webp')) return 'image/webp';
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg'))
    return 'image/jpeg';
  if (filename.endsWith('.gif')) return 'image/gif';
  if (filename.endsWith('.avif')) return 'image/avif';
  return null;
}

function inferImageDimensions(url, fallback = null) {
  const filename = getFilename(url);
  if (filename && KNOWN_IMAGE_DIMENSIONS[filename]) {
    return KNOWN_IMAGE_DIMENSIONS[filename];
  }
  return fallback;
}

function toInt(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function uniqueList(values) {
  const result = [];
  const seen = new Set();

  for (const raw of values || []) {
    const value = normalizeText(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}

function buildKeywordList(pageData, pathname = '/') {
  const baseKeywords = [
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
    'React',
    'Three.js',
    'JavaScript',
  ];

  const path = String(pathname || '/').toLowerCase();
  const sectionKeywords = [];

  if (path === '/' || path === '') {
    sectionKeywords.push(
      'Hauptseite',
      'Bildgalerie',
      'Video-Portfolio',
      'Tech Blog',
    );
  } else if (path.startsWith('/blog')) {
    sectionKeywords.push(
      'Blog',
      'Tutorials',
      'SEO',
      'Performance',
      'TypeScript',
    );
  } else if (path.startsWith('/videos')) {
    sectionKeywords.push('Video', 'YouTube', 'Behind the Scenes');
  } else if (path.startsWith('/gallery')) {
    sectionKeywords.push('Fotogalerie', 'Urban Photography', 'Portrait');
  } else if (path.startsWith('/projekte')) {
    sectionKeywords.push('Code Projekte', 'Web Apps', 'Frontend Experimente');
  }

  const titleTokens = normalizeText(pageData?.title || '')
    .split(/[\s|,–—:/]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  return uniqueList([
    ...baseKeywords,
    ...sectionKeywords,
    ...titleTokens,
  ]).slice(0, 24);
}

function getSectionDiscoveryText(pathname = '/') {
  const path = String(pathname || '/').toLowerCase();

  if (path === '/' || path === '') return SECTION_DISCOVERY_TEXT.home;
  if (path.startsWith('/blog')) return SECTION_DISCOVERY_TEXT.blog;
  if (path.startsWith('/videos')) return SECTION_DISCOVERY_TEXT.videos;
  if (path.startsWith('/gallery')) return SECTION_DISCOVERY_TEXT.gallery;
  if (path.startsWith('/projekte')) return SECTION_DISCOVERY_TEXT.projects;
  if (path.startsWith('/about')) return SECTION_DISCOVERY_TEXT.about;

  return SECTION_DISCOVERY_TEXT.generic;
}

function getAboutTopics(pathname = '/') {
  const path = String(pathname || '/').toLowerCase();
  const topics = ['Portfolio', 'Webentwicklung', 'Fotografie', 'Video', 'Blog'];

  if (path.startsWith('/blog'))
    topics.push('Technik Artikel', 'SEO', 'Performance');
  if (path.startsWith('/videos')) topics.push('Videoinhalte', 'YouTube');
  if (path.startsWith('/gallery'))
    topics.push('Bildersuche', 'Bildmetadaten', 'Fotogalerie');
  if (path.startsWith('/projekte'))
    topics.push('JavaScript Projekte', 'Interaktive Web Apps');

  return uniqueList(topics).map((name) => ({ '@type': 'Thing', name }));
}

function extractYouTubeId(url) {
  try {
    const parsed = new URL(toAbsoluteUrl(url));
    const host = parsed.hostname.toLowerCase();

    if (host === 'youtu.be') {
      return parsed.pathname.replace(/^\/+/, '').split('/')[0] || null;
    }

    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/')[2] || null;
      }
      return parsed.searchParams.get('v');
    }
  } catch {
    // Ignore invalid URLs
  }

  return null;
}

function collectDomVideoObjects({
  doc,
  pageUrl,
  pageData,
  brandData,
  canonicalOrigin,
}) {
  const nodes = [];
  const seen = new Set();

  const iframeVideos = Array.from(
    doc?.querySelectorAll?.('main iframe[src]') || [],
  )
    .filter((iframe) => {
      const src = iframe.getAttribute('src') || iframe.src || '';
      return /youtube\.com|youtube-nocookie\.com|youtu\.be/i.test(src);
    })
    .slice(0, 8);

  for (const iframe of iframeVideos) {
    const src = iframe.getAttribute('src') || iframe.src || '';
    const absoluteEmbed = toAbsoluteUrl(src, canonicalOrigin);
    if (!absoluteEmbed || seen.has(absoluteEmbed)) continue;
    seen.add(absoluteEmbed);

    const youtubeId = extractYouTubeId(absoluteEmbed);
    const canonicalVideoUrl = youtubeId
      ? `https://www.youtube.com/watch?v=${youtubeId}`
      : absoluteEmbed;

    const name = normalizeText(
      iframe.getAttribute('title') ||
        iframe.getAttribute('aria-label') ||
        `${pageData?.title || 'Video'} ${nodes.length + 1}`,
    );

    const videoNode = {
      '@type': 'VideoObject',
      '@id': `${pageUrl}#video-${nodes.length + 1}`,
      name,
      description: normalizeText(pageData?.description || name),
      url: canonicalVideoUrl,
      embedUrl: absoluteEmbed,
      inLanguage: 'de-DE',
      isFamilyFriendly: true,
      publisher: {
        '@type': 'Organization',
        name: brandData.legalName || brandData.name,
        url: ENV.BASE_URL,
      },
    };

    if (youtubeId) {
      videoNode.thumbnailUrl = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
      videoNode.contentUrl = canonicalVideoUrl;
    }

    nodes.push(videoNode);
  }

  const htmlVideos = Array.from(
    doc?.querySelectorAll?.('main video') || [],
  ).slice(0, 8);

  for (const video of htmlVideos) {
    const directSrc =
      video.getAttribute('src') ||
      video.querySelector?.('source[src]')?.getAttribute?.('src') ||
      '';
    if (!directSrc) continue;

    const absoluteSrc = toAbsoluteUrl(directSrc, canonicalOrigin);
    if (!absoluteSrc || seen.has(absoluteSrc)) continue;
    seen.add(absoluteSrc);

    const name = normalizeText(
      video.getAttribute('title') ||
        video.getAttribute('aria-label') ||
        video.getAttribute('data-title') ||
        `${pageData?.title || 'Video'} ${nodes.length + 1}`,
    );

    const videoNode = {
      '@type': 'VideoObject',
      '@id': `${pageUrl}#video-${nodes.length + 1}`,
      name,
      description: normalizeText(pageData?.description || name),
      url: absoluteSrc,
      contentUrl: absoluteSrc,
      inLanguage: 'de-DE',
      isFamilyFriendly: true,
      publisher: {
        '@type': 'Organization',
        name: brandData.legalName || brandData.name,
        url: ENV.BASE_URL,
      },
    };

    const poster = video.getAttribute('poster');
    if (poster) {
      videoNode.thumbnailUrl = toAbsoluteUrl(poster, canonicalOrigin);
    }

    nodes.push(videoNode);
  }

  return nodes;
}

function buildImageObject({
  id,
  imageUrl,
  name,
  caption,
  creatorName,
  currentYear,
  dimensions,
  creditPrefix = 'Photo: ',
  creditText = '',
  representativeOfPage = false,
}) {
  const absoluteUrl = toAbsoluteUrl(imageUrl);
  const encodingFormat = inferImageMimeType(absoluteUrl);

  const imageNode = {
    '@type': 'ImageObject',
    ...(id ? { '@id': id } : {}),
    contentUrl: absoluteUrl,
    url: absoluteUrl,
    name: normalizeText(name || caption || ''),
    caption: normalizeText(caption || name || ''),
    creator: { '@type': 'Person', name: creatorName },
    license: `${ENV.BASE_URL}/#image-license`,
    creditText: normalizeText(creditText || `${creditPrefix}${creatorName}`),
    copyrightNotice: `© ${currentYear} ${creatorName}`,
    acquireLicensePage: `${ENV.BASE_URL}/#image-license`,
  };

  if (encodingFormat) imageNode.encodingFormat = encodingFormat;

  const finalDimensions = dimensions || inferImageDimensions(absoluteUrl);
  if (finalDimensions?.width) imageNode.width = finalDimensions.width;
  if (finalDimensions?.height) imageNode.height = finalDimensions.height;
  if (representativeOfPage) imageNode.representativeOfPage = true;

  return imageNode;
}

function collectDomImageObjects({
  doc,
  pageUrl,
  brandData,
  currentYear,
  canonicalOrigin,
}) {
  const nodes = [];
  const seen = new Set();
  const images = Array.from(doc?.querySelectorAll?.('main img[src]') || []);

  for (const img of images) {
    if (nodes.length >= 12) break;

    const src = img.getAttribute('src') || img.src;
    if (!src) continue;

    const absolute = toAbsoluteUrl(src, canonicalOrigin);
    if (!absolute || seen.has(absolute)) continue;
    seen.add(absolute);

    const id = `${pageUrl}#image-${nodes.length + 1}`;
    const alt = normalizeText(img.getAttribute('alt') || '');
    const width = toInt(img.getAttribute('width'));
    const height = toInt(img.getAttribute('height'));

    nodes.push(
      buildImageObject({
        id,
        imageUrl: absolute,
        name: alt || pageUrl,
        caption: alt || pageUrl,
        creatorName: brandData.name,
        currentYear,
        dimensions:
          width && height
            ? {
                width,
                height,
              }
            : undefined,
        creditPrefix: brandData.creditPrefix || 'Photo: ',
      }),
    );
  }

  return nodes;
}

/**
 * Generate Schema.org @graph
 * @param {PageData} pageData
 * @param {string} pageUrl
 * @param {BrandData} brandData
 * @param {Object} options - Additional options
 * @param {Document} options.doc - Document object (for DOM queries)
 * @param {boolean} options.forceProdCanonical - Force production canonical
 * @returns {SchemaNode[]}
 */
export function generateSchemaGraph(
  pageData,
  pageUrl,
  brandData,
  options = {},
) {
  const { doc = document, forceProdCanonical = false } = options;

  // ✅ Create Date object once at the beginning
  const now = new Date();
  const currentYear = now.getFullYear();

  // Use canonical origin (prod or runtime origin)
  const canonicalOrigin =
    forceProdCanonical ||
    doc?.documentElement?.dataset?.forceProdCanonical === 'true'
      ? ENV.BASE_URL
      : globalThis.location?.origin || ENV.BASE_URL;

  const ID = {
    person: `${canonicalOrigin}/#person`,
    org: `${canonicalOrigin}/#organization`,
    website: `${canonicalOrigin}/#website`,
    webpage: `${pageUrl}#webpage`,
    breadcrumb: `${pageUrl}#breadcrumb`,
  };

  const graph = [];

  // Organization
  graph.push({
    '@type': 'Organization',
    '@id': ID.org,
    name: brandData.legalName,
    url: ENV.BASE_URL,
    logo: createImageObject(
      brandData.logo,
      brandData.name,
      currentYear,
      canonicalOrigin,
    ),
    sameAs: brandData.sameAs,
    founder: { '@id': ID.person },
  });

  // Person
  const personNode = {
    '@type': ['Person', 'Photographer'],
    '@id': ID.person,
    name: brandData.name,
    alternateName: brandData.alternateName,
    jobTitle: brandData.jobTitle,
    worksFor: { '@id': ID.org },
    url: ENV.BASE_URL,
    identifier: ID.person,
    logo: brandData.logo,
    image: brandData.image || {
      '@type': 'ImageObject',
      '@id': `${ENV.BASE_URL}/#personImage`,
      contentUrl: PERSON_FALLBACK_ICON,
      url: PERSON_FALLBACK_ICON,
      width: 512,
      height: 512,
      creator: { '@type': 'Person', name: brandData.name },
      caption: brandData.name,
      license: `${ENV.BASE_URL}/#image-license`,
      acquireLicensePage: `${ENV.BASE_URL}/#image-license`,
      creditText: `Photo: ${brandData.name}`,
      copyrightNotice: `© ${currentYear} ${brandData.name}`,
    },
    description: pageData.description,
    disambiguatingDescription:
      'Persönliche Website von Abdulkerim Sesli (auch bekannt als Abdul Sesli, Webentwickler und Fotograf); nicht identisch mit dem Fußballspieler Abdülkerim Bardakcı und nicht mit Sesli-Kitap-Portalen.',
    sameAs: brandData.sameAs,
    knowsLanguage: brandData.knowsLanguage?.map((lang) => ({
      '@type': 'Language',
      name: lang.name,
      alternateName: lang.alternateName,
    })),
    knowsAbout: getKnowsAbout(),
  };

  // Enrich Person node with interaction statistics
  enrichPersonNode(personNode, brandData, doc);

  graph.push(personNode);

  // WebPage with content extraction
  const aiReadyText = extractPageContent(doc);
  const currentPathname = globalThis.location?.pathname || '/';
  const sectionDiscoveryText = getSectionDiscoveryText(currentPathname);
  const isHomepage = currentPathname === '/' || currentPathname === '';
  const pageKeywords = buildKeywordList(pageData, currentPathname);
  const longDescription = normalizeText(
    [
      pageData.description,
      sectionDiscoveryText,
      isHomepage ? HOMEPAGE_DISCOVERY_TEXT : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
  const fullText = normalizeText(
    [
      aiReadyText,
      sectionDiscoveryText,
      isHomepage ? HOMEPAGE_DISCOVERY_TEXT : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  const webPageNode = {
    '@type': pageData.type || 'WebPage',
    '@id': ID.webpage,
    url: pageUrl,
    name: pageData.title,
    description: longDescription || pageData.description,
    keywords: pageKeywords.join(', '),
    text: fullText,
    abstract: sectionDiscoveryText,
    about: getAboutTopics(currentPathname),
    mentions: pageKeywords
      .slice(0, 10)
      .map((keyword) => ({ '@type': 'Thing', name: keyword })),
    isPartOf: { '@id': ID.website },
    mainEntity: { '@id': ID.person },
    publisher: { '@id': ID.org },
    inLanguage: 'de-DE',
    dateModified: now.toISOString(),
  };

  // Try to add dateCreated
  enrichWebPageNode(webPageNode, doc);

  graph.push(webPageNode);

  // WebSite
  graph.push({
    '@type': 'WebSite',
    '@id': ID.website,
    url: ENV.BASE_URL,
    name: 'Abdulkerim Sesli',
    alternateName: 'Abdulkerim Sesli Portfolio',
    description:
      'Portfolio-Website mit technischen Artikeln, Bildern, Videos und Projektinhalten von Abdulkerim Sesli.',
    keywords: pageKeywords.join(', '),
    inLanguage: 'de-DE',
    publisher: { '@id': ID.org },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${ENV.BASE_URL}/?s={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  });

  // Skills ItemList (for homepage and about page)
  if (
    pageUrl.includes('/about') ||
    pageUrl === ENV.BASE_URL ||
    pageUrl === `${ENV.BASE_URL}/`
  ) {
    graph.push(generateSkillsList(ENV.BASE_URL));
  }

  // Image enrichment
  let primaryImageUrl = null;
  const hasPartRefs = [];
  if (pageData.image) {
    const imageNode = generateImageObject(
      pageUrl,
      pageData,
      brandData,
      currentYear,
      canonicalOrigin,
    );
    primaryImageUrl = imageNode.url || imageNode.contentUrl || null;
    graph.push(imageNode);
    webPageNode.primaryImageOfPage = { '@id': imageNode['@id'] };
    if (primaryImageUrl) {
      webPageNode.image = primaryImageUrl;
    }
    if (imageNode['@id']) {
      hasPartRefs.push({ '@id': imageNode['@id'] });
    }
  }

  const domImageNodes = collectDomImageObjects({
    doc,
    pageUrl,
    brandData,
    currentYear,
    canonicalOrigin,
  });
  if (domImageNodes.length > 0) {
    const filteredDomNodes = domImageNodes.filter((node) => {
      const domUrl = node.url || node.contentUrl;
      return domUrl && domUrl !== primaryImageUrl;
    });

    if (filteredDomNodes.length > 0) {
      graph.push(...filteredDomNodes);
      for (const imageNode of filteredDomNodes) {
        if (imageNode['@id']) hasPartRefs.push({ '@id': imageNode['@id'] });
      }
    }

    const imageUrls = [
      ...(webPageNode.image ? [webPageNode.image] : []),
      ...filteredDomNodes
        .map((node) => node.url || node.contentUrl)
        .filter(Boolean),
    ];

    if (imageUrls.length > 0) {
      webPageNode.image = [...new Set(imageUrls)];
    }
  }

  const domVideoNodes = collectDomVideoObjects({
    doc,
    pageUrl,
    pageData,
    brandData,
    canonicalOrigin,
  });
  if (domVideoNodes.length > 0) {
    graph.push(...domVideoNodes);
    webPageNode.video = domVideoNodes.map((node) => ({ '@id': node['@id'] }));
    for (const videoNode of domVideoNodes) {
      if (videoNode['@id']) hasPartRefs.push({ '@id': videoNode['@id'] });
    }
  }

  if (hasPartRefs.length > 0) {
    webPageNode.hasPart = hasPartRefs;
  }

  // FAQ handling
  const faqNodes = extractFAQs(pageUrl, pageData, doc);
  if (faqNodes.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      name: pageData?.title
        ? `${pageData.title} — FAQ`
        : 'Häufig gestellte Fragen',
      mainEntity: faqNodes,
      isPartOf: { '@id': ID.webpage },
    });
  }

  // Breadcrumbs
  graph.push(generateBreadcrumbs(pageUrl, pageData.title, canonicalOrigin));

  return graph;
}

/**
 * Create ImageObject for schema
 * @param {string} url
 * @param {string} name
 * @returns {Object}
 */
function createImageObject(
  url,
  name,
  currentYear,
  canonicalOrigin = ENV.BASE_URL,
) {
  return buildImageObject({
    imageUrl: toAbsoluteUrl(url, canonicalOrigin),
    name: `${name} Logo`,
    caption: `${name} Logo`,
    creatorName: name,
    currentYear,
    dimensions: { width: 512, height: 512 },
    creditPrefix: 'Logo: ',
  });
}

/**
 * Get knowsAbout array
 * @returns {Object[]}
 */
function getKnowsAbout() {
  return [
    {
      '@type': 'Thing',
      name: 'Web Development',
      sameAs: 'https://www.wikidata.org/wiki/Q386275',
    },
    {
      '@type': 'Thing',
      name: 'React',
      sameAs: 'https://www.wikidata.org/wiki/Q19399674',
    },
    {
      '@type': 'Thing',
      name: 'Three.js',
      sameAs: 'https://www.wikidata.org/wiki/Q28135934',
    },
    {
      '@type': 'Thing',
      name: 'JavaScript',
      sameAs: 'https://www.wikidata.org/wiki/Q28865',
    },
    {
      '@type': 'Thing',
      name: 'Photography',
      sameAs: 'https://www.wikidata.org/wiki/Q11633',
    },
  ];
}

/**
 * Generate breadcrumb list
 * @param {string} pageUrl
 * @param {string} pageTitle
 * @param {string} canonicalOrigin
 * @returns {Object}
 */
function generateBreadcrumbs(pageUrl, pageTitle, canonicalOrigin) {
  const segments = (globalThis.location?.pathname || '/')
    .replace(/\/$/, '')
    .split('/')
    .filter(Boolean);

  const crumbs = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: { '@id': canonicalOrigin || ENV.BASE_URL, name: 'Home' },
    },
  ];

  let pathAcc = canonicalOrigin || ENV.BASE_URL;
  segments.forEach((seg, i) => {
    pathAcc += `/${seg}`;
    const name = seg.charAt(0).toUpperCase() + seg.slice(1);
    crumbs.push({
      '@type': 'ListItem',
      position: i + 2,
      name,
      item: { '@id': pathAcc, name },
    });
  });

  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    name: pageTitle || 'Navigationspfad',
    itemListElement: crumbs,
  };
}

/**
 * Enrich Person node with interaction statistics
 * @param {Object} personNode
 * @param {Object} brandData
 * @param {Document} doc
 */
function enrichPersonNode(personNode, brandData, doc) {
  try {
    // Multiple profile images (up to 3)
    try {
      const imgs = Array.from(
        doc?.querySelectorAll?.('main img, .profile-photo, .avatar') || [],
      )
        .map((i) => i.src)
        .filter(Boolean);
      if (imgs.length > 1) {
        personNode.image = imgs.slice(0, 3);
      }
    } catch {
      // Ignore
    }

    // Agent interaction statistic (posts/articles)
    try {
      const postsCount = Number(brandData.postsCount) || 0;
      const articlesCount = doc?.querySelectorAll?.('article')?.length || 0;
      const writeCount = postsCount > 0 ? postsCount : articlesCount;
      if (writeCount > 0) {
        personNode.agentInteractionStatistic = {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/WriteAction',
          userInteractionCount: writeCount,
        };
      }
    } catch {
      // Ignore
    }

    // Followers and likes
    try {
      const findCount = (selectors) => {
        for (const s of selectors) {
          const el = doc?.querySelector?.(s);
          if (!el) continue;
          const attr =
            el.dataset?.followers ||
            el.dataset?.followersCount ||
            el.dataset?.likes ||
            el.dataset?.likesCount;
          if (attr) return Number(String(attr).replace(/\D/g, '')) || 0;
          const text = String(el.textContent || '').replace(/\D/g, '');
          if (text) return Number(text) || 0;
        }
        return 0;
      };

      const brandFollowers = Number(brandData.followersCount) || 0;
      const followers =
        brandFollowers > 0
          ? brandFollowers
          : findCount([
              '[data-followers]',
              '[data-followers-count]',
              '.followers-count',
              '.follower-count',
            ]);

      if (followers > 0) {
        personNode.interactionStatistic = personNode.interactionStatistic || [];
        personNode.interactionStatistic.push({
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/FollowAction',
          userInteractionCount: followers,
        });
      }

      const brandLikes = Number(brandData.likesCount) || 0;
      const likes =
        brandLikes > 0
          ? brandLikes
          : findCount([
              '[data-likes]',
              '[data-likes-count]',
              '.likes-count',
              '.like-count',
            ]);

      if (likes > 0) {
        personNode.interactionStatistic = personNode.interactionStatistic || [];
        personNode.interactionStatistic.push({
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/LikeAction',
          userInteractionCount: likes,
        });
      }
    } catch {
      // Ignore
    }
  } catch {
    // Ignore all enrichment errors
  }
}

/**
 * Enrich WebPage node with dateCreated
 * @param {Object} webPageNode
 * @param {Document} doc
 */
function enrichWebPageNode(webPageNode, doc) {
  try {
    const metaPub =
      doc?.head?.querySelector?.(
        'meta[property="article:published_time"], meta[name="dateCreated"], meta[property="og:published_time"]',
      ) || null;
    const timeEl =
      doc?.querySelector?.(
        'time[datetime][pubdate], time[datetime][itemprop="dateCreated"], time[datetime][data-created]',
      ) || null;
    const created =
      metaPub?.getAttribute?.('content') ||
      timeEl?.getAttribute?.('datetime') ||
      null;
    if (created) {
      try {
        webPageNode.dateCreated = new Date(created).toISOString();
      } catch {
        webPageNode.dateCreated = created;
      }
    }
  } catch {
    // Ignore
  }
}

/**
 * Extract page content for AI/search engines
 * @param {Document} doc
 * @returns {string}
 */
function extractPageContent(doc) {
  try {
    const contentNode =
      doc?.querySelector?.('main') ||
      doc?.querySelector?.('article') ||
      doc?.body;
    if (!contentNode) return '';

    const clone = contentNode.cloneNode(true);
    const noiseSelectors = [
      'nav',
      'footer',
      'script',
      'style',
      'noscript',
      'iframe',
      '.cookie-banner',
      '.no-ai',
      '[aria-hidden="true"]',
    ];
    noiseSelectors.forEach((sel) =>
      clone.querySelectorAll?.(sel).forEach((el) => el.remove()),
    );

    let text = clone.textContent || '';
    text = text.replace(/\s+/g, ' ').trim();

    const imageAltTexts = uniqueList(
      Array.from(doc?.querySelectorAll?.('main img[alt]') || [])
        .map((img) => img.getAttribute('alt'))
        .filter(Boolean),
    );

    const videoTitles = uniqueList(
      Array.from(
        doc?.querySelectorAll?.(
          'main iframe[title], main video[title], main video[aria-label]',
        ) || [],
      )
        .map(
          (node) =>
            node.getAttribute('title') || node.getAttribute('aria-label'),
        )
        .filter(Boolean),
    );

    if (imageAltTexts.length > 0) {
      text += ` Bilder: ${imageAltTexts.slice(0, 12).join(' | ')}.`;
    }

    if (videoTitles.length > 0) {
      text += ` Videos: ${videoTitles.slice(0, 10).join(' | ')}.`;
    }

    const headingTexts = uniqueList(
      Array.from(doc?.querySelectorAll?.('main h1, main h2, main h3') || [])
        .map((node) => node.textContent)
        .filter(Boolean),
    );
    if (headingTexts.length > 0) {
      text += ` Themen: ${headingTexts.slice(0, 12).join(' | ')}.`;
    }

    return text.length > 5000 ? text.substring(0, 5000) + '...' : text;
  } catch {
    return '';
  }
}

/**
 * Generate Skills ItemList
 * @param {string} baseUrl
 * @returns {Object}
 */
function generateSkillsList(baseUrl) {
  return {
    '@type': 'ItemList',
    '@id': `${baseUrl}/#skills`,
    name: 'Technische Skills & Kompetenzen',
    description:
      'Kernkompetenzen in der Fullstack-Webentwicklung und Fotografie',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'React & Next.js Ecosystem' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Three.js & WebGL 3D-Visualisierung',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Node.js & Backend Architecture',
      },
      { '@type': 'ListItem', position: 4, name: 'UI/UX Design & Animation' },
      {
        '@type': 'ListItem',
        position: 5,
        name: 'Urban & Portrait Photography',
      },
    ],
  };
}

/**
 * Generate ImageObject for primary image
 * @param {string} pageUrl
 * @param {Object} pageData
 * @param {Object} brandData
 * @returns {Object}
 */
function generateImageObject(
  pageUrl,
  pageData,
  brandData,
  currentYear,
  canonicalOrigin = ENV.BASE_URL,
) {
  const absoluteImage = toAbsoluteUrl(pageData.image, canonicalOrigin);
  const dimensions = inferImageDimensions(
    absoluteImage,
    DEFAULT_IMAGE_DIMENSIONS,
  );

  return buildImageObject({
    id: `${pageUrl}#primaryImage`,
    imageUrl: absoluteImage,
    name: pageData.title || pageData.description || '',
    caption: pageData.title || pageData.description || '',
    creatorName: brandData.name,
    currentYear,
    dimensions,
    creditPrefix: brandData.creditPrefix || 'Photo: ',
    creditText: pageData.imageCredit || '',
    representativeOfPage: true,
  });
}

/**
 * Extract FAQs from page
 * @param {string} pageUrl
 * @param {Object} pageData
 * @param {Document} doc
 * @returns {Array}
 */
function extractFAQs(pageUrl, pageData, doc) {
  // Try to extract from DOM
  const faqNodes = Array.from(doc?.querySelectorAll?.('.faq-item') || [])
    .map((el, i) => {
      const rawQ = el.querySelector?.('.question, h3, summary')?.textContent;
      const rawA = el.querySelector?.('.answer, p, div')?.textContent;
      const q = rawQ ? String(rawQ).replace(/\s+/g, ' ').trim() : '';
      const a = rawA ? String(rawA).replace(/\s+/g, ' ').trim() : '';
      if (!q || q.length < 2) return null;
      return {
        '@type': 'Question',
        '@id': `${pageUrl}#faq-q${i + 1}`,
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a || 'Details ansehen' },
      };
    })
    .filter(Boolean);

  if (faqNodes.length > 0) return faqNodes;

  // Fallback to business FAQs for homepage
  const isHomepage =
    globalThis.location?.pathname === '/' ||
    globalThis.location?.pathname === '';
  const hasBusinessFaqFlag = !!doc?.querySelector?.(
    '[data-inject-business-faq]',
  );

  if (isHomepage || hasBusinessFaqFlag) {
    return BUSINESS_FAQS.map((item, i) => ({
      '@type': 'Question',
      '@id': `${pageUrl}#faq-q${i + 1}`,
      name: String(item.q).replace(/\s+/g, ' ').trim(),
      acceptedAnswer: {
        '@type': 'Answer',
        text: String(item.a).replace(/\s+/g, ' ').trim(),
      },
    }));
  }

  return [];
}

/**
 * Inject schema into document
 * @param {SchemaNode[]} graph
 * @param {string} scriptId - ID for the script tag
 */
export function injectSchema(graph, scriptId = 'schema-ldjson') {
  if (!document?.head) return;

  try {
    let script = document.getElementById(scriptId);

    const payload = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    });

    if (script) {
      script.textContent = payload;
    } else {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = scriptId;
      script.textContent = payload;
      document.head.appendChild(script);
    }

    log.debug('Schema injected successfully');
  } catch (error) {
    log.error('Failed to inject schema:', error);
  }
}

/**
 * Schedule schema injection
 * @param {Function} callback
 */
export function scheduleSchemaInjection(callback) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback, { timeout: 1500 });
  } else {
    setTimeout(callback, 1200);
  }
}
