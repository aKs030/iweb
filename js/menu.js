// menu.js – final funktionierende Version

document.addEventListener('DOMContentLoaded', () => {
  const menuContainer = document.getElementById('menu-container');

  // Footer laden
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (footerPlaceholder) {
    fetch('/pages/komponente/footer.html')
      .then(r => {
        if (!r.ok) throw new Error('Footer konnte nicht geladen werden');
        return r.text();
      })
      .then(html => {
        footerPlaceholder.innerHTML = html;
        const yearEl = document.getElementById('current-year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();
      })
      .catch(() => {
        // Optional: Fallback oder Fehleranzeige
      });
  } else {
    console.error('Fehler: footer-placeholder wurde nicht gefunden.');
  }

  // Menü laden
  if (!menuContainer) {
    console.error('Fehler: menuContainer wurde nicht gefunden.');
    return;
  }
  fetch('/pages/komponente/menu.html')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP-Error! Status: ${response.status}`);
      return response.text();
    })
    .then(menuMarkup => {
      menuContainer.innerHTML = menuMarkup;
      initializeMenu(menuContainer);
      initializeLogo(menuContainer);
      initializeSubmenuLinks(menuContainer);
      setSiteTitle();

      // Klick außerhalb schließt das Menü (nur Desktop)
      document.addEventListener('click', (event) => {
        const isClickInside = menuContainer.contains(event.target);
        const isMenuToggle = event.target.closest('.site-menu__toggle');
        if (!isClickInside && !isMenuToggle) closeMenu(menuContainer);
      });
    })
    .catch(err => {
      console.error('Fehler beim Laden des Menüs:', err.message);
    });
});

// Menü-Toggle-Logik
function initializeMenu(container) {
  const menuToggle = container.querySelector('.site-menu__toggle');
  const menu = container.querySelector('.site-menu');
  const overlay = container.querySelector('.site-menu__overlay');

  if (menuToggle && menu) {
    const toggle = () => {
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!isExpanded));
      menu.classList.toggle('open');
      menuToggle.classList.toggle('active');
    };

    menuToggle.addEventListener('click', toggle);
    menuToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') toggle();
    });

    if (overlay) {
      overlay.addEventListener('click', () => {
        menu.classList.remove('open');
        menuToggle.classList.remove('active');
      });
    }
  } else {
    console.warn('Menu-Toggle-Elemente fehlen oder konnten nicht gefunden werden.');
  }
}

// Logo-Rechtsklick navigiert zur Startseite
function initializeLogo(container) {
  const logoContainer = container.querySelector('.site-logo__container');
  if (logoContainer) {
    logoContainer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      window.location.href = '/index.html';
    });
  } else {
    console.warn('Logo-Container konnte nicht gefunden werden.');
  }
}

// Submenu-Links – nur Mobile
function initializeSubmenuLinks(container) {
  const submenuLinks = container.querySelectorAll('.has-submenu > a');
  submenuLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      if (window.innerWidth > 768) return;
      event.preventDefault();

      const parentLi = link.parentElement;
      const isOpen = parentLi.classList.contains('open');

      container.querySelectorAll('.has-submenu').forEach(li => li.classList.remove('open'));
      if (!isOpen) parentLi.classList.add('open');
    });
  });
}

// Menü schließen (z. B. bei Klick außen)
function closeMenu(container) {
  const menuToggle = container.querySelector('.site-menu__toggle');
  const menu = container.querySelector('.site-menu');
  if (menuToggle && menu) {
    menu.classList.remove('open');
    menuToggle.classList.remove('active');
  }
}

// Seitentitel im Logo setzen
function setSiteTitle() {
  const titleMap = {
    '/index.html': 'Startseite',
    '/': 'Startseite',
    '/pages/album.html': 'Fotogalerie',
    '/pages/ubermich.html': 'Über mich',
    '/pages/index-game.html': 'Spiele-Übersicht',
    '/pages/features/wetter.html': 'Wetter',
  };
  const path = window.location.pathname;
  const pageTitle = titleMap[path] || document.title || 'Website';
  const siteTitleEl = document.getElementById('site-title');
  if (siteTitleEl) siteTitleEl.textContent = pageTitle;
}

