/**
 * Dynamic Head Loader - Ultimate Modern SEO & Schema Graph (@graph approach)
 * Version: 2025.3.4 (Identity Disambiguation & Abdul Berlin)
 * * Features:
 * - [GELB] Icon Fix: Re-Integration von 'Organization' für Logo-Support
 * - [ROT] Snippet Fill: Maximierte Descriptions & Knowledge-Injection
 * - [BLAU] FAQ Booster: Strict Mode + Whitespace Cleaner (gegen "Unbenanntes Element")
 * - [GRÜN] Geo Update: Explizite GeoCoordinates & HomeLocation
 * - [LILA] Identity Fix: Disambiguating Description & Alternate Names (Abdul Berlin)
 */

import { createLogger } from '../../utils/shared-utilities.js';

const log = createLogger('HeadLoader');

// Static configuration data
const BASE_URL = 'https://abdulkerimsesli.de';

const BRAND_DATA = {
  name: 'Abdulkerim Sesli',
  legalName: 'Abdulkerim Sesli',
  alternateName: ['Abdul Sesli', 'Abdul Berlin', 'Abdulkerim Berlin'],
  logo: `${BASE_URL}/content/assets/img/icons/favicon-512.png`,
  jobTitle: ['Web Developer', 'Photographer'],
  email: 'kontakt@abdulkerimsesli.de',
  areaServed: 'Berlin, Deutschland',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Sterkrader Str. 59',
    addressLocality: 'Berlin',
    postalCode: '13507',
    addressCountry: 'DE',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: '52.5733',
    longitude: '13.2911',
  },
  sameAs: [
    'https://github.com/aKs030',
    'https://linkedin.com/in/abdulkerimsesli',
    'https://twitter.com/abdulkerimsesli',
    'https://x.com/kRm_030',
    'https://www.instagram.com/abdulkerimsesli',
    'https://www.youtube.com/@aks.030',
    'https://www.behance.net/abdulkerimsesli',
    'https://dribbble.com/abdulkerimsesli',
  ],
  openingHours: ['Mo-Fr 09:00-18:00'],
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'kontakt@abdulkerimsesli.de',
      url: `${BASE_URL}/#kontakt`,
    },
  ],
  telephone: '+49-30-12345678',
  paymentAccepted: 'Invoice',
  currenciesAccepted: 'EUR',

  // Optional social statistics (set server-side for accuracy)
  // - followersCount: total followers on primary platform
  // - likesCount: aggregate likes where meaningful
  // - postsCount: number of authored posts or contributions (used for WriteAction)
  followersCount: 5400, // example value: total followers across platforms
  likesCount: 12000, // example aggregated likes
  postsCount: 234, // example authored posts count
};

const ROUTES = {
  default: {
    title: 'Abdulkerim Sesli | Webentwicklung & Fotografie Berlin | Abdul Berlin',
    description:
      'Offizielles Portfolio von Abdulkerim Sesli (Abdul Berlin). Webentwickler (React, Three.js) und Fotograf aus Berlin. Nicht zu verwechseln mit Hörbuch-Verlagen.',
    title_en: 'Abdulkerim Sesli — Web Developer & Photographer in Berlin',
    description_en:
      'Abdulkerim Sesli — Web Developer & Photographer in Berlin. Specialist in React, Three.js and urban photography. Portfolio, references & contact.',
    type: 'ProfilePage',
    image: `${BASE_URL}/content/assets/img/og/og-home.png`,
    // Modern LCP image: keep PNG for social-card/OG but use AVIF for site delivery/preload
    imageAvif: `${BASE_URL}/content/assets/img/og/og-home.avif`,
  },
  '/projekte/': {
    title: 'Referenzen & Code-Projekte | Abdulkerim Sesli',
    description:
      'Entdecke interaktive Web-Experimente aus Berlin (13507). Spezialisiert auf performante React-Lösungen, 3D-Web (Three.js) und modernes UI/UX Design.',
    title_en: 'References & Code Projects | Abdulkerim Sesli',
    description_en:
      'Explore interactive web experiments and business apps. Specialist in performant React solutions, 3D web (Three.js) and modern UI/UX.',
    type: 'CollectionPage',
    image: `${BASE_URL}/content/assets/img/og/og-projects.png`,
  },
  '/blog/': {
    title: 'Tech-Blog & Tutorials | Webentwicklung Berlin',
    description:
      'Expertenwissen zu JavaScript, CSS und Web-Architektur. Praxisnahe Tutorials und Einblicke in den Workflow eines Berliner Fullstack-Entwicklers.',
    title_en: 'Tech Blog & Tutorials | Web Development Berlin',
    description_en:
      'Practical articles on JavaScript, CSS and web architecture. Hands-on tutorials and insights from a Berlin-based developer.',
    type: 'Blog',
    image: `${BASE_URL}/content/assets/img/og/og-blog.png`,
  },
  '/videos/': {
    title: 'Videos — Abdulkerim Sesli',
    description: 'Eine Auswahl meiner Arbeiten, kurzen Vorstellungen und Behind-the-Scenes.',
    title_en: 'Videos — Abdulkerim Sesli',
    description_en: 'A selection of my work, brief presentations and behind-the-scenes.',
    type: 'CollectionPage',
    // NOTE: currently uses og-home.png as a fallback.
    image: `${BASE_URL}/content/assets/img/og/og-home.png`,
  },
  '/gallery/': {
    title: 'Fotografie Portfolio | Urban & Portrait Berlin',
    description:
      'Visuelle Ästhetik aus der Hauptstadt. Kuratierte Galerie mit Fokus auf Street Photography, Architektur und atmosphärische Portraits aus Berlin und Umgebung.',
    title_en: 'Photography Portfolio | Urban & Portraits Berlin',
    description_en:
      'Visual aesthetics from the capital. Curated gallery focused on street photography, architecture and atmospheric portraits from Berlin.',
    type: 'ImageGallery',
    image: `${BASE_URL}/content/assets/img/og/og-gallery.png`,
  },
  '/about/': {
    title: 'Kontakt & Profil | Abdulkerim Sesli',
    description:
      'Der Mensch hinter dem Code. Detaillierter Lebenslauf, Tech-Stack Übersicht und direkte Kontaktmöglichkeiten für Projektanfragen und Kooperationen.',
    type: 'AboutPage',
    image: `${BASE_URL}/content/assets/img/og/og-about.png`,
  },
};

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

