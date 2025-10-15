# iweb Portfolio

Webbasiertes Portfolio mit nativen ES6-Modulen, Zero-Build-Tooling und einem Three.js-Erdsystem.

## Highlights

- Drei zentrale Systeme: SectionLoader, Three.js Earth und Three.js Card System mit Partikel-Animationen
- Einheitliche Utilities via `content/webentwicklung/shared-utilities.js` (Logger, Timer, Events, DOM-Caching)
- Accessibilty- und Performance-Optimierungen (WCAG 2.1 AA, Lighthouse ≥ 95)
- Zero-Build-Setup: alle Imports mit `.js`-Extension, keine Bundler erforderlich

## Setup & Entwicklung

- Voraussetzung: Node.js ≥ 18
- Installation: `npm install`
- Dev-Server: `npm start` (öffnet `http://localhost:8080`)
- Statische Auslieferung: HTML/CSS/JS lassen sich direkt über nginx oder Cloudflare Pages deployen (kein Build-Schritt notwendig)

## Validierung & Qualitätssicherung

- `npm run lint:js` führt ESLint mit Auto-Fix auf Basis der Flat Config aus (Double Quotes, Import-Order, `.js`-Extensions erzwungen)
- `npm run lint:js:check` für CI ohne Fixes (0 Errors / 0 Warnings expected)
- `npm run lint:html` nutzt `scripts/validate-html.js` (Default: CI-Modus, keine Reports)
- `npm run lint:html:verbose` und `npm run lint:html:all` liefern detaillierte HTML-Validierung inkl. Reports
- `npm run check:css` prüft, ob alle Custom Properties in `content/webentwicklung/root.css` konsolidiert sind
- `npm run audit:a11y` führt den a11y-Check aus (im `test:all`-Workflow enthalten)
- `npm run format` bzw. `npm run format:check` (Prettier) laufen über `**/*.{js,json,css,html}`

## Architektur-Kernelemente

- `content/webentwicklung/main.js`: SectionLoader lädt HTML-Files lazy/eager und feuert `section:will-load`, `section:prefetched`, `section:loaded`
- `createLazyLoadObserver()` und `TimerManager` stellen Cleanup sicher (immer Rückgabewert `cleanup` nutzen)
- Partikel- und Earth-Systeme liegen unter `content/webentwicklung/particles/` mit LOD-Texturmanagement und Timer-Autocleanup
- Feature-Karten (`content/webentwicklung/particles/three-card-system.js`) mit 150 Partikeln (Desktop) bzw. 60 (Mobile) und GPU-optimiertem BufferGeometry
- DOM-Zugriff über `getElementById` (20-Slot-Cache) statt `document.getElementById`
- CSS-Custom-Properties ausschließlich in `content/webentwicklung/root.css`

## Performance-Workflow

- Chrome DevTools Performance Tab: Aufnahme starten, Seite neuladen, Long Tasks > 50 ms und Layout Shifts prüfen
- Memory-Profilierung per Heap Snapshots, Fokus auf Timer/Listener-Cleanup (TimerManager `clearAll` sicherstellen)
- Network-Analyse mit deaktiviertem Cache: Render-blocking, Asset-Größe, Brotli/Gzip überprüfen
- Coverage View (`Cmd+Shift+P` → "Show Coverage"): Ziel < 20 % ungenutzter JS/CSS
- Core-Web-Vitals beobachten (LCP < 2,5 s, FID < 100 ms, CLS < 0,1, FCP < 1,8 s, TTFB < 600 ms) per `PerformanceObserver`

## Automatisierte Checks

- Lighthouse: `npm run lighthouse:desktop` und `npm run lighthouse:mobile` erzeugen Reports in `reports/lighthouse/`
- `npm run test:all` bündelt Linting (JS/HTML) + CSS-Check für CI-Pipelines
- Format-on-Save in VS Code aktiviert (`.vscode/settings.json`), Debug-Logging via `?debug=true` oder `localStorage.setItem("iweb-debug", "true")`

## Performance-Ziele

- Desktop-Lighthouse ≥ 98, Mobile ≥ 95 (Baseline 04.10.2025)
- Three.js-Texturen werden stufenweise (LOD) geladen, Fallback bei Timeout 2 s → prozedurales Material
- Starfield-Canvas: 60 FPS Desktop, 40–60 FPS Mobile durch DPR-Capping (`Math.min(devicePixelRatio, 2)`)
- Interaktive Sections liefern Transition-Zeiten < 100 ms; Logging erfolgt über `createLogger`

## Wartung & Deployment

- Hosting über GitHub Pages oder Cloudflare Pages ohne zusätzliche Build-Schritte
- Service Worker (`sw.js`) Cache-Version anpassen, sobald neue Assets ausgeliefert werden
- Reports unter `reports/lighthouse/` regelmäßig erneuern (Empfehlung: nach größeren UI/Asset-Änderungen)
- Bei neuen Modulen: Initialisierung an `section:loaded` koppeln oder im `MAP`-Array von `main.js` registrieren

## Lizenz

© 2025 Abdulkerim Sesli – Alle Rechte vorbehalten. Gebaut in Berlin-Tegel.
