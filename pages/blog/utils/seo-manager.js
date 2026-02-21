/**
 * SEO & Meta Tag Management for Blog
 * @version 1.0.0
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

const BLOG_PUBLISHER_LOGO = iconUrl('favicon-512.webp');

export const upsertHeadMeta = ({ name, property, content }) => {
  if (!content) return null;

  const selector = name
    ? `meta[name="${name}"]`
    : `meta[property="${property}"]`;
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('meta');
    if (name) {
      element.setAttribute('name', name);
    } else {
      element.setAttribute('property', property);
    }
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
  return element;
};

export const upsertCanonical = (href) => {
  if (!href) return null;
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', href);
  return canonical;
};

export const resetBlogPageMeta = () => {
  document.title = BLOG_DEFAULT_TITLE;

  upsertHeadMeta({
    name: 'description',
    content: BLOG_DEFAULT_DESCRIPTION,
  });
  upsertHeadMeta({
    name: 'twitter:title',
    content: BLOG_DEFAULT_TITLE,
  });
  upsertHeadMeta({
    name: 'twitter:description',
    content: BLOG_DEFAULT_DESCRIPTION,
  });
  upsertHeadMeta({
    name: 'twitter:image',
    content: BLOG_DEFAULT_IMAGE,
  });
  upsertHeadMeta({
    name: 'twitter:url',
    content: BLOG_HOME_URL,
  });

  upsertHeadMeta({
    property: 'og:type',
    content: 'website',
  });
  upsertHeadMeta({
    property: 'og:title',
    content: BLOG_DEFAULT_TITLE,
  });
  upsertHeadMeta({
    property: 'og:description',
    content: BLOG_DEFAULT_DESCRIPTION,
  });
  upsertHeadMeta({
    property: 'og:image',
    content: BLOG_DEFAULT_IMAGE,
  });
  upsertHeadMeta({
    property: 'og:url',
    content: BLOG_HOME_URL,
  });

  upsertCanonical(BLOG_HOME_URL);
};

export const updatePostMeta = (activePost) => {
  const canonicalUrl = buildPostCanonical(activePost.id);
  const imageUrl = toAbsoluteBlogUrl(activePost.image) || BLOG_DEFAULT_IMAGE;
  const description =
    activePost.seoDescription || activePost.excerpt || BLOG_DEFAULT_DESCRIPTION;
  const keywordList =
    Array.isArray(activePost.keywords) && activePost.keywords.length > 0
      ? activePost.keywords
      : buildFallbackKeywords(activePost);
  const articleBody = stripMarkdown(activePost.content || '').slice(0, 5000);

  document.title = `${activePost.title} — Abdulkerim Sesli`;
  upsertCanonical(canonicalUrl);

  upsertHeadMeta({
    name: 'description',
    content: description,
  });
  upsertHeadMeta({
    name: 'keywords',
    content: keywordList.join(', '),
  });
  upsertHeadMeta({
    name: 'robots',
    content: 'index, follow, max-image-preview:large',
  });
  upsertHeadMeta({
    name: 'twitter:title',
    content: activePost.title,
  });
  upsertHeadMeta({
    name: 'twitter:description',
    content: description,
  });
  upsertHeadMeta({
    name: 'twitter:image',
    content: imageUrl,
  });
  upsertHeadMeta({
    name: 'twitter:url',
    content: canonicalUrl,
  });
  upsertHeadMeta({
    property: 'og:type',
    content: 'article',
  });
  upsertHeadMeta({
    property: 'og:title',
    content: activePost.title,
  });
  upsertHeadMeta({
    property: 'og:description',
    content: description,
  });
  upsertHeadMeta({
    property: 'og:image',
    content: imageUrl,
  });
  upsertHeadMeta({
    property: 'og:url',
    content: canonicalUrl,
  });
  upsertHeadMeta({
    property: 'article:published_time',
    content: activePost.date,
  });

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'blog-post-ldjson';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${canonicalUrl}#article`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    headline: activePost.title,
    description,
    articleBody,
    articleSection: activePost.category,
    keywords: keywordList.join(', '),
    image: imageUrl ? [imageUrl] : [],
    datePublished: activePost.date,
    dateModified: activePost.date,
    inLanguage: 'de-DE',
    author: [
      {
        '@type': 'Person',
        name: 'Abdulkerim Sesli',
        url: `${BLOG_BASE_URL}/`,
      },
    ],
    publisher: {
      '@type': 'Organization',
      name: 'Abdulkerim Sesli',
      url: BLOG_BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: BLOG_PUBLISHER_LOGO,
      },
    },
    isPartOf: {
      '@type': 'Blog',
      '@id': `${BLOG_HOME_URL}#blog`,
      url: BLOG_HOME_URL,
    },
  });
  document.head.appendChild(script);

  return script;
};
