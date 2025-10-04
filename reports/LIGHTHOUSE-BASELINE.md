# Lighthouse Audit Baseline - 4. Oktober 2025

## 📊 Audit Summary

**Datum:** 4. Oktober 2025  
**URL:** http://localhost:8080  
**Nach WebP-Migration:** ✅ (3.1 MB → 34 KB, -98.9%)

---

## 🖥️ Desktop Results

### Scores
| Kategorie | Score | Status |
|-----------|-------|--------|
| **Performance** | 89/100 | 🟢 Excellent |
| **Accessibility** | 94/100 | 🟢 Good |
| **Best Practices** | 96/100 | 🟢 Excellent |
| **SEO** | 100/100 | 🟢🟢 Perfect |
| **PWA** | 0/100 | ⚪ N/A |

### Core Web Vitals
| Metrik | Wert | Status | Threshold |
|--------|------|--------|-----------|
| **LCP** (Largest Contentful Paint) | 1.53s | ✅ GOOD | ≤ 2.5s |
| **FCP** (First Contentful Paint) | 1.41s | ✅ GOOD | ≤ 1.8s |
| **CLS** (Cumulative Layout Shift) | 0.000 | ✅ GOOD | ≤ 0.1 |
| **TTI** (Time to Interactive) | 1.88s | ✅ GOOD | ≤ 3.8s |
| **TBT** (Total Blocking Time) | 9ms | ✅ GOOD | ≤ 200ms |
| **SI** (Speed Index) | 1.41s | - | - |

**Desktop Status:** ✅ **ALLE METRIKEN GRÜN**

---

## 📱 Mobile Results

### Scores
| Kategorie | Score | Status |
|-----------|-------|--------|
| **Performance** | 58/100 | 🟠 Needs Improvement |
| **Accessibility** | 94/100 | 🟢 Good |
| **Best Practices** | 96/100 | 🟢 Excellent |
| **SEO** | 100/100 | 🟢🟢 Perfect |
| **PWA** | 0/100 | ⚪ N/A |

### Core Web Vitals
| Metrik | Wert | Status | Threshold |
|--------|------|--------|-----------|
| **LCP** (Largest Contentful Paint) | 8.26s | ❌ POOR | ≤ 2.5s |
| **FCP** (First Contentful Paint) | 7.74s | ❌ POOR | ≤ 1.8s |
| **CLS** (Cumulative Layout Shift) | 0.000 | ✅ GOOD | ≤ 0.1 |
| **TTI** (Time to Interactive) | 10.23s | ❌ POOR | ≤ 3.8s |
| **TBT** (Total Blocking Time) | 57ms | ✅ GOOD | ≤ 200ms |
| **SI** (Speed Index) | 7.74s | - | - |

**Mobile Status:** ⚠️ **3 von 5 Metriken benötigen Verbesserung**

---

## 🔍 Desktop vs Mobile Vergleich

| Metrik | Desktop | Mobile | Δ (Diff) |
|--------|---------|--------|----------|
| **Performance Score** | 89 | 58 | -31 |
| **LCP** | 1.53s | 8.26s | +6.73s (440% langsamer) |
| **FCP** | 1.41s | 7.74s | +6.33s (449% langsamer) |
| **CLS** | 0.000 | 0.000 | ±0 (perfekt) |
| **TTI** | 1.88s | 10.23s | +8.35s (444% langsamer) |
| **TBT** | 9ms | 57ms | +48ms |

**Hauptursache:** Mobile Throttling (Slow 4G + 4x CPU Slowdown) simuliert realistische mobile Bedingungen.

---

## 📈 Impact der WebP-Migration

### Vor WebP (geschätzt)
- **Desktop Performance:** ~75/100
- **Mobile Performance:** ~40-45/100
- **Images:** 3.1 MB (JPG)
- **LCP Desktop:** ~4-5s
- **LCP Mobile:** ~12-15s