// Extracted helper: generate schema graph for a given page context. Returns an array of graph nodes.
export function generateSchemaGraph(
  pageData,
  pageUrl,
  BASE_URL,
  BRAND_DATA,
  BUSINESS_FAQS,
  doc = typeof document === 'undefined' ? null : document
) {
  // Use canonical origin (prod or runtime origin) so JSON-LD stays consistent in local/dev
  const canonicalOrigin =
    doc?.documentElement?.dataset?.forceProdCanonical === 'true'
      ? BASE_URL
      : globalThis.location.origin;

  const ID = {
    person: `${canonicalOrigin}/#person`,
    org: `${canonicalOrigin}/#organization`,
    website: `${canonicalOrigin}/#website`,
    webpage: `${pageUrl}#webpage`,
    breadcrumb: `${pageUrl}#breadcrumb`,
  };

  const graph = [];

  graph.push(
    {
      '@type': 'Organization',
      '@id': ID.org,
      name: BRAND_DATA.legalName,
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: BRAND_DATA.logo,
        width: 512,
        height: 512,
        creator: { '@type': 'Person', name: BRAND_DATA.name },
        license: `${BASE_URL}/#image-license`,
        creditText: `Logo: ${BRAND_DATA.name}`,
        copyrightNotice: `© ${new Date().getFullYear()} ${BRAND_DATA.name}`,
        acquireLicensePage: `${BASE_URL}/#image-license`,
      },
      image: {
        '@type': 'ImageObject',
        url: pageData?.image || BRAND_DATA.logo,
        contentUrl: pageData?.image || BRAND_DATA.logo,
        width: 1200,
        height: 630,
        creator: { '@type': 'Person', name: BRAND_DATA.name },
        license: `${BASE_URL}/#image-license`,
        creditText: pageData.imageCredit || `Photo: ${BRAND_DATA.name}`,
        copyrightNotice: `© ${new Date().getFullYear()} ${BRAND_DATA.name}`,
        acquireLicensePage: `${BASE_URL}/#image-license`,
      },

      email: BRAND_DATA.email,
      sameAs: BRAND_DATA.sameAs,
      contactPoint: BRAND_DATA.contactPoint,
      telephone: BRAND_DATA.telephone,
      address: BRAND_DATA.address || {
        '@type': 'PostalAddress',
        addressLocality: 'Berlin',
        addressCountry: 'DE',
      },
      geo: BRAND_DATA.geo,
      founder: { '@id': ID.person },
    },
    {
      '@type': ['Person', 'Photographer'],
      '@id': ID.person,
      name: BRAND_DATA.name,
      alternateName: BRAND_DATA.alternateName,
      jobTitle: BRAND_DATA.jobTitle,
      worksFor: { '@id': ID.org },
      url: BASE_URL,
      image: {
        '@type': 'ImageObject',
        '@id': `${BASE_URL}/#personImage`,
        url: 'https://commons.wikimedia.org/wiki/File:Abdulkerim_Sesli_portrait_2025.png',
        caption: BRAND_DATA.name,
      },
      description: pageData.description,
      disambiguatingDescription:
        "Webentwickler (React, Three.js) und Fotograf aus Berlin, nicht zu verwechseln mit 'Sesli Kitap' oder Hörbuch-Verlagen.",
      sameAs: BRAND_DATA.sameAs,
      homeLocation: {
        '@type': 'Place',
        name: 'Berlin',
        address: BRAND_DATA.address,
        geo: BRAND_DATA.geo,
      },
      knowsAbout: [
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
        { '@type': 'Thing', name: 'Urban Photography' },
        {
          '@type': 'Place',
          name: 'Berlin',
          sameAs: 'https://www.wikidata.org/wiki/Q64',
        },
      ],
    }
  );

  // Enrich Person node for ProfilePage (identifier, images, interaction stats) ✅
  try {
    const personNode = graph.find((g) => g['@id'] === ID.person);
    if (personNode) {
      // Ensure a stable identifier (use the person fragment URL)
      if (!personNode.identifier) personNode.identifier = ID.person;

      // If multiple profile images exist on the page, include up to 3 images (recommended by Google)
      try {
        const imgs = Array.from(doc.querySelectorAll('main img, .profile-photo, .avatar') || [])
          .map((i) => i.src)
          .filter(Boolean);
        if (imgs.length > 1) {
          personNode.image = imgs.slice(0, 3);
        }
      } catch (e) {}

      // Agent interaction statistic: prefer server-side postsCount, fallback to counting <article> elements
      try {
        const postsCount = Number(BRAND_DATA.postsCount) || 0;
        const articlesCount = doc?.querySelectorAll?.('article')?.length || 0;
        const writeCount = postsCount > 0 ? postsCount : articlesCount;
        if (writeCount > 0) {
          personNode.agentInteractionStatistic = {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/WriteAction',
            userInteractionCount: writeCount,
          };
        }
      } catch (e) {}

      // Interaction statistics (followers / likes) — prefer server-side BRAND_DATA values and fallback to DOM
      try {
        const findCount = (selectors) => {
          for (const s of selectors) {
            const el = doc.querySelector(s);
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

        const brandFollowers = Number(BRAND_DATA.followersCount) || 0;
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

        const brandLikes = Number(BRAND_DATA.likesCount) || 0;
        const likes =
          brandLikes > 0
            ? brandLikes
            : findCount(['[data-likes]', '[data-likes-count]', '.likes-count', '.like-count']);
        if (likes > 0) {
          personNode.interactionStatistic = personNode.interactionStatistic || [];
          personNode.interactionStatistic.push({
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/LikeAction',
            userInteractionCount: likes,
          });
        }
      } catch (e) {}
    }
  } catch (e) {}

  // Skills/ItemList
  if (pageUrl.includes('/about') || pageUrl === BASE_URL || pageUrl === `${BASE_URL}/`) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${BASE_URL}/#skills`,
      name: 'Technische Skills & Kompetenzen',
      description: 'Kernkompetenzen in der Fullstack-Webentwicklung und Fotografie',
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
    });
  }

  // Extract page content safely
  const extractPageContent = () => {
    try {
      const contentNode =
        document.querySelector('main') || document.querySelector('article') || document.body;
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
      noiseSelectors.forEach((sel) => clone.querySelectorAll(sel).forEach((el) => el.remove()));
      let text = clone.innerText || clone.textContent || '';
      text = text.replaceAll(/\s+/g, ' ').trim();
      return text.length > 5000 ? text.substring(0, 5000) + '...' : text;
    } catch {
      return '';
    }
  };

  const aiReadyText = extractPageContent();

  // Webpage + Website
  graph.push(
    {
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
      dateModified: new Date().toISOString(),
    },
    {
      '@type': 'WebSite',
      '@id': ID.website,
      url: BASE_URL,
      name: 'Abdulkerim Sesli Portfolio',
      publisher: { '@id': ID.org },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${BASE_URL}/?s={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    }
  );

  // Try to add dateCreated to the WebPage if the page provides a published time (meta or time element)
  try {
    const pageNode = graph.find((g) => g['@id'] === ID.webpage);
    if (pageNode) {
      const metaPub =
        doc?.head?.querySelector(
          'meta[property="article:published_time"], meta[name="dateCreated"], meta[property="og:published_time"]'
        ) || null;
      const timeEl =
        doc?.querySelector(
          'time[datetime][pubdate], time[datetime][itemprop="dateCreated"], time[datetime][data-created]'
        ) || null;
      const created = metaPub?.getAttribute('content') || timeEl?.getAttribute('datetime') || null;
      if (created) {
        try {
          pageNode.dateCreated = new Date(created).toISOString();
        } catch (e) {
          pageNode.dateCreated = created;
        }
      }
    }
  } catch (e) {}

  // ImageObject enrichment for richer image results (helps Image Pack / Image Carousel)
  try {
    if (pageData.image) {
      const imageId = `${pageUrl}#primaryImage`;
      const imageNode = {
        '@type': 'ImageObject',
        '@id': imageId,
        contentUrl: pageData.image,
        url: pageData.image,
        caption: pageData.title || pageData.description || '',
        creator: { '@type': 'Person', name: BRAND_DATA.name },
        license: `${BASE_URL}/#image-license`,
        creditText: pageData.imageCredit || `Photo: ${BRAND_DATA.name}`,
        copyrightNotice: `© ${new Date().getFullYear()} ${BRAND_DATA.name}`,
        acquireLicensePage: `${BASE_URL}/#image-license`,
      };
      graph.push(imageNode);
      const webpageNode = graph.find((g) => g['@id'] === ID.webpage);
      if (webpageNode) {
        webpageNode.primaryImageOfPage = { '@id': imageId };
      }
    }
  } catch (e) {
    log?.warn?.('head-complete: image enrichment failed', e);
  }

  // FAQ handling
  const faqNodes = Array.from(doc?.querySelectorAll?.('.faq-item') || [])
    .map((el, i) => {
      const rawQ = el.querySelector('.question, h3, summary')?.textContent;
      const rawA = el.querySelector('.answer, p, div')?.textContent;
      const q = rawQ ? String(rawQ).replaceAll(/\s+/g, ' ').trim() : '';
      const a = rawA ? String(rawA).replaceAll(/\s+/g, ' ').trim() : '';
      if (!q || q.length < 2) return null;
      return {
        '@type': 'Question',
        '@id': `${pageUrl}#faq-q${i + 1}`,
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a || 'Details ansehen' },
      };
    })
    .filter(Boolean);

  let faqEntities = faqNodes;
  if (faqEntities.length === 0) {
    const isHomepage = globalThis.location.pathname === '/' || globalThis.location.pathname === '';
    const hasBusinessFaqFlag = !!(doc?.querySelector?.('[data-inject-business-faq]') || false);
    if (isHomepage || hasBusinessFaqFlag) {
      const fallbackFaqNodes = BUSINESS_FAQS.map((item, i) => ({
        '@type': 'Question',
        '@id': `${pageUrl}#faq-q${i + 1}`,
        name: String(item.q).replaceAll(/\s+/g, ' ').trim(),
        acceptedAnswer: {
          '@type': 'Answer',
          text: String(item.a).replaceAll(/\s+/g, ' ').trim(),
        },
      }));
      faqEntities = fallbackFaqNodes;
    }
  }

  if (faqEntities.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      name: pageData?.title ? `${pageData.title} — FAQ` : 'Häufig gestellte Fragen',
      mainEntity: faqEntities,
      isPartOf: { '@id': ID.webpage },
    });
  }
  // Breadcrumbs
  const segments = globalThis.location.pathname.replace(/\/$/, '').split('/').filter(Boolean);
  const crumbs = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: { '@id': BASE_URL, name: 'Home' },
    },
  ];
  let pathAcc = canonicalOrigin;
  segments.forEach((seg, i) => {
    pathAcc += `/${seg}`;
    const name = seg.charAt(0).toUpperCase() + seg.slice(1);
    crumbs.push({
      '@type': 'ListItem',
      position: i + 2,
      name: name,
      item: { '@id': pathAcc, name: name },
    });
  });
  graph.push({
    '@type': 'BreadcrumbList',
    '@id': ID.breadcrumb,
    name: pageData?.title || document.title || 'Navigationspfad',
    itemListElement: crumbs,
  });

  return graph;
}

