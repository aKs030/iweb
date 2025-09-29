/**
 * Menü-System mit dynamischen Titeln
 *
 * Features:
 * - Dynamische Navigation mit Scroll-Detection
 * - Section-header Elemente werden auf Hauptseite ausgeblendet
 * - Responsive Hamburger-Menü
 * - FontAwesome Icons und Google Fonts Integration
 * - Accessibility-optimiert mit ARIA-Attributen
 *
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

import { getElementById } from "../utils/common-utils.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("menu");

document.addEventListener("DOMContentLoaded", () => {
  const menuContainer = getElementById("menu-container");
  const yearEl = getElementById("current-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Menü laden mit Live Server Detection
  if (!menuContainer) {
    return;
  }

  // Live Server Auto-Detection - Enhanced
  const isLiveServer =
    window.location.port === "5500" ||
    (window.location.hostname === "127.0.0.1" &&
      window.location.port === "5500") ||
    navigator.userAgent.includes("VS Code") ||
    document.querySelector('script[src*="__vscode_browser"]') !== null;

  const menuFile = isLiveServer ? "menu-liveserver-fix.html" : "menu.html";

  log.info(
    "Server Detection:",
    isLiveServer ? "Live Server" : "Standard Server",
    "- Loading",
    menuFile
  );

  fetch(`/content/webentwicklung/menu/${menuFile}`)
    .then((response) => {
      if (!response.ok)
        throw new Error(`HTTP-Error! Status: ${response.status}`);
      return response.text();
    })
    .then((menuMarkup) => {
      menuContainer.innerHTML = menuMarkup;
      initializeMenu(menuContainer);
      initializeLogo(menuContainer);
      initializeSubmenuLinks();
      setSiteTitle();
      setActiveMenuLink(); // Direkt hier aufrufen statt separater Event Listener
      document.addEventListener("click", (event) => {
        const isClickInside = menuContainer.contains(event.target);
        const isMenuToggle = event.target.closest(".site-menu__toggle");
        if (!isClickInside && !isMenuToggle) closeMenu(menuContainer);
      });
    })
    .catch(() => {
      // Menü-Laden fehlgeschlagen - graceful fallback
    });
});

/**
 * Initialisiert die Menü-Toggle-Logik
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function initializeMenu(container) {
  const menuToggle = container.querySelector(".site-menu__toggle");
  const menu = container.querySelector(".site-menu");
  if (menuToggle && menu) {
    // ARIA Grundattribute
    menu.setAttribute("role", "navigation");
    menuToggle.setAttribute("aria-controls", menu.id || "site-menu");
    menuToggle.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");

    const setState = (open) => {
      menu.classList.toggle("open", open);
      menuToggle.classList.toggle("active", open);
      menuToggle.setAttribute("aria-expanded", String(!!open));
      menu.setAttribute("aria-hidden", String(!open));
    };
    const toggle = () => setState(!menu.classList.contains("open"));
    menuToggle.addEventListener("click", toggle);
    menuToggle.addEventListener("keydown", (event) => {
      if (event.key === "Enter") toggle();
    });
  }
}

/**
 * Initialisiert das Verhalten für den Logo-Rechtsklick
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function initializeLogo(container) {
  const logoContainer = container.querySelector(".site-logo__container");
  if (logoContainer) {
    logoContainer.addEventListener("contextmenu", () => {
      // e.preventDefault(); entfernt, um Scroll-Blockaden zu vermeiden
      window.location.href = "/index.html";
    });
  }
}

/**
 * Initialisiert die Submenu-Links
 */
