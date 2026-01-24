/**
 * Advanced Menu Usage Examples
 * 
 * Zeigt wie man die neuen Features des Menu Systems nutzt
 */

import { MenuController } from '../modules/MenuController.js';

// ===== Beispiel 1: State-Updates abonnieren =====
export async function subscribeToMenuState() {
  const controller = new MenuController();
  await controller.init();

  // Menu öffnen/schließen tracken
  controller.state.on('openChange', (isOpen) => {
    console.log('Menu is now:', isOpen ? 'open' : 'closed');
    
    // Analytics Event senden
    if (window.gtag) {
      window.gtag('event', 'menu_interaction', {
        action: isOpen ? 'open' : 'close'
      });
    }
  });

  // Titel-Änderungen tracken
  controller.state.on('titleChange', ({ title, subtitle }) => {
    console.log('Title changed to:', title, subtitle);
    
    // Update Browser Title
    document.title = subtitle ? `${title} - ${subtitle}` : title;
  });

  // Aktiver Link geändert
  controller.state.on('activeLinkChange', (link) => {
    console.log('Active link:', link);
  });

  return controller;
}

// ===== Beispiel 2: Programmatisches Steuern =====
export async function controlMenuProgrammatically() {
  const controller = new MenuController();
  await controller.init();

  // Menu öffnen
  controller.state.setOpen(true);

  // Nach 2 Sekunden schließen
  setTimeout(() => {
    controller.state.setOpen(false);
  }, 2000);

  // Titel ändern
  controller.state.setTitle('Neuer Titel', 'Mit Untertitel');

  return controller;
}

// ===== Beispiel 3: Custom Event Handler =====
export async function addCustomBehavior() {
  const controller = new MenuController();
  await controller.init();

  // Eigene Logik bei Menu-Öffnung
  controller.state.on('openChange', (isOpen) => {
    if (isOpen) {
      // Blur Hintergrund
      document.body.style.filter = 'blur(2px)';
      document.body.style.transition = 'filter 0.3s ease';
    } else {
      // Blur entfernen
      document.body.style.filter = 'none';
    }
  });

  return controller;
}

// ===== Beispiel 4: State Synchronisation =====
export async function syncWithLocalStorage() {
  const controller = new MenuController();
  await controller.init();

  // State in LocalStorage speichern
  controller.state.on('openChange', (isOpen) => {
    localStorage.setItem('menuState', JSON.stringify({ isOpen }));
  });

  // State aus LocalStorage laden
  try {
    const saved = JSON.parse(localStorage.getItem('menuState'));
    if (saved?.isOpen) {
      controller.state.setOpen(true);
    }
  } catch (e) {
    console.warn('Could not restore menu state:', e);
  }

  return controller;
}

// ===== Beispiel 5: Keyboard Shortcuts =====
export async function addKeyboardShortcuts() {
  const controller = new MenuController();
  await controller.init();

  // Cmd/Ctrl + M zum Öffnen/Schließen
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
      e.preventDefault();
      controller.state.setOpen(!controller.state.isOpen);
    }
  });

  return controller;
}

// ===== Beispiel 6: Animation Callbacks =====
export async function animationCallbacks() {
  const controller = new MenuController();
  await controller.init();

  controller.state.on('openChange', (isOpen) => {
    if (isOpen) {
      // Animation beim Öffnen
      console.log('Menu opening animation started');
      
      // Nach Animation
      setTimeout(() => {
        console.log('Menu fully opened');
      }, 400); // Match CSS transition duration
    }
  });

  return controller;
}

// ===== Beispiel 7: Multi-Instance Management =====
export class MenuManager {
  constructor() {
    this.controllers = new Map();
  }

  async createMenu(id) {
    const controller = new MenuController();
    await controller.init();
    this.controllers.set(id, controller);
    return controller;
  }

  getMenu(id) {
    return this.controllers.get(id);
  }

  closeAll() {
    this.controllers.forEach(controller => {
      controller.state.setOpen(false);
    });
  }

  destroyAll() {
    this.controllers.forEach(controller => {
      controller.destroy();
    });
    this.controllers.clear();
  }
}

// ===== Beispiel 8: Debug Mode =====
export async function enableDebugMode() {
  const controller = new MenuController();
  await controller.init();

  // Log alle State-Änderungen
  ['openChange', 'titleChange', 'activeLinkChange'].forEach(event => {
    controller.state.on(event, (data) => {
      console.log(`[Menu Debug] ${event}:`, data);
    });
  });

  // Expose für Console
  window.menuDebug = {
    state: controller.state,
    open: () => controller.state.setOpen(true),
    close: () => controller.state.setOpen(false),
    setTitle: (title, subtitle) => controller.state.setTitle(title, subtitle),
  };

  console.log('Menu Debug Mode enabled. Use window.menuDebug');

  return controller;
}

// ===== Auto-Initialize mit Features =====
export async function initWithFeatures(options = {}) {
  const controller = new MenuController();
  await controller.init();

  // Optional: Analytics
  if (options.analytics) {
    controller.state.on('openChange', (isOpen) => {
      window.gtag?.('event', 'menu_interaction', {
        action: isOpen ? 'open' : 'close'
      });
    });
  }

  // Optional: LocalStorage Sync
  if (options.persistState) {
    controller.state.on('openChange', (isOpen) => {
      localStorage.setItem('menuState', JSON.stringify({ isOpen }));
    });
  }

  // Optional: Keyboard Shortcuts
  if (options.keyboardShortcuts) {
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault();
        controller.state.setOpen(!controller.state.isOpen);
      }
    });
  }

  // Optional: Debug Mode
  if (options.debug) {
    window.menuDebug = {
      state: controller.state,
      controller,
    };
  }

  return controller;
}
