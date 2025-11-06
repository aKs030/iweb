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
 * @version 1.2.0
 */

// ===== Shared Utilities Import =====
import { createLogger, getElementById } from "../shared-utilities.js";

const log = createLogger("menu");

document.addEventListener("DOMContentLoaded", () => {
  const menuContainer = getElementById("menu-container");
  if (!menuContainer) {
    return;
  }

  menuContainer.innerHTML = getMenuHTML();

  const yearEl = getElementById("current-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initializeMenu(menuContainer);
  initializeLogo(menuContainer);
  initializeSubmenuLinks();
  setSiteTitle();
  setActiveMenuLink();

  document.addEventListener("click", (event) => {
    const isClickInside = menuContainer.contains(event.target);
    const isMenuToggle = event.target.closest(".site-menu__toggle");
    if (!isClickInside && !isMenuToggle) closeMenu(menuContainer);
  });
});

function getMenuHTML() {
  return `
    <!-- Skip-Links für Accessibility (WCAG 2.1 Level AA) -->
    <div class="skip-links">
      <a href="#main-content" class="skip-link">Zum Hauptinhalt springen</a>
      <a href="#navigation" class="skip-link">Zur Navigation springen</a>
    </div>

    <!-- SVG Icon Sprite für Navigation -->
    <svg
      aria-hidden="true"
      style="position: absolute; width: 0; height: 0; overflow: hidden"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <symbol id="icon-house" viewBox="0 0 576 512">
          <path
            fill="currentColor"
            d="M541 229.16 512 205.26V64a32 32 0 0 0-32-32h-64a32 32 0 0 0-32 32v24.6L314.52 43a35.93 35.93 0 0 0-45 0L35 229.16a16 16 0 0 0-2 22.59l21.4 25.76a16 16 0 0 0 22.59 2L96 264.86V456a32 32 0 0 0 32 32h128V344a16 16 0 0 1 16-16h64a16 16 0 0 1 16 16v144h128a32 32 0 0 0 32-32V264.86l19 14.65a16 16 0 0 0 22.59-2l21.4-25.76a16 16 0 0 0-2-22.59Z"
          />
        </symbol>
        <symbol id="icon-images" viewBox="0 0 576 512">
          <path
            fill="currentColor"
            d="M480 416V80a48 48 0 0 0-48-48H80a48 48 0 0 0-48 48v336H16a16 16 0 0 0 0 32h448a16 16 0 0 0 0-32ZM64 416V80a16 16 0 0 1 16-16h352a16 16 0 0 1 16 16v336Zm96-80 64-80 48 64 64-80 80 96H160Zm48-144a40 40 0 1 1-40-40 40 40 0 0 1 40 40Zm368-96v304a16 16 0 0 1-16 16h-16v-32h16V96H496V64h16a16 16 0 0 1 16 16Z"
          />
        </symbol>
        <symbol id="icon-user" viewBox="0 0 448 512">
          <path
            fill="currentColor"
            d="M224 256A128 128 0 1 0 96 128a128 128 0 0 0 128 128Zm89.6 32h-11.7a174.64 174.64 0 0 1-155.8 0h-11.7A134.4 134.4 0 0 0 0 422.4 57.6 57.6 0 0 0 57.6 480h332.8A57.6 57.6 0 0 0 448 422.4 134.4 134.4 0 0 0 313.6 288Z"
          />
        </symbol>
        <symbol id="icon-gamepad" viewBox="0 0 640 512">
          <path
            fill="currentColor"
            d="M480.1 96h-320C71.63 96 0 167.6 0 256s71.63 160 160 160c53.85 0 101.5-26.73 130.6-67.67h58.78C378.5 389.3 426.1 416 480 416c88.38 0 160-71.63 160-160S568.5 96 480.1 96zM224 288h-48v48h-32v-48H96v-32h48v-48h32v48h48v32zm208 32c-17.67 0-32-14.33-32-32 0-17.7 14.3-32 32-32s32 14.3 32 32c0 17.7-14.3 32-32 32zm64-96c-17.67 0-32-14.33-32-32 0-17.7 14.3-32 32-32s32 14.3 32 32c0 17.7-14.3 32-32 32z"
          />
        </symbol>
        <symbol id="icon-joystick" viewBox="0 0 448 512">
          <path
            fill="currentColor"
            d="M416 240c0-44.11-35.89-80-80-80h-32V96c0-53.02-42.98-96-96-96s-96 42.98-96 96v64H80c-44.11 0-80 35.89-80 80v144c0 26.51 21.49 48 48 48h320c26.51 0 48-21.49 48-48V240zM144 96c0-35.29 28.71-64 64-64s64 28.71 64 64v64H144V96zm240 288H64V240c0-26.47 21.53-48 48-48h224c26.47 0 48 21.53 48 48v144zm-96-80c-17.67 0-32-14.33-32-32s14.33-32 32-32 32 14.33 32 32-14.33 32-32 32z"
          />
        </symbol>
        <symbol id="icon-cloud-sun" viewBox="0 0 640 512">
          <path
            fill="currentColor"
            d="M575.2 325.7c.2-1.9.8-3.7.8-5.6 0-61.9-50.1-112-112-112-16.7 0-32.9 3.6-48 10.8C394.8 138.6 332.9 96 261.4 96 161.2 96 80.1 177.1 80.1 277.4c0 11.5 1.1 22.7 3.1 33.5-39.1 21.1-63.1 62.2-63.1 108.1 0 68.1 55.2 123.3 123.3 123.3h368c57.4 0 104-46.6 104-104 0-40.8-23.6-76.1-58-93.3zM511.7 480H143.3c-45.3 0-82.3-37-82.3-82.3 0-33.6 20.4-64.4 51.6-77.5l23.1-9.7-4.1-24.2c-1.4-8.1-2.1-16.3-2.1-24.9 0-78.5 63.8-142.4 142.4-142.4 50.6 0 97.1 26.9 122.5 70.2l11.7 19.9 22.9-5.2c11.2-2.5 22.6-3.8 33.9-3.8 40.1 0 72 31.9 72 72 0 1.7-.1 3.5-.2 5.2l-2.3 21.4 19.3 9.1c26.7 12.6 43.9 39.4 43.9 68.4 0 35.6-29 64.6-64.6 64.6z"
          />
        </symbol>
        <symbol id="icon-mail" viewBox="0 0 512 512">
          <path fill="currentColor" d="M48 64C21.5 64 0 85.5 0 112v288c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zM48 96h416c8.8 0 16 7.2 16 16v41.4L288 264.4c-11.3 8.5-26.7 8.5-38 0L32 153.4V112c0-8.8 7.2-16 16-16zm0 320v-222l176 132c22.5 16.9 53.5 16.9 76 0l176-132v222c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16z"/>
        </symbol>
      </defs>
    </svg>

    <a href="/index.html" class="site-logo-link">
      <span class="site-logo__container">
        <span class="site-logo elegant-logo" id="site-title"><span class="visually-hidden">Startseite</span></span>
        <span class="site-subtitle" id="site-subtitle"></span>
      </span>
    </a>

    <!-- Hamburger-Button -->
    <button
      type="button"
      class="site-menu__toggle"
      aria-label="Menü"
      aria-controls="navigation"
      aria-expanded="false"
    >
      <span class="site-menu__hamburger"></span>
    </button>

    <!-- Navigation mit Rolle und aria-label -->
    <nav id="navigation" class="site-menu" aria-label="Hauptnavigation">
      <ul class="site-menu__list">
        <li>
          <a href="/index.html">
            <svg class="nav-icon" aria-hidden="true">
              <use href="#icon-house"></use>
            </svg>
            <span class="icon-fallback" style="display: none">🏠</span>
            <span>Startseite</span>
          </a>
        </li>
        <li>
          <a href="/pages/card/karten.html">
            <svg class="nav-icon" aria-hidden="true">
              <use href="#icon-images"></use>
            </svg>
            <span class="icon-fallback" style="display: none">🖼️</span>
            <span>Projekte</span>
          </a>
        </li>
        <li>
          <a href="/index.html#about">
            <svg class="nav-icon" aria-hidden="true">
              <use href="#icon-user"></use>
            </svg>
            <span class="icon-fallback" style="display: none">🧑</span>
            <span>Über mich</span>
          </a>
        </li>
        <li>
          <a href="/index.html#contact">
            <svg class="nav-icon" aria-hidden="true">
              <use href="#icon-mail"></use>
            </svg>
            <span class="icon-fallback" style="display: none">✉️</span>
            <span>Kontakt</span>
          </a>
        </li>
      </ul>
    </nav>
  `;
}


/**
 * Initialisiert die Menü-Toggle-Logik und die Icons
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function initializeMenu(container) {
  const menuToggle = container.querySelector(".site-menu__toggle");
  const menu = container.querySelector(".site-menu");
  if (menuToggle && menu) {
    // ARIA Grundattribute
    menu.setAttribute("role", "navigation");
    menuToggle.setAttribute("aria-controls", menu.id || "navigation");
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

  initializeIcons();
}

/**
 * Überprüft SVG Icon Support und zeigt Fallbacks an, wenn nötig.
 */
function initializeIcons() {
  const checkIcons = () => {
    const icons = document.querySelectorAll('.nav-icon use');
    let brokenIcons = 0;

    icons.forEach(use => {
      const href = use.getAttribute('href');
      if (!href) return;

      const targetId = href.substring(1);
      const target = document.getElementById(targetId);
      const svg = use.closest('svg');
      const fallback = svg?.nextElementSibling;

      if (!target && fallback?.classList.contains('icon-fallback')) {
        svg.style.display = 'none';
        fallback.style.display = 'inline-block';
        brokenIcons++;
      }
    });
  };

  checkIcons();
  setTimeout(checkIcons, 200);
}

/**
 * Initialisiert das Verhalten für den Logo-Rechtsklick
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function initializeLogo(container) {
  const logoContainer = container.querySelector(".site-logo__container");
  if (logoContainer) {
    logoContainer.addEventListener("contextmenu", () => {
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
      document.querySelectorAll(".submenu").forEach((sm) => {
        if (sm !== submenu) sm.style.display = "none";
      });
      submenu.style.display = open ? "none" : "block";
      btn.setAttribute("aria-expanded", String(!open));
    });
  });

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
            document.querySelectorAll(".has-submenu.open").forEach((el) => {
              if (el !== parent) el.classList.remove("open");
            });
            parent.classList.add("open");
            tapped = true;
            setTimeout(() => {
              tapped = false;
            }, 600);
          } else if (!tapped) {
            tapped = false;
          }
        },
        { passive: false }
      );
    });
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
    "/pages/fotos/fotos.html": "Album",
    "/pages/card/karten.html": "Projekte",
  };
  const path = window.location.pathname;
  const pageTitle = titleMap[path] || document.title || "Website";
  const siteTitleEl = getElementById("site-title");
  if (siteTitleEl) siteTitleEl.textContent = pageTitle;

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
    contact: { title: "Kontakt", subtitle: "Schreiben Sie mir" },
  };

  const section = document.querySelector(`#${sectionId}`);
  if (!section) {
    return fallbackTitleMap[sectionId] || { title: "Startseite", subtitle: "" };
  }

  if (["hero", "features", "about", "contact"].includes(sectionId)) {
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

  const header = section.querySelector(".section-header");
  if (!header) {
    return fallbackTitleMap[sectionId] || { title: "Startseite", subtitle: "" };
  }

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
  let snapEventListener = null;

  function updateTitleAndSubtitle(newTitle, newSubtitle = "") {
    const siteTitleEl = getElementById("site-title");
    const siteSubtitleEl = getElementById("site-subtitle");

    if (!siteTitleEl) return;

    const currentTitle = siteTitleEl.textContent;
    const currentSubtitle = siteSubtitleEl?.textContent || "";

    if (currentTitle === newTitle && currentSubtitle === newSubtitle) return;

    siteTitleEl.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    siteTitleEl.style.opacity = "0.6";
    siteTitleEl.style.transform = "scale(0.95)";

    if (siteSubtitleEl) {
      siteSubtitleEl.classList.remove("show");
    }

    setTimeout(() => {
      siteTitleEl.textContent = newTitle;
      siteTitleEl.style.opacity = "1";
      siteTitleEl.style.transform = "scale(1)";

      if (siteSubtitleEl && newSubtitle) {
        siteSubtitleEl.textContent = newSubtitle;
        setTimeout(() => {
          siteSubtitleEl.classList.add("show");
        }, 100);
      }
    }, 200);
  }

  function initSnapEventListener() {
    if (snapEventListener) {
      window.removeEventListener("snapSectionChange", snapEventListener);
    }

    snapEventListener = (event) => {
      const { index, id } = event.detail || {};
      let sectionId = id;

      if (!sectionId && typeof index === "number") {
        const sections = Array.from(
          document.querySelectorAll("main .section, .section")
        );
        const section = sections[index];
        sectionId = section?.id;
      }

      if (sectionId) {
        const { title, subtitle } = extractSectionInfo(sectionId);
        updateTitleAndSubtitle(title, subtitle);
      }
    };

    window.addEventListener("snapSectionChange", snapEventListener);
  }

  function waitForSnapSections() {
    const checkAndStart = () => {
      const sections = document.querySelectorAll("#hero.section, #features.section, #about.section, #contact.section");

      if (sections.length >= 3) { // hero, features, about should be there
        initSnapEventListener();
        const { title, subtitle } = extractSectionInfo("hero");
        updateTitleAndSubtitle(title, subtitle);
        return true;
      }
      return false;
    };

    if (checkAndStart()) return;

    setTimeout(checkAndStart, 1000);
  }

  waitForSnapSections();
}

function setActiveMenuLink() {
  const path = window.location.pathname.replace(/index\.html$/, "");
  const hash = window.location.hash;

  document.querySelectorAll(".site-menu a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href) return;

    const norm = href.replace(/index\.html$/, "");
    const linkPath = norm.split('#')[0];
    const linkHash = a.hash;

    if (norm === path || (linkPath === path && linkHash === hash)) {
      a.classList.add("active");
    } else {
      a.classList.remove("active");
    }
  });
}
