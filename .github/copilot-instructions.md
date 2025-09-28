# Copilot Instructions für iweb Portfolio

## Projekt-Architektur

Diese ist eine modulare, performante deutsche Portfolio-Website mit dynamischem Komponentensystem. Die Architektur basiert auf ES6 Modulen ohne Build-Tools und nutzt moderne Web APIs für Animationen und Interaktionen.

## Kernkomponenten & Datenflussmuster

### 1. Section Loader System (`/content/webentwicklung/main.js`)

- **Pattern**: Lazy-loading von HTML-Abschnitten via `data-section-src` Attribut
- **Integration**: Sections werden automatisch geladen wenn `SectionLoader.scan()` aufgerufen wird
- **Beispiel**: `<section data-section-src="/pages/home/hero.html" data-eager="true">`

### 2. Enhanced Animation Engine (`/content/webentwicklung/animations/`)

- **Pattern**: Data-attribute-gesteuerte Animationen mit IntersectionObserver
- **Konfiguration**:
  - `data-animation="slideInLeft"` - Animationstyp
  - `data-delay="300"` - Verzögerung in ms
  - `data-duration="0.6"` - Dauer in s oder ms
  - `data-once` - Einmalige Animation
  - `data-reset="false"` - Überschreibt globales repeatOnScroll
- **Deaktivierung**: `data-animations="off"` am Vorfahren-Element
- **API**: `window.enhancedAnimationEngine.scan()` nach DOM-Änderungen

### 3. Feature Rotation System (`/pages/card/karten-rotation.js`)

- **Pattern**: Template-basierte Inhalts-Rotation mit Intersection-Observer
- **Templates**: Werden aus `/pages/card/karten.html` geladen und im DOM gecacht
- **Konfiguration**: `data-features-src`, `data-anim-in`, `data-anim-out` am Section-Element
- **Event**: `featuresTemplatesLoaded` wenn Templates verfügbar sind

### 4. Particle System (`/content/webentwicklung/particles/`)

- **Pattern**: Canvas-basierte Partikel mit data-attribute Konfiguration
- **Config**: `data-particle-*` Attribute am `.global-particle-background` Element
- **Performance**: Automatische Qualitätsanpassung

## Code-Konventionen

### Module-Struktur

```javascript
// Immer zuerst utilities, dann spezifische Module
import { getElementById, throttle } from "../utils/common-utils.js";
import { createLogger } from "../utils/logger.js";

// Logger pro Modul mit eindeutigem Namen
const log = createLogger("moduleName");
```

### Error Handling & Accessibility

- **Fail-safe Pattern**: `try/catch` mit graceful degradation
- **Accessibility**: ARIA live regions für Announcements via `window.announce()`

### DOM Manipulation

- **Caching**: `getElementById()` mit integriertem Caching nutzen
- **Performance**: `WeakSet` für bereits verarbeitete Elemente
- **Batch Updates**: `requestAnimationFrame` für DOM-Änderungen

## Build & Deployment

### npm Scripts

- `npm run lint:js` - ESLint für JavaScript
- `npm run lint:html` - HTML-Validation aller Git-tracked HTML-Dateien
- `npm run check:css` - CSS Custom Properties Konsolidierung prüfen
- `npm run consolidate:css` - CSS Tokens nach root.css verschieben

### GitHub Workflows

- **Quality Checks**: Erweiterte Pipeline mit HTML/CSS/JS Validation in einem Workflow
- **Artifact Upload**: Automatische Fehlerberichte bei Build-Fehlern mit 7-Tage Retention
- **Performance Caching**: Node Modules & npm Cache Optimierung für schnellere Builds
- **HTML Validation**: Automatische Validierung bei PR/Push
- **CSS Consolidation**: Prüft ob CSS Custom Properties außerhalb von `root.css` existieren
- **ESLint**: Code Quality checks mit automatischen Fixes

### Critical Patterns

#### Performance Optimierung

- Module verwenden `TimerManager` für cleanup
- Canvas-Operationen mit `DPR` (Device Pixel Ratio) skalieren
- Intersection Observer mit optimierten Thresholds

