import { fire } from '#core/events.js';
import {
  OVERLAY_MODES,
  activeOverlay,
  clearActiveOverlayMode,
  menuOpen,
  setActiveOverlayMode,
} from '#core/ui-store.js';
import { withViewTransition } from '#core/view-transitions.js';
import {
  VIEW_TRANSITION_ROOT_CLASSES,
  VIEW_TRANSITION_TYPES,
  VIEW_TRANSITION_TIMINGS_MS,
} from '#core/view-transition-constants.js';
import { buildToolResult, createDetail } from '../tool-result.js';
import {
  getMenuToggleButton,
  getSiteMenuHost,
  queryFirst,
} from '../tool-dom-utils.js';

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

const SECTION_SELECTORS = new Map([
  ['header', 'header, .site-header, [data-section="header"]'],
  ['hero', '.hero, [data-section="hero"], #hero'],
  ['footer', 'site-footer, footer.site-footer, .site-footer'],
  ['contact', 'site-footer .footer-contact, .contact-section, #contact'],
  ['projects', '.projects-grid, [data-section="projects"], .project-cards'],
  ['skills', '.skills-section, [data-section="skills"], .skill-grid'],
  ['top', 'html, body'],
]);

function isMenuOpenInDom() {
  const siteMenu = getSiteMenuHost();
  if (typeof siteMenu?.state?.isOpen === 'boolean') {
    return siteMenu.state.isOpen;
  }

  const toggle = getMenuToggleButton();
  const menu = queryFirst('.site-menu');

  if (menu?.classList.contains('open')) return true;
  if (toggle?.classList.contains('active')) return true;

  const expanded = toggle?.getAttribute('aria-expanded');
  if (expanded === 'true') return true;
  if (expanded === 'false') return false;

  return menuOpen.value;
}

function setMenuOpenViaComponent(isOpen) {
  const siteMenu = getSiteMenuHost();
  const menuEvents = siteMenu?.events;

  if (!menuEvents) return false;

  if (!isOpen && typeof menuEvents.closeMenu === 'function') {
    menuEvents.closeMenu();
    return true;
  }

  if (typeof menuEvents.setMenuOpenWithTransition === 'function') {
    menuEvents.setMenuOpenWithTransition(isOpen);
    return true;
  }

  return false;
}

function openSearchViaComponent() {
  const siteMenu = getSiteMenuHost();
  if (typeof siteMenu?.search?.openSearchMode === 'function') {
    siteMenu.search.openSearchMode();
    return true;
  }
  return false;
}

function closeSearchViaComponent() {
  const siteMenu = getSiteMenuHost();
  if (typeof siteMenu?.search?.closeSearchModeSilently === 'function') {
    siteMenu.search.closeSearchModeSilently();
    return true;
  }
  if (typeof siteMenu?.search?.closeSearchMode === 'function') {
    siteMenu.search.closeSearchMode({ restoreFocus: false });
    return true;
  }
  return false;
}

function syncMenuStateFallback(isOpen) {
  void withViewTransition(
    () => {
      if (isOpen) {
        setActiveOverlayMode(OVERLAY_MODES.MENU);
      } else {
        clearActiveOverlayMode(OVERLAY_MODES.MENU);
      }
      fire('menu:toggle', { open: isOpen });
    },
    {
      types: [
        isOpen
          ? VIEW_TRANSITION_TYPES.MENU_OPEN
          : VIEW_TRANSITION_TYPES.MENU_CLOSE,
      ],
      rootClasses: [VIEW_TRANSITION_ROOT_CLASSES.MENU],
      preserveLiveBackdropOnMobile: true,
      timeoutMs: VIEW_TRANSITION_TIMINGS_MS.MENU_TIMEOUT,
    },
  );
}

