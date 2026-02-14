// @ts-check
/**
 * Search Component
 * Mac Spotlight-Inspired Search with Server-Side Optimization & AI Overview
 * @author Abdulkerim Sesli
 * @version 3.0.0
 */

/* exported initSearch, openSearch, closeSearch, toggleSearch */
import { createLogger } from '../../core/logger.js';
import { upsertHeadLink } from '../../core/utils.js';
import {
  TRENDING_SEARCHES,
  findQuickAction,
  getAutocompleteSuggestions,
  getDidYouMeanSuggestions,
} from './search-data.js';

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
    /** @type {HTMLElement|null} */
    this.suggestionsContainer = null;
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
    /** @type {Array<string>} */
    this.searchHistory = this.loadSearchHistory();
    /** @type {string} */
    this.activeFilter = 'all';

    this.init();
  }

  init() {
    this.createSearchOverlay();
    this.attachEventListeners();
    this.loadStyles();
    _log.info('Search component initialized with AI Search & Summary');
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
        <div class="search-header">
          <div class="search-input-wrapper">
            <input
              type="text"
              id="search-input"
              name="search"
              class="search-input"
              placeholder="Suche... (KI-gestützt)"
              aria-label="Suchfeld"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
            >
            <span class="search-icon" aria-hidden="true">🔍</span>
            <div class="search-loader" style="display: none;"></div>
          </div>
          <button class="search-close" aria-label="Suche schließen" title="ESC">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="search-autocomplete" style="display: none;"></div>

        <div class="search-filters">
          <button class="search-filter-btn active" data-filter="all">
            <span>Alle</span>
          </button>
          <button class="search-filter-btn" data-filter="Projekte">
            <span>💻</span>
            <span>Projekte</span>
          </button>
          <button class="search-filter-btn" data-filter="Blog">
            <span>📝</span>
            <span>Blog</span>
          </button>
          <button class="search-filter-btn" data-filter="Gallery">
            <span>🖼️</span>
            <span>Galerie</span>
          </button>
          <button class="search-filter-btn" data-filter="Videos">
            <span>🎬</span>
            <span>Videos</span>
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
    this.suggestionsContainer = overlay.querySelector('.search-autocomplete');

    overlay
      .querySelector('.search-close')
      .addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    // Filter buttons
    overlay.querySelectorAll('.search-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeFilter = btn.dataset.filter;
        overlay.querySelectorAll('.search-filter-btn').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        this.applyFilter();
      });
    });
  }

  attachEventListeners() {
    this._handleKeydown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }

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
      this.input.addEventListener('input', (e) => {
        const value = e.target.value;

        // Show autocomplete suggestions
        this.showAutocompleteSuggestions(value);

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
          this.hideAutocompleteSuggestions();

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

    document.body.style.overflow = 'hidden';

    // Show trending searches and quick actions if input is empty
    if (!this.input.value) {
      this.showTrendingAndQuickActions();
      this.currentResults = [];
      this.selectedIndex = -1;
    }

    _log.info('Search opened');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.classList.remove('active');
    this.selectedIndex = -1;
    if (this.input) this.input.value = '';
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    document.body.style.overflow = '';
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
      this.showTrendingAndQuickActions();
      this.currentResults = [];
      this.selectedIndex = -1;
      return;
    }

    this.lastQuery = trimmedQuery;
    this.hideAutocompleteSuggestions();

    // Check for Quick Action
    const quickAction = findQuickAction(trimmedQuery);
    if (quickAction) {
      _log.info(`Quick action detected: ${quickAction.label}`);
      window.location.href = quickAction.url;
      this.close();
      return;
    }

    this.showLoader(true);

    try {
      const data = await this.fetchResults(trimmedQuery);
      this.currentResults = data.results;
      this.selectedIndex = -1;

      if (data.results.length > 0 || data.summary) {
        this.displayResults(data.results, trimmedQuery, data.summary);
        this.applyFilter();
      } else {
        // Show "Did you mean?" suggestions
        const suggestions = getDidYouMeanSuggestions(trimmedQuery);
        this.showEmptyStateWithSuggestions(trimmedQuery, suggestions);
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
      };
    } catch (e) {
      console.error('API Search Error:', e);
      return { results: [], summary: '' };
    }
  }

  getIconForCategory(category) {
    const icons = {
      Seite: '📄',
      Blog: '📝',
      Projekt: '💻',
      Video: '🎬',
      Galerie: '🖼️',
      About: 'ℹ️',
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

  displayResults(results, query, summary = '') {
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
      html += `
        <div class="search-stats">
          <span class="search-stats-icon">⚡</span>
          <span class="search-stats-count">${results.length}</span>
          ${results.length === 1 ? 'Ergebnis' : 'Ergebnisse'}
        </div>
        ${Object.entries(grouped)
          .map(
            ([category, items]) => `
          <div class="search-category-group">
            <div class="search-category-header">
              <span>${category}</span>
              <div class="search-category-divider"></div>
            </div>
            ${items
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
        <div class="search-empty-text">${message || 'Keine Ergebnisse'}</div>
      </div>
    `;
    this.resultsContainer.innerHTML = html;
    this.currentResults = [];
    this.selectedIndex = -1;
  }

  /**
   * Show empty state with "Did you mean?" suggestions
   */
  showEmptyStateWithSuggestions(query, suggestions) {
    let html = `
      <div class="search-empty">
        <div class="search-empty-icon">🔍</div>
        <div class="search-empty-text">Keine Ergebnisse für "${this.escapeHTML(query)}"</div>
    `;

    if (suggestions.length > 0) {
      html += `
        <div class="search-did-you-mean">
          <div class="search-did-you-mean-title">Meinten Sie:</div>
          <div class="search-did-you-mean-suggestions">
            ${suggestions.map((suggestion) => `<button class="search-did-you-mean-btn" data-suggestion="${this.escapeHTML(suggestion)}">${this.escapeHTML(suggestion)}</button>`).join('')}
          </div>
        </div>
      `;
    }

    html += `</div>`;

    this.resultsContainer.innerHTML = html;
    this.currentResults = [];
    this.selectedIndex = -1;

    // Add click handlers for suggestions
    this.resultsContainer
      .querySelectorAll('.search-did-you-mean-btn')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const suggestion = btn.dataset.suggestion;
          this.input.value = suggestion;
          this.handleSearch(suggestion);
        });
      });
  }

  selectResult(index) {
    if (index < 0 || index >= this.currentResults.length) return;
    const result = this.currentResults[index];
    _log.info(`Navigating to: ${result.url}`);

    // Save to search history
    this.saveToSearchHistory(this.lastQuery);

    window.location.href = result.url;
    this.close();
  }

  /**
   * Show autocomplete suggestions
   */
  showAutocompleteSuggestions(query) {
    if (!query || query.length < 2) {
      this.hideAutocompleteSuggestions();
      return;
    }

    const suggestions = getAutocompleteSuggestions(query, 5);

    if (suggestions.length === 0) {
      this.hideAutocompleteSuggestions();
      return;
    }

    const html = suggestions
      .map(
        (suggestion) => `
      <div class="search-autocomplete-item" data-suggestion="${this.escapeHTML(suggestion)}">
        <span class="search-autocomplete-icon">🔍</span>
        <span class="search-autocomplete-text">${this.escapeHTML(suggestion)}</span>
      </div>
    `,
      )
      .join('');

    this.suggestionsContainer.innerHTML = html;
    this.suggestionsContainer.style.display = 'block';

    // Add click handlers
    this.suggestionsContainer
      .querySelectorAll('.search-autocomplete-item')
      .forEach((item) => {
        item.addEventListener('click', () => {
          const suggestion = item.dataset.suggestion;
          this.input.value = suggestion;
          this.hideAutocompleteSuggestions();
          this.handleSearch(suggestion);
        });
      });
  }

  /**
   * Hide autocomplete suggestions
   */
  hideAutocompleteSuggestions() {
    if (this.suggestionsContainer) {
      this.suggestionsContainer.style.display = 'none';
      this.suggestionsContainer.innerHTML = '';
    }
  }

  /**
   * Load search history from localStorage
   */
  loadSearchHistory() {
    try {
      const history = localStorage.getItem('search_history');
      return history ? JSON.parse(history) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save query to search history
   */
  saveToSearchHistory(query) {
    if (!query || query.length < 2) return;

    try {
      const history = this.loadSearchHistory();
      const filtered = history.filter((q) => q !== query);
      filtered.unshift(query);

      // Keep only last 10 searches
      const updated = filtered.slice(0, 10);
      localStorage.setItem('search_history', JSON.stringify(updated));
      this.searchHistory = updated;
    } catch (e) {
      _log.warn('Failed to save search history', e);
    }
  }

  /**
   * Show trending searches and quick actions when input is empty
   */
  showTrendingAndQuickActions() {
    let html = '';

    // Quick Actions
    html += `
      <div class="search-section">
        <div class="search-section-header">
          <span class="search-section-icon">⚡</span>
          <span class="search-section-title">Quick Actions</span>
        </div>
        <div class="search-quick-actions">
          ${findQuickAction('home') ? this.createQuickActionHTML(findQuickAction('home')) : ''}
          ${findQuickAction('projekte') ? this.createQuickActionHTML(findQuickAction('projekte')) : ''}
          ${findQuickAction('blog') ? this.createQuickActionHTML(findQuickAction('blog')) : ''}
          ${findQuickAction('galerie') ? this.createQuickActionHTML(findQuickAction('galerie')) : ''}
        </div>
      </div>
    `;

    // Trending Searches
    html += `
      <div class="search-section">
        <div class="search-section-header">
          <span class="search-section-icon">🔥</span>
          <span class="search-section-title">Beliebte Suchen</span>
        </div>
        <div class="search-trending">
          ${TRENDING_SEARCHES.map((item) => this.createTrendingItemHTML(item)).join('')}
        </div>
      </div>
    `;

    // Recent Searches
    if (this.searchHistory.length > 0) {
      html += `
        <div class="search-section">
          <div class="search-section-header">
            <span class="search-section-icon">🕐</span>
            <span class="search-section-title">Letzte Suchen</span>
          </div>
          <div class="search-recent">
            ${this.searchHistory
              .slice(0, 5)
              .map((query) => this.createRecentSearchHTML(query))
              .join('')}
          </div>
        </div>
      `;
    }

    this.resultsContainer.innerHTML = html;

    // Add event listeners
    this.resultsContainer
      .querySelectorAll('.search-quick-action')
      .forEach((item) => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = item.dataset.url;
          this.close();
        });
      });

    this.resultsContainer
      .querySelectorAll('.search-trending-item, .search-recent-item')
      .forEach((item) => {
        item.addEventListener('click', () => {
          const query = item.dataset.query;
          this.input.value = query;
          this.handleSearch(query);
        });
      });
  }

  /**
   * Create Quick Action HTML
   */
  createQuickActionHTML(action) {
    return `
      <div class="search-quick-action" data-url="${this.escapeHTML(action.url)}">
        <span class="search-quick-action-icon">${action.icon}</span>
        <div class="search-quick-action-content">
          <div class="search-quick-action-label">${this.escapeHTML(action.label)}</div>
          <div class="search-quick-action-desc">${this.escapeHTML(action.description)}</div>
        </div>
      </div>
    `;
  }

  /**
   * Create Trending Item HTML
   */
  createTrendingItemHTML(item) {
    return `
      <div class="search-trending-item" data-query="${this.escapeHTML(item.query)}">
        <span class="search-trending-icon">${item.icon}</span>
        <span class="search-trending-text">${this.escapeHTML(item.query)}</span>
      </div>
    `;
  }

  /**
   * Create Recent Search HTML
   */
  createRecentSearchHTML(query) {
    return `
      <div class="search-recent-item" data-query="${this.escapeHTML(query)}">
        <span class="search-recent-icon">🕐</span>
        <span class="search-recent-text">${this.escapeHTML(query)}</span>
      </div>
    `;
  }

  /**
   * Apply active filter to results
   */
  applyFilter() {
    if (this.activeFilter === 'all') {
      // Show all results
      this.resultsContainer
        .querySelectorAll('.search-category-group')
        .forEach((group) => {
          group.style.display = 'block';
        });
    } else {
      // Filter by category
      this.resultsContainer
        .querySelectorAll('.search-category-group')
        .forEach((group) => {
          const header = group.querySelector('.search-category-header span');
          const category = header ? header.textContent.trim() : '';
          group.style.display =
            category === this.activeFilter ? 'block' : 'none';
        });
    }
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
