# Performance & Quality Reports

Dieses Verzeichnis enthält automatisch generierte Performance- und Qualitäts-Reports.

## 📊 Verfügbare Analysen

### Bundle Size Analysis
```bash
npm run analyze:bundle
```

**Prüft:**
- JavaScript Module-Größen
- CSS Datei-Größen
- Asset-Größen (Texturen, Bilder)
- Import-Abhängigkeiten
- Performance-Budget-Überschreitungen

**Exit Code:** 1 bei Budget-Überschreitungen

---

### Accessibility Audit
```bash
npm run audit:a11y
```

**Prüft:**
- ARIA-Attribute Validierung
- Semantic HTML
- Image Alt-Text
- Heading-Hierarchie
- Landmarks (main, nav)
- Duplicate IDs

**Exit Code:** 1 bei kritischen Errors

---

### Performance Profiling Guide
```bash
npm run performance:guide
```

**Zeigt:**
- Chrome DevTools Anleitung
- Core Web Vitals Monitoring
- Lighthouse CLI Commands
- Projekt-spezifische Optimierungen

**Kein Exit Code Check**

---

### Lighthouse Reports (Optional)

**Installation:**
```bash
npm install --save-dev lighthouse
```

**HTML Report (mit Browser-Ansicht):**
```bash
npx lighthouse http://localhost:8000 \
  --view \
  --output html \
  --output-path ./reports/lighthouse-report.html
```

**JSON Report (für CI):**
```bash
npx lighthouse http://localhost:8000 \
  --chrome-flags="--headless" \
  --output json \
  --output-path ./reports/lighthouse-report.json
```

**Nur Performance:**
```bash
npx lighthouse http://localhost:8000 \
  --only-categories=performance \
  --view
```

---

## 🎯 Performance Budgets

### JavaScript
- **Critical (main.js, shared-utilities.js):** < 50 KB
- **Module:** < 25 KB pro File
- **Vendor (Three.js):** < 700 KB

### CSS
- **Critical (root.css, index.css):** < 15 KB
- **Module:** < 10 KB pro File

### Images
- **Texturen (WebP):** < 200 KB
- **Icons:** < 50 KB

---

## 📈 Core Web Vitals Targets

| Metrik | Target | Kategorie |
|--------|--------|-----------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Good |
| **FID** (First Input Delay) | < 100ms | Good |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Good |
| **FCP** (First Contentful Paint) | < 1.8s | Good |
| **TTFB** (Time to First Byte) | < 600ms | Good |

---

## 🔄 CI/CD Integration

### GitHub Actions Beispiel

```yaml
name: Performance & Quality Checks

on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      
      # Alle Tests
      - run: npm run test:all
      
      # Bundle Size
      - run: npm run analyze:bundle
      
      # A11y Audit
      - run: npm run audit:a11y
      
      # Optional: Lighthouse CI
      - run: npm install -g @lhci/cli
      - run: lhci autorun
```

---

## 📁 .gitignore

Diese Reports sollten NICHT committed werden:

```gitignore
# Performance Reports
reports/*.html
reports/*.json
reports/*.txt

# Lighthouse
.lighthouseci/
```

---

## 💡 Best Practices

1. **Regelmäßige Analysen:** Min. vor jedem Release
2. **Performance-Budgets:** Automatische CI-Checks bei Überschreitungen
3. **A11y Testing:** Manuelle Tests zusätzlich zu automatisierten
4. **Chrome DevTools:** Nutze für detaillierte Profiling-Sessions
5. **Real User Monitoring:** Web Vitals in Production tracken

---

## 🛠️ Troubleshooting

### Bundle Size zu groß?
- [ ] Ungenutzte Imports entfernen
- [ ] Code-Splitting prüfen
- [ ] Lazy Loading implementieren
- [ ] Vendor-Libs auf CDN auslagern

### Accessibility-Fehler?
- [ ] ARIA-Attribute gemäß Spec verwenden
- [ ] Alt-Text für alle Bilder
- [ ] Semantic HTML prüfen
- [ ] Keyboard-Navigation testen

### Performance-Probleme?
- [ ] Chrome DevTools Performance-Tab nutzen
- [ ] Long Tasks identifizieren (> 50ms)
- [ ] Memory Leaks prüfen (Heap Snapshots)
- [ ] Network Waterfall optimieren

---

## 📚 Weitere Ressourcen

- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Performance Budgets](https://web.dev/performance-budgets-101/)