// Extracted helper: compute canonical href & effective canonical depending on host/context.
// Designed to be testable in Node by allowing optional location overrides.
export function computeEffectiveCanonical(
  forceProdFlag,
  hostname,
  cleanPath,
  pageUrl,
  BASE_URL,
  locationPath = globalThis.location?.pathname || '',
  locationOrigin = globalThis.location?.origin || ''
) {
  // Determine canonicalHref and effectiveCanonical.
  // Removed host-based PROD_HOSTS detection per request — only `forceProdFlag`
  // (explicit) controls whether production canonical is used.
  const canonicalHref = forceProdFlag ? `${BASE_URL}${cleanPath}` : pageUrl;

  const isDirtyPath = /^\/pages\//i.exec(locationPath) || /\/index\.html$/i.exec(locationPath);

  let effectiveCanonical;
  if (forceProdFlag) {
    effectiveCanonical = `${BASE_URL}${cleanPath}`;
  } else if (isDirtyPath) {
    effectiveCanonical = `${locationOrigin}${cleanPath}`;
  } else {
    effectiveCanonical = canonicalHref;
  }

  return { canonicalHref, effectiveCanonical };
}

// Build canonical links helper (pure)
export function buildCanonicalLinks(
  forceProdFlag,
  hostname,
  cleanPath,
  pageUrl,
  BASE_URL,
  locationPath = globalThis.location?.pathname || '',
  locationOrigin = globalThis.location?.origin || ''
) {
  const { canonicalHref, effectiveCanonical } = computeEffectiveCanonical(
    forceProdFlag,
    hostname,
    cleanPath,
    pageUrl,
    BASE_URL,
    locationPath,
    locationOrigin
  );

  const canonicalOrigin = forceProdFlag ? BASE_URL : locationOrigin;
  const alternates = [
    { lang: 'de', href: `${canonicalOrigin}${cleanPath}` },
    { lang: 'x-default', href: `${canonicalOrigin}${cleanPath}` },
  ];

  return { canonicalHref, effectiveCanonical, alternates, canonicalOrigin };
}

