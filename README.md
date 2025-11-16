# iweb

## Hinweis: Service Worker vollständig entfernt (Nov 2025)

Die Website verwendet keinen Service Worker mehr. Alle Registrierungen und zugehörigen Caches wurden entfernt, und die Datei `sw.js` ist nicht mehr Teil des Repositories. In der CI gibt es keine SW-bezogenen Schritte mehr.

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

Konfigurationsdateien: `.eslintrc.json`, `.prettierrc` und `.eslintignore` wurden hinzugefügt.
