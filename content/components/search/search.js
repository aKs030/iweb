/**
 * Search Component
 * Volltext-Suche für die Webseite mit Fuzzy-Matching
 * @author Abdulkerim Sesli
 * @version 1.0.0
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
    keywords: ['home', 'start', 'hauptseite', 'portfolio', 'abdulkerim sesli']
  },
  {
    id: 'about',
    title: 'Über mich',
    description: 'Erfahre mehr über meine Arbeit, Fähigkeiten und meinen Werdegang als Web Developer und Fotograf.',
    category: 'Seite',
    url: '/pages/about/',
    keywords: ['über', 'about', 'biografie', 'cv', 'lebenslauf', 'skills', 'fähigkeiten']
  },
  {
    id: 'projekte',
    title: 'Projekte',
    description: 'Eine Auswahl meiner Web-Entwicklungsprojekte mit React, Three.js und modernen Technologien.',
    category: 'Seite',
    url: '/pages/projekte/',
    keywords: ['projekte', 'projects', 'portfolio', 'arbeiten', 'react', 'threejs', 'web development']
  },
  {
    id: 'gallery',
    title: 'Galerie',
    description: 'Fotografie-Portfolio mit Urban Photography und kreativen Aufnahmen aus Berlin.',
    category: 'Seite',
    url: '/pages/gallery/',
    keywords: ['galerie', 'gallery', 'fotografie', 'photography', 'bilder', 'fotos', 'urban']
  },
  {
    id: 'blog',
    title: 'Blog',
    description: 'Artikel über Webentwicklung, Design, Fotografie und Technologie.',
    category: 'Seite',
    url: '/pages/blog/',
    keywords: ['blog', 'artikel', 'posts', 'tutorials', 'guides']
  },
  {
    id: 'videos',
    title: 'Videos',
    description: 'Video-Portfolio mit Tutorials und kreativen Projekten.',
    category: 'Seite',
    url: '/pages/videos/',
    keywords: ['videos', 'tutorials', 'youtube', 'film']
  },

  // Blog Posts
  {
    id: 'blog-modern-ui',
    title: 'Modern UI Design',
    description: 'Moderne UI-Design-Prinzipien und Best Practices für Web-Anwendungen.',
    category: 'Blog',
    url: '/pages/blog/modern-ui-design/',
    keywords: ['ui', 'design', 'interface', 'ux', 'user experience', 'modern', 'glassmorphism']
  },
  {
    id: 'blog-react-no-build',
    title: 'React ohne Build-Tools',
    description: 'Wie man React ohne komplexe Build-Prozesse direkt im Browser nutzt.',
    category: 'Blog',
    url: '/pages/blog/react-no-build/',
    keywords: ['react', 'no build', 'esm', 'modules', 'javascript', 'frontend']
  },
  {
    id: 'blog-threejs-performance',
    title: 'Three.js Performance',
    description: 'Performance-Optimierung für Three.js Anwendungen und 3D-Grafik im Web.',
    category: 'Blog',
    url: '/pages/blog/threejs-performance/',
    keywords: ['threejs', 'three.js', '3d', 'webgl', 'performance', 'optimization']
  },
  {
    id: 'blog-visual-storytelling',
    title: 'Visual Storytelling',
    description: 'Geschichten visuell erzählen mit Fotografie und Webdesign.',
    category: 'Blog',
    url: '/pages/blog/visual-storytelling/',
    keywords: ['storytelling', 'visual', 'fotografie', 'design', 'narrative']
  },

  // Technologien
  {
    id: 'tech-react',
    title: 'React Entwicklung',
    description: 'Moderne React-Anwendungen mit Hooks, Context und Performance-Optimierungen.',
    category: 'Technologie',
    url: '/pages/projekte/#react',
    keywords: ['react', 'javascript', 'frontend', 'spa', 'hooks', 'jsx']
  },
  {
    id: 'tech-threejs',
    title: 'Three.js & WebGL',
    description: '3D-Grafik und interaktive Visualisierungen mit Three.js im Browser.',
    category: 'Technologie',
    url: '/pages/projekte/#threejs',
    keywords: ['threejs', 'webgl', '3d', 'graphics', 'animation', 'particles']
  },
  {
    id: 'tech-photography',
    title: 'Fotografie',
    description: 'Urban Photography, Portrait und kreative Fotografie in Berlin.',
    category: 'Technologie',
    url: '/pages/gallery/',
    keywords: ['fotografie', 'photography', 'kamera', 'bilder', 'urban', 'portrait']
  },

  // Kontakt & Legal
  {
    id: 'impressum',
    title: 'Impressum',
    description: 'Rechtliche Informationen und Kontaktdaten.',
    category: 'Info',
    url: '/content/components/footer/impressum.html',
    keywords: ['impressum', 'legal', 'kontakt', 'contact', 'anschrift']
  },
  {
    id: 'datenschutz',
    title: 'Datenschutz',
    description: 'Datenschutzerklärung und Informationen zum Umgang mit personenbezogenen Daten.',
    category: 'Info',
    url: '/content/components/footer/datenschutz.html',
    keywords: ['datenschutz', 'privacy', 'dsgvo', 'gdpr', 'cookies']
  }
];

class SearchComponent {
  constructor() {
    this.overlay = null;
    this.input = null;
    this.resultsContainer = null;
    this.isOpen = false;
    this.searchIndex = SEARCH_INDEX;
    this.currentResults = [];

    this.init();
  }

  init() {
    this.createSearchOverlay();
    this.attachEventListeners();
    this.loadStyles();
    _log.info('Search component initialized');
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
            <span class="search-icon">🔍</span>
            <input 
              type="text" 
              class="search-input" 
              placeholder="Suche nach Seiten, Projekten, Blog-Posts..."
              aria-label="Suchfeld"
              autocomplete="off"
              spellcheck="false"
            >
          </div>
          <button class="search-close" aria-label="Suche schließen" title="Schließen (ESC)">
            ✕
          </button>
        </div>
        
        <div class="search-results" role="region" aria-live="polite">
          <div class="search-empty">
            <div class="search-empty-icon">🔍</div>
            <div class="search-empty-text">Gib einen Suchbegriff ein</div>
            <div class="search-empty-hint">Suche nach Seiten, Projekten oder Blog-Posts</div>
          </div>
        </div>

        <div class="search-shortcuts">
          <span class="search-shortcut">
            <kbd class="search-shortcut-key">↑</kbd>
            <kbd class="search-shortcut-key">↓</kbd>
            <span>Navigieren</span>
          </span>
          <span class="search-shortcut">
            <kbd class="search-shortcut-key">↵</kbd>
            <span>Auswählen</span>
          </span>
          <span class="search-shortcut">
            <kbd class="search-shortcut-key">ESC</kbd>
            <span>Schließen</span>
          </span>
        </div>
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

  attachEventListeners() {
    // Tastatur-Shortcuts
    document.addEventListener('keydown', (e) => {
      // Cmd+K oder Ctrl+K zum Öffnen
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.open();
      }

      // ESC zum Schließen
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Such-Input
    if (this.input) {
      this.input.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });

      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && this.currentResults.length > 0) {
          this.selectResult(0);
        }
      });
    }
  }

  open() {
    if (this.isOpen) return;

    this.isOpen = true;
    this.overlay.classList.add('active');

    // Focus auf Input
    setTimeout(() => {
      if (this.input) {
        this.input.focus();
        this.input.select();
      }
    }, 100);

    // Body Scroll verhindern
    document.body.style.overflow = 'hidden';

    _log.info('Search opened');
  }

  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.overlay.classList.remove('active');

    // Input leeren
    if (this.input) {
      this.input.value = '';
    }

    // Ergebnisse zurücksetzen
    this.showEmptyState();

    // Body Scroll wieder erlauben
    document.body.style.overflow = '';

    _log.info('Search closed');
  }

  handleSearch(query) {
    const trimmedQuery = query.trim().toLowerCase();

    if (trimmedQuery.length === 0) {
      this.showEmptyState();
      return;
    }

    if (trimmedQuery.length < 2) {
      this.showEmptyState('Bitte mindestens 2 Zeichen eingeben');
      return;
    }

    // Suche durchführen
    const results = this.searchInIndex(trimmedQuery);
    this.currentResults = results;
    this.displayResults(results, trimmedQuery);
  }

  searchInIndex(query) {
    const results = [];

    this.searchIndex.forEach(item => {
      let score = 0;
      const queryLower = query.toLowerCase();

      // Exakte Übereinstimmung im Titel (höchste Priorität)
      if (item.title.toLowerCase().includes(queryLower)) {
        score += 100;
      }

      // Übereinstimmung in der Beschreibung
      if (item.description.toLowerCase().includes(queryLower)) {
        score += 50;
      }

      // Übereinstimmung in Keywords
      item.keywords.forEach(keyword => {
        if (keyword.toLowerCase().includes(queryLower)) {
          score += 30;
        }
      });

      // Übereinstimmung in Kategorie
      if (item.category.toLowerCase().includes(queryLower)) {
        score += 20;
      }

      // Fuzzy-Matching: Teilwort-Übereinstimmungen
      const words = queryLower.split(' ');
      words.forEach(word => {
        if (word.length > 2) {
          const titleWords = item.title.toLowerCase().split(' ');
          const descWords = item.description.toLowerCase().split(' ');

          titleWords.forEach(tw => {
            if (tw.startsWith(word)) score += 10;
          });

          descWords.forEach(dw => {
            if (dw.startsWith(word)) score += 5;
          });
        }
      });

      if (score > 0) {
        results.push({ ...item, score });
      }
    });

    // Sortiere nach Score (höchster zuerst)
    return results.sort((a, b) => b.score - a.score);
  }

  displayResults(results, query) {
    if (results.length === 0) {
      this.showEmptyState(`Keine Ergebnisse für "${query}"`);
      return;
    }

    const html = `
      <div class="search-stats">
        <span class="search-stats-count">${results.length}</span> 
        ${results.length === 1 ? 'Ergebnis' : 'Ergebnisse'} gefunden
      </div>
      ${results.map((result, index) => this.createResultHTML(result, query, index)).join('')}
    `;

    this.resultsContainer.innerHTML = html;

    // Event Listeners für Ergebnisse
    this.resultsContainer.querySelectorAll('.search-result-item').forEach((item, index) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectResult(index);
      });
    });
  }

  createResultHTML(result, query) {
    // Highlight Query in Titel und Beschreibung
    const highlightedTitle = this.highlightText(result.title, query);
    const highlightedDesc = this.highlightText(result.description, query);

    const categoryIcons = {
      'Seite': '📄',
      'Blog': '📝',
      'Technologie': '⚙️',
      'Info': 'ℹ️'
    };

    return `
      <a href="${result.url}" class="search-result-item" data-id="${result.id}">
        <span class="search-result-category">${result.category}</span>
        <div class="search-result-title">
          <span class="search-result-icon">${categoryIcons[result.category] || '📄'}</span>
          ${highlightedTitle}
        </div>
        <div class="search-result-description">${highlightedDesc}</div>
      </a>
    `;
  }

  highlightText(text, query) {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="search-result-highlight">$1</span>');
  }

  showEmptyState(message = null) {
    const html = `
      <div class="search-empty">
        <div class="search-empty-icon">🔍</div>
        <div class="search-empty-text">${message || 'Gib einen Suchbegriff ein'}</div>
        <div class="search-empty-hint">Suche nach Seiten, Projekten oder Blog-Posts</div>
      </div>
    `;
    this.resultsContainer.innerHTML = html;
    this.currentResults = [];
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

// Auto-Init wenn Dokument geladen ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch);
} else {
  initSearch();
}
