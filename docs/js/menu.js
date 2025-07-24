/**
 * Responsives Menü-System mit dynamischem Content-Loading
 *
 * Features:
 * - Dynamisches Laden von Menü und Footer
 * - Mobile-responsive Navigation
 * - Accessibility-Unterstützung (ARIA, Keyboard Navigation)
 * - Touch-optimierte Submenu-Interaktionen
 * - Performance-optimierte Event-Handler
 */

// Performance-optimierte Variablen und Konstanten
const currentYear = new Date().getFullYear();
const BREAKPOINTS = {
  MOBILE: 768,
  TOUCH_TIMEOUT: 500,
  RESIZE_DEBOUNCE: 150,
  LOGO_SCALE_DURATION: 150,
};

let resizeTimeout;

document.addEventListener('DOMContentLoaded', () => {
  const menuContainer = document.getElementById('menu-container');

  // Footer laden mit verbesserter Fehlerbehandlung
  loadFooter();

  // Menü laden mit optimierter Performance
  loadMenu(menuContainer);
});

/**
 * Lädt den Footer mit optimierter Performance und verbesserter Fehlerbehandlung
 */
async function loadFooter() {
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (!footerPlaceholder) {
    console.warn('Footer-placeholder nicht gefunden - wird übersprungen');
    return;
  }

  try {
    // Dynamischer Pfad zu footer.html, egal von wo geladen
    const footerPath = new URL('komponente/footer.html', window.location.pathname).pathname;
    const response = await fetch(footerPath);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Footer konnte nicht geladen werden`);
    }

    const html = await response.text();
    footerPlaceholder.innerHTML = html;

    // Jahr dynamisch setzen mit Fehlerbehandlung
    const yearEl = document.getElementById('current-year');
    if (yearEl) {
      yearEl.textContent = currentYear;
    }
  } catch (err) {
    console.error('Fehler beim Laden des Footers:', err.message);
    // Optimierter Fallback Footer
    footerPlaceholder.innerHTML = createFallbackFooter();
  }
}

/**
 * Erstellt Fallback-Footer HTML
 */
function createFallbackFooter() {
  return `
    <footer class="site-footer footer" role="contentinfo">
      <div class="footer-content">
        <p>&copy; ${currentYear} Abdul Kerim. Alle Rechte vorbehalten.</p>
      </div>
    </footer>
  `;
}

/**
 * Lädt das Menü mit optimierter Performance und Fehlerbehandlung
 * @param {HTMLElement} menuContainer - Der Container für das Menü
 */
async function loadMenu(menuContainer) {
  if (!menuContainer) {
    console.error('Fehler: menuContainer wurde nicht gefunden.');
    return;
  }

  try {
    // Dynamischer Pfad zu menu.html, egal von wo geladen
    const menuPath = new URL('komponente/menu.html', window.location.pathname).pathname;
    const response = await fetch(menuPath);
    if (!response.ok) throw new Error(`HTTP-Error! Status: ${response.status}`);

    const menuMarkup = await response.text();
    menuContainer.innerHTML = menuMarkup;

    // Menü-Funktionalitäten initialisieren
    initializeMenu(menuContainer);
    initializeLogo(menuContainer);
    initializeSubmenuLinks(menuContainer);
    initializeAccessibility(menuContainer);
    initializeThemeSwitcher();
    initializeSearch();
    setSiteTitle();

    // Optimierter Outside-Click Handler mit Debouncing
    setupOutsideClickHandler(menuContainer);

    // Resize-Handler für bessere Mobile-Performance
    setupResizeHandler(menuContainer);
  } catch (err) {
    console.error('Fehler beim Laden des Menüs:', err.message);
    // Verbesserter Fallback mit besserer Accessibility
    menuContainer.innerHTML = createFallbackMenu();
  }
}

/**
 * Erstellt Fallback-Menü HTML mit verbesserter Accessibility
 */
function createFallbackMenu() {
  return `
    <header class="site-header" role="banner">
      <a href="../index.html" aria-label="Zur Startseite">
        <span class="site-logo elegant-logo">Abdulkerim ⭐️</span>
      </a>
      <nav class="site-menu" role="navigation" aria-label="Hauptnavigation">
        <ul class="site-menu-list">
          <li><a href="../index.html"><i class="fa-solid fa-house" aria-hidden="true"></i>Startseite</a></li>
          <li><a href="../pages/ubermich.html"><i class="fa-solid fa-user" aria-hidden="true"></i>Über mich</a></li>
          <li><a href="../pages/album.html"><i class="fa-solid fa-images" aria-hidden="true"></i>Fotogalerie</a></li>
        </ul>
      </nav>
    </header>
  `;
}

/**
 * Initialisiert die Menü-Toggle-Logik mit verbesserter Accessibility
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function initializeMenu(container) {
  const menuToggle = container.querySelector('.site-menu-toggle');
  const menu = container.querySelector('.site-menu');
  const overlay = container.querySelector('.site-menu__overlay');

  if (!menuToggle || !menu) {
    console.warn('Menu-Toggle-Elemente fehlen oder konnten nicht gefunden werden.');
    return;
  }

  const toggleMenu = (isOpen = null) => {
    const willBeOpen = isOpen !== null ? isOpen : !menu.classList.contains('open');

    menu.classList.toggle('open', willBeOpen);
    menuToggle.classList.toggle('active', willBeOpen);

    // ARIA Attribute aktualisieren
    menuToggle.setAttribute('aria-expanded', willBeOpen.toString());

    // Body-Scroll verhindern wenn Mobile-Menü offen
    if (window.innerWidth <= BREAKPOINTS.MOBILE) {
      document.body.style.overflow = willBeOpen ? 'hidden' : '';
    }
  };

  // Event Listeners mit verbesserter Accessibility
  menuToggle.addEventListener('click', () => toggleMenu());

  menuToggle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleMenu();
    }
    if (event.key === 'Escape') {
      toggleMenu(false);
    }
  });

  // Overlay-Klick schließt Menü
  if (overlay) {
    overlay.addEventListener('click', () => toggleMenu(false));
  }
}

/**
 * Initialisiert das Verhalten für den Logo-Rechtsklick mit verbesserter UX
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function initializeLogo(container) {
  const logoContainer = container.querySelector('.site-logo__container');
  if (!logoContainer) {
    console.warn('Logo-Container konnte nicht gefunden werden.');
    return;
  }

  logoContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // Sanfte Navigation mit Feedback
    logoContainer.style.transform = 'scale(0.95)';
    setTimeout(() => {
      logoContainer.style.transform = '';
      window.location.href = '/docs/index.html';
    }, BREAKPOINTS.LOGO_SCALE_DURATION);
  });
}

/**
 * Initialisiert die Submenu-Links mit verbesserter Touch-Unterstützung
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function initializeSubmenuLinks(container) {
  const submenuLinks = container.querySelectorAll('.has-submenu > a');
  let touchStartTime = 0;

  submenuLinks.forEach((link) => {
    // Touch-Events für bessere Mobile-Erfahrung
    link.addEventListener(
      'touchstart',
      () => {
        touchStartTime = Date.now();
      },
      { passive: true }
    );

    link.addEventListener('click', (event) => {
      const isMobile = window.innerWidth <= BREAKPOINTS.MOBILE;
      const isQuickTouch = Date.now() - touchStartTime < BREAKPOINTS.TOUCH_TIMEOUT;

      // Nur für Mobile oder schnelle Touch-Ereignisse: JS steuert Submenu
      if (!isMobile && !isQuickTouch) return;

      event.preventDefault();
      const parentLi = link.parentElement;
      const isOpen = parentLi.classList.contains('open');

      // Alle anderen Submenüs schließen
      container.querySelectorAll('.has-submenu').forEach((li) => {
        if (li !== parentLi) li.classList.remove('open');
      });

      // Aktuelles Submenü umschalten
      parentLi.classList.toggle('open', !isOpen);

      // ARIA Attribute aktualisieren
      link.setAttribute('aria-expanded', (!isOpen).toString());
    });

    // Keyboard Navigation
    link.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault();
        const parentLi = link.parentElement;
        parentLi.classList.add('open');
        link.setAttribute('aria-expanded', 'true');

        // Fokus auf erstes Submenu-Element
        const firstSubmenuLink = parentLi.querySelector('.submenu a');
        if (firstSubmenuLink) firstSubmenuLink.focus();
      }
    });
  });
}

/**
 * Erweiterte Accessibility-Features
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function initializeAccessibility(container) {
  // Escape-Key schließt alle offenen Submenüs
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      container.querySelectorAll('.has-submenu').forEach((li) => {
        li.classList.remove('open');
        li.querySelector('a').setAttribute('aria-expanded', 'false');
      });
      closeMenu(container);
    }
  });

  // Fokus-Management für bessere Navigation
  const menuLinks = container.querySelectorAll('a');
  menuLinks.forEach((link, index) => {
    link.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextLink = menuLinks[index + 1];
        if (nextLink) nextLink.focus();
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevLink = menuLinks[index - 1];
        if (prevLink) prevLink.focus();
      }
    });
  });
}

/**
 * Schließt das Menü mit verbesserter State-Verwaltung
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function closeMenu(container) {
  const menuToggle = container.querySelector('.site-menu-toggle');
  const menu = container.querySelector('.site-menu');

  if (menuToggle && menu) {
    menu.classList.remove('open');
    menuToggle.classList.remove('active');
    menuToggle.setAttribute('aria-expanded', 'false');

    // Body-Scroll wiederherstellen
    document.body.style.overflow = '';

    // Alle Submenüs schließen
    container.querySelectorAll('.has-submenu').forEach((li) => {
      li.classList.remove('open');
      li.querySelector('a').setAttribute('aria-expanded', 'false');
    });
  }
}

/**
 * Optimierter Outside-Click Handler mit Performance-Verbesserungen
 * @param {HTMLElement} menuContainer - Der Container mit der Menü-Komponente
 */
function setupOutsideClickHandler(menuContainer) {
  const handleOutsideClick = (event) => {
    // Nur prüfen wenn Menü offen ist
    const menu = menuContainer.querySelector('.site-menu');
    if (!menu?.classList.contains('open')) return;

    const isClickInside = menuContainer.contains(event.target);
    const isMenuToggle = event.target.closest('.site-menu-toggle');

    if (!isClickInside && !isMenuToggle) {
      closeMenu(menuContainer);
    }
  };

  // Verwende passive Event Listener für bessere Performance
  document.addEventListener('click', handleOutsideClick, { passive: true });
}

/**
 * Resize-Handler für verbesserte Mobile-Performance
 * @param {HTMLElement} menuContainer - Der Container mit der Menü-Komponente
 */
function setupResizeHandler(menuContainer) {
  const handleResize = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Desktop: Schließe Mobile-Menü wenn zu Desktop gewechselt wird
      if (window.innerWidth > BREAKPOINTS.MOBILE) {
        closeMenu(menuContainer);
        document.body.style.overflow = '';
      }
    }, BREAKPOINTS.RESIZE_DEBOUNCE);
  };

  window.addEventListener('resize', handleResize, { passive: true });
}

/**
 * Setzt den Seitentitel im Logo mit erweiterten Pfaden
 */
function setSiteTitle() {
  const titleMap = {
    '/docs/index.html': 'Startseite',
    '/': 'Startseite',
    '/docs/pages/album.html': 'Fotogalerie',
    '/docs/pages/ubermich.html': 'Über mich',
    '/docs/pages/index-game.html': 'Spiele-Übersicht',
    '/docs/pages/features/wetter.html': 'Wetter',
    '/docs/pages/features/snake.html': 'Snake Spiel',
    '/docs/pages/features/tetris.html': 'Tetris Spiel',
    '/docs/pages/features/Run.html': 'Jump & Run',
    '/docs/pages/features/editor.html': 'Level Editor',
    '/docs/pages/komponente/kontakt.html': 'Kontakt',
    '/docs/pages/komponente/impressum.html': 'Impressum',
    '/docs/pages/komponente/datenschutz.html': 'Datenschutz',
  };

  const path = window.location.pathname;
  const pageTitle = titleMap[path] || document.title || 'Abdul Kerim';
  const siteTitleEl = document.getElementById('site-title');

  if (siteTitleEl) {
    siteTitleEl.textContent = pageTitle;
    // Aria-Label für bessere Accessibility
    siteTitleEl.setAttribute('aria-label', `Aktuelle Seite: ${pageTitle}`);
  }
}

/**
 * Initialisiert den Theme-Umschalter
 */
function initializeThemeSwitcher() {
  const themeToggles = document.querySelectorAll('.theme-toggle-checkbox');

  if (themeToggles.length === 0) return;

  const currentTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);

  // Update toggles and icons
  themeToggles.forEach((toggle) => {
    toggle.checked = currentTheme === 'dark';
  });

  updateThemeIcons(currentTheme);

  document.body.addEventListener('change', (e) => {
    if (e.target.classList.contains('theme-toggle-checkbox')) {
      const newTheme = e.target.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);

      // Synchronize other toggles
      themeToggles.forEach((t) => {
        if (t !== e.target) {
          t.checked = e.target.checked;
        }
      });

      // Update all theme icons
      updateThemeIcons(newTheme);
    }
  });
}

/**
 * Aktualisiert die Theme-Icons basierend auf dem aktuellen Theme
 */
function updateThemeIcons(theme) {
  const themeIcons = document.querySelectorAll('.theme-icon');
  themeIcons.forEach((icon) => {
    if (theme === 'dark') {
      icon.className = 'theme-icon fa-solid fa-sun'; // Zeige Sonne im Dark Mode
    } else {
      icon.className = 'theme-icon fa-solid fa-moon'; // Zeige Mond im Light Mode
    }
  });
}

/**
 * Initialisiert die Suchfunktion
 */
function initializeSearch() {
  const searchContainers = document.querySelectorAll('.search-container');
  if (searchContainers.length === 0) return;

  searchContainers.forEach((container) => {
    const toggle = container.querySelector('.search-toggle');
    const input = container.querySelector('.search-input');

    if (!toggle || !input) return;

    // Spezifische Logik für Desktop-Suche mit Toggle
    if (!container.parentElement.classList.contains('mobile-actions')) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = container.classList.toggle('active');
        toggle.setAttribute('aria-expanded', isActive);
        if (isActive) {
          input.focus();
        }
      });
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        alert(`Searching for: ${input.value}`);
        // Hier würde die eigentliche Suchlogik implementiert
      }
    });
  });

  document.addEventListener('click', (e) => {
    searchContainers.forEach((container) => {
      // Nur die Desktop-Suche bei Klick außerhalb schließen
      if (
        !container.parentElement.classList.contains('mobile-actions') &&
        !container.contains(e.target)
      ) {
        container.classList.remove('active');
        container.querySelector('.search-toggle').setAttribute('aria-expanded', 'false');
      }
    });
  });
}

// Klasse MenuManager entfernt, da sie nicht verwendet wird
