/**
 * SEO & Meta Tag Management for Blog
 * @version 2.0.0 - Optimized & Minimal
 */

import { iconUrl } from '/content/config/constants.js';
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

const PUBLISHER_LOGO = iconUrl('favicon-512.webp');

const setMeta = (selector, attr, value) => {
  if (!value) return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr.split('=')[0], attr.split('=')[1]);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
};

const setCanonical = (href) => {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
};

export const resetBlogPageMeta = () => {
  document.title = BLOG_DEFAULT_TITLE;
  setCanonical(BLOG_HOME_URL);

  setMeta(
    'meta[name="description"]',
    'name=description',
    BLOG_DEFAULT_DESCRIPTION,
  );
  setMeta(
    'meta[name="twitter:title"]',
    'name=twitter:title',
    BLOG_DEFAULT_TITLE,
  );
  setMeta(
    'meta[name="twitter:description"]',
    'name=twitter:description',
    BLOG_DEFAULT_DESCRIPTION,
  );
  setMeta(
    'meta[name="twitter:image"]',
    'name=twitter:image',
    BLOG_DEFAULT_IMAGE,
  );
  setMeta('meta[name="twitter:url"]', 'name=twitter:url', BLOG_HOME_URL);
  setMeta('meta[property="og:type"]', 'property=og:type', 'website');
  setMeta('meta[property="og:title"]', 'property=og:title', BLOG_DEFAULT_TITLE);
  setMeta(
    'meta[property="og:description"]',
    'property=og:description',
    BLOG_DEFAULT_DESCRIPTION,
  );
  setMeta('meta[property="og:image"]', 'property=og:image', BLOG_DEFAULT_IMAGE);
  setMeta('meta[property="og:url"]', 'property=og:url', BLOG_HOME_URL);
};

export const updatePostMeta = (post) => {
  const url = buildPostCanonical(post.id);
  const image = toAbsoluteBlogUrl(post.image) || BLOG_DEFAULT_IMAGE;
  const desc = post.seoDescription || post.excerpt || BLOG_DEFAULT_DESCRIPTION;
  const keywords =
    Array.isArray(post.keywords) && post.keywords.length
      ? post.keywords
      : buildFallbackKeywords(post);
  const body = stripMarkdown(post.content || '').slice(0, 5000);

  document.title = `${post.title} — Abdulkerim Sesli`;
  setCanonical(url);

  setMeta('meta[name="description"]', 'name=description', desc);
  setMeta('meta[name="keywords"]', 'name=keywords', keywords.join(', '));
  setMeta(
    'meta[name="robots"]',
    'name=robots',
    'index, follow, max-image-preview:large',
  );
  setMeta('meta[name="twitter:title"]', 'name=twitter:title', post.title);
  setMeta('meta[name="twitter:description"]', 'name=twitter:description', desc);
  setMeta('meta[name="twitter:image"]', 'name=twitter:image', image);
  setMeta('meta[name="twitter:url"]', 'name=twitter:url', url);
  setMeta('meta[property="og:type"]', 'property=og:type', 'article');
  setMeta('meta[property="og:title"]', 'property=og:title', post.title);
  setMeta('meta[property="og:description"]', 'property=og:description', desc);
  setMeta('meta[property="og:image"]', 'property=og:image', image);
  setMeta('meta[property="og:url"]', 'property=og:url', url);
  setMeta(
    'meta[property="article:published_time"]',
    'property=article:published_time',
    post.date,
  );

  let script = document.getElementById('blog-post-ldjson');
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'blog-post-ldjson';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: post.title,
    description: desc,
    articleBody: body,
    articleSection: post.category,
    keywords: keywords.join(', '),
    image: image ? [image] : [],
    datePublished: post.date,
    dateModified: post.date,
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
  });
};
