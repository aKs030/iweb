/**
 * Main Initialization Script – Pfadsichere Version
 * Zentrale Koordination aller Module
 *
 * @version 3.1.0
 * @date 2025-07-25
 */

class MainInitializer {
  constructor() {
    this.initModules = [];
    this.isInitialized = false;
    this.initStartTime = null;
    this.moduleTimings = new Map();
    this.priorityModules = new Set(['ErrorHandler', 'PerformanceMonitor']);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      setTimeout(() => this.initialize(), 0);
    }
  }

  registerModule(name, initFunction, options = {}) {
    const moduleConfig = {
      name,
      initFunction,
      priority: this.priorityModules.has(name) ? 'high' : options.priority || 'normal',
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      dependencies: options.dependencies || [],
    };

    this.initModules.push(moduleConfig);
    this.sortModulesByPriority();

    if (this.isInitialized) {
      this.runModule(moduleConfig);
    }
  }

  sortModulesByPriority() {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    this.initModules.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  async runModule(moduleConfig) {
    const startTime = performance.now();

    try {
      if (!this.checkDependencies(moduleConfig)) {
        console.warn(`⚠️ Abhängigkeiten für ${moduleConfig.name} nicht erfüllt`);
        return;
      }

      await Promise.race([
        moduleConfig.initFunction(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), moduleConfig.timeout)
        ),
      ]);

      const duration = performance.now() - startTime;
      this.moduleTimings.set(moduleConfig.name, duration);
      console.log(`✅ ${moduleConfig.name} initialisiert (${Math.round(duration)}ms)`);
    } catch (error) {
      console.error(`❌ Fehler in ${moduleConfig.name}:`, error);
      if (moduleConfig.critical) {
        console.error(`🚨 Kritisches Modul ${moduleConfig.name} fehlgeschlagen!`);
      }
    }
  }

  checkDependencies(moduleConfig) {
    return moduleConfig.dependencies.every((dep) => this.moduleTimings.has(dep) || window[dep]);
  }

  async initialize() {
    if (this.isInitialized) return;

    console.log('🚀 Starte Website-Initialisierung...');
    this.isInitialized = true;
    this.initStartTime = performance.now();

    for (const moduleConfig of this.initModules) {
      await this.runModule(moduleConfig);
    }

    const totalTime = performance.now() - this.initStartTime;

    document.dispatchEvent(
      new CustomEvent('websiteInitialized', {
        detail: {
          modules: Array.from(this.moduleTimings.keys()),
          totalTime: totalTime,
          moduleTimings: Object.fromEntries(this.moduleTimings),
        },
      })
    );

    console.log(`✅ Initialisierung abgeschlossen in ${Math.round(totalTime)}ms`);
  }
}

window.mainInitializer = new MainInitializer();

window.onWebsiteReady = (name, initFunction, options = {}) => {
  window.mainInitializer.registerModule(name, initFunction, options);
};

// 🔧 Pfadsicherer Ladevorgang für share-dialog.js
(function loadShareDialogScript() {
  if (typeof window.showShareDialog === 'undefined') {
    const script = document.createElement('script');

    // Pfad berechnen basierend auf aktuellem Pfad
    const currentPath = window.location.pathname;
    const scriptBase = currentPath.includes('/pages/') ? '../js/' : 'js/';
    script.src = scriptBase + 'share-dialog.js';

    script.onload = () => console.log('✅ share-dialog.js geladen');
    script.onerror = () => console.warn('⚠️ share-dialog.js konnte nicht geladen werden');

    document.head.appendChild(script);
  }
})();

// Globale Share-Funktion
window.shareContent = async function (title, text, url) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
    } catch (err) {
      console.log('Teilen abgebrochen oder Fehler:', err);
    }
  } else {
    if (typeof window.showShareDialog === 'function') {
      window.showShareDialog(title, text, url);
    } else {
      alert('Teilen wird auf diesem Gerät nicht unterstützt.');
    }
  }
};

// 🔌 Module registrieren
window.onWebsiteReady(
  'ErrorHandler',
  () => Promise.resolve(),
  { priority: 'high', critical: true }
);

window.onWebsiteReady(
  'PerformanceMonitor',
  () => Promise.resolve(),
  { priority: 'high' }
);

window.onWebsiteReady('CookieSystem', async () => {
  return new Promise((resolve) => {
    if (window.CookieConsent) {
      resolve();
    } else {
      document.addEventListener('DOMContentLoaded', resolve);
    }
  });
});

window.onWebsiteReady('Navigation', async () => Promise.resolve());

window.onWebsiteReady('ScrollNavigation', async () => Promise.resolve());

window.onWebsiteReady(
  'ContentAnimation',
  async () => {
    return new Promise((resolve) => {
      document.addEventListener('templatesLoaded', resolve);
    });
  },
  { dependencies: ['Navigation'] }
);

// 🔧 Debug-Funktionen nur lokal
if (window.location.hostname === 'localhost') {
  window.debugInit = {
    stats: () => ({
      modules: Array.from(window.mainInitializer.moduleTimings.keys()),
      timings: Object.fromEntries(window.mainInitializer.moduleTimings),
      totalTime: window.mainInitializer.initStartTime
        ? performance.now() - window.mainInitializer.initStartTime
        : 0,
    }),
    reset: () => {
      window.mainInitializer.moduleTimings.clear();
      window.mainInitializer.isInitialized = false;
      console.log('🔄 Initialisierung zurückgesetzt');
    },
  };
}