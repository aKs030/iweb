# Deployment Guide

## Architektur

Dieses Projekt nutzt **KEIN Build-System** mehr. Die Source-Dateien werden direkt deployed.

### Lokal entwickeln

```bash
npm run dev
```

Startet `server.js` auf `http://localhost:8080`

- Zeigt direkt die Source-Dateien
- Template-Injection zur Laufzeit
- Kein Build, kein `dist/` Ordner

### Auf GitHub pushen

```bash
npm run push
```

Oder manuell:

```bash
git add -A
git commit -m "Deine Nachricht"
git push origin main
```

### Cloudflare Pages Deployment

Cloudflare deployed **direkt die Source-Dateien** ohne Build:

**Konfiguration in `wrangler.toml`:**

```toml
pages_build_output_dir = "."
```

**Was passiert:**

1. GitHub Push triggert Cloudflare Pages
2. Cloudflare kopiert alle Dateien (außer `.cfignore`)
3. `functions/_middleware.js` injiziert Templates zur Laufzeit
4. Fertig - kein Build nötig!

### Ignorierte Dateien

`.cfignore` definiert was NICHT deployed wird:

- `node_modules/`
- `docs/`
- `server.js` (nur für lokale Entwicklung)
- `.kiro/`, `.github/`, etc.

### Vorteile

✅ Kein Build-Prozess  
✅ Schnellere Deployments  
✅ Einfachere Debugging (Source = Production)  
✅ Keine Build-Artefakte  
✅ CDN-basierte Dependencies (Import Maps)

### Dependencies

Alle externen Libraries werden via CDN geladen (siehe `index.html`):

- React: `esm.sh`
- Three.js: `cdn.jsdelivr.net`
- DOMPurify: `esm.sh`

Keine `node_modules` in Production!