export function buildPwaAssets(BASE_URL, BRAND_DATA) {
  const links = [
    { rel: 'manifest', href: '/manifest.json' },
    {
      rel: 'mask-icon',
      href: `${BASE_URL}/content/assets/img/icons/safari-pinned-tab.svg`,
      color: '#0d0d0d',
    },
  ];
  const iconLinks = [
    {
      rel: 'icon',
      sizes: '16x16',
      href: `${BASE_URL}/content/assets/img/icons/favicon-16.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '32x32',
      href: `${BASE_URL}/content/assets/img/icons/favicon-32.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '48x48',
      href: `${BASE_URL}/content/assets/img/icons/favicon-48.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '64x64',
      href: `${BASE_URL}/content/assets/img/icons/favicon-64.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '128x128',
      href: `${BASE_URL}/content/assets/img/icons/favicon-128.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '192x192',
      href: `${BASE_URL}/content/assets/img/icons/favicon-192.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '256x256',
      href: `${BASE_URL}/content/assets/img/icons/favicon-256.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '512x512',
      href: `${BASE_URL}/content/assets/img/icons/favicon-512.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: 'any',
      href: `${BASE_URL}/content/assets/img/icons/favicon.svg`,
      type: 'image/svg+xml',
    },
    {
      rel: 'shortcut icon',
      href: `${BASE_URL}/content/assets/img/icons/favicon.ico`,
    },
    {
      rel: 'apple-touch-icon',
      sizes: '180x180',
      href: `${BASE_URL}/content/assets/img/icons/apple-touch-icon.png`,
    },
  ];
  const metas = [
    { name: 'theme-color', content: '#0d0d0d' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: BRAND_DATA.name },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
  ];
  return { links, iconLinks, metas };
}

export function buildPageMeta(pageData, pageUrl, locationPath) {
  return {
    page_title: pageData.title || document.title || '',
    page_path: locationPath || '/',
    page_url: pageUrl,
    page_type: pageData.type || 'WebPage',
    page_image: pageData.image || '',
    page_lang: 'de-DE',
  };
}

export function upsertMeta(
  nameOrProperty,
  content,
  isProperty = false,
  doc = typeof document === 'undefined' ? null : document
) {
  if (!doc?.head || !content) return;
  const selector = isProperty
    ? `meta[property="${nameOrProperty}"]`
    : `meta[name="${nameOrProperty}"]`;
  let el = doc?.head?.querySelector(selector);
  if (el) {
    el.setAttribute(isProperty ? 'property' : 'name', nameOrProperty);
    el.setAttribute('content', content);
  } else {
    el = doc.createElement('meta');
    el.setAttribute(isProperty ? 'property' : 'name', nameOrProperty);
    el.setAttribute('content', content);
    doc.head.appendChild(el);
  }
}

export function upsertLink(rel, href, doc = typeof document === 'undefined' ? null : document) {
  if (!doc?.head || !href) return;
  let el = doc?.head?.querySelector(`link[rel="${rel}"]`);
  if (el) {
    el.setAttribute('href', href);
  } else {
    el = doc.createElement('link');
    el.setAttribute('rel', rel);
    el.setAttribute('href', href);
    doc.head.appendChild(el);
  }
}

export function applyCanonicalLinks(
  doc = typeof document === 'undefined' ? null : document,
  alternates = [],
  effectiveCanonical = ''
) {
  if (!doc?.head) return;

  // Upsert canonical
  const canonicalEl = doc.head.querySelector('link[rel="canonical"]');
  if (canonicalEl) {
    if (typeof canonicalEl.setAttribute === 'function')
      canonicalEl.setAttribute('href', effectiveCanonical);
    else canonicalEl.href = effectiveCanonical;
  } else {
    const el = doc.createElement('link');
    el.setAttribute('rel', 'canonical');
    el.setAttribute('href', effectiveCanonical);
    doc.head.appendChild(el);
  }

  // Upsert alternates
  alternates.forEach(({ lang, href }) => {
    if (!href) return;
    const selector = `link[rel="alternate"][hreflang="${lang}"]`;
    let el = doc.head.querySelector(selector);
    if (el) {
      if (typeof el.setAttribute === 'function') el.setAttribute('href', href);
      else el.href = href;
    } else {
      el = doc.createElement('link');
      el.setAttribute('rel', 'alternate');
      el.setAttribute('hreflang', lang);
      el.setAttribute('href', href);
      doc.head.appendChild(el);
    }
  });
}

