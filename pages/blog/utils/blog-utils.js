/**
 * Blog Utility Functions
 * @version 1.0.0
 */

export const BLOG_BASE_URL = 'https://www.abdulkerimsesli.de';
export const BLOG_HOME_URL = `${BLOG_BASE_URL}/blog/`;
export const BLOG_DEFAULT_TITLE = 'Blog — Abdulkerim Sesli';
export const BLOG_DEFAULT_DESCRIPTION =
  'Blog von Abdulkerim Sesli: Tipps & Anleitungen zu Webdesign, SEO, Performance und Online-Marketing für Unternehmen und Selbstständige.';
export const BLOG_DEFAULT_IMAGE =
  'https://img.abdulkerimsesli.de/blog/og-home-800.png';

export const CATEGORY_OVERRIDES = {
  'threejs-performance': 'Performance',
  'react-no-build': 'Webdesign',
  'modern-ui-design': 'Webdesign',
  'visual-storytelling': 'Online-Marketing',
};

export const estimateReadTime = (text = '') =>
  `${Math.max(1, Math.round(text.split(/\s+/).length / 200))} min`;

export const toAbsoluteBlogUrl = (value = '') => {
  if (!value) return '';
  try {
    return new URL(value, BLOG_BASE_URL).toString();
  } catch {
    return value;
  }
};

export const buildPostCanonical = (postId = '') =>
  `${BLOG_HOME_URL}${encodeURIComponent(String(postId || '').trim())}/`;

export const toKeywordList = (value = '') => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const stripMarkdown = (value = '') =>
  String(value || '')
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

  const frontmatter = match[1];
  const content = text.slice(match[0].length);
  const data = {};

  frontmatter.split('\n').forEach((line) => {
    const [key, ...val] = line.split(':');
    if (key && val) {
      data[key.trim()] = val.join(':').trim();
    }
  });

  return { content, data };
};

export const buildFallbackKeywords = (post = {}) =>
  toKeywordList(
    `${post.category || 'Blog'}, ${post.title || ''}, Bilder, Videos, Hauptseite`,
  );

export const normalizePost = (raw = {}) => {
  const id = raw.id || raw.slug;
  if (!id) return null;
  const category = CATEGORY_OVERRIDES[id] || raw.category || 'Artikel';
  const dateStr = raw.date || '';
  const keywords =
    toKeywordList(raw.keywords).length > 0
      ? toKeywordList(raw.keywords)
      : buildFallbackKeywords({ ...raw, category });

  return {
    ...raw,
    id,
    category,
    title: raw.title || id,
    excerpt: raw.excerpt || '',
    seoDescription: raw.seoDescription || raw.excerpt || '',
    imageAlt: raw.imageAlt || raw.title || id,
    keywords,
    timestamp: dateStr ? new Date(dateStr).getTime() : 0,
    dateDisplay: raw.dateDisplay || dateStr,
    readTime: raw.readTime || estimateReadTime(raw.content || raw.html || ''),
    file: raw.file || null,
  };
};
