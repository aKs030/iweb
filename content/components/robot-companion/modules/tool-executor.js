/**
 * Tool Executor - Executes AI tool calls on the client side
 * Steuert die Website aktiv über den Event-Bus und DOM-APIs.
 * @version 1.0.0
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
]);

/**
 * Execute a tool call from the AI agent
 * @param {Object} toolCall - { name: string, arguments: Object }
 * @returns {{ success: boolean, message: string, requiresUI?: boolean }}
 */
export function executeTool(toolCall) {
  const { name, arguments: args } = toolCall;

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
      case 'summarizePage':
        return executeSummarizePage();
      case 'recommend':
        return executeRecommend(args);
      default:
        log.warn(`Unknown tool: ${name}`);
        return { success: false, message: `Unbekanntes Tool: ${name}` };
    }
  } catch (error) {
    log.error(`Tool execution failed: ${name}`, error);
    return { success: false, message: `Tool-Fehler: ${error.message}` };
  }
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
      message: `Unbekannte Seite: "${page}". Verfügbar: ${[...PAGE_ROUTES.keys()].join(', ')}`,
    };
  }

  if (route === '#footer') {
    // Special handling for contact → scroll to footer
    return executeScrollToSection({ section: 'footer' });
  }

  // Use View Transitions API if available
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      globalThis.location.href = route;
    });
  } else {
    globalThis.location.href = route;
  }

  log.info(`Navigating to: ${route}`);
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

  // Persist preference
  try {
    localStorage.setItem('theme', newTheme);
  } catch {
    // Storage not available
  }

  // Fire event for other components
  fire('theme:changed', { theme: newTheme });

  const label = newTheme === 'dark' ? 'Dark Mode 🌙' : 'Light Mode ☀️';
  log.info(`Theme set to: ${newTheme}`);

  return {
    success: true,
    message: `${label} aktiviert!`,
  };
}

/**
 * Search blog/website
 */
function executeSearch(args) {
  const query = String(args?.query || '').trim();
  if (!query) {
    return { success: false, message: 'Kein Suchbegriff angegeben.' };
  }

  // Try to open the search panel with the query
  const searchState = uiStore.getState();
  if (!searchState.searchOpen) {
    uiStore.setState({ searchOpen: true });
  }

  // Fire search event
  fire('search:execute', { query });

  // Also try to find and fill the search input
  requestAnimationFrame(() => {
    const searchInput =
      document.querySelector('.search-input input') ||
      document.querySelector('[data-search-input]') ||
      document.querySelector('input[type="search"]');

    if (searchInput) {
      /** @type {HTMLInputElement} */ (searchInput).value = query;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.focus();
    }
  });

  log.info(`Search executed: ${query}`);
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

  // Also try to click the menu button directly
  const menuBtn =
    document.querySelector('.menu-toggle') ||
    document.querySelector('[data-menu-toggle]') ||
    document.querySelector('button[aria-label*="Menü"]') ||
    document.querySelector('button[aria-label*="Menu"]');

  if (menuBtn && currentState !== newState) {
    /** @type {HTMLElement} */ (menuBtn).click();
  }

  const label = newState ? 'geöffnet 📋' : 'geschlossen';
  log.info(`Menu ${label}`);

  return {
    success: true,
    message: `Menü ${label}`,
  };
}

/**
 * Scroll to a section
 */
function executeScrollToSection(args) {
  const section = String(args?.section || '')
    .toLowerCase()
    .trim();
  const selectors = SECTION_SELECTORS.get(section);

  if (!selectors) {
    return {
      success: false,
      message: `Unbekannter Bereich: "${section}". Verfügbar: ${[...SECTION_SELECTORS.keys()].join(', ')}`,
    };
  }

  // Try each selector
  const selectorList = selectors.split(',').map((s) => s.trim());
  let target = null;

  for (const sel of selectorList) {
    target = document.querySelector(sel);
    if (target) break;
  }

  if (!target) {
    return {
      success: false,
      message: `Bereich "${section}" nicht auf dieser Seite gefunden.`,
    };
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  log.info(`Scrolled to: ${section}`);

  return {
    success: true,
    message: `Scrolle zu ${section}... 👇`,
  };
}

/**
 * Summarize current page (triggers the existing summarize feature)
 */
function executeSummarizePage() {
  fire('robot:summarize', {});

  return {
    success: true,
    message: 'Seite wird zusammengefasst...',
    requiresUI: true,
  };
}

/**
 * Give recommendation based on topic
 */
function executeRecommend(args) {
  const topic = String(args?.topic || '').trim();

  // Navigate to blog with search query if topic is given
  if (topic) {
    fire('search:execute', { query: topic });

    return {
      success: true,
      message: `Suche nach Empfehlungen zu "${topic}"...`,
    };
  }

  return {
    success: true,
    message: 'Schau dir die neuesten Blog-Artikel an!',
  };
}
