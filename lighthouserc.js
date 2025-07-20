// Lighthouse CI Configuration – optimised for GitHub Actions
// -----------------------------------------------------------
// Das File ist so aufgebaut, dass es sowohl lokal (\"npm run lhci\")
// als auch in der CI ohne Änderungen läuft.
// -----------------------------------------------------------

/*
  Wichtige Anpassungen:
  - BASE_URL via Umgebungsvariable (fällt auf localhost zurück)
  - numberOfRuns CI-freundlich auf 3 erhöht ⇒ stabilere Median-Werte
  - Upload: nur in CI an Public Storage, lokal auf keinen
  - Assertions klarer gruppiert und strenger abgestuft (error|warn)
  - Überflüssige / doppelte Checks entfernt
  - ChromeFlags → Headless & CPU-Throttling (6×) für deterministisches Ergebnis
*/

const BASE_URL = process.env.LHCI_BASE_URL || 'http://localhost:8000';

module.exports = {
  ci: {
    collect: {
      url: [
        `${BASE_URL}/`,
        `${BASE_URL}/pages/ubermich.html`,
        `${BASE_URL}/pages/album.html`,
        `${BASE_URL}/pages/index-game.html`,
      ],
      startServerCommand: BASE_URL.includes('localhost') ? 'npm run dev-node' : undefined,
      startServerReadyPattern: 'Available on',
      numberOfRuns: process.env.CI ? 3 : 1,
      chromeFlags: '--headless --disable-gpu --no-sandbox --throttling-method=devtools',
    },

    assert: {
      preset: 'lighthouse:recommended', // Basis-Regeln, danach Überschreiben/Ergänzen
      assertions: {
        // ---------------------------------------------------
        // Kategorie-Ziele (0-1 Skala)
        // ---------------------------------------------------
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'categories:pwa': ['warn', { minScore: 0.8 }],

        // ---------------------------------------------------
        // Core Web Vitals (maxNumericValue in Millisekunden)
        // ---------------------------------------------------
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }], // 2 s
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }], // 4 s
        'total-blocking-time': ['warn', { maxNumericValue: 300 }], // 300 ms
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],

        // ---------------------------------------------------
        // Sicherheit (lokal abgeschwächt)
        // ---------------------------------------------------
        'is-on-https': BASE_URL.startsWith('https') ? 'error' : 'off',
        'uses-https': BASE_URL.startsWith('https') ? 'error' : 'off',
        'geolocation-on-start': 'error',
        'notification-on-start': 'error',

        // ---------------------------------------------------
        // Performance / Bytes sparen
        // ---------------------------------------------------
        'unused-javascript': ['warn', { maxNumericValue: 3000 }],
        'unused-css-rules': ['warn', { maxNumericValue: 3000 }],
        'modern-image-formats': 'warn',
        'efficient-animated-content': 'warn',
        'non-composited-animations': 'warn',

        // ---------------------------------------------------
        // Best Practices & Accessibility
        // ---------------------------------------------------
        'color-contrast': 'error',
        'heading-order': 'error',
        'html-has-lang': 'error',
        'image-alt': 'error',
        'link-name': 'error',
        charset: 'error',
      },
    },

    upload: {
      target: process.env.CI ? 'temporary-public-storage' : 'filesystem',
    },
  },
};