// Schedule schema injection using requestIdleCallback when available, otherwise fallback to setTimeout.
export function scheduleSchemaInjection(callback, idleTimeout = 1500, fallbackDelay = 1200) {
  if (typeof globalThis.requestIdleCallback === 'function') {
    try {
      return globalThis.requestIdleCallback(callback, { timeout: idleTimeout });
    } catch {
      return globalThis.setTimeout(callback, fallbackDelay);
    }
  }

  return globalThis.setTimeout(callback, fallbackDelay);
}

// Top-level injector: insert LD+JSON for given page context (testable)
export function injectSchema(
  pageDataLocal,
  pageUrlLocal,
  BASE_URL_LOCAL,
  BRAND_DATA_LOCAL,
  BUSINESS_FAQS_LOCAL,
  doc = typeof document === 'undefined' ? null : document
) {
  if (!doc?.head) return;
  try {
    const graph = generateSchemaGraph(
      pageDataLocal,
      pageUrlLocal,
      BASE_URL_LOCAL,
      BRAND_DATA_LOCAL,
      BUSINESS_FAQS_LOCAL,
      doc
    );
    const ldId = 'head-complete-ldjson';
    let script = doc.getElementById(ldId);
    const payload = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    });
    if (script) script.textContent = payload;
    else {
      script = doc.createElement('script');
      script.type = 'application/ld+json';
      script.id = ldId;
      script.textContent = payload;
      doc.head.appendChild(script);
    }
  } catch (err) {
    log?.warn?.('head-complete: injectSchema failed', err);
  }
}

