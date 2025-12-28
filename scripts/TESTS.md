# Playwright Tests

Dieses Dokument beschreibt die Playwright-End-to-End-Tests für das iweb-Projekt.

## Übersicht

Die Tests sind in `./scripts/tests/` organisiert und prüfen die Funktionalität der Website.

## Test-Struktur

- **testDir**: `./scripts/tests/`
- **outputDir**: `./scripts/test-results/`
- **WebServer**: Startet automatisch mit `npm run serve:dev` auf Port 8081

## Verfügbare Tests

### Homepage Test

- **Datei**: `scripts/tests/homepage.spec.js`
- **Beschreibung**: Prüft, ob die Homepage lädt und wichtige Elemente anzeigt.
- **Assertions**:
  - Titel enthält "Abdulkerim"
  - Navigation ist sichtbar
  - Hauptinhalt ist sichtbar
  - Keine JavaScript-Fehler

### Navigation Test

- **Datei**: `scripts/tests/homepage.spec.js`
- **Beschreibung**: Testet die Navigation zur Gallery-Seite.
- **Assertions**:
  - Klick auf Gallery-Link
  - URL wechselt zu `/gallery/`
  - Titel enthält "Fotografie Portfolio"
  - Hauptinhalt ist sichtbar

## Ausführung

### Lokal

```bash
npm run test:playwright
```

### CI (GitHub Actions)

- Workflow: `.github/workflows/playwright.yml`
- Ausführung: Manuell über GitHub UI
- Befehl: `npm run test:playwright`

## Konfiguration

In `playwright.config.js`:

```javascript
testDir: './scripts/tests',
outputDir: './scripts/test-results',
webServer: {
  command: 'npm run serve:dev',
  port: 8081,
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000
}
```

## Ergebnisse

Test-Ergebnisse werden in `./scripts/test-results/` gespeichert, inklusive Screenshots und Videos bei Fehlern.
