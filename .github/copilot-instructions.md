# Copilot Instructions für iweb

## Architektur & Konzepte

**Dynamisches Laden**: Das Projekt nutzt einen `SectionLoader` für Lazy Loading von HTML-Sektionen via `data-section-src` Attribut. Beispiel: `<section data-section-src="/pages/home/hero.html">` lädt Inhalte bei Intersection. Eager Loading via `data-eager` Attribut möglich.

**ESM Module**: Alles ist nativ ESM (`"type": "module"` in package.json). Importe nutzen explizite `.js` Endungen. Zentraler Entry-Point ist `content/webentwicklung/main.js`.

**Komponentenbasiert**: UI-Module sind in `content/webentwicklung/` organisiert:
- `menu/` - Dynamisch geladenes Hauptmenü  
- `particles/` - Canvas-basiertes Partikelsystem mit FPS-Anpassung
- `utils/` - Gemeinsame Utilities (throttle, debounce, DOM-Cache, Logger)
- `footer/` - Footer-Komponente mit automatischer Höhen-Messung
- `animations/` - Intersection-basierte Animationen mit `data-aos` Attributen

**CSS Token System**: Zentrale Design-Tokens in `content/webentwicklung/root.css`. Konvention: `--purpose-name` für globale, `--component-name` für lokale Tokens. Script `scripts/consolidate-tokens.sh` findet externe Variablen.

## Wichtige Patterns

**Accessibility First**: 
- Live-Regions für Screenreader: `announce(message, {assertive: false})`
- Skip-Links, ARIA-Labels, `prefers-reduced-motion` Support
- Element-Cache mit DOM-Validierung in `common-utils.js`

**Performance**:
- Intersection Observer für Lazy Loading und Animationen
- Throttled/Debounced Event-Handler (verfügbar in `common-utils.js`)
- FPS-basierte Partikel-Anpassung mit `window.__particleStats`
- Snap-Scrolling mit temporärer Deaktivierung bei aktiver Interaktion (`.no-snap` Klasse)
- Element-Cache System in `getElementById()` mit DOM-Validierung

**Logging**: Modulares Logging-System in `utils/logger.js` mit `createLogger('moduleName')`. Ring-Buffer für letzte Logs, Level-Filter, und `window.logEvent` Custom Events für Debug-Overlay.

## Entwickler-Workflows

**Testing**: Vitest mit jsdom Environment. Tests in `tests/`. Run mit:
```bash
npm test              # Einmaliger Lauf
npm run test:watch    # Watch-Modus
npm run test:cov      # Coverage
```

**Linting/Validation**:
```bash
npm run lint:html     # HTML-Validation mit html-validate
npm run check:css     # CSS-Token Konsistenzcheck
npm run consolidate:css # Token-Konsolidierung
```

**CI/CD**: GitHub Actions validiert automatisch:
- CSS-Token Konsistenz (`check-css.yml`) - prüft `root.css` Load-Order und verhindert doppelte `:root` Blocks
- Token-Konsolidierung (`consolidate-check.yml`) - findet externe CSS-Variablen
- Alle Checks laufen bei Push/PR auf main/master Branch

**Build**: Kein Build-Step - direktes Serving von Dateien. Nutze Live Server für Development.

## Konventionen

**File Structure**: 
- `pages/` - Seitenspezifische Module
- `content/webentwicklung/` - Wiederverwendbare Komponenten
- `scripts/` - Shell-Scripts für Maintenance

**CSS**: 
- Mobile-First mit `clamp()` für responsive Values
- BEM-ähnliche Namenskonvention für Komponenten
- Snap-Container mit `.no-snap` für temporäre Deaktivierung

**JavaScript**:
- IIFE Pattern für Module ohne Exports
- WeakSet für "bereits verarbeitet" Tracking
- Defensive Programmierung mit try/catch in A11y-Code

## Integration Points

**Menu System**: Dynamisch geladen via Fetch. Logo-Text wird via JavaScript gesetzt. Submenu-Toggle für mobile Navigation.

**Particle System**: Canvas-basiert mit data-attributes für Konfiguration (`data-particle-gradient`, `data-particle-alpha-scale`). Adaptive Performance basierend auf FPS.

**Section Loading**: Intersection-basiert mit `aria-busy` States und Live-Region Announcements. Template-Support für client-side Hydration.

## Key Files

- `content/webentwicklung/main.js` - Haupt-Entry mit SectionLoader
- `content/webentwicklung/utils/common-utils.js` - Core Utilities  
- `content/webentwicklung/root.css` - Design Token System
- `vitest.config.js` - Test-Konfiguration
- `scripts/consolidate-tokens.sh` - CSS-Token Maintenance
- `scripts/check-root.sh` - CSS-Load-Order Validation (CI)
- `.github/workflows/check-css.yml` - GitHub Actions CSS-Validierung
