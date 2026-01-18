/**
 * Search Component
 * Mac Spotlight-Inspired Search with Advanced Features
 * @author Abdulkerim Sesli
 * @version 2.0.0
 */

import { createLogger } from '/content/utils/shared-utilities.js';

const _log = createLogger('search');

/**
 * Search Index - Enthält alle durchsuchbaren Inhalte der Webseite
 */
const SEARCH_INDEX = [
  // Hauptseiten
  {
    id: 'home',
    title: 'Home',
    description: 'Web Developer & Photographer in Berlin. Spezialisiert auf React, Three.js und Urban Photography.',
    category: 'Seite',
    url: '/',
    icon: '🏠',
    keywords: ['home', 'start', 'hauptseite', 'portfolio', 'abdulkerim sesli'],
    priority: 10
  },
  {
    id: 'about',
    title: 'Über mich',
    description: 'Erfahre mehr über meine Arbeit, Fähigkeiten und meinen Werdegang als Web Developer und Fotograf.',
    category: 'Seite',
    url: '/pages/about/',
    icon: '👤',
    keywords: ['über', 'about', 'biografie', 'cv', 'lebenslauf', 'skills', 'fähigkeiten'],
    priority: 9
  },
  {
    id: 'projekte',
    title: 'Projekte',
    description: 'Eine Auswahl meiner Web-Entwicklungsprojekte mit React, Three.js und modernen Technologien.',
    category: 'Seite',
    url: '/pages/projekte/',
    icon: '💼',
    keywords: ['projekte', 'projects', 'portfolio', 'arbeiten', 'react', 'threejs', 'web development'],
    priority: 9
  },
  {
    id: 'gallery',
    title: 'Galerie',
    description: 'Fotografie-Portfolio mit Urban Photography und kreativen Aufnahmen aus Berlin.',
    category: 'Seite',
    url: '/pages/gallery/',
    icon: '📸',
    keywords: ['galerie', 'gallery', 'fotografie', 'photography', 'bilder', 'fotos', 'urban'],
    priority: 8
  },
  {
    id: 'blog',
    title: 'Blog',
    description: 'Artikel über Webentwicklung, Design, Fotografie und Technologie.',
    category: 'Seite',
    url: '/pages/blog/',
    icon: '📝',
    keywords: ['blog', 'artikel', 'posts', 'tutorials', 'guides'],
    priority: 8
  },
  {
    id: 'videos',
    title: 'Videos',
    description: 'Video-Portfolio mit Tutorials und kreativen Projekten.',
    category: 'Seite',
    url: '/pages/videos/',
    icon: '🎬',
    keywords: ['videos', 'tutorials', 'youtube', 'film'],
    priority: 7
  },

  // Blog Posts
  {
    id: 'blog-modern-ui',
    title: 'Modern UI Design',
    description: 'Moderne UI-Design-Prinzipien und Best Practices für Web-Anwendungen.',
    category: 'Blog',
    url: '/pages/blog/modern-ui-design/',
    icon: '🎨',
    keywords: ['ui', 'design', 'interface', 'ux', 'user experience', 'modern', 'glassmorphism'],
    priority: 6
  },
  {
    id: 'blog-react-no-build',
    title: 'React ohne Build-Tools',
    description: 'Wie man React ohne komplexe Build-Prozesse direkt im Browser nutzt.',
    category: 'Blog',
    url: '/pages/blog/react-no-build/',
    icon: '⚛️',
    keywords: ['react', 'no build', 'esm', 'modules', 'javascript', 'frontend'],
    priority: 6
  },
  {
    id: 'blog-threejs-performance',
    title: 'Three.js Performance',
    description: 'Performance-Optimierung für Three.js Anwendungen und 3D-Grafik im Web.',
    category: 'Blog',
    url: '/pages/blog/threejs-performance/',
    icon: '🎮',
    keywords: ['threejs', 'three.js', '3d', 'webgl', 'performance', 'optimization'],
    priority: 6
  },
  {
    id: 'blog-visual-storytelling',
    title: 'Visual Storytelling',
    description: 'Geschichten visuell erzählen mit Fotografie und Webdesign.',
    category: 'Blog',
    url: '/pages/blog/visual-storytelling/',
    icon: '📖',
    keywords: ['storytelling', 'visual', 'fotografie', 'design', 'narrative'],
    priority: 5
  },

  // Technologien
  {
    id: 'tech-react',
    title: 'React Entwicklung',
    description: 'Moderne React-Anwendungen mit Hooks, Context und Performance-Optimierungen.',
    category: 'Technologie',
    url: '/pages/projekte/#react',
    icon: '⚛️',
    keywords: ['react', 'javascript', 'frontend', 'spa', 'hooks', 'jsx'],
    priority: 7
  },
  {
    id: 'tech-threejs',
    title: 'Three.js & WebGL',
    description: '3D-Grafik und interaktive Visualisierungen mit Three.js im Browser.',
    category: 'Technologie',
    url: '/pages/projekte/#threejs',
    icon: '🌐',
    keywords: ['threejs', 'webgl', '3d', 'graphics', 'animation', 'particles'],
    priority: 7
  },
  {
    id: 'tech-photography',
    title: 'Fotografie',
    description: 'Urban Photography, Portrait und kreative Fotografie in Berlin.',
    category: 'Technologie',
    url: '/pages/gallery/',
    icon: '📷',
    keywords: ['fotografie', 'photography', 'kamera', 'bilder', 'urban', 'portrait'],
    priority: 6
  },

  // Kontakt & Legal
  {
    id: 'impressum',
    title: 'Impressum',
    description: 'Rechtliche Informationen und Kontaktdaten.',
    category: 'Info',
    url: '/content/components/footer/impressum.html',
    icon: 'ℹ️',
    keywords: ['impressum', 'legal', 'kontakt', 'contact', 'anschrift'],
    priority: 3
  },
  {
    id: 'datenschutz',
    title: 'Datenschutz',
    description: 'Datenschutzerklärung und Informationen zum Umgang mit personenbezogenen Daten.',
    category: 'Info',
    url: '/content/components/footer/datenschutz.html',
    icon: '🔒',
    keywords: ['datenschutz', 'privacy', 'dsgvo', 'gdpr', 'cookies'],
    priority: 3
  }
];

