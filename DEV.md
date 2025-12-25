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
- WebSocket test server (echo): ws://127.0.0.1:8081

## Debugging & Tests

Use the query string `?debug` on any page to enable the development reconnecting WebSocket inside the app:

You should see console logs about the reconnecting WebSocket attempting to open a connection to `ws://127.0.0.1:8081`.

### Test WebSocket with wscat (optional)

```bash
npx wscat -c ws://127.0.0.1:8081
# Type some text and you should see the server echo back 'echo:...'
```

## Progressive Web App (PWA)

Hinweis: Der Service Worker (`sw.js`) wurde entfernt. Ein einmaliger Cleanup läuft beim Laden der Seite und entfernt vorherige Registrierungen und Caches.

> Tipp: Wenn du lokal Registrierungen manuell prüfen möchtest, kannst du weiterhin `navigator.serviceWorker.getRegistrations()` in der Console ausführen.

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

(Dev note: Reconnecting WebSocket helper removed)

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
- Service Worker wurde entfernt; kein Version-Bump erforderlich
- Teste Offline-/Network-Fallbacks manuell mit DevTools Network Throttling

### Formatting

- **Standardformatierer:** Diese Workspace-Konfiguration setzt Prettier als Standardformatierer für JavaScript/HTML/CSS/JSON. Nutze `npm run format` oder aktiviere "Format on Save" in VS Code (die Workspace-Einstellungen sind bereits konfiguriert).
- **Empfohlene VS Code-Extensions:** `esbenp.prettier-vscode` (Prettier) und `dbaeumer.vscode-eslint` (ESLint).

```bash
# Optional: Installiere empfohlene VS Code-Extensions
code --install-extension esbenp.prettier-vscode
code --install-extension dbaeumer.vscode-eslint
```
