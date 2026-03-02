/**
 * Tool Executor - Executes AI tool calls on the client side
 * Controls website behavior through UI state, DOM APIs, and events.
 * @version 2.0.0
 */

import { createLogger } from '../../../core/logger.js';
import { fire } from '../../../core/events.js';
import { uiStore } from '../../../core/ui-store.js';

const log = createLogger('ToolExecutor');

/** @type {Map<string, string>} Route mappings */
const PAGE_ROUTES = new Map([
  ['home', '/'],
  ['projekte', '/projekte/'],
  ['about', '/about/'],
  ['gallery', '/gallery/'],
  ['blog', '/blog/'],
  ['videos', '/videos/'],
  ['kontakt', '#footer'],
  ['impressum', '/impressum/'],
  ['datenschutz', '/datenschutz/'],
]);

/** @type {Map<string, string>} Section selectors */
const SECTION_SELECTORS = new Map([
  ['header', 'header, .site-header, [data-section="header"]'],
  ['hero', '.hero, [data-section="hero"], #hero'],
  ['footer', 'site-footer, footer.site-footer, .site-footer'],
  ['contact', 'site-footer .footer-contact, .contact-section, #contact'],
  ['projects', '.projects-grid, [data-section="projects"], .project-cards'],
  ['skills', '.skills-section, [data-section="skills"], .skill-grid'],
  ['top', 'html, body'],
]);

const CHAT_HISTORY_KEYS = ['robot-chat-history', 'jules-conversation-history'];

/**
 * Execute a tool call from the AI agent
 * @param {Object} toolCall - { name: string, arguments: Object }
 * @returns {{ success: boolean, message: string }}
 */
export function executeTool(toolCall) {
  const name = String(toolCall?.name || '').trim();
  const args = toolCall?.arguments || {};

  try {
    switch (name) {
      case 'navigate':
        return executeNavigate(args);
      case 'setTheme':
        return executeSetTheme(args);
      case 'searchBlog':
        return executeSearch(args);
      case 'toggleMenu':
        return executeToggleMenu(args);
      case 'scrollToSection':
        return executeScrollToSection(args);
      case 'recommend':
        return executeRecommend(args);
      case 'openSearch':
        return executeOpenSearch();
      case 'closeSearch':
        return executeCloseSearch();
      case 'focusSearch':
        return executeFocusSearch(args);
      case 'scrollTop':
        return executeScrollTop();
      case 'copyCurrentUrl':
        return executeCopyCurrentUrl();
      case 'openImageUpload':
        return executeOpenImageUpload();
      case 'clearChatHistory':
        return executeClearChatHistory();
      default:
        log.warn(`Unknown tool: ${name}`);
        return { success: false, message: `Unbekanntes Tool: ${name}` };
    }
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : String(error);
    log.error(`Tool execution failed: ${name}`, error);
    return { success: false, message: `Tool-Fehler: ${message}` };
  }
}

function queryFirst(selectors) {
  if (!selectors) return null;
  const selectorList = String(selectors)
    .split(',')
    .map((sel) => sel.trim())
    .filter(Boolean);
  for (const selector of selectorList) {
    const target = document.querySelector(selector);
    if (target) return target;
  }
  return null;
}

/**
 * Navigate to a page
 */
function executeNavigate(args) {
  const page = String(args?.page || '')
    .toLowerCase()
    .trim();
  const route = PAGE_ROUTES.get(page);

  if (!route) {
    return {
      success: false,
      message: `Unbekannte Seite: "${page}". Verfuegbar: ${[...PAGE_ROUTES.keys()].join(', ')}`,
    };
  }

  if (route === '#footer') {
    return executeScrollToSection({ section: 'footer' });
  }

  if (document.startViewTransition) {
    document.startViewTransition(() => {
      globalThis.location.href = route;
    });
  } else {
    globalThis.location.href = route;
  }

  return {
    success: true,
    message: `Navigiere zu ${page}...`,
  };
}

/**
 * Set theme (dark/light/toggle)
 */
function executeSetTheme(args) {
  const theme = String(args?.theme || 'toggle').toLowerCase();
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme') || 'dark';

  let newTheme;
  if (theme === 'toggle') {
    newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  } else {
    newTheme = theme === 'light' ? 'light' : 'dark';
  }

  html.setAttribute('data-theme', newTheme);

  try {
    localStorage.setItem('theme', newTheme);
  } catch {
    /* ignore */
  }

  fire('theme:changed', { theme: newTheme });
  return {
    success: true,
    message: `Theme auf ${newTheme} gesetzt.`,
  };
}

