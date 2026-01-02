# Layout Shift Testing Checkliste

## ✅ Vor Lighthouse-Test

### 1. Build durchführen
```bash
npm run build:brotli
```

### 2. Dev-Server starten
```bash
npm run dev
```

### 3. Browser öffnen
```
http://localhost:3000
```

---

## 🔍 Chrome DevTools Performance Check

### Layout Shift Regions anzeigen
1. Chrome DevTools öffnen (F12)
2. Menü → "More tools" → "Rendering"
3. ✅ "Layout Shift Regions" aktivieren
4. Seite neu laden (Strg+Shift+R)
5. **Blaue Flashes beobachten** (jeder Flash = Layout Shift)

### Performance Recording
1. DevTools → "Performance" Tab
2. "Start profiling and reload page"
3. Nach Laden stoppen
4. Suchen nach:
   - **"Layout Shift"** Events
   - **"Recalculate Style"** > 10ms
   - **"Layout"** > 5ms (Forced Reflows)

---

## 📊 Lighthouse Audit

### Desktop
```bash
# Im Chrome:
# 1. DevTools → Lighthouse Tab
# 2. Mode: Navigation
# 3. Categories: Performance ✓
# 4. Device: Desktop
# 5. "Analyze page load"
```

**Erwartete Werte**:
- **CLS**: < 0,1 ✅ (Good)
- **LCP**: < 2,5s ✅
- **TBT**: < 200ms ✅

### Mobile
```bash
# Gleiche Schritte, aber:
# Device: Mobile
```

**Erwartete Werte**:
- **CLS**: < 0,1 ✅
- **LCP**: < 2,5s
- **TBT**: < 200ms

---

## 🎯 Spezifische Tests

### Test 1: Main Content Layout Shift
**Was testen**: Hero-Section beim Laden

1. Seite laden
2. Layout Shift Regions beobachten
3. **Sollte KEIN** blaues Flash bei Hero geben
4. Lighthouse CLS für `#main-content` sollte **0** sein

**Fix**: ✅ `min-height: clamp(500px, 100vh, 1200px)` in index.html

---

### Test 2: Cookie-Banner Layout Shift
**Was testen**: Cookie-Banner Einblendung

1. Cookies im Browser löschen
2. Seite neu laden
3. Footer beobachten beim Banner-Erscheinen
4. **Sollte KEIN** Shift des Footers geben

**Fix**: ✅ `min-height: 32px` + `contain` in cookie-consent.css

---

### Test 3: Typewriter Layout Shift
**Was testen**: Dynamischer Textumbruch

1. Seite laden und warten bis Typewriter startet
2. Bei langem Text beobachten ob Container "springt"
3. **Sollte KEINE** Höhenänderung geben
4. `--box-h` CSS-Variable sollte gesetzt sein

**Fix**: ✅ `min-height: var(--box-h, 2.2em)` in index.html

---

### Test 4: Robot Forced Reflows
**Was testen**: Robot-Collision-Checks

1. Performance Recording starten
2. Seite scrollen (Robot bewegt sich)
3. Nach ~10s stoppen
4. Suche nach "Layout" Events in Timeline
5. **Sollte < 5 Reflows/Sekunde** geben

**Fix**: ✅ Batched `getBoundingClientRect()` in robot-collision.js

---

## 📈 Benchmark-Werte

### Vorher (2026-01-02)
```
CLS: 1,716 ❌
Forced Reflows: ~108ms
Main Content Shift: 1,715
```

### Nachher (Erwartet)
```
CLS: < 0,1 ✅
Forced Reflows: ~20ms
Main Content Shift: < 0,05
```

### Differenz
```
CLS: -97% ↓
Reflows: -81% ↓
Performance Score: +5-10 Punkte
```

---

## 🐛 Troubleshooting

### CLS immer noch > 0,1?
1. **Check**: Welches Element verursacht Shift?
   → Lighthouse zeigt Element in "Avoid large layout shifts"
2. **Fix**: Füge `min-height` oder `aspect-ratio` hinzu
3. **Verify**: `contain: layout` für isolierte Container

### Forced Reflows immer noch hoch?
1. **Check**: DevTools Performance → "Layout" Events
2. **Identify**: Welche Funktion verursacht Reflow? (Stack Trace)
3. **Fix**: 
   - Batch Reads: Alle `getBoundingClientRect()` vor Writes
   - Use `requestAnimationFrame()` für Timing
   - Cache Rects mit `RectCache` aus `layout-optimizer.js`

### TypeWriter-Shifts?
1. **Check**: Ist `--box-h` CSS-Variable gesetzt?
   → Browser DevTools → Elements → Computed → Custom Properties
2. **Fix**: Stelle sicher `reserveFor()` wird vor `onBeforeType` aufgerufen
3. **Note**: TypeWriter.js ist minifiziert, siehe TYPEWRITER-OPTIMIZATION.md

---

## 📝 Reporting

### Screenshot-Proof
1. Lighthouse-Report speichern (JSON + HTML)
2. Performance-Timeline-Screenshot machen
3. Layout Shift Regions Video aufnehmen

### Vergleich
```bash
# Before-Screenshot: lighthouse-before.png
# After-Screenshot: lighthouse-after.png
```

**Teilen**:
- Git Commit mit Screenshots
- README.md Update
- CHANGELOG.md Entry

---

## 🚀 Next Steps nach erfolgreicher Validation

1. ✅ Git Commit:
   ```bash
   git add .
   git commit -m "feat(perf): Fix CLS 1.716→<0.1 & reduce reflows by 81%"
   ```

2. ✅ Deploy auf Staging

3. ✅ Production Lighthouse-Test

4. ✅ Monitor mit Real User Metrics (RUM)

---

**Erstellt**: 2026-01-02  
**Autor**: GitHub Copilot AI Agent  
**Version**: 1.0
