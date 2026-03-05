/**
 * Tool Executor - Executes AI tool calls on the client side
 * Controls website behavior through UI state, DOM APIs, and events.
 * @version 2.0.0
 */

import { createLogger } from '../../../core/logger.js';
import { fire } from '../../../core/events.js';
import { uiStore } from '../../../core/ui-store.js';
import { withViewTransition } from '../../../core/view-transitions.js';
import {
  VIEW_TRANSITION_ROOT_CLASSES,
  VIEW_TRANSITION_TYPES,
} from '../../../core/view-transition-types.js';
import { VIEW_TRANSITION_TIMINGS_MS } from '../../../core/view-transition-timings.js';

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

const DEFAULT_CONFIRM_TITLE = 'Aktion bestaetigen';
const SOCIAL_PROFILE_URLS = new Map([
  ['github', 'https://github.com/aKs030'],
  ['linkedin', 'https://linkedin.com/in/abdulkerim-s'],
  ['instagram', 'https://instagram.com/abdul.codes'],
  ['youtube', 'https://youtube.com/@abdulcodes'],
  ['x', 'https://x.com/kRm_030'],
]);

function shouldConfirmToolExecution(toolCall) {
  return !!toolCall?.meta?.requiresConfirm;
}

function confirmToolExecution(toolCall) {
  const title =
    String(toolCall?.meta?.confirmTitle || '').trim() || DEFAULT_CONFIRM_TITLE;
  const message =
    String(toolCall?.meta?.confirmMessage || '').trim() ||
    'Soll diese Aktion wirklich ausgefuehrt werden?';

  if (typeof window?.confirm !== 'function') return true;
  return window.confirm(`${title}\n\n${message}`);
}

/**
 * Execute a tool call from the AI agent
 * @param {Object} toolCall - { name: string, arguments: Object }
 * @returns {{ success: boolean, message: string }}
 */
