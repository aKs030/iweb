import { i18n } from '../../../core/i18n.js';
import { createLogger } from '../../../core/logger.js';
import { sanitizeInternalNavigationUrl } from '../../../core/url-utils.js';

const log = createLogger('MenuSearchApi');
const SEARCH_ENDPOINT = '/api/search';
const AI_AGENT_ENDPOINT = '/api/ai-agent';
const MARK_HIGHLIGHT_PATTERN = /<mark>[\s\S]*?<\/mark>/i;

export class MenuSearchApi {
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

  filterHighlightedResults(items) {
    return (Array.isArray(items) ? items : []).filter((item) =>
      this.hasMarkedHighlight(item?.highlightedDescription),
    );
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
    return { message };
  }

  buildSearchAiAgentPrompt(query, items = []) {
    const compactQuery = String(query || '')
      .replace(/\s+/g, ' ')
      .trim();
    const context = (Array.isArray(items) ? items : [])
      .slice(0, 4)
      .map((item, index) => {
        const title = String(item?.title || '').trim();
        const url = sanitizeInternalNavigationUrl(item?.url || '');
        const desc = String(item?.description || '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!title || !url) return '';
        return `${index + 1}. ${title} (${url})${desc ? ` - ${desc}` : ''}`;
      })
      .filter(Boolean)
      .join('\n');

    return [
      `Nutzer sucht im Menü nach: "${compactQuery}".`,
      'Formuliere eine kurze Antwort auf Deutsch (maximal 2 Sätze).',
      'Nutze nur relative interne Links im Markdown-Format, z. B. [Blog](/blog/).',
      'Keine Listen, keine Tool-Aktionen, keine externen Links.',
      '',
      'Verfügbare Suchtreffer:',
      context || 'Keine Treffer.',
    ].join('\n');
  }

  async fetchSearchResults(query, options = {}) {
    const { topK = 12, signal = null } = options;
    const response = await fetch(SEARCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, topK }),
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
      aiChatMessage: fallbackAiChat.message,
    };
  }

  async fetchSearchAiAgentMessage(query, items = [], options = {}) {
    if (!query) return '';
    if (navigator.onLine === false) return '';

    const timeoutMs = Number(options.timeoutMs || 0);
    const controller = new AbortController();
    const timeoutId =
      timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const response = await fetch(AI_AGENT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: this.buildSearchAiAgentPrompt(query, items),
          stream: false,
        }),
        credentials: 'omit',
        signal: controller.signal,
      });

      if (!response.ok) return '';

      const body = await response.json().catch(() => ({}));
      return this.normalizeSearchChatMessage(body?.text || '');
    } catch (error) {
      if (!this.isAbortLikeError(error)) {
        log.debug('Menu search AI agent request failed:', error);
      }
      return '';
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
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

  isAbortLikeError(error) {
    if (!error || typeof error !== 'object') return false;

    if (error.name === 'AbortError' || error.code === 20) {
      return true;
    }

    const message = String(error.message || '').toLowerCase();
    return message.includes('abort');
  }
}