function focusSearchInput(query = '') {
  const attemptFocus = (attemptsLeft = 12) => {
    const searchInput = /** @type {HTMLInputElement | null} */ (
      queryFirst(
        '.menu-search__input, .search-input input, [data-search-input], input[type="search"], input[role="searchbox"]',
      )
    );
    if (!searchInput) {
      if (attemptsLeft > 0) {
        requestAnimationFrame(() => attemptFocus(attemptsLeft - 1));
      }
      return;
    }

    if (query && searchInput.value !== query) {
      searchInput.value = query;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      fire('search:execute', { query });
    }

    try {
      searchInput.focus({ preventScroll: true });
    } catch {
      searchInput.focus();
    }

    if (typeof searchInput.select === 'function') {
      searchInput.select();
    }
  };

  requestAnimationFrame(() => attemptFocus());
}

export function executeNavigate(args) {
  const page = String(args?.page || '')
    .toLowerCase()
    .trim();
  const route = PAGE_ROUTES.get(page);

  if (!route) {
    return buildToolResult('navigate', args, false, 'Seite nicht gefunden.', {
      summary: `Unbekannte Seite: "${page}".`,
      details: [createDetail('Verfuegbar', [...PAGE_ROUTES.keys()].join(', '))],
      accent: 'error',
      cta: false,
    });
  }

  if (route === '#footer') {
    const result = executeScrollToSection({ section: 'footer' });
    return buildToolResult('navigate', args, result.success, result.message, {
      summary: 'Die Seite scrollt zum Kontaktbereich im Footer.',
      details: [createDetail('Ziel', 'Footer / Kontakt')],
      accent: 'navigation',
    });
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

  return buildToolResult('navigate', args, true, `Navigiere zu ${page}...`, {
    summary: `Seite "${page}" wird geöffnet.`,
    details: [createDetail('Ziel', route)],
  });
}

export function executeSearch(args) {
  const query = String(args?.query || '').trim();
  if (!query) {
    return buildToolResult(
      'searchBlog',
      args,
      false,
      'Kein Suchbegriff angegeben.',
      {
        summary: 'Fuer die Suche fehlt ein Suchbegriff.',
        accent: 'error',
        cta: false,
      },
    );
  }

  executeOpenSearch();
  focusSearchInput(query);

  return buildToolResult('searchBlog', args, true, `Suche nach "${query}"...`, {
    summary: `Die Website-Suche wurde mit "${query}" gestartet.`,
    details: [createDetail('Suchbegriff', query)],
  });
}

export function executeToggleMenu(args) {
  const state = String(args?.state || 'toggle').toLowerCase();
  const currentState = isMenuOpenInDom();

  let newState;
  if (state === 'toggle') {
    newState = !currentState;
  } else {
    newState = state === 'open';
  }

  const performToggle = () => {
    const effectiveState = isMenuOpenInDom();
    if (effectiveState === newState) return;

    if (setMenuOpenViaComponent(newState)) {
      requestAnimationFrame(() => {
        if (isMenuOpenInDom() !== newState) {
          syncMenuStateFallback(newState);
        }
      });
      return;
    }

    const menuBtn = getMenuToggleButton();
    if (menuBtn) {
      /** @type {HTMLElement} */ (menuBtn).click();
      requestAnimationFrame(() => {
        if (isMenuOpenInDom() !== newState) {
          syncMenuStateFallback(newState);
        }
      });
      return;
    }

    syncMenuStateFallback(newState);
  };

  if (activeOverlay.value === OVERLAY_MODES.SEARCH) {
    if (!closeSearchViaComponent()) {
      clearActiveOverlayMode(OVERLAY_MODES.SEARCH);
    }
    requestAnimationFrame(() => performToggle());
  } else {
    performToggle();
  }

  return buildToolResult(
    'toggleMenu',
    args,
    true,
    newState ? 'Menue geoeffnet.' : 'Menue geschlossen.',
    {
      summary: newState
        ? 'Das Hauptmenue ist jetzt sichtbar.'
        : 'Das Hauptmenue wurde geschlossen.',
      details: [createDetail('Status', newState ? 'Offen' : 'Geschlossen')],
    },
  );
}

export function executeScrollToSection(args) {
  const section = String(args?.section || '')
    .toLowerCase()
    .trim();
  if (section === 'top') return executeScrollTop();

  const selectors = SECTION_SELECTORS.get(section);
  if (!selectors) {
    return buildToolResult(
      'scrollToSection',
      args,
      false,
      'Bereich unbekannt.',
      {
        summary: `Bereich "${section}" ist nicht verfuegbar.`,
        details: [
          createDetail('Verfuegbar', [...SECTION_SELECTORS.keys()].join(', ')),
        ],
        accent: 'error',
        cta: false,
      },
    );
  }

  const target = queryFirst(selectors);
  if (!target) {
    return buildToolResult(
      'scrollToSection',
      args,
      false,
      `Bereich "${section}" nicht gefunden.`,
      {
        summary: `Fuer "${section}" wurde kein passendes Ziel gefunden.`,
        accent: 'error',
        cta: false,
      },
    );
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return buildToolResult(
    'scrollToSection',
    args,
    true,
    `Scrolle zu ${section}...`,
    {
      summary: `Die Seite scrollt zum Bereich "${section}".`,
      details: [createDetail('Bereich', section)],
    },
  );
}

export function executeRecommend(args) {
  const topic = String(args?.topic || '').trim();
  if (!topic) {
    return buildToolResult(
      'recommend',
      args,
      true,
      'Nenne ein Thema, dann suche ich passende Inhalte.',
      {
        summary: 'Fuer Empfehlungen wird noch ein Thema benoetigt.',
        cta: false,
      },
    );
  }

  executeOpenSearch();
  focusSearchInput(topic);
  return buildToolResult('recommend', args, true, `Suche nach "${topic}"...`, {
    summary: `Ich suche passende Inhalte zu "${topic}".`,
    details: [createDetail('Thema', topic)],
  });
}

export function executeOpenSearch() {
  if (!openSearchViaComponent()) {
    const searchTrigger = queryFirst('.search-trigger');
    if (searchTrigger && activeOverlay.value !== OVERLAY_MODES.SEARCH) {
      /** @type {HTMLElement} */ (searchTrigger).click();
    } else {
      setActiveOverlayMode(OVERLAY_MODES.SEARCH);
    }
  } else if (isMenuOpenInDom()) {
    requestAnimationFrame(() => {
      if (isMenuOpenInDom()) {
        clearActiveOverlayMode(OVERLAY_MODES.MENU);
      }
    });
  }

  if (activeOverlay.value !== OVERLAY_MODES.SEARCH) {
    setActiveOverlayMode(OVERLAY_MODES.SEARCH);
  }

  return buildToolResult('openSearch', {}, true, 'Suche geoeffnet.', {
    summary: 'Die Suchoberflaeche wurde geoeffnet.',
  });
}

export function executeCloseSearch() {
  if (!closeSearchViaComponent()) {
    clearActiveOverlayMode(OVERLAY_MODES.SEARCH);
  }
  return buildToolResult('closeSearch', {}, true, 'Suche geschlossen.', {
    summary: 'Die Suchoberflaeche wurde geschlossen.',
  });
}

export function executeFocusSearch(args) {
  const query = String(args?.query || '').trim();
  executeOpenSearch();
  focusSearchInput(query);
  return buildToolResult(
    'focusSearch',
    args,
    true,
    query ? `Suche fokussiert mit "${query}".` : 'Suche fokussiert.',
    {
      summary: query
        ? `Die Suche ist aktiv und mit "${query}" vorbelegt.`
        : 'Die Suche ist jetzt fokussiert.',
      details: query ? [createDetail('Suchbegriff', query)] : [],
    },
  );
}

export function executeScrollTop() {
  globalThis.scrollTo({ top: 0, behavior: 'smooth' });
  return buildToolResult('scrollTop', {}, true, 'Scrolle nach oben.', {
    summary: 'Die Seite scrollt an den Anfang.',
  });
}