export function executeTool(toolCall) {
  const name = String(toolCall?.name || '').trim();
  const args = toolCall?.arguments || {};

  try {
    if (
      shouldConfirmToolExecution(toolCall) &&
      !confirmToolExecution(toolCall)
    ) {
      return {
        success: false,
        message: 'Aktion abgebrochen (nicht bestaetigt).',
      };
    }

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
      case 'openExternalLink':
        return executeOpenExternalLink(args);
      case 'openSocialProfile':
        return executeOpenSocialProfile(args);
      case 'composeEmail':
        return executeComposeEmail(args);
      case 'createCalendarReminder':
        return executeCreateCalendarReminder(args);
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
    void withViewTransition(
      () => {
        globalThis.location.href = route;
      },
      { types: [VIEW_TRANSITION_TYPES.PAGE_NAVIGATE] },
    );
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

  void withViewTransition(
    () => {
      html.setAttribute('data-theme', newTheme);
      fire('theme:changed', { theme: newTheme });
    },
    {
      types: [VIEW_TRANSITION_TYPES.THEME_CHANGE],
      rootClasses: [VIEW_TRANSITION_ROOT_CLASSES.THEME_CHANGE],
      timeoutMs: VIEW_TRANSITION_TIMINGS_MS.THEME_TIMEOUT,
    },
  );

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

  const menuBtn = queryFirst(
    '.site-menu__toggle, .menu-toggle, [data-menu-toggle], button[aria-label*="Menue"], button[aria-label*="Menu"], button[aria-label*="Menü"]',
  );
  if (menuBtn && currentState !== newState) {
    /** @type {HTMLElement} */ (menuBtn).click();
  } else {
    void withViewTransition(
      () => {
        uiStore.setState({ menuOpen: newState });
        fire('menu:toggle', { open: newState });
      },
      {
        types: [
          newState
            ? VIEW_TRANSITION_TYPES.MENU_OPEN
            : VIEW_TRANSITION_TYPES.MENU_CLOSE,
        ],
        rootClasses: [VIEW_TRANSITION_ROOT_CLASSES.MENU],
        preserveLiveBackdropOnMobile: true,
        timeoutMs: VIEW_TRANSITION_TIMINGS_MS.MENU_TIMEOUT,
      },
    );
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
  fire('robot:history:cleared', {}, document);
  return { success: true, message: 'Chatverlauf geloescht.' };
}

function normalizeExternalUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  if (value.startsWith('/')) {
    try {
      return new URL(value, globalThis.location?.origin || '').toString();
    } catch {
      return '';
    }
  }
  return value;
}

function openUrl(url, newTab = true) {
  if (newTab) {
    const ref = window.open(url, '_blank', 'noopener,noreferrer');
    return !!ref;
  }
  globalThis.location.href = url;
  return true;
}

function executeOpenExternalLink(args) {
  const normalized = normalizeExternalUrl(args?.url);
  if (!normalized) {
    return { success: false, message: 'Kein gueltiger Link uebergeben.' };
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return { success: false, message: 'Link ist ungueltig.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return {
      success: false,
      message: 'Nur http/https Links sind erlaubt.',
    };
  }

  const opened = openUrl(parsed.toString(), args?.newTab !== false);
  return opened
    ? { success: true, message: 'Externer Link geoeffnet.' }
    : { success: false, message: 'Link konnte nicht geoeffnet werden.' };
}

function executeOpenSocialProfile(args) {
  const platform = String(args?.platform || '')
    .toLowerCase()
    .trim();
  const url = SOCIAL_PROFILE_URLS.get(platform);
  if (!url) {
    return { success: false, message: `Unbekannte Plattform: ${platform}` };
  }

  const opened = openUrl(url, true);
  return opened
    ? { success: true, message: `${platform} Profil geoeffnet.` }
    : {
        success: false,
        message: `${platform} Profil konnte nicht geoeffnet werden.`,
      };
}

function executeComposeEmail(args) {
  const to = String(args?.to || '').trim();
  if (!to || !to.includes('@')) {
    return { success: false, message: 'Ungueltige E-Mail-Adresse.' };
  }

  const subject = String(args?.subject || '').trim();
  const body = String(args?.body || '').trim();
  const mailto =
    `mailto:${encodeURIComponent(to)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  const opened = openUrl(mailto, false);
  return opened
    ? { success: true, message: 'E-Mail-Entwurf geoeffnet.' }
    : {
        success: false,
        message: 'E-Mail-Entwurf konnte nicht geoeffnet werden.',
      };
}

function formatCalendarDateForGoogle(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function parseReminderDate(dateValue, timeValue = '09:00') {
  const rawDate = String(dateValue || '').trim();
  if (!rawDate) return null;

  let isoDate = rawDate;
  if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(rawDate)) {
    const parts = rawDate.split('.');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    isoDate = `${year}-${month}-${day}`;
  }

  const safeTime = String(timeValue || '09:00').trim() || '09:00';
  const parsed = new Date(`${isoDate}T${safeTime}:00`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function executeCreateCalendarReminder(args) {
  const title = String(args?.title || '').trim() || 'Erinnerung';
  const start = parseReminderDate(args?.date, args?.time);
  if (!start) {
    return { success: false, message: 'Ungueltiges Datum fuer Erinnerung.' };
  }

  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const details = String(args?.details || '').trim();
  const location = String(args?.url || '').trim();
  const url =
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${encodeURIComponent(
      `${formatCalendarDateForGoogle(start)}/${formatCalendarDateForGoogle(end)}`,
    )}` +
    `&details=${encodeURIComponent(details)}` +
    `&location=${encodeURIComponent(location)}`;

  const opened = openUrl(url, true);
  return opened
    ? { success: true, message: 'Kalender-Erinnerung geoeffnet.' }
    : { success: false, message: 'Kalender konnte nicht geoeffnet werden.' };
}
