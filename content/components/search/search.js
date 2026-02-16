// @ts-check
/**
 * Search Component
 * AI-powered search with Cloudflare AI Search Beta
 * @author Abdulkerim Sesli
 * @version 4.0.0
 */

/* exported initSearch, openSearch, closeSearch, toggleSearch */
import { createLogger } from '../../core/logger.js';
import { upsertHeadLink } from '../../core/utils.js';

const _log = createLogger('search');

/**
 * Search Component Class
 * Manages search overlay, input, and results via API
 */
class SearchComponent {
  constructor() {
    /** @type {HTMLElement|null} */
    this.overlay = null;
    /** @type {HTMLInputElement|null} */
    this.input = null;
    /** @type {HTMLElement|null} */
    this.resultsContainer = null;
    /** @type {HTMLElement|null} */
    this.loader = null;
    /** @type {boolean} */
    this.isOpen = false;
    /** @type {Array} */
    this.currentResults = [];
    /** @type {number} */
    this.selectedIndex = -1;
    /** @type {number|null} */
    this.searchTimeout = null;
    /** @type {string} */
    this.lastQuery = '';

    this.init();
  }

  init() {
    this.createSearchOverlay();
    this.attachEventListeners();
    this.loadStyles();
    _log.info('Search component initialized with Cloudflare AI Search');
  }

  loadStyles() {
    upsertHeadLink({
      rel: 'stylesheet',
      href: '/content/components/search/search.css',
      dataset: { injectedBy: 'search-js' },
    });
  }

  createSearchOverlay() {
    const existing = document.getElementById('search-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'search-overlay';
    // @ts-ignore
    overlay.className = 'search-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Suchfenster');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="search-modal" role="document">
        <div class="search-bar-wrapper">
          <div class="search-input-container">
            <span class="search-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input
              type="text"
              id="search-input"
              name="search"
              class="search-input"
              aria-label="Suchfeld"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
            >
            <div class="search-loader" style="display: none;"></div>
          </div>
          <button class="search-close" aria-label="Suche schließen" title="ESC">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="search-results" role="region" aria-live="polite" aria-atomic="false"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.input = overlay.querySelector('.search-input');
    this.resultsContainer = overlay.querySelector('.search-results');
    this.loader = overlay.querySelector('.search-loader');

    overlay
      .querySelector('.search-close')
      .addEventListener('click', () => this.close());

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
  }

  attachEventListeners() {
    this._handleKeydown = (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }

      if (this.isOpen && this.currentResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.navigateResults(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.navigateResults(-1);
        } else if (e.key === 'Enter' && this.selectedIndex >= 0) {
          e.preventDefault();
          this.selectResult(this.selectedIndex);
        }
      }
    };
    document.addEventListener('keydown', this._handleKeydown);

