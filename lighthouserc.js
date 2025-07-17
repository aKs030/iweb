// lighthouserc.js – Lighthouse CI Configuration
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:8000',
        'http://localhost:8000/pages/ubermich.html',
        'http://localhost:8000/pages/album.html',
        'http://localhost:8000/pages/index-game.html'
      ],
      startServerCommand: 'npm run dev-node',
      startServerReadyPattern: 'Available on',
      numberOfRuns: 1, // schnellere CI-Tests, bei Bedarf auf 3 erhöhen
    },
    assert: {
      assertions: {
        // Kategorie-Ziele
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'categories:pwa': ['warn', { minScore: 0.8 }],

        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],

        // PWA Checks
        'service-worker': 'error',
        'installable-manifest': 'error',
        'themed-omnibox': 'warn',

        // Security (deaktiviert wegen localhost)
        'is-on-https': 'off',
        'uses-https': 'off',
        'geolocation-on-start': 'error',
        'notification-on-start': 'error',

        // Accessibility
        'color-contrast': 'error',
        'heading-order': 'error',
        'html-has-lang': 'error',
        'image-alt': 'error',
        'link-name': 'error',

        // Performance-Optimierungen
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',
        'modern-image-formats': 'warn',
        'efficient-animated-content': 'warn',
        'non-composited-animations': 'warn',

        // Best Practices
        'uses-responsive-images': 'warn',
        'offscreen-images': 'warn',
        'unminified-css': 'warn',
        'unminified-javascript': 'warn',
        'charset': 'error'
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};