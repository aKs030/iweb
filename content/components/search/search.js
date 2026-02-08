// @ts-check
/**
 * Search Component
 * Mac Spotlight-Inspired Search with Server-Side Optimization
 * @author Abdulkerim Sesli
 * @version 2.2.0
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
    /** @type {boolean} */
    this.isOpen = false;
    /** @type {Array} */
    this.currentResults = [];
    /** @type {number} */
    this.selectedIndex = -1;
    /** @type {number|null} */
    this.searchTimeout = null;

    this.init();
  }

  init() {
    this.createSearchOverlay();
    this.attachEventListeners();
    this.loadStyles();
    _log.info('Search component initialized with Server-Side API');
  }

  loadStyles() {
    // Use upsertHeadLink to prevent duplicate injections and allow cleaner management
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
              placeholder="Suche... (Powered by AI Search)"
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
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        // @ts-ignore
        this.searchTimeout = setTimeout(() => {
          // @ts-ignore
          this.handleSearch(e.target.value);
        }, 300); // 300ms Debounce for API
      });

      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(this.searchTimeout);
          if (this.currentResults.length > 0) {
            const index = this.selectedIndex >= 0 ? this.selectedIndex : 0;
            this.selectResult(index);
          } else {
            // Force search if enter is pressed and no results yet
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
    if (!this.input.value) {
      this.resultsContainer.innerHTML = '';
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
      this.resultsContainer.innerHTML = '';
      this.currentResults = [];
      this.selectedIndex = -1;
      return;
    }

    this.showLoader(true);

    try {
      const results = await this.fetchResults(trimmedQuery);
      this.currentResults = results;
      this.selectedIndex = -1;

      if (results.length > 0) {
        this.displayResults(results, trimmedQuery);
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

      // Enrich results with icons/metadata that might be missing from the lean index
      return (data.results || []).map((item) => ({
        ...item,
        // Map common IDs to icons if not returned by API
        icon: item.icon || this.getIconForCategory(item.category || 'Seite'),
      }));
    } catch (e) {
      console.error('API Search Error:', e);
      return [];
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
      // Optional: Add simple rotation or pulse CSS if needed
    }
  }

  displayResults(results, query) {
    const grouped = {};
    results.forEach((result) => {
      const cat = result.category || 'Allgemein';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(result);
    });

    const html = `
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
    if (!query) return text;
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    let highlightedText = text;
    words.forEach((word) => {
      const regex = new RegExp(`(${this.escapeRegex(word)})`, 'gi');
      highlightedText = highlightedText.replace(
        regex,
        '<span class="search-result-highlight">$1</span>',
      );
    });
    return highlightedText;
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