    if (this.input) {
      this.input.addEventListener('input', () => {
        const value = this.input.value;

        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        // @ts-ignore
        this.searchTimeout = setTimeout(() => {
          // @ts-ignore
          this.handleSearch(value);
        }, 300);
      });

      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(this.searchTimeout);

          if (this.currentResults.length > 0) {
            const index = this.selectedIndex >= 0 ? this.selectedIndex : 0;
            this.selectResult(index);
          } else {
            // @ts-ignore
            this.handleSearch(this.input.value);
          }
        }
      });
    }
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.overlay.classList.add('active');
    this.selectedIndex = -1;

    requestAnimationFrame(() => {
      setTimeout(() => {
        if (this.input) {
          this.input.focus();
          this.input.select();
        }
      }, 100);
    });

    // Prevent body scroll using event listener to avoid layout shifts/black bars
    document.addEventListener('touchmove', this.preventScroll, {
      passive: false,
    });
    document.addEventListener('wheel', this.preventScroll, { passive: false });

    window.dispatchEvent(new CustomEvent('search:opened'));
    _log.info('Search opened');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.classList.remove('active');
    this.selectedIndex = -1;
    if (this.input) this.input.value = '';
    if (this.searchTimeout) clearTimeout(this.searchTimeout);

    // Restore scroll
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.documentElement.style.height = '';
    document.body.style.height = '';

    window.dispatchEvent(new CustomEvent('search:closed'));
    _log.info('Search closed');
  }

  navigateResults(direction) {
    if (this.currentResults.length === 0) return;
    const previousItem = this.resultsContainer.querySelector(
      '.search-result-item.keyboard-selected',
    );
    if (previousItem) previousItem.classList.remove('keyboard-selected');

    this.selectedIndex += direction;
    if (this.selectedIndex < 0)
      this.selectedIndex = this.currentResults.length - 1;
    else if (this.selectedIndex >= this.currentResults.length)
      this.selectedIndex = 0;

    const items = this.resultsContainer.querySelectorAll('.search-result-item');
    if (items[this.selectedIndex]) {
      items[this.selectedIndex].classList.add('keyboard-selected');
      items[this.selectedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }

  async handleSearch(query) {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length === 0) {
      this.resultsContainer.innerHTML = '';
      this.currentResults = [];
      this.selectedIndex = -1;
      return;
    }

    this.lastQuery = trimmedQuery;
    this.showLoader(true);

    try {
      const data = await this.fetchResults(trimmedQuery);
      this.currentResults = data.results;
      this.selectedIndex = -1;

      if (data.results.length > 0 || data.summary) {
        // Use the server-provided `categories` to decide which category groups to show
        this.displayResults(
          data.results,
          trimmedQuery,
          data.summary,
          data.categories || {},
        );
      } else {
        this.showEmptyState(`Keine Ergebnisse für "${trimmedQuery}"`);
      }
    } catch (error) {
      _log.error('Search failed', error);
      this.showEmptyState(
        'Fehler bei der Suche. Bitte versuchen Sie es später erneut.',
      );
    } finally {
      this.showLoader(false);
    }
  }

  async fetchResults(query) {
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, topK: 20 }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();

      return {
        results: (data.results || []).map((item) => ({
          ...item,
          icon: item.icon || this.getIconForCategory(item.category || 'Seite'),
        })),
        summary: data.summary || '',
        categories: data.categories || {},
      };
    } catch (e) {
      console.error('API Search Error:', e);
      return { results: [], summary: '', categories: {} };
    }
  }

  getIconForCategory(category) {
    const icons = {
      Seite: '📄',
      Blog: '📝',
      Projekte: '💻',
      Videos: '🎬',
      Galerie: '🖼️',
      'Über mich': 'ℹ️',
      Kontakt: '✉️',
      Home: '🏠',
    };
    return icons[category] || '🔍';
  }

  showLoader(show) {
    if (this.loader) {
      // @ts-ignore
      this.loader.style.display = show ? 'block' : 'none';
    }
  }

  // Use server-provided `categories` to decide which category groups to render.
  // Only categories present in `categories` with a count > 0 will be shown.
  displayResults(results, query, summary = '', categories = {}) {
    const grouped = {};
    results.forEach((result) => {
      const cat = result.category || 'Allgemein';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(result);
    });

    let html = '';

    // Modern Extension: AI Summary
    if (summary) {
      html += `
        <div class="search-ai-summary">
          <div class="search-ai-header">
            <span class="search-ai-icon">✨</span>
            <span class="search-ai-title">AI OVERVIEW</span>
          </div>
          <div class="search-ai-content">${this.escapeHTML(summary)}</div>
        </div>
      `;
    }

    if (results.length > 0) {
      // Prefer the server-provided category ordering/counts; fall back to grouped keys
      const categoriesToShow = Object.keys(categories || {}).filter(
        (c) =>
          (categories[c] || 0) > 0 &&
          Array.isArray(grouped[c]) &&
          grouped[c].length > 0,
      );

      const finalCategories =
        categoriesToShow.length > 0
          ? categoriesToShow.sort(
              (a, b) => (categories[b] || 0) - (categories[a] || 0),
            )
          : Object.keys(grouped).filter(
              (c) => grouped[c] && grouped[c].length > 0,
            );

      html += `
        <div class="search-stats">
          <span class="search-stats-icon">⚡</span>
          <span class="search-stats-count">${results.length}</span>
          ${results.length === 1 ? 'Ergebnis' : 'Ergebnisse'}
        </div>
        ${finalCategories
          .map(
            (category) => `
          <div class="search-category-group">
            <div class="search-category-header">
              <span>${category}${categories[category] ? ` (${categories[category]})` : ''}</span>
              <div class="search-category-divider"></div>
            </div>
            ${(grouped[category] || [])
              .map((result) => this.createResultHTML(result, query))
              .join('')}
          </div>
        `,
          )
          .join('')}
      `;
    }

    this.resultsContainer.innerHTML = html;

    this.resultsContainer
      .querySelectorAll('.search-result-item')
      .forEach((item, index) => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          this.selectResult(index);
        });

        item.addEventListener('mouseenter', () => {
          this.resultsContainer
            .querySelectorAll('.search-result-item')
            .forEach((el) => el.classList.remove('keyboard-selected'));
          this.selectedIndex = index;
          item.classList.add('keyboard-selected');
        });
      });
  }

  createResultHTML(result, query) {
    const safeTitle = this.escapeHTML(result.title || '');
    const safeDesc = this.escapeHTML(result.description || '');
    const safeUrl = this.escapeHTML(result.url || '#');
    const safeId = this.escapeHTML(result.id || '');
    const safeIcon = this.escapeHTML(result.icon || '📄');

    const highlightedTitle = this.highlightText(safeTitle, query);
    const highlightedDesc = this.highlightText(safeDesc, query);

    return `
      <a href="${safeUrl}" class="search-result-item" data-id="${safeId}">
        <div class="search-result-icon-wrapper">
          ${safeIcon}
        </div>
        <div class="search-result-content">
          <div class="search-result-title-row">
            <div class="search-result-title">${highlightedTitle}</div>
          </div>
          <div class="search-result-description">${highlightedDesc}</div>
        </div>
      </a>
    `;
  }

  escapeHTML(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c],
    );
  }

  highlightText(text, query) {
    if (!query || !text) return text;

    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (words.length === 0) return text;

    const pattern = words
      .sort((a, b) => b.length - a.length)
      .map((w) => this.escapeRegex(w))
      .join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');

    const parts = text.split(/(<[^>]+>)/g);

    return parts
      .map((part) => {
        if (part.startsWith('<')) return part;
        return part.replace(
          regex,
          '<span class="search-result-highlight">$1</span>',
        );
      })
      .join('');
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  showEmptyState(message) {
    const html = `
      <div class="search-empty">
        <div class="search-empty-icon">🔍</div>
        <div class="search-empty-text">${message || 'Keine Ergebnisse'}</div>
      </div>
    `;
    this.resultsContainer.innerHTML = html;
    this.currentResults = [];
    this.selectedIndex = -1;
  }

  selectResult(index) {
    if (index < 0 || index >= this.currentResults.length) return;
    const result = this.currentResults[index];
    _log.info(`Navigating to: ${result.url}`);

    window.location.href = result.url;
    this.close();
  }

  destroy() {
    if (this._handleKeydown) {
      document.removeEventListener('keydown', this._handleKeydown);
      this._handleKeydown = null;
    }
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
    this.close();
    if (this.overlay?.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.input = null;
    this.resultsContainer = null;
  }
}

let searchInstance = null;

function initSearch() {
  if (searchInstance) return searchInstance;
  searchInstance = new SearchComponent();
  // @ts-ignore
  window.openSearch = () => searchInstance.open();
  // @ts-ignore
  window.closeSearch = () => searchInstance.close();
  // @ts-ignore
  window.toggleSearch = () => searchInstance.toggle();
  return searchInstance;
}

export function openSearch() {
  if (searchInstance) searchInstance.open();
  else {
    initSearch();
    if (searchInstance) searchInstance.open();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch);
} else {
  initSearch();
}
