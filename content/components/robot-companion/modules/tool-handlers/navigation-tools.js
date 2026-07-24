import { fire } from "../../../../core/events.js";
import { activeOverlay } from "../../../../core/state/overlay-state.js";
import {
  closeOverlay,
  openOverlay,
  OVERLAY_MODES,
  toggleOverlay,
} from "../../../../core/overlay-manager.js";
import {
  VIEW_TRANSITION_TYPES,
  withViewTransition,
} from "../../../../core/view-transitions/index.js";
import { buildToolResult, createDetail } from "../tool-result.js";
import { queryFirst } from "../tool-dom-utils.js";

const PAGE_ROUTES = new Map([
  ["home", "/"],
  ["projekte", "/projekte/"],
  ["about", "/about/"],
  ["gallery", "/gallery/"],
  ["blog", "/blog/"],
  ["videos", "/videos/"],
  ["kontakt", "#footer"],
  ["impressum", "/impressum/"],
  ["datenschutz", "/datenschutz/"],
]);

const SECTION_SELECTORS = new Map([
  ["header", 'header, .site-header, [data-section="header"]'],
  ["hero", '.hero, [data-section="hero"], #hero'],
  ["footer", "site-footer, footer.site-footer, .site-footer"],
  ["contact", "site-footer .footer-contact, .contact-section, #contact"],
  ["projects", '.projects-grid, [data-section="projects"], .project-cards'],
  ["skills", '.skills-section, [data-section="skills"], .skill-grid'],
  ["top", "html, body"],
]);

