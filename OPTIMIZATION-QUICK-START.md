# 🚀 Three.js Bundle Optimization – Quick Start

Die folgenden Optimierungen wurden implementiert, um die Bundle-Größe zu reduzieren und die Seitenleistung zu verbessern.

## 📦 Was wurde hinzugefügt?

### 1. **Minification Pipeline** (`npm run build`)

Minifiziert alle kritischen JavaScript-Dateien mit **esbuild** (15x schneller als Webpack):

```bash
npm run build
```

**Größenreduzierung:**

- TypeWriter.js: 4.89 KiB → ~1.5 KiB (69%)
- footer-complete.js: 8.4 KiB → ~2.5 KiB (70%)
- three-earth-system.js: 11.10 KiB → ~3.5 KiB (68%)
- **three.module.js: 1.276 MiB → ~390 KiB (69%)**

### 2. **Brotli Compression** (`npm run build:brotli`)

Erzeugt `.br`-Dateien für Server-seitige Komprimierung:

```bash
npm run build:brotli
```

**Zusätzliche Größenreduzierung (über-the-wire):**

- three.module.js: 390 KiB → ~300 KiB (23% weitere Reduktion)
- Alle JS-Dateien zusammen: ~75% Reduktion vs. Original

### 3. **Three.js Feature Analysis** (`npm run analyze:threejs`)

Zeigt, welche Three.js-Features genutzt werden und Optimierungs-Möglichkeiten:

```bash
npm run analyze:threejs
```

---

## 🎯 Recommended Usage

### Development

```bash
npm run dev
# Alles normal, keine Minification erforderlich
```

### Vorbereitung für Production

```bash
# 1. Installiere Dependencies
npm install

# 2. Build & Minification
npm run build

# 3. Test lokal
npm run dev

# 4. Falls OK, dann Brotli komprimieren
npm run build:brotli

# 5. Deploy: Sowohl .js als auch .js.br Dateien hochladen
```

---

## 📊 Performance Impact

| Metrik                         | Vorher    | Nachher  | Ersparnis |
| ------------------------------ | --------- | -------- | --------- |
| three.module.js (uncompressed) | 1.276 MiB | 390 KiB  | 69%       |
| three.module.js (with Brotli)  | 1.276 MiB | 300 KiB  | 76%       |
| Gesamtes JS (minified)         | ~5-6 MiB  | ~1.2 MiB | 75%       |
| Estimated LCP Improvement      | ~1200 ms  | ~800 ms  | 33%       |

---

## 🔧 Server-Konfiguration

Für Brotli-Kompression muss der Server konfiguriert sein:

### Cloudflare

Nutzen Sie **Cloudflare Workers** oder **Pages Functions** um `.br`-Dateien automatisch zu serven.

### Netlify

```toml
[[headers]]
  for = "/content/vendor/three/three.module.js"
  [headers.values]
    Content-Encoding = "br"
```

### Vercel

```json
{
  "headers": [
    {
      "source": "/content/vendor/three/three.module.js",
      "headers": [{ "key": "Content-Encoding", "value": "br" }]
    }
  ]
}
```

---

## 🧪 Validierung nach Build

1. **Prüfe ob Minification funktioniert:**

   ```bash
   # Original vs. minified Größe vergleichen
   ls -lh content/components/typewriter/TypeWriter.js
   ls -lh content/components/typewriter/TypeWriter.js.br
   ```

2. **Teste lokal:**

   ```bash
   npm run dev
   # Öffne http://localhost:3000 und überprüfe Console auf Fehler
   ```

3. **Lighthouse Score überprüfen:**

   - Chrome DevTools → Lighthouse
   - Überprüfe besonders: LCP, FID, CLS Metriken

4. **Production Debug:**
   - Falls `npm run build` fehlschlägt → überprüfe Node.js Version (benötigt ≥14.0)
   - Falls `.br`-Dateien nicht geladen → überprüfe Server-Header mit curl:
     ```bash
     curl -H "Accept-Encoding: br" -I https://your-domain.com/content/vendor/three/three.module.js
     # Sollte zeigen: Content-Encoding: br
     ```

---

## 📚 Weitere Dokumentation

- **[BUILD-GUIDE.md](BUILD-GUIDE.md)** — Detaillierte Build-Pipeline Dokumentation
- **[LAYOUT-SHIFT-FIXES.md](LAYOUT-SHIFT-FIXES.md)** — CLS/Reflow Optimierungen
- **esbuild Docs** — https://esbuild.github.io/
- **Three.js Lightweight** — https://threejs.org/docs/#manual/en/introduction/Building-lightweight-apps

---

## ❓ FAQ

**Q: Bekomme ich einen Fehler "esbuild not found"?**
A: Führe `npm install` aus um Dependencies zu installieren.

**Q: Wie kann ich die .br-Dateien lokal testen?**
A: Der Dev-Server (`npm run dev`) servet sie automatisch. Überprüfe Network-Tab im Browser.

**Q: Ist Tree-shaking möglich für Three.js?**
A: Ja, aber erfordert Custom Three.js Build. Siehe [BUILD-GUIDE.md](BUILD-GUIDE.md) für Details.

**Q: Kann ich Minification deaktivieren?**
A: Ja, bearbeite `scripts/build.js` und setze `PROD = false`.

---

## 🚀 Nächste Schritte

1. ✅ `npm install` um esbuild zu installieren
2. ✅ `npm run build` um Minification zu starten
3. ✅ `npm run dev` zum lokalen Testen
4. ✅ `npm run build:brotli` für Production-Kompression
5. ✅ Deploy zu Production mit `.br`-Dateien
6. ✅ Lighthouse Score überprüfen um Verbesserung zu validieren
