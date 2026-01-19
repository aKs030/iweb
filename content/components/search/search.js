/**
 * Search Component
 * Mac Spotlight-Inspired Search with Advanced Features
 * Uses remote Cloudflare Worker API
 * @author Abdulkerim Sesli
 * @version 2.1.0
 */

/* exported initSearch, openSearch, closeSearch, toggleSearch */
/* eslint-disable import/no-unused-modules */
import { createLogger } from '/content/utils/shared-utilities.js';

const _log = createLogger('search');
const API_ENDPOINT =
  'https://throbbing-mode-6fe1-nlweb.httpsgithubcomaks030website.workers.dev/api/search';

class SearchComponent {
  constructor() {
    this.overlay = null;
    this.input = null;
    this.resultsContainer = null;
    this.isOpen = false;
    this.currentResults = [];
    this.selectedIndex = -1;
    this.searchTimeout = null;
    this.isLoading = false;
    this.abortController = null;

    this.init();
  }

  init() {
    this.createSearchOverlay();
    this.attachEventListeners();
    this.loadStyles();
    _log.info('Search component initialized with Remote API');
  }

  loadStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/content/components/search/search.css';
    link.dataset.injectedBy = 'search-js';
    document.head.appendChild(link);
  }

  createSearchOverlay() {
    // Entferne bestehende Overlays
    const existing = document.getElementById('search-overlay');
    if (existing) existing.remove();

    // Erstelle neues Overlay
    const overlay = document.createElement('div');
    overlay.id = 'search-overlay';
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
              class="search-input" 
              placeholder="Spotlight-Suche"
              aria-label="Suchfeld"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
            >
            <span class="search-icon" aria-hidden="true">🔍</span>
            <div class="search-loading" style="display: none;"></div>
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
    this.loadingIndicator = overlay.querySelector('.search-loading');

    // Event Listeners für Modal
    overlay
      .querySelector('.search-close')
      .addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
  }

  attachEventListeners() {
    // Globale Tastatur-Shortcuts
    document.addEventListener('keydown', (e) => {
      // Cmd+K oder Ctrl+K zum Öffnen
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }

      // ESC zum Schließen
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }

      // Pfeiltasten für Navigation (nur wenn Suche offen)
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
    });

    // Such-Input mit Debouncing
    if (this.input) {
      this.input.addEventListener('input', (e) => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.handleSearch(e.target.value);
        }, 300); // 300ms Debounce für Remote Request
      });

      // Sofortige Suche bei Enter (falls bereits Ergebnisse da sind oder um Suche zu erzwingen)
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(this.searchTimeout);
          if (this.currentResults.length > 0 && this.selectedIndex >= 0) {
            this.selectResult(this.selectedIndex);
          } else if (this.input.value.trim().length > 0) {
            this.handleSearch(this.input.value);
          }
        }
      });
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this.isOpen) return;

    this.isOpen = true;
    this.overlay.classList.add('active');
    this.selectedIndex = -1;

    // Focus auf Input mit Verzögerung für Animation
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (this.input) {
          this.input.focus();
          this.input.select();
        }
      }, 100);
    });

    // Body Scroll verhindern
    document.body.style.overflow = 'hidden';

    // Kein Empty State anzeigen – Modal bleibt leer wie bei macOS
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

    // Input leeren
    if (this.input) {
      this.input.value = '';
    }

    // Clear timeout & abort fetch
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    if (this.abortController) {
      this.abortController.abort();
    }

    // Loading aus
    this.setLoading(false);

    // Body Scroll wieder erlauben
    document.body.style.overflow = '';

    _log.info('Search closed');
  }

  setLoading(state) {
    this.isLoading = state;
    if (this.loadingIndicator) {
      this.loadingIndicator.style.display = state ? 'block' : 'none';
      // Search icon toggeln
      const searchIcon = this.overlay.querySelector('.search-icon');
      if (searchIcon) searchIcon.style.display = state ? 'none' : 'block';
    }
  }

  navigateResults(direction) {
    if (this.currentResults.length === 0) return;

    // Entferne vorherige Selektion
    const previousItem = this.resultsContainer.querySelector(
      '.search-result-item.keyboard-selected',
    );
    if (previousItem) {
      previousItem.classList.remove('keyboard-selected');
    }

    // Berechne neuen Index
    this.selectedIndex += direction;

    // Wrap around
    if (this.selectedIndex < 0) {
      this.selectedIndex = this.currentResults.length - 1;
    } else if (this.selectedIndex >= this.currentResults.length) {
      this.selectedIndex = 0;
    }

    // Markiere neues Element
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
      this.setLoading(false);
      return;
    }

    this.setLoading(true);

    // Cancel previous request
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: trimmedQuery, topK: 20 }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      // API returns { results: [...] }
      const results = data.results || [];

      this.currentResults = results;
      this.selectedIndex = -1;

      if (results.length > 0) {
        this.displayResults(results, trimmedQuery);
      } else {
        this.showEmptyState(`Keine Ergebnisse für "${trimmedQuery}"`);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Ignore aborts
        return;
      }
      _log.error('Search failed:', err);
      this.showEmptyState(
        'Fehler bei der Suche. Bitte versuchen Sie es später.',
      );
    } finally {
      this.setLoading(false);
    }
  }

  displayResults(results, query) {
    // Gruppiere nach Kategorie
    const grouped = {};
    results.forEach((result) => {
      // Fallback falls Kategorie fehlt
      const category = result.category || 'Ergebnisse';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(result);
    });

    const html = `
      <div class="search-stats">
        <span class="search-stats-icon">🔍</span>
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

    // Event Listeners für Ergebnisse
    this.resultsContainer
      .querySelectorAll('.search-result-item')
      .forEach((item, index) => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          this.selectResult(index);
        });

        item.addEventListener('mouseenter', () => {
          // Entferne keyboard-selected von allen
          this.resultsContainer
            .querySelectorAll('.search-result-item')
            .forEach((el) => {
              el.classList.remove('keyboard-selected');
            });
          this.selectedIndex = index;
          item.classList.add('keyboard-selected');
        });
      });
  }

  createResultHTML(result, query) {
    // Highlight Query in Titel und Beschreibung
    const highlightedTitle = this.highlightText(result.title, query);
    const highlightedDesc = this.highlightText(result.description, query);

    // Fallback Icon
    const icon = result.icon || '📄';

    return `
      <a href="${result.url}" class="search-result-item" data-id="${result.id}">
        <div class="search-result-icon-wrapper">
          ${icon}
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

  highlightText(text, query) {
    if (!query || !text) return text;

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

  showEmptyState(message = null) {
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

    // Navigation
    window.location.href = result.url;

    // Schließe Search
    this.close();
  }
}

// Globale Instanz
let searchInstance = null;

/**
 * Initialisiert die Suchkomponente
 */
export function initSearch() {
  if (searchInstance) {
    _log.warn('Search already initialized');
    return searchInstance;
  }

  searchInstance = new SearchComponent();

  // Mache global verfügbar
  window.openSearch = () => searchInstance.open();
  window.closeSearch = () => searchInstance.close();
  window.toggleSearch = () => searchInstance.toggle();

  return searchInstance;
}

/**
 * Öffnet die Suche
 */
export function openSearch() {
  if (searchInstance) {
    searchInstance.open();
  } else {
    initSearch();
    if (searchInstance) searchInstance.open();
  }
}

/**
 * Schließt die Suche
 */
export function closeSearch() {
  if (searchInstance) {
    searchInstance.close();
  }
}

/**
 * Toggle Search
 */
export function toggleSearch() {
  if (searchInstance) {
    searchInstance.toggle();
  } else {
    openSearch();
  }
}

// Auto-Init wenn Dokument geladen ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch);
} else {
  initSearch();
}