function initializeSubmenuLinks() {
  const submenuButtons = document.querySelectorAll(
    ".has-submenu > .submenu-toggle"
  );
  submenuButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const submenu = btn.nextElementSibling;
      const open = submenu.style.display === "block";
      // Close others
      document.querySelectorAll(".submenu").forEach((sm) => {
        if (sm !== submenu) sm.style.display = "none";
      });
      submenu.style.display = open ? "none" : "block";
      btn.setAttribute("aria-expanded", String(!open));
    });
  });

  // Touch-optimiertes Submenü: Erster Tap öffnet, zweiter Tap folgt Link
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (isTouch) {
    document.querySelectorAll(".has-submenu > a").forEach((link) => {
      let tapped = false;
      link.addEventListener(
        "touchend",
        function (e) {
          const parent = link.parentElement;
          if (!parent.classList.contains("open")) {
            e.preventDefault();
            // Schließe andere offene Submenüs
            document.querySelectorAll(".has-submenu.open").forEach((el) => {
              if (el !== parent) el.classList.remove("open");
            });
            parent.classList.add("open");
            tapped = true;
            setTimeout(() => {
              tapped = false;
            }, 600);
          } else if (!tapped) {
            // Zweiter Tap: Link folgen
            tapped = false;
          }
        },
        { passive: false }
      );
    });
    // Schließe Submenüs beim Klick außerhalb
    document.addEventListener("touchstart", function (e) {
      if (!e.target.closest(".site-menu")) {
        document
          .querySelectorAll(".has-submenu.open")
          .forEach((el) => el.classList.remove("open"));
      }
    });
  }
}

/**
 * Schließt das Menü
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function closeMenu(container) {
  const menuToggle = container.querySelector(".site-menu__toggle");
  const menu = container.querySelector(".site-menu");
  if (menuToggle && menu) {
    menu.classList.remove("open");
    menuToggle.classList.remove("active");
  }
}

/**
 * Setzt den Seitentitel im Logo anhand des aktuellen Pfads oder der aktiven Sektion
 */
function setSiteTitle() {
  const titleMap = {
    "/index.html": "Startseite",
    "/": "Startseite",
    "/pages/fotogalerie/urban.html": "Album",
    "/pages/ueber-mich/": "Über mich",
    "/pages/webentwicklung/project-1.html": "E‑Commerce Platform",
    "/pages/spiele/space-defender.html": "Space Defender",
    "/pages/card/wetter.html": "Wetter",
  };
  const path = window.location.pathname;
  const pageTitle = titleMap[path] || document.title || "Website";
  const siteTitleEl = getElementById("site-title");
  if (siteTitleEl) siteTitleEl.textContent = pageTitle;

  // Initialisiere Scroll-Detection nur auf der Hauptseite
  if (path === "/" || path === "/index.html") {
    initializeScrollDetection();
  }
}

/**
 * Extrahiert Titel und Untertitel aus einer Sektion und versteckt section-header Elemente
 * @param {string} sectionId - Die ID der Sektion
 * @returns {Object} - Objekt mit title und subtitle
 */
function extractSectionInfo(sectionId) {
  const fallbackTitleMap = {
    hero: { title: "Startseite", subtitle: "" },
    features: { title: "Projekte", subtitle: "Meine Arbeiten" },
    about: { title: "Über mich", subtitle: "Lerne mich kennen" },
  };

  const section = document.querySelector(`#${sectionId}`);
  if (!section)
    return fallbackTitleMap[sectionId] || { title: "Startseite", subtitle: "" };

  // Spezielle Behandlung für Hauptseiten-Sektionen - section-header ausblenden
  if (["hero", "features", "about"].includes(sectionId)) {
    const sectionElement = document.querySelector(`#${sectionId}`);
    if (sectionElement) {
      const headers = sectionElement.querySelectorAll(
        ".section-header, .section-subtitle"
      );
      headers.forEach((header) => {
        header.style.display = "none";
        header.style.visibility = "hidden";
      });
    }
    return fallbackTitleMap[sectionId] || { title: "Startseite", subtitle: "" };
  }

  // Für andere Sektionen: normale Extraktion aus section-header
  const header = section.querySelector(".section-header");
  if (!header)
    return fallbackTitleMap[sectionId] || { title: "Startseite", subtitle: "" };

  const titleEl = header.querySelector(".section-title, h1, h2, h3");
  const subtitleEl = header.querySelector(".section-subtitle");

  const title =
    titleEl?.textContent?.trim() ||
    fallbackTitleMap[sectionId]?.title ||
    "Startseite";
  const subtitle =
    subtitleEl?.textContent?.trim() ||
    fallbackTitleMap[sectionId]?.subtitle ||
    "";

  return { title, subtitle };
}

