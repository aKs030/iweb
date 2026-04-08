/**
 * SEO & Meta Tag Management for Blog
 * @version 3.0.0 - Modern & Optimized
 */

import { FAVICON_512_URL } from '#config/constants.js';
import {
  BLOG_BASE_URL,
  BLOG_HOME_URL,
  BLOG_DEFAULT_TITLE,
  BLOG_DEFAULT_DESCRIPTION,
  BLOG_DEFAULT_IMAGE,
  buildPostCanonical,
  toAbsoluteBlogUrl,
  stripMarkdown,
  buildFallbackKeywords,
} from './blog-utils.js';

// Constants
const PUBLISHER_LOGO = FAVICON_512_URL;
const BLOG_DEFAULT_KEYWORDS = [
  'Blog',
  'Abdulkerim Sesli',
  'Webdesign',
  'SEO',
  'Performance',
  'Online-Marketing',
].join(', ');
const BLOG_DEFAULT_IMAGE_ALT = 'Blog — Abdulkerim Sesli';
const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large';

const IMAGE_MIME_TYPES = {
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

// DOM Utilities
const setMeta = (selector, attr, value) => {
  if (!value) return;

  const [attrName, attrValue] = attr.split('=');
  let el = document.head.querySelector(selector);

  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }

  el.setAttribute('content', value);
};

const setCanonical = (href) => {
  let el = document.head.querySelector('link[rel="canonical"]');

  if (!el) {
    el = document.createElement('link');
    /** @type {any} */ (el).rel = 'canonical';
    document.head.appendChild(el);
  }

  /** @type {any} */ (el).href = href;
};

const removeMeta = (selector) => {
  document.head.querySelector(selector)?.remove();
};

const removeElementById = (id) => {
  document.getElementById(id)?.remove();
};

const inferImageType = (url = '') => {
  const cleanUrl = url.split('#')[0].split('?')[0];
  const ext = cleanUrl.toLowerCase().split('.').pop();
  return IMAGE_MIME_TYPES[ext] || 'image/jpeg';
};

// Batch Meta Tag Setters
const setCommonMeta = (title, description, url, image, imageAlt, keywords) => {
  setMeta('meta[name="description"]', 'name=description', description);
  setMeta('meta[name="keywords"]', 'name=keywords', keywords);
  setMeta('meta[name="robots"]', 'name=robots', DEFAULT_ROBOTS);

  // Twitter Card
  setMeta('meta[name="twitter:title"]', 'name=twitter:title', title);
  setMeta(
    'meta[name="twitter:description"]',
    'name=twitter:description',
    description,
  );
  setMeta('meta[name="twitter:image"]', 'name=twitter:image', image);
  setMeta('meta[name="twitter:image:alt"]', 'name=twitter:image:alt', imageAlt);
  setMeta('meta[name="twitter:url"]', 'name=twitter:url', url);

  // Open Graph
  setMeta('meta[property="og:title"]', 'property=og:title', title);
  setMeta(
    'meta[property="og:description"]',
    'property=og:description',
    description,
  );
  setMeta('meta[property="og:image"]', 'property=og:image', image);
  setMeta('meta[property="og:image:alt"]', 'property=og:image:alt', imageAlt);
  setMeta(
    'meta[property="og:image:type"]',
    'property=og:image:type',
    inferImageType(image),
  );
  setMeta('meta[property="og:url"]', 'property=og:url', url);
};

const cleanupArticleMeta = () => {
  removeMeta('meta[property="article:published_time"]');
  removeMeta('meta[property="article:modified_time"]');
  removeElementById('blog-post-ldjson');
  removeElementById('edge-route-schema');
  removeElementById('edge-partial-meta');
};

export const resetBlogPageMeta = () => {
  document.title = BLOG_DEFAULT_TITLE;
  setCanonical(BLOG_HOME_URL);

  setCommonMeta(
    BLOG_DEFAULT_TITLE,
    BLOG_DEFAULT_DESCRIPTION,
    BLOG_HOME_URL,
    BLOG_DEFAULT_IMAGE,
    BLOG_DEFAULT_IMAGE_ALT,
    BLOG_DEFAULT_KEYWORDS,
  );

  setMeta('meta[property="og:type"]', 'property=og:type', 'website');
  cleanupArticleMeta();
};

const createStructuredData = (post, url, image, desc, keywords, body) => {
  const { title, category, date, updated } = post;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: title,
    description: desc,
    articleBody: body,
    articleSection: category,
    keywords: keywords.join(', '),
    image: image ? [image] : [],
    datePublished: date,
    dateModified: updated || date,
    inLanguage: 'de-DE',
    author: [
      { '@type': 'Person', name: 'Abdulkerim Sesli', url: `${BLOG_BASE_URL}/` },
    ],
    publisher: {
      '@type': 'Organization',
      name: 'Abdulkerim Sesli',
      url: BLOG_BASE_URL,
      logo: { '@type': 'ImageObject', url: PUBLISHER_LOGO },
    },
    isPartOf: {
      '@type': 'Blog',
      '@id': `${BLOG_HOME_URL}#blog`,
      url: BLOG_HOME_URL,
    },
  };
};

const setStructuredData = (data) => {
  let script = document.getElementById('blog-post-ldjson');

  if (!script) {
    script = document.createElement('script');
    /** @type {any} */ (script).type = 'application/ld+json';
    script.id = 'blog-post-ldjson';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(data);
};

export const updatePostMeta = (post) => {
  const url = buildPostCanonical(post.id);
  const image = toAbsoluteBlogUrl(post.image) || BLOG_DEFAULT_IMAGE;
  const imageAlt = post.imageAlt || post.title || BLOG_DEFAULT_IMAGE_ALT;
  const desc = post.seoDescription || post.excerpt || BLOG_DEFAULT_DESCRIPTION;
  const keywords =
    Array.isArray(post.keywords) && post.keywords.length
      ? post.keywords
      : buildFallbackKeywords(post);
  const body = stripMarkdown(post.content || '').slice(0, 5000);

  document.title = `${post.title} — Abdulkerim Sesli`;
  setCanonical(url);

  setCommonMeta(post.title, desc, url, image, imageAlt, keywords.join(', '));

  setMeta('meta[property="og:type"]', 'property=og:type', 'article');
  setMeta(
    'meta[property="article:published_time"]',
    'property=article:published_time',
    post.date,
  );
  setMeta(
    'meta[property="article:modified_time"]',
    'property=article:modified_time',
    post.updated || post.date,
  );

  removeElementById('edge-route-schema');
  removeElementById('edge-partial-meta');

  const structuredData = createStructuredData(
    post,
    url,
    image,
    desc,
    keywords,
    body,
  );
  setStructuredData(structuredData);
};
