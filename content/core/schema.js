/**
 * Modern Schema.org Generator
 * @version 4.0.0 - Enhanced with FAQ, Skills, Image enrichment
 */

import { createLogger } from './logger.js';
import { ENV } from '../config/env.config.js';

const log = createLogger('Schema');

// Business FAQs for homepage
const BUSINESS_FAQS = [
  {
    q: 'Welche Dienstleistungen bietest du an?',
    a: 'Ich biete professionelle Webentwicklung (Frontend & Fullstack mit React/Node.js) sowie hochwertige Fotografie-Dienstleistungen (Portrait, Urban, Event) im Raum Berlin an.',
  },
  {
    q: 'Welchen Tech-Stack verwendest du?',
    a: 'Mein Fokus liegt auf modernen JavaScript-Frameworks wie React, Next.js und Vue. Für 3D-Visualisierungen im Web nutze ich Three.js und WebGL.',
  },
  {
    q: 'Bist du für Freelance-Projekte verfügbar?',
    a: 'Ja, ich bin offen für spannende Projektanfragen und Kooperationen. Kontaktieren Sie mich gerne direkt über meine Webseite oder LinkedIn.',
  },
];

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
    logo: createImageObject(brandData.logo, brandData.name, currentYear),
    email: brandData.email,
    sameAs: brandData.sameAs,
    contactPoint: brandData.contactPoint,
    telephone: brandData.telephone,
    address: brandData.address,
    geo: brandData.geo,
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
    image: {
      '@type': 'ImageObject',
      '@id': `${ENV.BASE_URL}/#personImage`,
      url: 'https://commons.wikimedia.org/wiki/File:Abdulkerim_Sesli_portrait_2025.png',
      caption: brandData.name,
      license: `${ENV.BASE_URL}/#image-license`,
      acquireLicensePage: `${ENV.BASE_URL}/#image-license`,
      creditText: `Photo: ${brandData.name}`,
      copyrightNotice: `© ${currentYear} ${brandData.name}`,
    },
    description: pageData.description,
    disambiguatingDescription:
      "Webentwickler (React, Three.js) und Fotograf aus Berlin, nicht zu verwechseln mit 'Sesli Kitap' oder Hörbuch-Verlagen.",
    sameAs: brandData.sameAs,
    homeLocation: {
      '@type': 'Place',
      name: 'Berlin',
      address: brandData.address,
      geo: brandData.geo,
    },
    knowsAbout: getKnowsAbout(),
  };

  // Enrich Person node with interaction statistics
  enrichPersonNode(personNode, brandData, doc);

  graph.push(personNode);

  // WebPage with content extraction
  const aiReadyText = extractPageContent(doc);
  const webPageNode = {
    '@type': pageData.type || 'WebPage',
    '@id': ID.webpage,
    url: pageUrl,
    name: pageData.title,
    description: pageData.description,
    text: aiReadyText,
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
    name: 'Abdulkerim Sesli Portfolio',
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
  if (pageData.image) {
    const imageNode = generateImageObject(
      pageUrl,
      pageData,
      brandData,
      currentYear,
    );
    graph.push(imageNode);
    webPageNode.primaryImageOfPage = { '@id': imageNode['@id'] };
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
function createImageObject(url, name, currentYear) {
  return {
    '@type': 'ImageObject',
    url,
    width: 512,
    height: 512,
    creator: { '@type': 'Person', name },
    license: `${ENV.BASE_URL}/#image-license`,
    acquireLicensePage: `${ENV.BASE_URL}/#image-license`,
    creditText: `Logo: ${name}`,
    copyrightNotice: `© ${currentYear} ${name}`,
  };
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
    {
      '@type': 'Place',
      name: 'Berlin',
      sameAs: 'https://www.wikidata.org/wiki/Q64',
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
function generateImageObject(pageUrl, pageData, brandData, currentYear) {
  return {
    '@type': 'ImageObject',
    '@id': `${pageUrl}#primaryImage`,
    contentUrl: pageData.image,
    url: pageData.image,
    caption: pageData.title || pageData.description || '',
    creator: { '@type': 'Person', name: brandData.name },
    license: `${ENV.BASE_URL}/#image-license`,
    creditText: pageData.imageCredit || `Photo: ${brandData.name}`,
    copyrightNotice: `© ${currentYear} ${brandData.name}`,
    acquireLicensePage: `${ENV.BASE_URL}/#image-license`,
  };
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