async function loadSharedHead() {
  // Skip all DOM mutations when running in non-browser environments (e.g. Node imports during CI/tests)
  if (document === undefined || globalThis.location === undefined) {
    log?.info?.('head-complete: running in non-browser environment; skipping loadSharedHead');
    return;
  }

  if (globalThis.SHARED_HEAD_LOADED) return;

  // Wait for head-inline.js to complete critical setup (prevents race conditions)
  if (!globalThis.__HEAD_INLINE_READY) {
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (globalThis.__HEAD_INLINE_READY) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
      // Safety timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        log?.warn?.('head-complete: timeout waiting for head-inline, proceeding anyway');
        resolve();
      }, 5000);
    });
  }

  // --- 1. GLOBALE DATEN & KONFIGURATION ---

  // B. INHALTS-STEUERUNG (Snippet Text Füllung)
  // [ROT] Hier füllen wir den Text-Bereich maximal auf (~160 Zeichen + Keywords)

  // Pfad-Logik
  const currentPath = globalThis.location.pathname.toLowerCase();
  const matchedKey = Object.keys(ROUTES).find(
    (key) => key !== 'default' && currentPath.includes(key)
  );
  const rawPageData = matchedKey ? ROUTES[matchedKey] : ROUTES.default;
  const pageUrl = globalThis.location.href.split('#')[0];

  // --- i18n: Choose localized title/description when available ---
  const preferredLang = (
    document?.documentElement?.lang ||
    globalThis.navigator?.language ||
    'de'
  ).toLowerCase();
  const isEnglish = preferredLang.startsWith('en');
  const pageData = {
    ...rawPageData,
    title: isEnglish && rawPageData.title_en ? rawPageData.title_en : rawPageData.title,
    description:
      isEnglish && rawPageData.description_en
        ? rawPageData.description_en
        : rawPageData.description,
  };

  // --- Push stable page metadata to dataLayer for GTM (no PII) ---
  try {
    globalThis.dataLayer = globalThis.dataLayer || [];
    const page_meta = buildPageMeta(pageData, pageUrl, globalThis.location.pathname || '/');

    // push a named event so GTM can use it as trigger (and to avoid premature reads)
    globalThis.dataLayer.push({ event: 'pageMetadataReady', page_meta });
  } catch (e) {
    log?.warn?.('head-complete: pushing page metadata failed', e);
  }

  // --- 2. HTML HEAD UPDATES (lightweight, no heavy DOM replacement) ---
  try {
    await import('../../utils/shared-utilities.js');

    // NOTE: host-based automatic production detection removed — prefer explicit
    // opt-in via `data-force-prod-canonical="true"` when production canonical is required.

    // computeEffectiveCanonical has been moved to a top-level, exported helper (`computeEffectiveCanonical`).
    // Use: computeEffectiveCanonical(forceProdFlag, hostname, cleanPath, pageUrl, BASE_URL)

    // applyCanonicalLinks helper is defined at module scope; see top-level export.

    // canonical helpers live as exported functions at module scope: use `buildCanonicalLinks(...)`

    // Use exported helpers `upsertMeta` and `upsertLink` (defined at module scope) to mutate the document head.
    // These helpers are pure DOM mutators and are testable via unit tests.

    // Title: only override if we have a non-empty title
    if (pageData.title?.trim()) document.title = pageData.title;

    // Meta descriptions and core tags
    upsertMeta('description', pageData.description);
    upsertMeta('robots', 'index, follow, max-image-preview:large');
    // Ensure a mobile viewport is declared for all pages (fixes webhint / audit warnings)
    upsertMeta('viewport', 'width=device-width, initial-scale=1');
    upsertMeta('language', 'de-DE');
    upsertMeta('author', 'Abdulkerim Sesli');
    upsertMeta('twitter:card', 'summary_large_image');
    upsertMeta('twitter:creator', '@abdulkerimsesli');

    // Geo Tags for Local SEO (Berlin 13507)
    upsertMeta('geo.region', 'DE-BE');
    upsertMeta('geo.placename', 'Berlin');
    upsertMeta('geo.position', '52.5733;13.2911');
    upsertMeta('ICBM', '52.5733, 13.2911');

    // OpenGraph minimal set (property)
    upsertMeta('og:title', pageData.title, true);
    upsertMeta('og:description', pageData.description, true);
    upsertMeta('og:locale', 'de_DE', true);
    if (pageData.image) upsertMeta('og:image', pageData.image, true);

    // Social URLs - ensure shares show the current page URL
    upsertMeta('og:url', pageUrl, true);
    upsertMeta('twitter:url', pageUrl);

    // Improve social image metadata: alt text (accessibility) and recommended dimensions
    const imageAlt = pageData.title || pageData.description || '';
    if (imageAlt) upsertMeta('twitter:image:alt', imageAlt);
    if (pageData.image) {
      // Try to find real image dimensions from the generated JSON file
      fetch('/content/utils/og-image-dimensions.json')
        .then((r) => (r.ok ? r.json() : null))
        .then((map) => {
          if (!map) {
            upsertMeta('og:image:width', '1200', true);
            upsertMeta('og:image:height', '630', true);
            return;
          }
          // image path may be absolute URL or relative path; normalize to web path
          const imgPath = pageData.image;
          const dims = map[imgPath] || map[pageData.image] || null;
          if (dims) {
            upsertMeta('og:image:width', String(dims.width), true);
            upsertMeta('og:image:height', String(dims.height), true);
          } else {
            upsertMeta('og:image:width', '1200', true);
            upsertMeta('og:image:height', '630', true);
          }
        })
        .catch(() => {
          upsertMeta('og:image:width', '1200', true);
          upsertMeta('og:image:height', '630', true);
        });
    }

    // Canonical: compute and apply canonical and alternate links
    try {
      // determine hostname for env checks
      const hostname = globalThis.location.hostname.toLowerCase();

      // Force Canonical to Production host when true. Set to false to allow dev/staging canonical behavior.
      // Only honor an explicit opt-in via data attribute.
      const forceProdFlag = document.documentElement.dataset.forceProdCanonical === 'true';

      // Compute cleanPath using shared canonical util
      let cleanPath;
      try {
        const { getCanonicalPathFromRoutes } = await import('../../utils/canonical-utils.js');
        cleanPath = getCanonicalPathFromRoutes(globalThis.location.pathname, ROUTES);
      } catch {
        // Fallback to previous inline behavior if import fails
        const rawPath = globalThis.location.pathname || '/';
        let pathForMatch = rawPath.replaceAll(/\/\/+/g, '/');
        pathForMatch = pathForMatch.replaceAll(/\/index\.html$/i, '/');
        pathForMatch = pathForMatch.replaceAll(/\.html$/i, '/');
        pathForMatch = pathForMatch.replaceAll(/\/\/+/g, '/');
        if (!pathForMatch.startsWith('/')) pathForMatch = '/' + pathForMatch;
        pathForMatch = pathForMatch.endsWith('/') ? pathForMatch : pathForMatch + '/';
        const lowerMatch = pathForMatch.toLowerCase();
        let routeKey = Object.keys(ROUTES).find((k) => k !== 'default' && lowerMatch.startsWith(k));
        if (!routeKey)
          routeKey = Object.keys(ROUTES).find((k) => k !== 'default' && lowerMatch.includes(k));
        cleanPath = routeKey || pathForMatch;
        if (routeKey && !routeKey.endsWith('/')) {
          cleanPath = routeKey + '/';
        }
      }

      // Build canonical links and alternates
      const { effectiveCanonical, alternates } = buildCanonicalLinks(
        forceProdFlag,
        hostname,
        cleanPath,
        pageUrl,
        BASE_URL,
        globalThis.location.pathname,
        globalThis.location.origin
      );

      const canonicalEl = document.head.querySelector('link[rel="canonical"]');
      if (canonicalEl) {
        canonicalEl.setAttribute('href', effectiveCanonical);
        // Remove early flag if present (now properly configured)
        canonicalEl.removeAttribute('data-early');
      } else {
        upsertLink('canonical', effectiveCanonical);
      }

      // Apply canonical and hreflang alternates using pure, testable helper
      applyCanonicalLinks(document, alternates, effectiveCanonical);
    } catch (err) {
      // Safe fallback log
      log.warn('canonical detection failed', err);
      const canonicalEl = document.head.querySelector('link[rel="canonical"]');
      if (canonicalEl) canonicalEl.setAttribute('href', pageUrl);
      else upsertLink('canonical', pageUrl);
    }

    // Ensure favicon exists (minimal, do not re-inject if present)
    if (!document.head.querySelector('link[rel="icon"]')) {
      const iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      iconLink.href = BRAND_DATA.logo;
      document.head.appendChild(iconLink);
    }
    // Ensure PWA manifest & Apple mobile settings
    try {
      const { links, iconLinks, metas } = buildPwaAssets(BASE_URL, BRAND_DATA);
      links.forEach((l) => upsertLink(l.rel, l.href));
      metas.forEach((m) => upsertMeta(m.name, m.content));
      const addIcon = (href, sizes, type) => {
        if (!href) return;
        let el = document.head.querySelector(`link[rel="icon"][sizes="${sizes}"]`);
        if (el) el.setAttribute('href', href);
        else {
          el = document.createElement('link');
          el.setAttribute('rel', 'icon');
          el.setAttribute('sizes', sizes);
          if (type) el.setAttribute('type', type);
          el.setAttribute('href', href);
          document.head.appendChild(el);
        }
      };
      iconLinks
        .filter((l) => l.rel === 'icon' && l.sizes)
        .forEach((l) => addIcon(l.href, l.sizes, l.type));

      iconLinks
        .filter((l) => l.rel === 'shortcut icon')
        .forEach((l) => {
          let el = document.head.querySelector('link[rel="shortcut icon"]');
          if (el) el.setAttribute('href', l.href);
          else {
            el = document.createElement('link');
            el.rel = 'shortcut icon';
            el.href = l.href;
            document.head.appendChild(el);
          }
        });
      upsertMeta('theme-color', '#0d0d0d');
      upsertMeta('mobile-web-app-capable', 'yes');
      upsertMeta('apple-mobile-web-app-capable', 'yes');
      upsertMeta('apple-mobile-web-app-title', BRAND_DATA.name);
      upsertMeta('apple-mobile-web-app-status-bar-style', 'default');

      iconLinks
        .filter((l) => l.rel === 'apple-touch-icon')
        .forEach((l) => {
          let el = document.head.querySelector('link[rel="apple-touch-icon"]');
          if (el) el.setAttribute('href', l.href);
          else {
            el = document.createElement('link');
            el.setAttribute('rel', 'apple-touch-icon');
            el.setAttribute('sizes', l.sizes || '180x180');
            el.setAttribute('href', l.href);
            document.head.appendChild(el);
          }
        });
    } catch (e) {
      // Safe logging in catch block
      log?.warn?.('PWA meta injection failed:', e);
    }
  } catch (e) {
    log?.warn?.('lightweight head update failed:', e);
  }

  // --- 3. SCHEMA GRAPH GENERATION (moved to top-level helper) ---
  // NOTE: the heavy graph generation has been extracted to `generateSchemaGraph` (exported at the top of this module).
  // Use canonical origin (prod or runtime origin) so JSON-LD stays consistent in local/dev
  const canonicalOrigin =
    document.documentElement.dataset.forceProdCanonical === 'true'
      ? BASE_URL
      : globalThis.location.origin;

  const ID = {
    person: `${canonicalOrigin}/#person`,
    org: `${canonicalOrigin}/#organization`,
    website: `${canonicalOrigin}/#website`,
    webpage: `${pageUrl}#webpage`,
    breadcrumb: `${pageUrl}#breadcrumb`,
  };

  const graph = [];
  // 1. ORGANIZATION (Organization for Local SEO) + 2. PERSON (Die Haupt-Entität)
  graph.push(
    {
      '@type': 'Organization',
      '@id': ID.org,
      name: BRAND_DATA.legalName,
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: BRAND_DATA.logo,
        width: 512,
        height: 512,
        creditText: `Logo: ${BRAND_DATA.name}`,
        copyrightNotice: `© ${new Date().getFullYear()} ${BRAND_DATA.name}`,
        acquireLicensePage: `${BASE_URL}/#image-license`,
      },
      founder: { '@id': ID.person },
      image: {
        '@type': 'ImageObject',
        url: pageData?.image || BRAND_DATA.logo,
        width: 1200,
        height: 630,
        creditText: pageData.imageCredit || `Photo: ${BRAND_DATA.name}`,
        copyrightNotice: `© ${new Date().getFullYear()} ${BRAND_DATA.name}`,
        acquireLicensePage: `${BASE_URL}/#image-license`,
      },
      email: BRAND_DATA.email,
      sameAs: BRAND_DATA.sameAs,
      address: BRAND_DATA.address || {
        '@type': 'PostalAddress',
        addressLocality: 'Berlin',
        addressCountry: 'DE',
      },
      geo: BRAND_DATA.geo,
    },
    {
      '@type': ['Person', 'Photographer'],
      '@id': ID.person,
      name: BRAND_DATA.name,
      alternateName: BRAND_DATA.alternateName,
      jobTitle: BRAND_DATA.jobTitle,
      worksFor: { '@id': ID.org },
      url: BASE_URL,
      image: {
        '@type': 'ImageObject',
        '@id': `${BASE_URL}/#personImage`,
        url: 'https://commons.wikimedia.org/wiki/File:Abdulkerim_Sesli_portrait_2025.png',
        caption: BRAND_DATA.name,
      },
      description: pageData.description,
      // Identity Disambiguation
      disambiguatingDescription:
        "Webentwickler (React, Three.js) und Fotograf aus Berlin, nicht zu verwechseln mit 'Sesli Kitap' oder Hörbuch-Verlagen.",
      sameAs: BRAND_DATA.sameAs,
      homeLocation: {
        '@type': 'Place',
        name: 'Berlin',
        address: BRAND_DATA.address,
        geo: BRAND_DATA.geo,
      },
      knowsAbout: [
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
        { '@type': 'Thing', name: 'Urban Photography' },
        {
          '@type': 'Place',
          name: 'Berlin',
          sameAs: 'https://www.wikidata.org/wiki/Q64',
        },
      ],
    }
  );

  // 2.1 SPECIAL: FEATURE SNIPPET OPTIMIZATION (Skills as ItemList)
  // Helps Google display "Skills: React, Three.js..." in snippets
  if (pageUrl.includes('/about') || pageUrl === BASE_URL || pageUrl === `${BASE_URL}/`) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${BASE_URL}/#skills`,
      name: 'Technische Skills & Kompetenzen',
      description: 'Kernkompetenzen in der Fullstack-Webentwicklung und Fotografie',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'React & Next.js Ecosystem',
        },
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
        {
          '@type': 'ListItem',
          position: 4,
          name: 'UI/UX Design & Animation',
        },
        {
          '@type': 'ListItem',
          position: 5,
          name: 'Urban & Portrait Photography',
        },
      ],
    });
  }

  // (AI Context extraction moved to the top-level `generateSchemaGraph` for clarity and testability)

  // (WebPage and WebSite graph nodes generated in `generateSchemaGraph` - removed duplicate here)

  // 5. FAQ (STRICT MODE & WHITESPACE CLEANING)
  // Filtert "schmutzige" Strings und setzt stabile IDs, um "Unbenanntes Element" zu verhindern.
  /* FAQ generation is handled by generateSchemaGraph; no local placeholder needed */

  // FAQ generation moved to `generateSchemaGraph` (no inline fallback here)

  // 6. BREADCRUMBS
  const segments = globalThis.location.pathname.replace(/\/$/, '').split('/').filter(Boolean);
  const crumbs = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: { '@id': BASE_URL, name: 'Home' },
    },
  ];
  let pathAcc = canonicalOrigin;
  segments.forEach((seg, i) => {
    pathAcc += `/${seg}`;
    const name = seg.charAt(0).toUpperCase() + seg.slice(1);
    crumbs.push({
      '@type': 'ListItem',
      position: i + 2,
      name: name,
      item: { '@id': pathAcc, name: name },
    });
  });
  graph.push({
    '@type': 'BreadcrumbList',
    '@id': ID.breadcrumb,
    name: pageData?.title || document.title || 'Navigationspfad',
    itemListElement: crumbs,
  });

  // (graph assembled inside generateSchemaGraph)

  // Trigger schema generation via the exported scheduler (testable)
  const scheduleSchema = () =>
    scheduleSchemaInjection(
      () => injectSchema(pageData, pageUrl, BASE_URL, BRAND_DATA, BUSINESS_FAQS, document),
      1500,
      1200
    );

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', scheduleSchema);
  else scheduleSchema();

  // UI Helper: follow app events instead of raw window load to avoid early hides
  const hideLoader = () => {
    const el = document.getElementById('app-loader');
    if (!el) return;

    el.classList.add('fade-out');
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
      opacity: '0',
      pointerEvents: 'none',
      visibility: 'hidden',
    });

    setTimeout(() => {
      if (el) el.style.display = 'none';
    }, 800);
  };

  // React only when the app signals that all blocking tasks are done.
  document.addEventListener('app:loaderHide', hideLoader, { once: true });
  globalThis.SHARED_HEAD_LOADED = true;
}

