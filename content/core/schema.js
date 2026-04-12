/**
 * Modern Schema.org Generator
 * @version 4.1.0 - Enhanced with image/video enrichment and neutral entity profile
 */

import {
  extractMainHeadingTexts,
  extractMainImageAltTexts,
  extractMainVideoTitles,
} from './content-extractors.js';
import { createLogger } from './logger.js';
import { scheduleIdleTask } from './async-utils.js';
import { ENV } from '../config/env.config.js';
import {
  SITE_PERSON_DISAMBIGUATING_DESCRIPTION,
  SITE_WEBSITE_ALT_NAME,
  SITE_WEBSITE_DESCRIPTION,
  SITE_OWNER_NAME,
} from '../config/site-seo.js';
import {
  DEFAULT_IMAGE_DIMENSIONS,
  PERSON_FALLBACK_ICON,
  buildImageObject,
  collectDomImageObjects,
  collectDomVideoObjects,
  inferImageDimensions,
  toAbsoluteUrl,
} from './schema-media.js';
import {
  SCHEMA_HOMEPAGE_DISCOVERY_TEXT,
  buildSchemaKeywordList,
  getSchemaAboutTopics,
  getSchemaSectionDiscoveryText,
  shouldIncludeSchemaSkillsList,
} from './schema-page-types.js';
import {
  normalizeSchemaText as normalizeText,
  uniqueSchemaList as uniqueList,
} from './text-utils.js';

const log = createLogger('Schema');
const CRAWLER_UA_PATTERN =
  /googlebot|google-inspectiontool|bingbot|slurp|duckduckbot|baiduspider|yandex|facebookexternalhit|twitterbot|linkedinbot|applebot|semrushbot|ahrefsbot/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getNodeIdentity(value) {
  if (!isPlainObject(value)) return `json:${JSON.stringify(value)}`;

  const id = normalizeText(value['@id']);
  if (id) return `id:${id}`;

  const url = normalizeText(value.url || value.contentUrl || value.embedUrl);
  if (url) return `url:${url}`;

  const type = normalizeText(value['@type']);
  const name = normalizeText(value.name);
  if (type && name) return `type-name:${type}:${name}`;

  return `json:${JSON.stringify(value)}`;
}

function mergeSchemaNodes(baseNode, incomingNode) {
  const merged = { ...baseNode };

  for (const [key, value] of Object.entries(incomingNode || {})) {
    if (value == null || value === '') continue;

    if (!(key in merged) || merged[key] == null || merged[key] === '') {
      merged[key] = value;
      continue;
    }

    const current = merged[key];
    if (Array.isArray(current) && Array.isArray(value)) {
      const seen = new Set();
      const next = [];
      for (const item of [...current, ...value]) {
        const identity = getNodeIdentity(item);
        if (seen.has(identity)) continue;
        seen.add(identity);
        next.push(item);
      }
      merged[key] = next;
      continue;
    }

    if (isPlainObject(current) && isPlainObject(value)) {
      const currentId = normalizeText(current['@id']);
      const valueId = normalizeText(value['@id']);
      if (!currentId || !valueId || currentId === valueId) {
        merged[key] = mergeSchemaNodes(current, value);
      }
    }
  }

  return merged;
}

function dedupeNodeRefList(refs) {
  const seen = new Set();
  const result = [];

  for (const ref of refs || []) {
    if (!isPlainObject(ref)) continue;
    const id = normalizeText(ref['@id']);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({ '@id': id });
  }

  return result;
}

function dedupeSchemaGraph(nodes) {
  const orderedIds = [];
  const byId = new Map();
  const noIdNodes = [];
  const noIdSeen = new Set();

  for (const node of nodes || []) {
    if (!isPlainObject(node)) continue;

    const id = normalizeText(node['@id']);
    if (id) {
      if (!byId.has(id)) {
        byId.set(id, node);
        orderedIds.push(id);
      } else {
        byId.set(id, mergeSchemaNodes(byId.get(id), node));
      }
      continue;
    }

    const identity = getNodeIdentity(node);
    if (noIdSeen.has(identity)) continue;
    noIdSeen.add(identity);
    noIdNodes.push(node);
  }

  return [...orderedIds.map((id) => byId.get(id)), ...noIdNodes];
}

function extractSchemaNodesFromScript(script) {
  if (!script?.textContent) return [];

  try {
    const payload = JSON.parse(script.textContent);
    if (Array.isArray(payload?.['@graph'])) {
      return payload['@graph'].filter(isPlainObject);
    }
    if (isPlainObject(payload)) return [payload];
  } catch {
    // Ignore malformed inline payload
  }

  return [];
}

