# Vorschlag für eine moderne Projektstruktur

Aktuell dient das gesamte Root-Verzeichnis (`.`) als Build-Output für Cloudflare Pages (siehe `wrangler.jsonc`: `"pages_build_output_dir": "."`). Das führt dazu, dass Konfigurationsdateien, Skripte, und Frontend-Assets vermischt werden.

Hier ist ein Konzept, wie man die Struktur "modernisieren" und aufräumen kann, um Source-Code von statischen/öffentlichen Assets strikt zu trennen, ähnlich wie es bei modernen Frameworks (Vite, Next, Astro) der Fall ist, aber für Vanilla JS beibehalten:

## 1. Die neue Ordnerstruktur

```text
/
├── .github/                  # CI/CD Workflows
├── docs/                     # Dokumentation
├── functions/                # Cloudflare Pages Functions (API, Middleware)
├── scripts/                  # Eigene Tools & Build-Scripte (Wartung, Generierung)
├── src/                      # 🚀 NEU: Gesamter Source Code
│   ├── content/              # Bisheriges content/ (Core, Components, Styles)
│   ├── pages/                # Bisheriges pages/ (Seiten-spezifischer Code)
│   └── styleguide/           # Bisheriges styleguide/
├── public/                   # 🚀 NEU: Statische Dateien (Das künftige Output-Dir)
│   ├── _headers              # Cloudflare Headers
│   ├── _redirects            # Cloudflare Redirects
│   ├── favicon.ico           # Statische Assets
│   ├── manifest.json
│   ├── robots.txt
│   ├── index.html            # Root HTML-Seiten
│   ├── offline.html
│   └── ai-info.html
├── package.json
├── wrangler.jsonc
└── eslint.config.mjs / ...   # Weitere Root-Konfigurationen
```

## 2. Warum diese Änderung?

### A. Trennung von Source und Output
- **Aktuell:** `pages_build_output_dir: "."` bedeutet, dass beim Deployment das *komplette Repository* (inklusive `scripts/`, `docs/`, `package.json` etc.) als Website bereitgestellt werden kann, sofern es nicht explizit durch eine `.cfignore` gefiltert wird.
- **Neu:** Durch ein explizites Output-Verzeichnis (z.B. `public/` oder ein generiertes `dist/`) wird nur das ausgeliefert, was wirklich für den Browser bestimmt ist.

### B. Verbesserte Sicherheit & Hygiene
- Keine Gefahr mehr, versehentlich Source-Maps, interne Skripte oder Konfigurationen (`eslint.config.mjs`, `wrangler.jsonc`) zu veröffentlichen.
- Eine `.cfignore` wird weitestgehend obsolet (oder zumindest deutlich kleiner).

### C. Zukunftsfähigkeit
- Falls das Projekt wächst und ein Bundler (wie Vite, Rollup oder ESBuild) eingeführt werden soll, ist der Code bereits im `src/`-Ordner isoliert. Der Bundler würde dann von `src/` nach `dist/` (oder `public/`) kompilieren.
- Bessere Übersichtlichkeit im Root-Verzeichnis.

## 3. Notwendige Schritte zur Migration

1. **Ordner erstellen & verschieben:**
   - Einen `public/` Ordner erstellen.
   - Alle reinen HTML-Dateien (`index.html`, `offline.html`, etc.) und statischen Assets (`favicon.ico`, `_headers`, `_redirects`, `robots.txt`, `manifest.json`) dorthin verschieben.
   - Einen `src/` Ordner erstellen.
   - Die Ordner `content/`, `pages/` und `styleguide/` in `src/` verschieben.

2. **Pfade in HTML & Skripten anpassen:**
   - In den HTML-Dateien (jetzt in `public/`) müssen die relativen Pfade zu den JS/CSS-Dateien angepasst werden (z.B. `<script src="/src/content/main.js"></script>` oder je nach Routing-Setup). *Hinweis: Wenn kein Bundler genutzt wird, müssen die `src/` Dateien auch ins `public/` kopiert oder das Routing im Dev-Server entsprechend konfiguriert werden.*

3. **`wrangler.jsonc` anpassen:**
   - `pages_build_output_dir` auf `"public"` (oder `"dist"`, falls ein Build-Step eingeführt wird) setzen.

4. **Wartungsskripte anpassen:**
   - In `scripts/dev-workflow.mjs` den `wrangler pages dev` Befehl so anpassen, dass er das neue Output-Directory verwendet (`wrangler pages dev public ...`).
   - Audit- und Token-Generierungs-Skripte (`package.json` und `scripts/`) müssen auf die neuen Pfade (`src/content/...`) verweisen.

## 4. Alternative: Minimal-Invasiver Ansatz (Kein Build-Step)

Da das Projekt aktuell Vanilla JS ohne Bundler verwendet (und Dateien wie `content/main.js` direkt im Browser geladen werden):

```text
/
├── public/                   # 🚀 Das neue Cloudflare Output-Directory
│   ├── _headers
│   ├── _redirects
│   ├── index.html
│   ├── content/              # Direkter Ordner für Frontend-Assets
│   ├── pages/
│   └── styleguide/
├── functions/                # Cloudflare API bleibt im Root (oder in public/, je nach Wrangler-Setup)
├── scripts/
├── docs/
├── package.json
└── wrangler.jsonc
```
Hierbei würde alles, was in den Browser gelangt, einfach in den `public/` Ordner verschoben. In der `wrangler.jsonc` wird `"pages_build_output_dir": "public"` gesetzt. Das ändert keine relativen Importe innerhalb des Frontends (da `content/` und `pages/` nebeneinander in `public/` liegen) und erfordert die geringsten Code-Anpassungen, isoliert aber das Tooling (`scripts`, `docs`, Configs) vom Deployment.
