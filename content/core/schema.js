/**
 * Modern Schema.org Generator
 * @version 3.0.0
 */

import { createLogger } from './logger.js';
import { ENV } from '../config/env.config.js';

const log = createLogger('Schema');

/**
 * Generate Schema.org @graph
 * @param {PageData} pageData
 * @param {string} pageUrl
 * @param {BrandData} brandData
 * @returns {SchemaNode[]}
 */
export function generateSchemaGraph(pageData, pageUrl, brandData) {
  const canonicalOrigin = ENV.BASE_URL;

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
    logo: createImageObject(brandData.logo, brandData.name),
    email: brandData.email,
    sameAs: brandData.sameAs,
    contactPoint: brandData.contactPoint,
    telephone: brandData.telephone,
    address: brandData.address,
    geo: brandData.geo,
    founder: { '@id': ID.person },
  });

  // Person
  graph.push({
    '@type': ['Person', 'Photographer'],
    '@id': ID.person,
    name: brandData.name,
    alternateName: brandData.alternateName,
    jobTitle: brandData.jobTitle,
    worksFor: { '@id': ID.org },
    url: ENV.BASE_URL,
    description: pageData.description,
    disambiguatingDescription:
      'Webentwickler (React, Three.js) und Fotograf aus Berlin',
    sameAs: brandData.sameAs,
    homeLocation: {
      '@type': 'Place',
      name: 'Berlin',
      address: brandData.address,
      geo: brandData.geo,
    },
    knowsAbout: getKnowsAbout(),
  });

  // WebPage
  graph.push({
    '@type': pageData.type || 'WebPage',
    '@id': ID.webpage,
    url: pageUrl,
    name: pageData.title,
    description: pageData.description,
    isPartOf: { '@id': ID.website },
    mainEntity: { '@id': ID.person },
    publisher: { '@id': ID.org },
    inLanguage: 'de-DE',
    dateModified: new Date().toISOString(),
  });

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

  // Breadcrumbs
  graph.push(generateBreadcrumbs(pageUrl, pageData.title));

  return graph;
}

/**
 * Create ImageObject for schema
 * @param {string} url
 * @param {string} name
 * @returns {Object}
 */
function createImageObject(url, name) {
  return {
    '@type': 'ImageObject',
    url,
    width: 512,
    height: 512,
    creator: { '@type': 'Person', name },
    license: `${ENV.BASE_URL}/#image-license`,
    creditText: `Logo: ${name}`,
    copyrightNotice: `© ${new Date().getFullYear()} ${name}`,
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
 * @returns {Object}
 */
function generateBreadcrumbs(pageUrl, pageTitle) {
  const segments = window.location.pathname
    .replace(/\/$/, '')
    .split('/')
    .filter(Boolean);

  const crumbs = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: { '@id': ENV.BASE_URL, name: 'Home' },
    },
  ];

  let pathAcc = ENV.BASE_URL;
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
 * Inject schema into document
 * @param {SchemaNode[]} graph
 */
export function injectSchema(graph) {
  if (!document?.head) return;

  try {
    const ldId = 'schema-ldjson';
    let script = document.getElementById(ldId);

    const payload = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    });

    if (script) {
      script.textContent = payload;
    } else {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = ldId;
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
