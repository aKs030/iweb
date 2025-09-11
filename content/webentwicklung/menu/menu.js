import { createLogger } from '../utils/logger.js';
const logMenu = createLogger('menu');

document.addEventListener('DOMContentLoaded', () => {
  const menuContainer = document.getElementById('menu-container');
  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Footer: kein Remote-Fetch, um 404s zu vermeiden; optional minimaler Fallback
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (footerPlaceholder) {
    // Wenn du eine Footer-Datei hast, bitte Pfad hier eintragen und Fetch reaktivieren.
    // footerPlaceholder.innerHTML = '<footer class="footer">&copy; <span id="current-year"></span> Abdulkerim Sesli</footer>';
  }

  // Menü laden
  if (!menuContainer) {
    logMenu.error('Fehler: menuContainer wurde nicht gefunden.');
    return;
  }
  fetch('/content/webentwicklung/menu/menu.html')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP-Error! Status: ${response.status}`);
      return response.text();
    })
    .then(menuMarkup => {
      menuContainer.innerHTML = menuMarkup;
      initializeMenu(menuContainer);
      initializeLogo(menuContainer);
      initializeSubmenuLinks();
      setSiteTitle();
      document.addEventListener('click', (event) => {
        const isClickInside = menuContainer.contains(event.target);
        const isMenuToggle = event.target.closest('.site-menu__toggle');
        if (!isClickInside && !isMenuToggle) closeMenu(menuContainer);
      });
    })
    .catch(err => {
      logMenu.error('Fehler beim Laden des Menüs:', err.message);
    });
});

/**
 * Initialisiert die Menü-Toggle-Logik
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function initializeMenu(container) {
  const menuToggle = container.querySelector('.site-menu__toggle');
  const menu = container.querySelector('.site-menu');
  if (menuToggle && menu) {
    // ARIA Grundattribute
    menu.setAttribute('role','navigation');
    menuToggle.setAttribute('aria-controls', menu.id || 'site-menu');
    menuToggle.setAttribute('aria-expanded','false');
    menu.setAttribute('aria-hidden','true');

    const setState = (open) => {
      menu.classList.toggle('open', open);
      menuToggle.classList.toggle('active', open);
      menuToggle.setAttribute('aria-expanded', String(!!open));
      menu.setAttribute('aria-hidden', String(!open));
    };
    const toggle = () => setState(!menu.classList.contains('open'));
    menuToggle.addEventListener('click', toggle);
    menuToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') toggle();
    });
  } else {
    logMenu.warn('Menu-Toggle-Elemente fehlen oder konnten nicht gefunden werden.');
  }
}

/**
 * Initialisiert das Verhalten für den Logo-Rechtsklick
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function initializeLogo(container) {
  const logoContainer = container.querySelector('.site-logo__container');
  if (logoContainer) {
    logoContainer.addEventListener('contextmenu', (_e) => {
      // e.preventDefault(); entfernt, um Scroll-Blockaden zu vermeiden
      window.location.href = '/index.html';
    });
  } else {
    logMenu.warn('Logo-Container konnte nicht gefunden werden.');
  }
}

/**
 * Initialisiert die Submenu-Links
 */
function initializeSubmenuLinks() {
  const submenuButtons = document.querySelectorAll('.has-submenu > .submenu-toggle');
  submenuButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const submenu = btn.nextElementSibling;
      const open = submenu.style.display === 'block';
      // Close others
      document.querySelectorAll('.submenu').forEach(sm => {
        if (sm !== submenu) sm.style.display = 'none';
      });
      submenu.style.display = open ? 'none' : 'block';
      btn.setAttribute('aria-expanded', String(!open));
    });
  });
}

/**
 * Schließt das Menü
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function closeMenu(container) {
  const menuToggle = container.querySelector('.site-menu__toggle');
  const menu = container.querySelector('.site-menu');
  if (menuToggle && menu) {
    menu.classList.remove('open');
    menuToggle.classList.remove('active');
  }
}

/**
 * Setzt den Seitentitel im Logo anhand des aktuellen Pfads oder der aktiven Sektion
 */
function setSiteTitle() {
  const titleMap = {
    '/index.html': 'Startseite',
    '/': 'Startseite',
    '/pages/fotogalerie/urban.html': 'Album',
    '/pages/ueber-mich/': 'Über mich',
    '/pages/webentwicklung/project-1.html': 'E‑Commerce Platform',
    '/pages/spiele/space-defender.html': 'Space Defender',
    '/pages/card/wetter.html': 'Wetter',
  };
  const path = window.location.pathname;
  const pageTitle = titleMap[path] || document.title || 'Website';
  const siteTitleEl = document.getElementById('site-title');
  if (siteTitleEl) siteTitleEl.textContent = pageTitle;
  
  // Initialisiere Scroll-Detection nur auf der Hauptseite
  if (path === '/' || path === '/index.html') {
    initializeScrollDetection();
    
    // Temporäre Debug-Funktion für Scroll Snap mit section-header (können Sie später entfernen)
    window.debugScrollDetection = function() {
      const sections = document.querySelectorAll('#hero.section, #features.section, #about.section');
      const allSections = Array.from(document.querySelectorAll('main .section, .section'));
      const activeSectionEl = document.querySelector('.section.section-active');
      const siteTitleEl = document.getElementById('site-title');
      const siteSubtitleEl = document.getElementById('site-subtitle');
      
      console.warn('=== SCROLL SNAP + SECTION HEADER DEBUG INFO ===');
      console.warn('Current title:', siteTitleEl?.textContent);
      console.warn('Current subtitle:', siteSubtitleEl?.textContent);
      console.warn('Subtitle visible:', siteSubtitleEl?.classList.contains('show'));
      console.warn('Active section element:', activeSectionEl?.id || 'none');
      console.warn('Target sections found:', sections.length);
      console.warn('All sections found:', allSections.length);
      console.warn('Current scroll position:', window.scrollY);
      console.warn('Viewport height:', window.innerHeight);
      console.warn('Viewport center:', window.innerHeight * 0.5);
      
      // Zeige alle Sektionen mit ihrer Position und extrahierten Inhalten
      allSections.forEach((section, index) => {
        const rect = section.getBoundingClientRect();
        const sectionCenter = rect.top + rect.height * 0.5;
        const distanceFromCenter = Math.abs(sectionCenter - (window.innerHeight * 0.5));
        const hasActiveClass = section.classList.contains('section-active');
        const hasInViewClass = section.classList.contains('in-view');
        
        // Extrahiere section-header Informationen
        const header = section.querySelector('.section-header');
        const titleEl = header?.querySelector('.section-title, h1, h2, h3');
        const subtitleEl = header?.querySelector('.section-subtitle');
        const extractedTitle = titleEl?.textContent?.trim() || 'Nicht gefunden';
        const extractedSubtitle = subtitleEl?.textContent?.trim() || 'Nicht gefunden';
        
        console.warn(`Section ${index} - ID: ${section.id}:`);
        console.warn(`  - State: ${section.getAttribute('data-state')}`);
        console.warn(`  - Height: ${section.offsetHeight}px`);
        console.warn(`  - Top: ${rect.top}px (relative to viewport)`);
        console.warn(`  - Center: ${sectionCenter}px (relative to viewport)`);
        console.warn(`  - Distance from viewport center: ${distanceFromCenter}px`);
        console.warn(`  - Has section-active: ${hasActiveClass}`);
        console.warn(`  - Has in-view: ${hasInViewClass}`);
        console.warn(`  - Has section-header: ${!!header}`);
        console.warn(`  - Extracted title: "${extractedTitle}"`);
        console.warn(`  - Extracted subtitle: "${extractedSubtitle}"`);
        console.warn(`  - Classes: ${section.className}`);
      });
      
      // Test snapSectionChange Event mit section-header
      window.testSnapEvent = function(index) {
        const section = allSections[index];
        const detail = { index, id: section?.id || `section-${index}` };
        window.dispatchEvent(new CustomEvent('snapSectionChange', { detail }));
        
        if (section) {
          const { title, subtitle } = extractSectionInfo(section.id);
          console.warn('Dispatched snapSectionChange event:', detail);
          console.warn('Extracted info:', { title, subtitle });
        }
      };
      console.warn('Use testSnapEvent(index) to manually trigger snap events with section-header extraction');
    };
  }
}

/**
 * Extrahiert Titel und Untertitel aus einer Sektion
 */
function extractSectionInfo(sectionId) {
  const fallbackTitleMap = {
    'hero': { title: 'Startseite', subtitle: '' },
    'features': { title: 'Projekte', subtitle: 'Meine Arbeiten' }, 
    'about': { title: 'Über mich', subtitle: 'Lerne mich kennen' }
  };
  
  const section = document.querySelector(`#${sectionId}`);
  if (!section) return fallbackTitleMap[sectionId] || { title: 'Startseite', subtitle: '' };
  
  // Spezielle Behandlung für Hero-Sektion - immer nur "Startseite"
  if (sectionId === 'hero') {
    // Stelle sicher, dass keine section-header Elemente in der Hero-Sektion angezeigt werden
    const heroSection = document.querySelector('#hero');
    if (heroSection) {
      const headers = heroSection.querySelectorAll('.section-header, .section-subtitle');
      headers.forEach(header => {
        header.style.display = 'none';
        header.style.visibility = 'hidden';
      });
    }
    return { title: 'Startseite', subtitle: '' };
  }

  // Spezielle Behandlung für Features-Sektion - section-header ausblenden
  if (sectionId === 'features') {
    const featuresSection = document.querySelector('#features');
    if (featuresSection) {
      const headers = featuresSection.querySelectorAll('.section-header, .section-subtitle');
      headers.forEach(header => {
        header.style.display = 'none';
        header.style.visibility = 'hidden';
      });
    }
    return fallbackTitleMap[sectionId] || { title: 'Projekte', subtitle: '' };
  }

  // Spezielle Behandlung für About-Sektion - section-header ausblenden
  if (sectionId === 'about') {
    const aboutSection = document.querySelector('#about');
    if (aboutSection) {
      const headers = aboutSection.querySelectorAll('.section-header, .section-subtitle');
      headers.forEach(header => {
        header.style.display = 'none';
        header.style.visibility = 'hidden';
      });
    }
    return fallbackTitleMap[sectionId] || { title: 'Über mich', subtitle: '' };
  }
  
  // Suche nach section-header in der Sektion
  const header = section.querySelector('.section-header');
  if (!header) return fallbackTitleMap[sectionId] || { title: 'Startseite', subtitle: '' };
  
  const titleEl = header.querySelector('.section-title, h1, h2, h3');
  const subtitleEl = header.querySelector('.section-subtitle');
  
  const title = titleEl?.textContent?.trim() || fallbackTitleMap[sectionId]?.title || 'Startseite';
  const subtitle = subtitleEl?.textContent?.trim() || fallbackTitleMap[sectionId]?.subtitle || '';
  
  return { title, subtitle };
}

/**
 * Initialisiert die Scroll-Detection für dynamische Titel-Updates mit Scroll Snap
 */
function initializeScrollDetection() {
  let isScrolling = false;
  let scrollListener = null;
  let observerActive = null;
  let snapEventListener = null;
  
  // Hilfsfunktion für Titel und Untertitel-Update  
  function updateTitleAndSubtitle(newTitle, newSubtitle = '') {
    const siteTitleEl = document.getElementById('site-title');
    const siteSubtitleEl = document.getElementById('site-subtitle');
    
    if (!siteTitleEl) return;
    
    const currentTitle = siteTitleEl.textContent;
    const currentSubtitle = siteSubtitleEl?.textContent || '';
    
    // Nur updaten wenn sich etwas geändert hat
    if (currentTitle === newTitle && currentSubtitle === newSubtitle) return;
    
    // Titel-Update mit Animation
    siteTitleEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    siteTitleEl.style.opacity = '0.6';
    siteTitleEl.style.transform = 'scale(0.95)';
    
    // Untertitel ausblenden falls vorhanden
    if (siteSubtitleEl) {
      siteSubtitleEl.classList.remove('show');
    }
    
    setTimeout(() => {
      // Titel setzen
      siteTitleEl.textContent = newTitle;
      siteTitleEl.style.opacity = '1';
      siteTitleEl.style.transform = 'scale(1)';
      
      // Untertitel setzen und einblenden
      if (siteSubtitleEl && newSubtitle) {
        siteSubtitleEl.textContent = newSubtitle;
        setTimeout(() => {
          siteSubtitleEl.classList.add('show');
        }, 100);
      }
    }, 200);
  }
  
  // Primäre Methode: Höre auf snapSectionChange Event
  function initSnapEventListener() {
    if (snapEventListener) {
      window.removeEventListener('snapSectionChange', snapEventListener);
    }
    
    snapEventListener = (event) => {
      const { index, id } = event.detail || {};
      let sectionId = id;
      
      // Falls ID nicht direkt verfügbar, verwende Index
      if (!sectionId && typeof index === 'number') {
        const sections = Array.from(document.querySelectorAll('main .section, .section'));
        const section = sections[index];
        sectionId = section?.id;
      }
      
      // Titel und Untertitel aus Sektion extrahieren
      if (sectionId) {
        const { title, subtitle } = extractSectionInfo(sectionId);
        updateTitleAndSubtitle(title, subtitle);
      }
    };
    
    window.addEventListener('snapSectionChange', snapEventListener);
  }
  
  // Fallback-Methode: Intersection Observer
  function initIntersectionObserver() {
    if (observerActive) observerActive.disconnect();
    
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -50% 0px', // Trigger wenn Sektion zentral sichtbar ist
      threshold: [0.3, 0.5, 0.8]
    };
    
    observerActive = new IntersectionObserver((entries) => {
      // Nur den Eintrag mit der höchsten Intersection Ratio verwenden
      let bestEntry = null;
      let bestRatio = 0;
      
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
          bestRatio = entry.intersectionRatio;
          bestEntry = entry;
        }
      });
      
      if (bestEntry?.target?.id) {
        const { title, subtitle } = extractSectionInfo(bestEntry.target.id);
        updateTitleAndSubtitle(title, subtitle);
      }
    }, observerOptions);
    
    // Beobachte alle Sektionen
    const sections = document.querySelectorAll('#hero.section, #features.section, #about.section');
    sections.forEach(section => {
      observerActive.observe(section);
    });
  }
  
  // Alternative Fallback: Scroll-basierte Detection
  function updateTitleBasedOnSection() {
    if (isScrolling) return;
    isScrolling = true;
    
    requestAnimationFrame(() => {
      let activeSection = 'hero'; // Default
      
      // Verwende die gleiche Logik wie das Particle-System
      const sections = Array.from(document.querySelectorAll('main .section, .section'));
      if (sections.length > 0) {
        const viewportCenter = window.innerHeight * 0.5;
        let bestDistance = Infinity;
        let bestIndex = 0;
        
        sections.forEach((section, index) => {
          const rect = section.getBoundingClientRect();
          const sectionCenter = rect.top + rect.height * 0.5;
          const distance = Math.abs(sectionCenter - viewportCenter);
          
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
          }
        });
        
        const activeEl = sections[bestIndex];
        if (activeEl?.id) {
          activeSection = activeEl.id;
        }
      }
      
      const { title, subtitle } = extractSectionInfo(activeSection);
      updateTitleAndSubtitle(title, subtitle);
      
      isScrolling = false;
    });
  }
  
  // Warte auf alle Sektionen und initialisiere
  function waitForSnapSections() {
    const checkAndStart = () => {
      const heroSection = document.querySelector('#hero.section');
      const featuresSection = document.querySelector('#features.section');
      const aboutSection = document.querySelector('#about.section');
      
      if (heroSection && featuresSection && aboutSection) {
        // Entferne vorherige Listener falls vorhanden
        if (scrollListener) {
          window.removeEventListener('scroll', scrollListener);
        }
        
        // 1. Primär: Snap Event Listener
        initSnapEventListener();
        
        // 2. Fallback: Intersection Observer
        initIntersectionObserver();
        
        // 3. Zusätzlicher Scroll-Listener als letzte Absicherung
        let scrollTimeout;
        scrollListener = () => {
          if (scrollTimeout) clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(updateTitleBasedOnSection, 200);
        };
        
        window.addEventListener('scroll', scrollListener, { passive: true });
        
        // Initial call
        setTimeout(updateTitleBasedOnSection, 300);
        return true;
      }
      return false;
    };
    
    // Versuche sofort zu starten
    if (checkAndStart()) return;
    
    // Fallback: Warte auf DOM-Änderungen
    const observer = new MutationObserver(() => {
      if (checkAndStart()) {
        observer.disconnect();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Fallback: Nach 3 Sekunden trotzdem starten
    setTimeout(() => {
      observer.disconnect();
      checkAndStart();
    }, 3000);
  }
  
  // Starte die Snap-Detection
  waitForSnapSections();
}

// Aktiven Link im Menü markieren
function setActiveMenuLink() {
  try {
    const path = window.location.pathname.replace(/index\.html$/, '');
    document.querySelectorAll('.site-menu a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      // Normalisieren (index.html entfernen)
      const norm = href.replace(/index\.html$/, '');
      if (norm === path) a.classList.add('active');
      else a.classList.remove('active');
    });
  } catch (error) {
    logMenu.warn('Error setting active menu link:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setActiveMenuLink();
});
