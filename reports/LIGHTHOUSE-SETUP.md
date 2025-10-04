# Lighthouse Audit Setup Guide

## ✅ Installation Complete

Lighthouse ist jetzt als Performance-Audit-Tool eingerichtet.

## 📦 Installierte Pakete

```json
{
  "lighthouse": "^12.x",
  "chrome-launcher": "^1.x"
}
```

## 🚀 Quick Start

### 1. Dev-Server starten

```bash
npx http-server -p 8080
```

### 2. Lighthouse ausführen

```bash
# Beide Reports (Desktop + Mobile)
npm run lighthouse

# Nur Desktop
npm run lighthouse:desktop

# Nur Mobile  
npm run lighthouse:mobile
```

## 📊 Was wird gemessen?

### Core Web Vitals
- **LCP** - Largest Contentful Paint (Ladegeschwindigkeit)
- **FID** - First Input Delay (Interaktivität)
- **CLS** - Cumulative Layout Shift (Visuelle Stabilität)
- **FCP** - First Contentful Paint
- **TTI** - Time to Interactive
- **TBT** - Total Blocking Time
- **SI** - Speed Index

### Score Categories (0-100)
- **Performance** - Web Vitals, Ladezeiten
- **Accessibility** - WCAG 2.1, ARIA
- **Best Practices** - Security, moderne Standards
- **SEO** - Meta-Tags, Structured Data
- **PWA** - Progressive Web App Features

## 📁 Output

Reports werden gespeichert in:
```
reports/lighthouse/
├── lighthouse-desktop-2025-10-04.html
├── lighthouse-desktop-2025-10-04.json
├── lighthouse-mobile-2025-10-04.html
└── lighthouse-mobile-2025-10-04.json
```

## 🎯 Performance Budgets

### Mobile Thresholds (strenger)
- LCP: ≤ 2.5s (Good)
- FCP: ≤ 1.8s (Good)
- CLS: ≤ 0.1 (Good)
- TTI: ≤ 3.8s (Good)
- TBT: ≤ 200ms (Good)

### Desktop Thresholds
- LCP: ≤ 2.5s (Good)
- FCP: ≤ 1.8s (Good)
- CLS: ≤ 0.1 (Good)
- TTI: ≤ 3.8s (Good)
- TBT: ≤ 200ms (Good)

## 🔧 Konfiguration

### Desktop
- Viewport: 1920x1080
- Device Scale: 1x
- Throttling: Fast 3G (40ms RTT, 10Mbps)
- CPU: 1x Slowdown

### Mobile
- Viewport: 375x667 (iPhone SE)
- Device Scale: 2x
- Throttling: Slow 4G (150ms RTT, 1.6Mbps)
- CPU: 4x Slowdown

## 📈 Baseline nach WebP-Migration

Nach der WebP-Optimierung erwarten wir:

### Erwartete Verbesserungen
- ✅ **LCP**: -3MB Image Size → ~1.5s schneller
- ✅ **Performance Score**: +10-15 Punkte
- ✅ **Best Practices**: +5 Punkte (moderne Bildformate)

### Aktuelle Baseline (vor WebP)
- Images: 3.1 MB (JPG)
- LCP: ~4-5s (Mobile)
- Performance: ~75/100

### Ziel nach WebP-Migration
- Images: 34 KB (WebP)
- LCP: ~2.5s (Mobile)
- Performance: 90+/100

## 🔍 Troubleshooting

### Server läuft nicht
```
❌ Error: ECONNREFUSED
⚠️  Lokaler Server läuft nicht!
```

**Lösung:**
```bash
npx http-server -p 8080
```

### Chrome nicht gefunden
```
❌ Error: No Chrome installations found
```

**Lösung:** Google Chrome installieren

### Port bereits belegt
```
❌ Error: Port 8080 already in use
```

**Lösung:** Anderen Port verwenden
```bash
# Server
npx http-server -p 8081

# Lighthouse Config anpassen
# In scripts/lighthouse-audit.js:
CONFIG.url = "http://localhost:8081"
```

## 🎓 Best Practices

1. **Mehrere Runs**: Führe 3-5 Audits durch, nutze Median
2. **Cache leeren**: Zwischen Runs für konsistente Ergebnisse
3. **Mobile zuerst**: Optimiere primär für Mobile
4. **Realistische Bedingungen**: Throttling aktiviert lassen
5. **Baseline tracken**: Speichere Scores vor/nach Änderungen

## 📋 CI/CD Integration (Optional)

Lighthouse kann in GitHub Actions integriert werden:

```yaml
name: Lighthouse CI
on: [push]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      
      - name: Install dependencies
        run: npm ci
        
      - name: Start server
        run: npx http-server -p 8080 &
        
      - name: Run Lighthouse
        run: npm run lighthouse
        
      - name: Check Performance Budget
        run: |
          SCORE=$(jq '.categories.performance.score * 100' \
            reports/lighthouse/lighthouse-mobile-*.json)
          if [ "$SCORE" -lt 90 ]; then
            exit 1
          fi
```

## 🔗 Nächste Schritte

1. ✅ **Setup Complete** - Lighthouse installiert
2. 🔄 **Baseline erstellen** - Ersten Audit durchführen
3. 📊 **Metriken analysieren** - Verbesserungspotentiale finden
4. 🚀 **Optimieren** - Performance-Budgets einhalten
5. 📈 **Monitoring** - Regelmäßige Audits

## 📚 Ressourcen

- [Lighthouse Docs](https://developer.chrome.com/docs/lighthouse/)
- [Web Vitals](https://web.dev/vitals/)
- [Performance Budget Calculator](https://www.performancebudget.io/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
