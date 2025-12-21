# Development helpers

This repository includes a `dev` script to start a static HTTP server and a WebSocket test server concurrently. It helps with testing Live Preview/WebSocket issues and with reconnect logic.

## Setup

Install dev dependencies:

```bash
npm ci
```

## Run dev servers

Start both the static file server and the websocket test server:

```bash
npm run dev
```

- Static site: http://127.0.0.1:8081
- WebSocket test server (echo): ws://127.0.0.1:3001

## Debugging & Tests

Use the query string `?debug` on any page to enable the development reconnecting WebSocket inside the app:

You should see console logs about the reconnecting WebSocket attempting to open a connection to `ws://127.0.0.1:3001`.

### Test WebSocket with wscat (optional)

```bash
npx wscat -c ws://127.0.0.1:3001
# Type some text and you should see the server echo back 'echo:...'
```

## Progressive Web App (PWA)

The site includes a Service Worker (`sw.js`) for offline functionality:

- **Offline-First** für statische Assets
- **Network-First** für HTML-Seiten
- **Cache-First** für Bilder und Fonts
- Automatische Cache-Bereinigung

### Service Worker testen

```bash
# Lokaler Server mit HTTPS (Service Worker benötigt HTTPS oder localhost)
npm run serve

# Service Worker Status in DevTools:
# Application > Service Workers
```

### Service Worker löschen (während Entwicklung)

```javascript
// In Browser Console:
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(registration => registration.unregister())
})
```

## Recent Optimizations (2025-12-04)

### ✅ Console-Logs durch Logger ersetzt

Alle direkten `console.*` Aufrufe wurden durch das zentrale Logger-System ersetzt für bessere Kontrolle und Production-Optimierung.

### ✅ CSS-Duplikate entfernt

- `pages/about/about.css` wurde bereinigt und optimiert
- Doppelte Selektoren wurden konsolidiert

### ✅ Dependencies aktualisiert

- ESLint: v8 → v9
- Concurrently: v8 → v9
- Lint-staged: v13 → v15
- Prettier: v3.2 → v3.4
- Stylelint: v16.26 → v16.11

### ✅ Service Worker hinzugefügt

PWA-Support mit intelligenten Caching-Strategien implementiert.

### ✅ Security (CSP)

Siehe `SECURITY-CSP.md` für Content Security Policy Empfehlungen.

## Notes

The reconnecting WebSocket helper is in `content/shared/reconnecting-websocket.js`. It listens to `visibilitychange` and `online` events to avoid aggressive reconnection when the page is suspended by the browser. Use this class for persistent WebSocket connections in dev or production, but ensure you adjust heartbeat/ping strategy for real-world servers.

## Code Quality

### Linting

```bash
# JavaScript
npx eslint .

# (CSS linting / formatting tools were removed from devDependencies)
```

### Best Practices

- Verwende das Logger-System (`createLogger`) statt direkter `console.*` Aufrufe
- Halte CSS-Variablen in `content/root.css` zentralisiert
- Service Worker Updates erfordern Version-Bump in `sw.js`
- Teste offline Funktionalität mit DevTools Network Throttling

- Hinweis: Das zentrale `LoadingScreen`-Utility wurde entfernt. Bitte implementiere komponentenspezifische Ladezustände (lokale Spinner oder Inline-Placeholder) oder verwende das `SectionLoader`-Signal (`section:will-load` / `section:loaded`) für Statusmeldungen.

#### Retry-Policy (heute)
- **Automatische Retries wurden entfernt.** Section‑ oder Page‑Lader versuchen Inhalte nicht mehr automatisch erneut nach einem Fehler.
- **Manueller Retry:** Wenn du einen erneuten Ladevorgang auslösen willst, kannst du die Section gezielt erneut laden:

```javascript
// Beispiel: bestimme das Section-Element und rufe den Loader auf
const heroSection = document.querySelector('#hero')
if (heroSection && window.SectionLoader && typeof window.SectionLoader.loadSection === 'function') {
  window.SectionLoader.loadSection(heroSection)
}
```

- **Warum:** Automatische Retries können zu unnötigem Netzwerkverkehr oder fragilen retry‑Loops führen. Die App zeigt jetzt eine einfache Fehleranzeige und überlässt erneute Ladeversuche der Nutzeroberfläche oder einem expliziten Entwickler‑Call.

- **Hinweis:** `SectionLoader.loadSection(section)` kann erneut aufgerufen werden; die Implementierung hebt die interne Lade‑Markierung auf, wenn ein vorheriger Versuch fehlgeschlagen ist, damit ein manueller Retry funktioniert.


### Formatting

- **Standardformatierer:** Diese Workspace-Konfiguration setzt Prettier als Standardformatierer für JavaScript/HTML/CSS/JSON. Nutze `npm run format` oder aktiviere "Format on Save" in VS Code (die Workspace-Einstellungen sind bereits konfiguriert).
- **Empfohlene VS Code-Extensions:** `esbenp.prettier-vscode` (Prettier) und `dbaeumer.vscode-eslint` (ESLint).

```bash
# Optional: Installiere empfohlene VS Code-Extensions
code --install-extension esbenp.prettier-vscode
code --install-extension dbaeumer.vscode-eslint
```
