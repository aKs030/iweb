/**
 * Blog Utility Functions
 * @version 2.0.0 - Optimized & Minimal
 */

export const BLOG_BASE_URL = 'https://www.abdulkerimsesli.de';
export const BLOG_HOME_URL = `${BLOG_BASE_URL}/blog/`;
export const BLOG_DEFAULT_TITLE = 'Blog — Abdulkerim Sesli';
export const BLOG_DEFAULT_DESCRIPTION =
  'Blog von Abdulkerim Sesli: Tipps & Anleitungen zu Webdesign, SEO, Performance und Online-Marketing für Unternehmen und Selbstständige.';
export const BLOG_DEFAULT_IMAGE =
  'https://img.abdulkerimsesli.de/blog/og-home-800.png';

const CATEGORY_MAP = {
  'threejs-performance': 'Performance',
  'react-no-build': 'Webdesign',
  'modern-ui-design': 'Webdesign',
  'visual-storytelling': 'Online-Marketing',
};

export const toAbsoluteBlogUrl = (url = '') => {
  if (!url) return '';
  try {
    return new URL(url, BLOG_BASE_URL).toString();
  } catch {
    return url;
  }
};

export const buildPostCanonical = (id = '') =>
  `${BLOG_HOME_URL}${encodeURIComponent(String(id).trim())}/`;

export const stripMarkdown = (text = '') =>
  String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const parseFrontmatter = (text) => {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { content: text, data: {} };

  const data = {};
  match[1].split('\n').forEach((line) => {
    const [key, ...val] = line.split(':');
    if (key && val.length) {
      data[key.trim()] = val.join(':').trim();
    }
  });

  return { content: text.slice(match[0].length), data };
};

const toKeywordArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
};

export const buildFallbackKeywords = (post) =>
  toKeywordArray(
    `${post.category || 'Blog'}, ${post.title || ''}, Bilder, Videos, Hauptseite`,
  );

export const normalizePost = (raw = {}) => {
  const id = raw.id || raw.slug;
  if (!id) return null;

  const category = CATEGORY_MAP[id] || raw.category || 'Artikel';
  const keywords =
    toKeywordArray(raw.keywords).length > 0
      ? toKeywordArray(raw.keywords)
      : buildFallbackKeywords({ ...raw, category });

  const wordCount = (raw.content || '').split(/\s+/).length;
  const readTime = `${Math.max(1, Math.round(wordCount / 200))} min`;

  return {
    ...raw,
    id,
    category,
    title: raw.title || id,
    excerpt: raw.excerpt || '',
    seoDescription: raw.seoDescription || raw.excerpt || '',
    imageAlt: raw.imageAlt || raw.title || id,
    keywords,
    timestamp: raw.date ? new Date(raw.date).getTime() : 0,
    dateDisplay: raw.dateDisplay || raw.date || '',
    readTime: raw.readTime || readTime,
    file: raw.file || null,
  };
};
