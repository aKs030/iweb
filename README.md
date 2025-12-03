# iweb

## Hinweis: Service Worker vollständig entfernt (Nov 2025)

Die Website verwendet keinen Service Worker mehr. Alle Registrierungen und zugehörigen Caches wurden entfernt, und die Datei `sw.js` ist nicht mehr Teil des Repositories.

## Aufräumen und Linting

Für ein sauberes Projekt-Setup kannst du folgende Befehle lokal ausführen:

```bash
# Installiere dev-Tools
npm install

# Linting (ESLint): erkennt mögliche Fehler und Stilprobleme
npm run lint

# Formatierung (Prettier): formatiert den Code automatisch
npm run format
```

## Lokale Entwicklung & WebSocket Debugging

Zum schnellen lokalen Testen ohne VS Code Live Preview kannst du jetzt einen statischen HTTP-Server und einen lokalen WebSocket-Testserver parallel starten:

1. Installiere dev-Abhängigkeiten (falls noch nicht geschehen):

```bash
npm install
```

2. Starte alles mit einem Befehl:

```bash
npm run dev
```

3. Öffne die Seite im Browser:

```bash
open http://127.0.0.1:8081
```

4. Wenn du die lokale WebSocket-Demo aktivieren möchtest (sie verbindet zu `ws://127.0.0.1:3001`), füge `?ws-test` zur URL hinzu oder aktiviere `debug` im Query-String:

```bash
open "http://127.0.0.1:8081/?ws-test"
```

Die WebSocket-Reconnect-Logik verwendet eine helper-Klasse unter `content/shared/reconnecting-websocket.js`.

Konfigurationsdateien: `.eslintrc.json`, `.prettierrc` und `.eslintignore` wurden hinzugefügt.

Hinweis: Playwright-basierte Tests wurden entfernt; es gibt keine `npm test` Playwright-Tasks mehr.

## Vendorized dependencies

This project uses a local `content/vendor/` folder to host third-party libraries (React, ReactDOM, HTM, Three.js) to avoid CDN usage and to maintain a strict CSP policy. To fetch or refresh the vendor files, run:

```bash
bash ./scripts/fetch-vendor.sh
```

The script will download curated versions of the libraries into `content/vendor/` and ensure they are referenced locally by the project.