// Helper to apply a single icon link to the document
function applyIconLink(doc, ic) {
  if (!ic?.rel) return;
  if (ic.rel === 'icon' && ic.sizes) {
    // upsert link[rel="icon"][sizes="..."]
    let el = doc.head.querySelector(`link[rel="icon"][sizes="${ic.sizes}"]`);
    if (el) {
      el.setAttribute('href', ic.href);
    } else {
      el = doc.createElement('link');
      el.setAttribute('rel', 'icon');
      el.setAttribute('sizes', ic.sizes);
      if (ic.type) el.setAttribute('type', ic.type);
      el.setAttribute('href', ic.href);
      doc.head.appendChild(el);
    }
  } else if (ic.rel === 'shortcut icon') {
    // upsert link[rel="shortcut icon"]
    let el = doc.head.querySelector('link[rel="shortcut icon"]');
    if (el) {
      el.setAttribute('href', ic.href);
    } else {
      el = doc.createElement('link');
      el.setAttribute('rel', 'shortcut icon');
      if (ic.type) el.setAttribute('type', ic.type);
      el.setAttribute('href', ic.href);
      doc.head.appendChild(el);
    }
  } else {
    // upsert other rels (e.g. apple-touch-icon)
    let el = doc.head.querySelector(`link[rel="${ic.rel}"]`);
    if (el) {
      el.setAttribute('href', ic.href);
    } else {
      el = doc.createElement('link');
      el.setAttribute('rel', ic.rel);
      if (ic.sizes) el.setAttribute('sizes', ic.sizes);
      if (ic.type) el.setAttribute('type', ic.type);
      el.setAttribute('href', ic.href);
      doc.head.appendChild(el);
    }
  }
}

