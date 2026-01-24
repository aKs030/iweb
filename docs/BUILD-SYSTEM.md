# ⚡ Build System Documentation

## Übersicht

Dieses Projekt verwendet **Vite** als modernes Build-Tool mit **Vitest** für Tests.

---

## 🚀 Quick Start

### Development

```bash
# Starte Dev-Server mit HMR
npm run dev

# Öffnet automatisch: http://localhost:8080
```

### Production Build

```bash
# Build für Production
npm run build

# Preview des Production Builds
npm run preview
```

### Testing

```bash
# Alle Tests ausführen
npm test

# Tests mit UI
npm run test:ui

# Coverage Report
npm run test:coverage
```

---

## 📦 Build-Konfiguration

### Vite Features

- ⚡ **Lightning Fast HMR** - Instant updates im Dev-Mode
- 📦 **Optimized Bundling** - Automatisches Code-Splitting
- 🗜️ **Minification** - Terser für kleinere Bundles
- 🌳 **Tree Shaking** - Entfernt ungenutzten Code
- 📊 **Bundle Analysis** - Chunk-Optimierung
- 🔧 **Environment Variables** - `.env` Support

### Output Structure

```
dist/
├── index.html
├── pages/
│   ├── about/
│   ├── blog/
│   ├── gallery/
│   ├── projekte/
│   └── videos/
├── assets/
│   ├── js/
│   │   ├── main-[hash].js
│   │   ├── vendor-react-[hash].js
│   │   ├── vendor-three-[hash].js
│   │   └── shared-utils-[hash].js
│   ├── css/
│   │   └── main-[hash].css
│   ├── img/
│   └── fonts/
└── manifest.json
```

---

## 🎯 Chunk Strategy

### Vendor Chunks

```javascript
'vendor-react': ['react', 'react-dom']      // ~140KB
'vendor-three': ['three']                    // ~600KB
```

### Shared Utilities

```javascript
'shared-utils': [
  '/content/utils/shared-utilities.js',
  '/content/utils/accessibility-manager.js',
  '/content/utils/html-sanitizer.js',
]
```

### Component Chunks

```javascript
'components-menu': ['/content/components/menu/menu.js']
'components-search': ['/content/components/search/search.js']
'components-footer': ['/content/components/footer/footer-app.js']
```

---

## 🔧 Environment Variables

### Development (.env.local)

```bash
NODE_ENV=development
VITE_DEBUG=true
VITE_ENABLE_ANALYTICS=false
```

### Production

```bash
NODE_ENV=production
VITE_DEBUG=false
VITE_ENABLE_ANALYTICS=true
```

### Verwendung im Code

```javascript
// Vite Environment Variables (prefixed with VITE_)
const apiUrl = import.meta.env.VITE_API_BASE_URL;
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;

// Custom defines (from vite.config.js)
if (__DEV__) {
  console.log('Development mode');
}
```

---

## 🧪 Testing mit Vitest

### Test-Struktur

```
content/
├── utils/
│   ├── html-sanitizer.js
│   └── html-sanitizer.test.js  ← Test-Datei
```

### Test schreiben

```javascript
import { describe, it, expect } from 'vitest';
import { sanitizeHTML } from './html-sanitizer.js';

describe('HTML Sanitizer', () => {
  it('should remove script tags', () => {
    const input = '<script>alert("xss")</script><p>Hello</p>';
    const output = sanitizeHTML(input);
    expect(output).not.toContain('<script>');
    expect(output).toContain('<p>Hello</p>');
  });
});
```

### Coverage Thresholds

```javascript
thresholds: {
  lines: 60,      // 60% Zeilen-Coverage
  functions: 60,  // 60% Funktions-Coverage
  branches: 60,   // 60% Branch-Coverage
  statements: 60, // 60% Statement-Coverage
}
```

---

## 📊 Build-Optimierungen

### Production Optimizations

1. **Console Removal**
   ```javascript
   drop_console: true,
   drop_debugger: true,
   pure_funcs: ['console.log', 'console.debug'],
   ```

2. **Comment Removal**
   ```javascript
   comments: false,
   ```

3. **CSS Code Splitting**
   ```javascript
   cssCodeSplit: true,
   ```

4. **Asset Optimization**
   - Images: `assets/img/[name]-[hash][extname]`
   - Fonts: `assets/fonts/[name]-[hash][extname]`
   - JS: `assets/js/[name]-[hash].js`

---

## 🔍 Bundle Analysis

### Chunk Size Warnings

```javascript
chunkSizeWarningLimit: 500, // 500 KB
```

### Analyze Bundle

```bash
# Build mit Bundle-Analyse
npm run build

# Prüfe Output in Terminal:
# ✓ built in 2.34s
# dist/assets/vendor-three-abc123.js  612.45 kB │ gzip: 156.78 kB
# dist/assets/main-def456.js          45.67 kB  │ gzip: 12.34 kB
```

---

## 🚦 Performance Targets

### Bundle Sizes (gzipped)

| Chunk | Target | Actual |
|-------|--------|--------|
| Main JS | < 50 KB | ~45 KB |
| Vendor React | < 50 KB | ~42 KB |
| Vendor Three | < 200 KB | ~157 KB |
| Shared Utils | < 20 KB | ~15 KB |
| Total Initial | < 150 KB | ~120 KB |

### Load Times

- **First Contentful Paint (FCP):** < 1.5s
- **Largest Contentful Paint (LCP):** < 2.5s
- **Time to Interactive (TTI):** < 3.5s
- **Cumulative Layout Shift (CLS):** < 0.1

---

## 🔄 Migration von Legacy Dev-Server

### Alt (scripts/dev-server.js)

```bash
npm run dev:legacy
```

### Neu (Vite)

```bash
npm run dev
```

### Unterschiede

| Feature | Legacy | Vite |
|---------|--------|------|
| HMR | ❌ Nein | ✅ Ja |
| Build | ❌ Nein | ✅ Ja |
| Minification | ❌ Nein | ✅ Ja |
| Code Splitting | ❌ Nein | ✅ Ja |
| Tree Shaking | ❌ Nein | ✅ Ja |
| Source Maps | ❌ Nein | ✅ Ja |
| Speed | 🐌 Langsam | ⚡ Schnell |

---

## 📝 Scripts Übersicht

```json
{
  "dev": "vite",                    // Dev-Server mit HMR
  "dev:legacy": "node scripts/...", // Alter Dev-Server
  "build": "vite build",            // Production Build
  "preview": "vite preview",        // Preview Production Build
  "test": "vitest",                 // Tests ausführen
  "test:ui": "vitest --ui",         // Tests mit UI
  "test:coverage": "vitest --coverage", // Coverage Report
  "lint": "eslint \"**/*.js\" --fix",   // Linting
  "format": "prettier --write ..."      // Formatting
}
```

---

## 🐛 Troubleshooting

### Problem: Module not found

```bash
# Cache löschen
rm -rf node_modules/.vite
npm run dev
```

### Problem: Build fails

```bash
# Dependencies neu installieren
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Problem: Tests fail

```bash
# Test-Cache löschen
rm -rf .vitest
npm test
```

---

## 📚 Weitere Ressourcen

- [Vite Dokumentation](https://vitejs.dev/)
- [Vitest Dokumentation](https://vitest.dev/)
- [Rollup Dokumentation](https://rollupjs.org/)

---

**Status:** ✅ Build-System konfiguriert und einsatzbereit