function focusSearchInput(query = "") {
  const attemptFocus = (attemptsLeft = 12) => {
    const searchInput = /** @type {HTMLInputElement | null} */ (
      queryFirst(
        '.menu-search__input, .search-input input, [data-search-input], input[type="search"], input[role="searchbox"]'
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
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      fire("search:execute", { query });
    }

    try {
      searchInput.focus({ preventScroll: true });
    } catch {
      searchInput.focus();
    }

    if (typeof searchInput.select === "function") {
      searchInput.select();
    }
  };

  requestAnimationFrame(() => attemptFocus());
}

export function executeNavigate(args) {
  const page = String(args?.page || "")
    .toLowerCase()
    .trim();
  const route = PAGE_ROUTES.get(page);

  if (!route) {
    return buildToolResult("navigate", args, false, "Seite nicht gefunden.", {
      summary: `Unbekannte Seite: "${page}".`,
      details: [createDetail("Verfuegbar", [...PAGE_ROUTES.keys()].join(", "))],
      accent: "error",
      cta: false,
    });
  }

  if (route === "#footer") {
    const result = executeScrollToSection({ section: "footer" });
    return buildToolResult("navigate", args, result.success, result.message, {
      summary: "Die Seite scrollt zum Kontaktbereich im Footer.",
      details: [createDetail("Ziel", "Footer / Kontakt")],
      accent: "navigation",
    });
  }

  if (document.startViewTransition) {
    void withViewTransition(
      () => {
        globalThis.location.href = route;
      },
      { types: [VIEW_TRANSITION_TYPES.PAGE_NAVIGATE] }
    );
  } else {
    globalThis.location.href = route;
  }

  return buildToolResult("navigate", args, true, `Navigiere zu ${page}...`, {
    summary: `Seite "${page}" wird geöffnet.`,
    details: [createDetail("Ziel", route)],
  });
}

export function executeSearch(args) {
  const query = String(args?.query || "").trim();
  if (!query) {
    return buildToolResult("searchBlog", args, false, "Kein Suchbegriff angegeben.", {
      summary: "Fuer die Suche fehlt ein Suchbegriff.",
      accent: "error",
      cta: false,
    });
  }

  executeOpenSearch();
  focusSearchInput(query);

  return buildToolResult("searchBlog", args, true, `Suche nach "${query}"...`, {
    summary: `Die Website-Suche wurde mit "${query}" gestartet.`,
    details: [createDetail("Suchbegriff", query)],
  });
}

export function executeToggleMenu(args) {
  const state = String(args?.state || "toggle").toLowerCase();
  const currentState = activeOverlay.value === OVERLAY_MODES.MENU;

  let newState;
  if (state === "toggle") {
    newState = !currentState;
  } else {
    newState = state === "open";
  }

  if (state === "toggle") {
    void toggleOverlay(OVERLAY_MODES.MENU, { reason: "robot-tool" });
  } else if (newState) {
    void openOverlay(OVERLAY_MODES.MENU, { reason: "robot-tool" });
  } else {
    void closeOverlay(OVERLAY_MODES.MENU, {
      reason: "robot-tool",
      restoreFocus: false,
    });
  }

  return buildToolResult(
    "toggleMenu",
    args,
    true,
    newState ? "Menü geöffnet." : "Menü geschlossen.",
    {
      summary: newState ? "Das Hauptmenü ist jetzt sichtbar." : "Das Hauptmenü wurde geschlossen.",
      details: [createDetail("Status", newState ? "Offen" : "Geschlossen")],
    }
  );
}

export function executeScrollToSection(args) {
  const section = String(args?.section || "")
    .toLowerCase()
    .trim();
  if (section === "top") return executeScrollTop();

  const selectors = SECTION_SELECTORS.get(section);
  if (!selectors) {
    return buildToolResult("scrollToSection", args, false, "Bereich unbekannt.", {
      summary: `Bereich "${section}" ist nicht verfügbar.`,
      details: [createDetail("Verfügbar", [...SECTION_SELECTORS.keys()].join(", "))],
      accent: "error",
      cta: false,
    });
  }

  const target = queryFirst(selectors);
  if (!target) {
    return buildToolResult("scrollToSection", args, false, `Bereich "${section}" nicht gefunden.`, {
      summary: `Für "${section}" wurde kein passendes Ziel gefunden.`,
      accent: "error",
      cta: false,
    });
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
  return buildToolResult("scrollToSection", args, true, `Scrolle zu ${section}...`, {
    summary: `Die Seite scrollt zum Bereich "${section}".`,
    details: [createDetail("Bereich", section)],
  });
}

export function executeRecommend(args) {
  const topic = String(args?.topic || "").trim();
  if (!topic) {
    return buildToolResult(
      "recommend",
      args,
      true,
      "Nenne ein Thema, dann suche ich passende Inhalte.",
      {
        summary: "Für Empfehlungen wird noch ein Thema benötigt.",
        cta: false,
      }
    );
  }

  executeOpenSearch();
  focusSearchInput(topic);
  return buildToolResult("recommend", args, true, `Suche nach "${topic}"...`, {
    summary: `Ich suche passende Inhalte zu "${topic}".`,
    details: [createDetail("Thema", topic)],
  });
}

export function executeOpenSearch() {
  void openOverlay(OVERLAY_MODES.SEARCH, { reason: "robot-tool" });

  return buildToolResult("openSearch", {}, true, "Suche geöffnet.", {
    summary: "Die Suchoberfläche wurde geöffnet.",
  });
}

export function executeCloseSearch() {
  void closeOverlay(OVERLAY_MODES.SEARCH, {
    reason: "robot-tool",
    restoreFocus: false,
  });
  return buildToolResult("closeSearch", {}, true, "Suche geschlossen.", {
    summary: "Die Suchoberfläche wurde geschlossen.",
  });
}

export function executeFocusSearch(args) {
  const query = String(args?.query || "").trim();
  executeOpenSearch();
  focusSearchInput(query);
  return buildToolResult(
    "focusSearch",
    args,
    true,
    query ? `Suche fokussiert mit "${query}".` : "Suche fokussiert.",
    {
      summary: query
        ? `Die Suche ist aktiv und mit "${query}" vorbelegt.`
        : "Die Suche ist jetzt fokussiert.",
      details: query ? [createDetail("Suchbegriff", query)] : [],
    }
  );
}

export function executeScrollTop() {
  globalThis.scrollTo({ top: 0, behavior: "smooth" });
  return buildToolResult("scrollTop", {}, true, "Scrolle nach oben.", {
    summary: "Die Seite scrollt an den Anfang.",
  });
}
