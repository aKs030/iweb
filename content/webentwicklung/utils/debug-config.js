// Debug / Log-Level Konfiguration
// Lädt Query-Parameter ?debug=true|false & ?log=debug|info|warn|error oder numerisch
// Persistiert Einstellungen optional in localStorage (key: app_debug, app_log_level)
(function(){
  try {
    const params = new URLSearchParams(window.location.search);
    const ls = window.localStorage;

    // Produktions-Erkennung (Hostname Heuristik anpassbar)
    const host = window.location.hostname;
    const isLocal = /localhost|127\.0\.0\.1/.test(host);
    const isProd = !isLocal && !/\b(dev|test|staging)\b/i.test(host);

    const debugParam = params.get('debug');
    const levelParam = params.get('log') ?? params.get('logLevel');

    if (debugParam !== null && debugParam !== undefined) {
      const val = /^(1|true|on)$/i.test(debugParam);
      ls.setItem('app_debug', val ? '1' : '0');
    }
    if (levelParam !== null && levelParam !== undefined) {
      ls.setItem('app_log_level', levelParam);
    }

    const storedDebug = ls.getItem('app_debug');
    const storedLevel = ls.getItem('app_log_level');

    if (typeof window.DEBUG === 'undefined') {
      window.DEBUG = storedDebug ? storedDebug === '1' : false;
    }
    if (typeof window.LOG_LEVEL === 'undefined') {
      const base = isProd ? 'error' : 'info';
      window.LOG_LEVEL = storedLevel ?? (window.DEBUG ? 'debug' : base);
    }

    // Overlay nur bei aktivem DEBUG laden
    if (window.DEBUG) {
      import('./debug-overlay.js').catch(() => {});
    }
  } catch (e) {
    console.warn('[debug-config] Initialisierung übersprungen:', e);
  }
})();