// Orchestrator helper: performs high-level head initialization using the exported helpers.
export function orchestrateHead(
  doc = typeof document === 'undefined' ? null : document,
  options = {}
) {
  if (!doc?.head) return null;

  const BASE_URL = options.BASE_URL || 'https://abdulkerimsesli.de';
  const BRAND_DATA = options.BRAND_DATA || {};
  const ROUTES = options.ROUTES || {};
  const BUSINESS_FAQS = options.BUSINESS_FAQS || [];

  const currentPath = globalThis.location.pathname.toLowerCase();
  const matchedKey = Object.keys(ROUTES).find(
    (key) => key !== 'default' && currentPath.includes(key)
  );
  const pageData = matchedKey ? ROUTES[matchedKey] : ROUTES.default || {};
  const pageUrl = globalThis.location.href.split('#')[0];

  // 1) push page metadata
  globalThis.dataLayer = globalThis.dataLayer || [];
  const page_meta = buildPageMeta(pageData, pageUrl, globalThis.location.pathname || '/');
  globalThis.dataLayer.push({ event: 'pageMetadataReady', page_meta });

  // 2) core metas
  upsertMeta(doc, 'description', pageData?.description);
  upsertMeta(doc, 'robots', 'index, follow, max-image-preview:large');
  upsertMeta(doc, 'viewport', 'width=device-width, initial-scale=1');
  upsertMeta(doc, 'language', 'de-DE');
  upsertMeta(doc, 'author', BRAND_DATA.name || '');
  upsertMeta(doc, 'twitter:card', 'summary_large_image');
  upsertMeta(doc, 'twitter:creator', '@abdulkerimsesli');

  // 3) OG tags
  upsertMeta(doc, 'og:title', pageData.title, true);
  upsertMeta(doc, 'og:description', pageData.description, true);
  if (pageData.image) upsertMeta(doc, 'og:image', pageData.image, true);
  upsertLink(doc, 'canonical', pageUrl);
  upsertLink(doc, 'manifest', '/manifest.json');

  // 4) PWA assets
  const { links, iconLinks, metas } = buildPwaAssets(BASE_URL, BRAND_DATA);
  links.forEach((l) => upsertLink(doc, l.rel, l.href));
  metas.forEach((m) => upsertMeta(doc, m.name, m.content));

  // Ensure icon links (icons, shortcut, apple-touch-icon) are applied
  iconLinks.forEach((ic) => applyIconLink(doc, ic));

  // 5) canonical + alternates
  const { effectiveCanonical, alternates } = buildCanonicalLinks(
    ROUTES.forceProdFlag || false,
    globalThis.location.hostname.toLowerCase(),
    options.cleanPath ?? globalThis.location.pathname,
    pageUrl,
    BASE_URL,
    globalThis.location.pathname,
    globalThis.location.origin
  );
  applyCanonicalLinks(doc, alternates, effectiveCanonical);

  // 6) schedule schema injection
  scheduleSchemaInjection(
    () => injectSchema(pageData, pageUrl, BASE_URL, BRAND_DATA, BUSINESS_FAQS, doc),
    1500,
    1200
  );

  return { pageData, pageUrl, effectiveCanonical, alternates };
}

try {
  await loadSharedHead();
} catch (e) {
  log?.warn?.('head-complete: loadSharedHead failed', e);
}
