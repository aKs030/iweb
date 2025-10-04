# Lighthouse Audit Reports

Dieses Verzeichnis enthält Lighthouse Performance Audit Reports für Desktop und Mobile.

## 📊 Reports

Lighthouse generiert zwei Report-Formate:

- **HTML Reports** - Detaillierte visuelle Darstellung aller Metriken
- **JSON Reports** - Maschinenlesbare Daten für CI/CD Integration

## 🚀 Usage

### Lokalen Server starten

Bevor du Lighthouse ausführst, muss ein lokaler Server laufen:

```bash
# Option 1: http-server (empfohlen)
npx http-server -p 8080

# Option 2: Python
python3 -m http.server 8080

# Option 3: Node.js
npx serve -p 8080
```

### Audits durchführen

```bash
# Beide Reports (Desktop + Mobile)
npm run lighthouse

# Nur Desktop
npm run lighthouse:desktop

# Nur Mobile
npm run lighthouse:mobile
```

## 📈 Core Web Vitals Thresholds

### LCP (Largest Contentful Paint)
- ✅ **Good**: ≤ 2.5s
- ⚠️  **Needs Improvement**: 2.5s - 4.0s
- ❌ **Poor**: > 4.0s

### FID (First Input Delay)
- ✅ **Good**: ≤ 100ms
- ⚠️  **Needs Improvement**: 100ms - 300ms
- ❌ **Poor**: > 300ms

### CLS (Cumulative Layout Shift)
- ✅ **Good**: ≤ 0.1
- ⚠️  **Needs Improvement**: 0.1 - 0.25
- ❌ **Poor**: > 0.25

### FCP (First Contentful Paint)
- ✅ **Good**: ≤ 1.8s
- ⚠️  **Needs Improvement**: 1.8s - 3.0s
- ❌ **Poor**: > 3.0s

### TTI (Time to Interactive)
- ✅ **Good**: ≤ 3.8s
- ⚠️  **Needs Improvement**: 3.8s - 7.3s
- ❌ **Poor**: > 7.3s

### TBT (Total Blocking Time)
- ✅ **Good**: ≤ 200ms
- ⚠️  **Needs Improvement**: 200ms - 600ms
- ❌ **Poor**: > 600ms

## 🎯 Score Categories

Jeder Report enthält Scores (0-100) für:

1. **Performance** - Ladegeschwindigkeit, Web Vitals
2. **Accessibility** - WCAG 2.1 Compliance, ARIA
3. **Best Practices** - Sicherheit, moderne Web-Standards
4. **SEO** - Meta-Tags, Crawlability, Structured Data
5. **PWA** - Progressive Web App Features

## 📋 Report-Naming Convention

```
lighthouse-{formFactor}-{date}.{format}

Beispiele:
lighthouse-desktop-2025-10-04.html
lighthouse-desktop-2025-10-04.json
lighthouse-mobile-2025-10-04.html
lighthouse-mobile-2025-10-04.json
```

## 🔧 Konfiguration

Die Lighthouse-Konfiguration befindet sich in `scripts/lighthouse-audit.js`:

- **Desktop**: 1920x1080, Fast 3G Throttling
- **Mobile**: 375x667, Slow 4G Throttling

## 📊 CI/CD Integration

JSON Reports können in CI/CD Pipelines verwendet werden:

```yaml
# .github/workflows/lighthouse.yml
- name: Run Lighthouse
  run: npm run lighthouse
  
- name: Check Performance Budget
  run: |
    SCORE=$(jq '.categories.performance.score * 100' reports/lighthouse/lighthouse-mobile-*.json)
    if [ "$SCORE" -lt 90 ]; then
      echo "Performance score below threshold: $SCORE"
      exit 1
    fi
```

## 📝 Hinweise

- **Cache leeren** zwischen Audits für konsistente Ergebnisse
- **Mobile zuerst** optimieren (strengere Thresholds)
- **Mehrere Runs** für verlässliche Metriken (3-5x)
- **Throttling** simuliert realistische Netzwerkbedingungen

## 🔗 Ressourcen

- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse Scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
