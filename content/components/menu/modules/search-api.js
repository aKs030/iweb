import { i18n } from '#core/i18n.js';
import { sanitizeInternalNavigationUrl } from '#core/url-utils.js';

const SEARCH_ENDPOINT = '/api/search';
const MARK_HIGHLIGHT_PATTERN = /<mark>[\s\S]*?<\/mark>/i;
const SEARCH_FACETS = Object.freeze([
  'all',
  'blog',
  'projects',
  'videos',
  'pages',
]);

/**
 * @typedef {typeof import('./MenuConfig.js').MenuConfig} MenuComponentConfig
 */
/**
 * @typedef {Partial<MenuComponentConfig>} MenuComponentConfigInput
 */

export class MenuSearchApi {
  /**
   * @param {MenuComponentConfigInput} [config]
   */
  constructor(config = {}) {
    this.config = config;
  }

  normalizeSearchResult(item) {
    if (!item || typeof item !== 'object') return null;

    const title = String(item.title || '').trim();
    const url = String(item.url || '').trim();

    if (!title || !url) return null;

    return {
      title,
      url,
      description: String(item.description || '').trim(),
      highlightedDescription: String(item.highlightedDescription || '').trim(),
      category: String(item.category || '').trim(),
    };
  }

  hasMarkedHighlight(value) {
    return MARK_HIGHLIGHT_PATTERN.test(String(value || '').trim());
  }

  normalizeSearchFacet(rawFacet) {
    const value = String(rawFacet || '')
      .trim()
      .toLowerCase();
    if (value === 'project' || value === 'projekte') return 'projects';
    if (value === 'video') return 'videos';
    if (value === 'page' || value === 'seiten') return 'pages';
    return SEARCH_FACETS.includes(value) ? value : 'all';
  }

  normalizeFacetCounts(facets) {
    const countsByKey = new Map(
      (Array.isArray(facets) ? facets : []).map((entry) => [
        this.normalizeSearchFacet(entry?.key),
        Math.max(0, Number.parseInt(String(entry?.count || 0), 10) || 0),
      ]),
    );

    return SEARCH_FACETS.map((key) => ({
      key,
      count: countsByKey.get(key) || 0,
    }));
  }

  filterResultsByFacet(items, rawFacet) {
    const facet = this.normalizeSearchFacet(rawFacet);
    const list = Array.isArray(items) ? items : [];

    if (facet === 'all') return list;

    return list.filter((item) => {
      const category = String(item?.category || '')
        .trim()
        .toLowerCase();
      const url = String(item?.url || '')
        .trim()
        .toLowerCase();

      if (facet === 'blog')
        return category === 'blog' || url.startsWith('/blog/');
      if (facet === 'projects') {
        return (
          category === 'projekte' ||
          url === '/projekte/' ||
          url.startsWith('/projekte/')
        );
      }
      if (facet === 'videos') {
        return (
          category === 'videos' ||
          url === '/videos/' ||
          url.startsWith('/videos/')
        );
      }

      return !['blog', 'projekte', 'videos'].includes(category);
    });
  }