/**
 * Quick Actions für schnellen Zugriff
 */
const QUICK_ACTIONS = [
  { label: 'Alle Projekte', icon: '💼', url: '/pages/projekte/' },
  { label: 'Foto-Galerie', icon: '📸', url: '/pages/gallery/' },
  { label: 'Blog lesen', icon: '📝', url: '/pages/blog/' },
  { label: 'Videos ansehen', icon: '🎬', url: '/pages/videos/' }
];

class SearchComponent {
  constructor() {
    this.overlay = null;
    this.input = null;
    this.resultsContainer = null;
    this.isOpen = false;
    this.searchIndex = SEARCH_INDEX;
    this.currentResults = [];
    this.selectedIndex = -1;
    this.recentSearches = this.loadRecentSearches();
    this.searchTimeout = null;

    this.init();
  }

  init() {
    this.createSearchOverlay();
    this.attachEventListeners();
    this.loadStyles();
    _log.info('Search component initialized with Spotlight design');
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

    // Event Listeners für Modal
    overlay.querySelector('.search-close').addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
  }

  createQuickActionsHTML() {
    return `
      <div class="search-quick-actions">
        ${QUICK_ACTIONS.map(action => `
          <a href="${action.url}" class="search-quick-action">
            <div class="search-quick-action-icon">${action.icon}</div>
            <span class="search-quick-action-label">${action.label}</span>
          </a>
        `).join('')}
      </div>
    `;
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
        }, 150); // 150ms Debounce
      });

      // Sofortige Suche bei Enter
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(this.searchTimeout);
          if (this.currentResults.length > 0) {
            const index = this.selectedIndex >= 0 ? this.selectedIndex : 0;
            this.selectResult(index);
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

    // Kein Empty State anzeigen – Modal bleibt leer wie bei macOS 26.2
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

    // Clear timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Body Scroll wieder erlauben
    document.body.style.overflow = '';

    _log.info('Search closed');
  }

  navigateResults(direction) {
    if (this.currentResults.length === 0) return;

    // Entferne vorherige Selektion
    const previousItem = this.resultsContainer.querySelector('.search-result-item.keyboard-selected');
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
        behavior: 'smooth'
      });
    }
  }

  handleSearch(query) {
    const trimmedQuery = query.trim().toLowerCase();

    if (trimmedQuery.length === 0) {
      this.resultsContainer.innerHTML = '';
      this.currentResults = [];
      this.selectedIndex = -1;
      return;
    }



    // Suche durchführen
    const results = this.searchInIndex(trimmedQuery);
    this.currentResults = results;
    this.selectedIndex = -1;

    if (results.length > 0) {
      this.displayResults(results, trimmedQuery);
      // Speichere Suche
      this.saveRecentSearch(trimmedQuery);
    } else {
      this.showEmptyState(`Keine Ergebnisse für "${trimmedQuery}"`);
    }
  }

  searchInIndex(query) {
    const results = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);

    this.searchIndex.forEach(item => {
      let score = item.priority || 0; // Start mit Priorität
      const titleLower = item.title.toLowerCase();
      const descLower = item.description.toLowerCase();

      // Exakte Titel-Übereinstimmung (höchste Priorität)
      if (titleLower === queryLower) {
        score += 1000;
      } else if (titleLower.startsWith(queryLower)) {
        score += 500;
      } else if (titleLower.includes(queryLower)) {
        score += 200;
      }

      // Übereinstimmung in der Beschreibung
      if (descLower.includes(queryLower)) {
        score += 100;
      }

      // Keyword-Matching
      item.keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        if (keywordLower === queryLower) {
          score += 150;
        } else if (keywordLower.startsWith(queryLower)) {
          score += 80;
        } else if (keywordLower.includes(queryLower)) {
          score += 40;
        }
      });

      // Multi-Word-Matching
      queryWords.forEach(word => {
        if (titleLower.includes(word)) score += 30;
        if (descLower.includes(word)) score += 15;

        item.keywords.forEach(keyword => {
          if (keyword.toLowerCase().includes(word)) score += 20;
        });
      });

      // Fuzzy-Matching für Tippfehler (Levenshtein-Distanz vereinfacht)
      const titleWords = titleLower.split(/\s+/);
      titleWords.forEach(tw => {
        if (this.isSimilar(tw, queryLower)) {
          score += 50;
        }
      });

      if (score > 0) {
        results.push({ ...item, score });
      }
    });

    // Sortiere nach Score (höchster zuerst)
    return results.sort((a, b) => b.score - a.score).slice(0, 20); // Max 20 Ergebnisse
  }

  isSimilar(str1, str2) {
    // Einfache Ähnlichkeitsprüfung
    if (str1.length < 3 || str2.length < 3) return false;
    const shorter = str1.length < str2.length ? str1 : str2;
    const longer = str1.length >= str2.length ? str1 : str2;
    return longer.includes(shorter.substring(0, shorter.length - 1));
  }

  displayResults(results, query) {
    if (results.length === 0) {
      this.showEmptyState(`Keine Ergebnisse für "${query}"`);
      return;
    }

    // Gruppiere nach Kategorie
    const grouped = {};
    results.forEach(result => {
      if (!grouped[result.category]) {
        grouped[result.category] = [];
      }
      grouped[result.category].push(result);
    });

    const html = `
      <div class="search-stats">
        <span class="search-stats-icon">🔍</span>
        <span class="search-stats-count">${results.length}</span> 
        ${results.length === 1 ? 'Ergebnis' : 'Ergebnisse'}
      </div>
      ${Object.entries(grouped).map(([category, items]) => `
        <div class="search-category-group">
          <div class="search-category-header">
            <span>${category}</span>
            <div class="search-category-divider"></div>
          </div>
          ${items.map((result, index) => this.createResultHTML(result, query)).join('')}
        </div>
      `).join('')}
    `;

    this.resultsContainer.innerHTML = html;

    // Event Listeners für Ergebnisse
    this.resultsContainer.querySelectorAll('.search-result-item').forEach((item, index) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectResult(index);
      });

      item.addEventListener('mouseenter', () => {
        // Entferne keyboard-selected von allen
        this.resultsContainer.querySelectorAll('.search-result-item').forEach(el => {
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

    return `
      <a href="${result.url}" class="search-result-item" data-id="${result.id}">
        <div class="search-result-icon-wrapper">
          ${result.icon || '📄'}
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
    if (!query) return text;

    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    let highlightedText = text;

    words.forEach(word => {
      const regex = new RegExp(`(${this.escapeRegex(word)})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<span class="search-result-highlight">$1</span>');
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
    _log.info(`Navigating to: ${result.url} (score: ${result.score})`);

    // Navigation
    window.location.href = result.url;

    // Schließe Search
    this.close();
  }

  // Recent Searches Management
  loadRecentSearches() {
    try {
      const stored = localStorage.getItem('search-recent');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      _log.warn('Failed to load recent searches:', e);
      return [];
    }
  }

  saveRecentSearch(query) {
    try {
      const recent = this.recentSearches.filter(q => q !== query);
      recent.unshift(query);
      this.recentSearches = recent.slice(0, 5); // Max 5 recent
      localStorage.setItem('search-recent', JSON.stringify(this.recentSearches));
    } catch (e) {
      _log.warn('Failed to save recent search:', e);
    }
  }

  clearRecentSearches() {
    try {
      this.recentSearches = [];
      localStorage.removeItem('search-recent');
      _log.info('Recent searches cleared');
    } catch (e) {
      _log.warn('Failed to clear recent searches:', e);
    }
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