#### CSS Custom Properties

- **Zentral**: Alle Custom Properties in `/content/webentwicklung/root.css`
- **Validation**: Script überprüft ausgelagerte Properties automatisch

#### Template Loading

```javascript
// Standard Pattern für dynamische Inhalte
async function loadTemplate(url) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}
```

## Development Environment

### VS Code Optimierungen (.vscode/settings.json)

- **GitHub Copilot**: Auto-Approval aktiviert für nahtlose AI-Integration
- **Multi-AI Setup**: Cline (Claude 3.5), Copilot (GPT-4), GitLens AI integriert
- **HTML/CSS Validierung**: Automatische Syntax-Prüfung und Formatierung
- **Portfolio-spezifische Settings**: Emmet in JS, optimierte Search-Excludes
- **Git Integration**: Auto-fetch (3min), Smart Commits, weniger Bestätigungen
- **Terminal Auto-Approval**: Projekt-spezifische Befehle vorkonfiguriert

### Dateispezifische Formatierung

```json
"[html]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
"[css]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
"[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" }
```

## Performance Optimierungen (Stand Sept 2025)

### CSS Consolidation (Automatisiert)

- **Befehl**: `npm run consolidate:css` verschiebt alle Custom Properties nach root.css
- **Validierung**: `npm run check:css` prüft auf ausgelagerte Properties
- **Erfolg**: 41 Properties erfolgreich konsolidiert (Sept 2025)

### Bild-Optimierung (Empfohlen)

```bash
# WebP Konvertierung (70% Einsparung möglich)
cwebp -q 85 content/img/profile.jpg -o content/img/profile.webp
cwebp -q 85 content/img/og-portfolio.jpg -o content/img/og-portfolio.webp

# Responsive Images HTML Pattern
<picture>
  <source srcset="content/img/profile.avif" type="image/avif">
  <source srcset="content/img/profile.webp" type="image/webp">
  <img src="content/img/profile.jpg" alt="Profile">
</picture>
```

### Bundle-Analyse

- **Three.js**: 1.2MB (bereits LOD-optimiert)
- **Bilder**: 3.1MB → Ziel: ~900KB durch WebP/AVIF
- **JavaScript**: Optimal mit Lazy Loading und Performance Detection

## Wichtige Dateipfade

- **Root CSS**: `/content/webentwicklung/root.css` - Alle CSS Custom Properties
- **Main Entry**: `/content/webentwicklung/main.js` - App-Initialisierung
- **Utils**: `/content/webentwicklung/utils/` - Geteilte Funktionen
- **Components**: `/content/webentwicklung/[component]/` - Komponentenlogik
- **Pages**: `/pages/[section]/` - Section-spezifische Assets

## Debugging

### Logger System

```javascript
import { createLogger, setGlobalLogLevel } from "./utils/logger.js";
setGlobalLogLevel("debug"); // 'error', 'warn', 'info', 'debug'
const log = createLogger("componentName");
log.debug("Debug message", { data });
```

### Animation Debug

- `data-animations="off"` zum Deaktivieren von Animationen
- Browser DevTools Animation Panel für CSS-Animation debugging
- `window.enhancedAnimationEngine` API für programmatische Kontrolle

### VS Code Debug Features

- **Terminal Auto-Approval**: Komplexe CSS-Analyse-Befehle vorkonfiguriert
- **Git Integration**: Auto-fetch für aktuelle Repository-States
- **Multi-AI Support**: Cline, Copilot, GitLens für verschiedene Debugging-Ansätze

### GitHub Actions Debug

- **Artifact Upload**: Validation-Reports bei Fehlern verfügbar
- **Erweiterte Logs**: Separate Steps für HTML/CSS/JS Validierung
- **Cache Debugging**: Node Modules Cache für Performance-Analyse

## Browser Support

- **ES6 Modules**: Native ES Module Support erforderlich
- **Modern APIs**: IntersectionObserver, MutationObserver, Canvas 2D
- **Fallbacks**: Graceful degradation bei fehlender API-Unterstützung