/**
 * Generate Schema.org @graph
 * @param {import('./types.js').PageData} pageData
 * @param {string} pageUrl
 * @param {import('./types.js').BrandData} brandData
 * @param {Object} [options={}] - Additional options
 * @param {Document} [options.doc] - Document object (for DOM queries)
 * @param {boolean} [options.forceProdCanonical] - Force production canonical
 * @returns {import('./types.js').SchemaNode[]}
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
    disambiguatingDescription: SITE_PERSON_DISAMBIGUATING_DESCRIPTION,
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
  const sectionDiscoveryText = getSchemaSectionDiscoveryText(currentPathname);
  const isHomepage = currentPathname === '/' || currentPathname === '';
  const pageKeywords = buildSchemaKeywordList(pageData, currentPathname);
  const longDescription = normalizeText(
    [
      pageData.description,
      sectionDiscoveryText,
      isHomepage ? SCHEMA_HOMEPAGE_DISCOVERY_TEXT : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
  const fullText = normalizeText(
    [
      aiReadyText,
      sectionDiscoveryText,
      isHomepage ? SCHEMA_HOMEPAGE_DISCOVERY_TEXT : '',
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
    about: getSchemaAboutTopics(currentPathname),
    mentions: pageKeywords
      .slice(0, 10)
      .map((keyword) => ({ '@type': 'Thing', name: keyword })),
    isPartOf: { '@id': ID.website },
    mainEntity: { '@id': ID.person },
    publisher: { '@id': ID.org },
    inLanguage: 'de-DE',
    dateModified:
      doc.querySelector('meta[name="dateModified"]')?.getAttribute('content') ||
      doc
        .querySelector('meta[property="article:modified_time"]')
        ?.getAttribute('content') ||
      doc.querySelector('meta[name="dateCreated"]')?.getAttribute('content') ||
      now.toISOString(),
  };

  // Try to add dateCreated
  enrichWebPageNode(webPageNode, doc);

  graph.push(webPageNode);

  // WebSite
  graph.push({
    '@type': 'WebSite',
    '@id': ID.website,
    url: ENV.BASE_URL,
    name: SITE_OWNER_NAME,
    alternateName: SITE_WEBSITE_ALT_NAME,
    description: SITE_WEBSITE_DESCRIPTION,
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
  if (shouldIncludeSchemaSkillsList(pageUrl, ENV.BASE_URL)) {
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
    webPageNode.hasPart = dedupeNodeRefList(hasPartRefs);
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

  const deduped = dedupeSchemaGraph(graph);
  if (deduped.length !== graph.length) {
    log.debug(
      `Schema graph deduplicated: ${graph.length} -> ${deduped.length}`,
    );
  }

  return deduped;
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
    id: toAbsoluteUrl(url, canonicalOrigin),
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
        .map((i) => i.getAttribute('src'))
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

    const clone = /** @type {HTMLElement} */ (contentNode.cloneNode(true));
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

    const imageAltTexts = uniqueList(extractMainImageAltTexts(doc));
    const videoTitles = uniqueList(extractMainVideoTitles(doc));

    if (imageAltTexts.length > 0) {
      text += ` Bilder: ${imageAltTexts.slice(0, 12).join(' | ')}.`;
    }

    if (videoTitles.length > 0) {
      text += ` Videos: ${videoTitles.slice(0, 10).join(' | ')}.`;
    }

    const headingTexts = uniqueList(extractMainHeadingTexts(doc));
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

  return faqNodes;
}

/**
 * Inject schema into document
 * @param {import('./types.js').SchemaNode[]} graph
 * @param {Object} options
 * @param {Document} [options.doc=document]
 * @param {string} [options.scriptId='schema-ldjson']
 */
export function injectSchema(graph, options = {}) {
  const { doc = document, scriptId = 'schema-ldjson' } = options;
  if (!doc?.head || !Array.isArray(graph) || graph.length === 0) return;

  try {
    const edgeScript = doc.getElementById('edge-route-schema');
    const edgeNodes = extractSchemaNodesFromScript(edgeScript);
    const finalGraph = dedupeSchemaGraph([
      ...(edgeNodes || []),
      ...(graph || []),
    ]);

    let script = /** @type {HTMLScriptElement} */ (
      doc.getElementById(scriptId)
    );

    const payload = JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@graph': finalGraph,
      },
      null,
      2,
    );

    if (script) {
      script.textContent = payload;
    } else {
      script = /** @type {HTMLScriptElement} */ (doc.createElement('script'));
      script.type = 'application/ld+json';
      script.id = scriptId;
      script.textContent = payload;
      document.head.appendChild(script);
    }

    if (edgeScript && edgeScript.id !== scriptId) {
      edgeScript.remove();
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
  const run = () => {
    try {
      callback();
    } catch (error) {
      log.error('Scheduled schema injection failed:', error);
    }
  };

  const userAgent = globalThis.navigator?.userAgent || '';
  if (CRAWLER_UA_PATTERN.test(userAgent)) {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(run);
    } else {
      Promise.resolve().then(run);
    }
    return;
  }

  scheduleIdleTask(run, {
    timeout: 600,
    fallbackDelay: 150,
  });
}