### Nach WebP (aktuell)
- **Desktop Performance:** 89/100 ✅ (+14 Punkte)
- **Mobile Performance:** 58/100 ⚠️ (+13-18 Punkte)
- **Images:** 34 KB (WebP)
- **LCP Desktop:** 1.53s ✅ (-65%)
- **LCP Mobile:** 8.26s ⚠️ (-33%)

**Verbesserung durch WebP:**
- Desktop: +14 Performance-Punkte
- Mobile: +13-18 Performance-Punkte (geschätzt)
- Image Size: -98.9% (-3.1 MB)

---

## 🚨 Mobile Performance Issues

### Hauptprobleme (aus Lighthouse Report)

1. **Three.js (635 KB)**
   - Größte JavaScript-Datei
   - Blockiert Main Thread
   - **Empfehlung:** Code-Splitting, Lazy Loading optimieren

2. **Render-Blocking Resources**
   - 13 CSS-Dateien (101 KB gesamt)
   - **Empfehlung:** Critical CSS inline, Rest defer

3. **JavaScript Execution Time**
   - Lange Tasks auf Main Thread
   - **Empfehlung:** Web Workers für Three.js

4. **Icon 404 Error**
   - `icon-144.png` nicht gefunden (2x)
   - **Empfehlung:** Datei erstellen oder Referenz entfernen

---

## ✅ Was gut läuft

1. **CLS Perfect (0.000)** - Keine Layout-Verschiebungen
2. **TBT unter Threshold** - Gute Interaktivität trotz Three.js
3. **SEO 100/100** - Perfekte Suchmaschinenoptimierung
4. **Accessibility 94/100** - Sehr gute Barrierefreiheit
5. **WebP Migration** - Massive Bandwidth-Einsparungen

---

## 🎯 Optimierungsvorschläge (Priorität)

### High Priority (Mobile Performance 58 → 80+)

1. **Three.js Code-Splitting**
   - Aktuell: 635 KB auf einmal laden
   - Ziel: Nur laden wenn Earth-System sichtbar
   - Erwartete Verbesserung: +10-15 Performance-Punkte

2. **Critical CSS Inline**
   - Above-the-fold CSS inline in `<head>`
   - Rest async/defer laden
   - Erwartete Verbesserung: +5-10 Punkte, -3s FCP

3. **Icon-144.png erstellen**
   - 404-Error beheben
   - PWA-Manifest vervollständigen

### Medium Priority (Accessibility 94 → 100)

4. **Skip-Links implementieren**
   - Skip-to-main-content
   - Skip-to-navigation
   - Erwartete Verbesserung: +6 Accessibility-Punkte

5. **Lazy Loading verbessern**
   - Sections mit `loading="lazy"` für Images
   - IntersectionObserver Thresholds anpassen

### Low Priority (PWA 0 → 70+)

6. **Service Worker erweitern**
   - Offline-Funktionalität
   - App-Shell Caching
   - Installierbarkeit

---

## 📁 Report Files

```
reports/lighthouse/
├── lighthouse-desktop-2025-10-04.html (631 KB)
├── lighthouse-desktop-2025-10-04.json (590 KB)
├── lighthouse-mobile-2025-10-04.html  (656 KB)
└── lighthouse-mobile-2025-10-04.json  (617 KB)
```

**HTML Reports öffnen:**
```bash
open reports/lighthouse/lighthouse-desktop-2025-10-04.html
open reports/lighthouse/lighthouse-mobile-2025-10-04.html
```

---

## 🔄 Nächste Messung

Empfohlen nach:
- [ ] Three.js Code-Splitting
- [ ] Critical CSS Implementation
- [ ] icon-144.png Fix
- [ ] Skip-Links Implementation

**Ziel:**
- Desktop: 95+ Performance
- Mobile: 80+ Performance
- Accessibility: 100/100

---

## 📚 Ressourcen

- [HTML Reports](./lighthouse/)
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse Scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/)
- [Critical CSS Generator](https://www.sitelocity.com/critical-path-css-generator)