function focusSearchInput(query = '') {
  requestAnimationFrame(() => {
    const searchInput = queryFirst(
      '.search-input input, [data-search-input], input[type="search"]',
    );
    if (!searchInput) return;

    if (query) {
      /** @type {HTMLInputElement} */ (searchInput).value = query;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      fire('search:execute', { query });
    }

    /** @type {HTMLElement} */ (searchInput).focus();
  });
}

/**
 * Search blog/website
 */
function executeSearch(args) {
  const query = String(args?.query || '').trim();
  if (!query) return { success: false, message: 'Kein Suchbegriff angegeben.' };
  executeOpenSearch();
  focusSearchInput(query);
  return {
    success: true,
    message: `Suche nach "${query}"...`,
  };
}

/**
 * Toggle main menu
 */
function executeToggleMenu(args) {
  const state = String(args?.state || 'toggle').toLowerCase();
  const currentState = uiStore.getState().menuOpen;

  let newState;
  if (state === 'toggle') {
    newState = !currentState;
  } else {
    newState = state === 'open';
  }

  uiStore.setState({ menuOpen: newState });
  fire('menu:toggle', { open: newState });

  const menuBtn = queryFirst(
    '.menu-toggle, [data-menu-toggle], button[aria-label*="Menue"], button[aria-label*="Menu"], button[aria-label*="Menü"]',
  );
  if (menuBtn && currentState !== newState) {
    /** @type {HTMLElement} */ (menuBtn).click();
  }

  return {
    success: true,
    message: newState ? 'Menue geoeffnet.' : 'Menue geschlossen.',
  };
}

/**
 * Scroll to a section
 */
function executeScrollToSection(args) {
  const section = String(args?.section || '')
    .toLowerCase()
    .trim();
  if (section === 'top') return executeScrollTop();

  const selectors = SECTION_SELECTORS.get(section);
  if (!selectors) {
    return {
      success: false,
      message: `Unbekannter Bereich: "${section}". Verfuegbar: ${[...SECTION_SELECTORS.keys()].join(', ')}`,
    };
  }

  const target = queryFirst(selectors);
  if (!target) {
    return {
      success: false,
      message: `Bereich "${section}" nicht gefunden.`,
    };
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return {
    success: true,
    message: `Scrolle zu ${section}...`,
  };
}

/**
 * Recommendation helper: delegate to search
 */
function executeRecommend(args) {
  const topic = String(args?.topic || '').trim();
  if (!topic) {
    return {
      success: true,
      message: 'Nenne ein Thema, dann suche ich passende Inhalte.',
    };
  }
  return executeSearch({ query: topic });
}

function executeOpenSearch() {
  uiStore.setState({ searchOpen: true });
  fire('search:opened', {}, window);
  return { success: true, message: 'Suche geoeffnet.' };
}

function executeCloseSearch() {
  uiStore.setState({ searchOpen: false });
  fire('search:closed', {}, window);
  return { success: true, message: 'Suche geschlossen.' };
}

function executeFocusSearch(args) {
  const query = String(args?.query || '').trim();
  executeOpenSearch();
  focusSearchInput(query);
  return {
    success: true,
    message: query ? `Suche fokussiert mit "${query}".` : 'Suche fokussiert.',
  };
}

function executeScrollTop() {
  globalThis.scrollTo({ top: 0, behavior: 'smooth' });
  return { success: true, message: 'Scrolle nach oben.' };
}

function executeCopyCurrentUrl() {
  const url = globalThis.location?.href || '';
  if (!url) return { success: false, message: 'URL nicht verfuegbar.' };

  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(url).catch(() => {});
    return { success: true, message: 'Link in die Zwischenablage kopiert.' };
  }

  return { success: true, message: 'Aktueller Link bereit.' };
}

function executeOpenImageUpload() {
  const input = document.getElementById('robot-image-upload');
  if (!input) return { success: false, message: 'Bild-Upload nicht gefunden.' };
  /** @type {HTMLElement} */ (input).click();
  return { success: true, message: 'Bild-Upload geoeffnet.' };
}

function executeClearChatHistory() {
  for (const key of CHAT_HISTORY_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  fire('robot:history:cleared', {}, document);
  return { success: true, message: 'Chatverlauf geloescht.' };
}