/**
 * Initialisiert die Scroll-Detection für dynamische Titel-Updates mit Scroll Snap
 */
function initializeScrollDetection() {
  let scrollListener = null;
  let snapEventListener = null;

  // Hilfsfunktion für Titel und Untertitel-Update
  function updateTitleAndSubtitle(newTitle, newSubtitle = "") {
    const siteTitleEl = getElementById("site-title");
    const siteSubtitleEl = getElementById("site-subtitle");

    if (!siteTitleEl) return;

    const currentTitle = siteTitleEl.textContent;
    const currentSubtitle = siteSubtitleEl?.textContent || "";

    // Nur updaten wenn sich etwas geändert hat
    if (currentTitle === newTitle && currentSubtitle === newSubtitle) return;

    // Titel-Update mit Animation
    siteTitleEl.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    siteTitleEl.style.opacity = "0.6";
    siteTitleEl.style.transform = "scale(0.95)";

    // Untertitel ausblenden falls vorhanden
    if (siteSubtitleEl) {
      siteSubtitleEl.classList.remove("show");
    }

    setTimeout(() => {
      // Titel setzen
      siteTitleEl.textContent = newTitle;
      siteTitleEl.style.opacity = "1";
      siteTitleEl.style.transform = "scale(1)";

      // Untertitel setzen und einblenden
      if (siteSubtitleEl && newSubtitle) {
        siteSubtitleEl.textContent = newSubtitle;
        setTimeout(() => {
          siteSubtitleEl.classList.add("show");
        }, 100);
      }
    }, 200);
  }

  // Primäre Methode: Höre auf snapSectionChange Event
  function initSnapEventListener() {
    if (snapEventListener) {
      window.removeEventListener("snapSectionChange", snapEventListener);
    }

    snapEventListener = (event) => {
      const { index, id } = event.detail || {};
      let sectionId = id;

      // Falls ID nicht direkt verfügbar, verwende Index
      if (!sectionId && typeof index === "number") {
        const sections = Array.from(
          document.querySelectorAll("main .section, .section")
        );
        const section = sections[index];
        sectionId = section?.id;
      }

      // Titel und Untertitel aus Sektion extrahieren
      if (sectionId) {
        const { title, subtitle } = extractSectionInfo(sectionId);
        updateTitleAndSubtitle(title, subtitle);
      }
    };

    window.addEventListener("snapSectionChange", snapEventListener);
  }

  // Warte auf alle Sektionen und initialisiere
  function waitForSnapSections() {
    const checkAndStart = () => {
      const heroSection = document.querySelector("#hero.section");
      const featuresSection = document.querySelector("#features.section");
      const aboutSection = document.querySelector("#about.section");

      if (heroSection && featuresSection && aboutSection) {
        // Entferne vorherige Listener falls vorhanden
        if (scrollListener) {
          window.removeEventListener("scroll", scrollListener);
        }

        // Initialisiere Snap Event Listener
        initSnapEventListener();

        // Initial call
        const { title, subtitle } = extractSectionInfo("hero");
        updateTitleAndSubtitle(title, subtitle);

        return true;
      }
      return false;
    };

    // Versuche sofort zu starten
    if (checkAndStart()) return;

    // Fallback: Nach 1 Sekunde erneut versuchen
    setTimeout(() => {
      checkAndStart();
    }, 1000);
  }

  // Starte die Snap-Detection
  waitForSnapSections();
}

// Aktiven Link im Menü markieren
function setActiveMenuLink() {
  const path = window.location.pathname.replace(/index\.html$/, "");
  document.querySelectorAll(".site-menu a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href) return;
    // Normalisieren (index.html entfernen)
    const norm = href.replace(/index\.html$/, "");
    if (norm === path) a.classList.add("active");
    else a.classList.remove("active");
  });
}