  normalizeSearchChatMessage(value) {
    let text = String(value || '').trim();
    if (!text) return '';

    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, rawUrl) => {
      const safeUrl = sanitizeInternalNavigationUrl(rawUrl);
      if (!safeUrl) return label;
      return `<a href="${safeUrl}" class="menu-search__ai-link">${label}</a>`;
    });
    text = text.replace(
      /(^|[\s(])(https?:\/\/[^\s<)]+)/gi,
      (_match, prefix, rawUrl) => {
        const safeUrl = sanitizeInternalNavigationUrl(rawUrl);
        if (!safeUrl) return `${prefix}${rawUrl}`;
        return `${prefix}<a href="${safeUrl}" class="menu-search__ai-link">${safeUrl}</a>`;
      },
    );
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/\n\n+/g, '</p><p>');
    text = text.replace(/\n/g, '<br>');
    return `<p>${text}</p>`;
  }

  normalizeSearchChatPayload(aiChat, fallbackSummary = '') {
    const payload = aiChat && typeof aiChat === 'object' ? aiChat : {};
    const message = this.normalizeSearchChatMessage(
      payload.message || fallbackSummary || '',
    );
    const suggestions = Array.isArray(payload.suggestions)
      ? payload.suggestions
          .map((suggestion) => {
            const title = String(
              suggestion?.title || suggestion?.label || '',
            ).trim();
            const safeUrl = sanitizeInternalNavigationUrl(
              suggestion?.url || '',
            );
            if (!title || !safeUrl) return null;
            return { title, url: safeUrl };
          })
          .filter(Boolean)
          .slice(0, 6)
      : [];
    return { message, suggestions };
  }

  async fetchSearchResults(query, options = {}) {
    const { topK = 12, facet = 'all', signal = null } = options;
    const response = await fetch(SEARCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        topK,
        facet: this.normalizeSearchFacet(facet),
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Search request failed with status ${response.status}`);
    }

    const data = await response.json();
    const items = Array.isArray(data?.results)
      ? data.results
          .map((item) => this.normalizeSearchResult(item))
          .filter(Boolean)
      : [];
    const fallbackAiChat = this.normalizeSearchChatPayload(
      data?.aiChat,
      data?.summary,
    );

    return {
      items,
      facet: this.normalizeSearchFacet(data?.facet),
      facets: this.normalizeFacetCounts(data?.facets),
      aiChatMessage: fallbackAiChat.message,
      aiChatSuggestions: fallbackAiChat.suggestions || [],
    };
  }

  normalizeSuggestions(suggestions) {
    const seen = new Set();
    return (Array.isArray(suggestions) ? suggestions : [])
      .map((entry) => {
        const title = String(entry?.title || '').trim();
        const safeUrl = sanitizeInternalNavigationUrl(entry?.url || '');
        if (!title || !safeUrl) return null;
        const key = `${title}|${safeUrl}`.toLowerCase();
        if (seen.has(key)) return null;
        seen.add(key);
        return { title, url: safeUrl };
      })
      .filter(Boolean);
  }

  pickSearchSuggestions(query, suggestions = [], maxCount = 6) {
    const normalizedQuery = String(query || '')
      .trim()
      .toLowerCase();
    const unique = this.normalizeSuggestions(suggestions);
    if (!normalizedQuery) {
      return unique.slice(0, maxCount);
    }
    const ranked = unique.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aUrl = a.url.toLowerCase();
      const bUrl = b.url.toLowerCase();
      const aScore =
        (aTitle.includes(normalizedQuery) ? 2 : 0) +
        (aUrl.includes(normalizedQuery) ? 1 : 0);
      const bScore =
        (bTitle.includes(normalizedQuery) ? 2 : 0) +
        (bUrl.includes(normalizedQuery) ? 1 : 0);
      if (bScore !== aScore) return bScore - aScore;
      return aTitle.localeCompare(bTitle, 'de');
    });
    return ranked.slice(0, maxCount);
  }

  getFallbackSuggestions() {
    return [
      {
        title: i18n.tOrFallback('menu.nav_home', 'Startseite'),
        url: '/',
      },
      {
        title: i18n.tOrFallback('menu.nav_about', 'About'),
        url: '/about/',
      },
      {
        title: i18n.tOrFallback('menu.nav_blog', 'Blog'),
        url: '/blog/',
      },
      {
        title: i18n.tOrFallback('menu.nav_projects', 'Projekte'),
        url: '/projekte/',
      },
    ];
  }

  buildOfflineSearchResults(query) {
    const normalizedQuery = String(query || '')
      .trim()
      .toLowerCase();
    if (!normalizedQuery) return [];

    const fallbackSources = [
      ...this.getFallbackSuggestions(),
      {
        title: i18n.tOrFallback('menu.nav_gallery', 'Galerie'),
        url: '/gallery/',
      },
      { title: i18n.tOrFallback('menu.nav_videos', 'Videos'), url: '/videos/' },
      { title: i18n.tOrFallback('menu.contact', 'Kontakt'), url: '#footer' },
    ];

    return fallbackSources
      .filter((item) => {
        const title = String(item.title || '').toLowerCase();
        const url = String(item.url || '').toLowerCase();
        return title.includes(normalizedQuery) || url.includes(normalizedQuery);
      })
      .slice(0, 6)
      .map((item) => ({
        title: String(item.title || ''),
        url: String(item.url || '/'),
        description: i18n.tOrFallback(
          'menu.search_offline_desc',
          'Aus lokal verfuegbaren Navigationseintraegen',
        ),
        highlightedDescription: `<mark>${i18n.tOrFallback('menu.search_offline_match', 'Lokaler Treffer')}</mark>`,
        category: i18n.tOrFallback('menu.search_offline_category', 'Offline'),
      }));
  }

  buildOfflineFacetCounts(query) {
    const items = this.buildOfflineSearchResults(query);
    return this.normalizeFacetCounts(
      SEARCH_FACETS.map((key) => ({
        key,
        count: this.filterResultsByFacet(items, key).length,
      })),
    );
  }

  isAbortLikeError(error) {
    if (!error || typeof error !== 'object') return false;

    if (error.name === 'AbortError' || error.code === 20) {
      return true;
    }

    const message = String(error.message || '').toLowerCase();
    return message.includes('abort');
  }
}
