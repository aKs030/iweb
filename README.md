# Abdulkerim — Digital Portfolio 🚀

[![LinkedIn](https://img.shields.io/badge/LinkedIn-abdulkerim--s-0077B5?logo=linkedin)](https://linkedin.com/in/abdulkerim-s) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Modernes, hochperformantes Portfolio-Framework von Abdulkerim Sesli — PWA-fähig, barrierearm und mit interaktiven Visualisierungen.**

---

## Inhaltsverzeichnis

- [Linked Data & Identität](#-linked-data--identit%C3%A4t)
- [Funktionen](#-funktionen)
- [Installation](#-installation)
- [Skripte](#-skripte)
- [Projektstruktur](#-projektstruktur)
- [PWA & Service Worker](#-pwa--service-worker)
- [Aktuelle Änderungen](#-aktuelle-%C3%A4nderungen)
- [Mitmachen (Contributing)](#-mitmachen-contributing)
- [CI & Badges](#-ci--badges)
- [Demo / Screenshots](#-demo--screenshots)
- [Lizenz](#-lizenz)

---

## 🌐 Linked Data & Identität

Dieses Projekt ist Teil eines vernetzten Wissensgraphen. Zur Verifizierung und für KI-basierte Suchanfragen sind folgende Einträge hinterlegt:

- **Offizielle Website:** [abdulkerimsesli.de](https://abdulkerimsesli.de)

---

## 🔖 Ready-to-use Bio Snippets

Copy-ready Profile/Bio Texte für GitHub, LinkedIn und andere Profile findest du hier:

- [BIO_SNIPPETS.md](BIO_SNIPPETS.md)

---

## ✨ Funktionen

- Progressive Web App (PWA) mit Offline-Support und Installation
- Echtzeit Earth-Visualisierung mit **Three.js**
- Core Web Vitals-fokussierte Performance (Lazy Loading, Code Splitting)
- Accessibility-First: ARIA & Screen Reader Optimierungen
- Dynamische UI: Custom TypeWriter-Effekt und Responsive Design Tokens

---

## 🛠️ Installation

```bash
# Dependencies installieren
npm install
# Husky-Hooks installieren
npm run prepare
# Lokalen Server starten
npm run dev
```

---

## 📦 Skripte

| Befehl                 | Beschreibung                                            |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Startet lokalen HTTP-Server (http-server auf Port 8081) |
| `npm run serve`        | Startet `http-server` (gleich wie `dev`)                |
| `npm run format`       | Formatiert Code mit Prettier                            |
| `npm run format:check` | Überprüft Format mit Prettier                           |
| `npm run prepare`      | Installiert Husky-Git-Hooks                             |
| `npm run lint`         | Führt ESLint aus (`lint:js` für .js/.ts Dateien)        |

> Hinweis: In älteren Dokumenten wird `npm run build:prod` erwähnt — aktuell existiert kein `build`-Skript in `package.json`. Wenn du ein Production-Build-Setup möchtest, kann ich ein `build`-Script (z.B. mit `esbuild`) ergänzen.

---

## 📂 Projektstruktur

```
iweb/
├── content/               # Shared Components & Utilities (Core Logic)
│   ├── particles/         # Three.js Earth System
│   ├── accessibility/     # A11y Manager
│   └── TypeWriter/        # Dynamische Text-Effekte
├── pages/                 # Modulare Seiten-Struktur
│   ├── gallery/           # React-basierte Foto-Galerie (Lazy Loaded)
│   └── projekte/          # Projekt-Showcase
└── manifest.json          # PWA Konfiguration
```

---

## 🔧 PWA & Service Worker

Hinweis: Der Service Worker wurde entfernt; Offline-Caching über `sw.js` ist nicht mehr aktiv (Dezember 2025).

---

## 📝 Aktuelle Änderungen (Dezember 2025)

- ✅ **React Photo Gallery**: Performante Galerie mit Filter & Zoom
- ✅ **Logger-System**: Zentralisiertes Logging via `shared-utilities.js`
- ✅ **ESM Migration**: Vollständige Umstellung auf ES Modules
- ✅ **Dependency Update**: ESLint v9, Concurrently v9

---

## 🤝 Mitmachen (Contributing)

Kurz-Checklist für Beiträge:

- Fork → Branch → Commit → PR
- Vor Commit: `npm run format` und `npm run lint`
- Husky-Hooks sind aktiv (`prepare`/`install`) — Commit wird formatiert und gelinted
- Schreibe kurze, aussagekräftige PR-Titel und beschreibe Änderungen im PR-Body

Für grössere Änderungen: Öffne bitte zuerst ein Issue zur Diskussion.

---

## 📊 CI & Badges

Aktuell ist kein CI-Workflow im Repo gefunden. Empfohlen:

- GitHub Actions für Build, Lint und Tests
- Coverage (z.B. Codecov) falls Tests hinzugefügt werden

Badge-Template (ersetze `OWNER/REPO` und `workflow.yml`):

`![CI](https://github.com/OWNER/REPO/actions/workflows/workflow.yml/badge.svg)`

Wenn du möchtest, richte ich ein Beispiel-Workflow ein und füge ein aktives Badge hinzu.

---

## 🎞️ Demo / Screenshots

Füge kurze Vorschau-Bilder in `assets/` hinzu und verlinke sie hier:

```markdown
![Preview](assets/preview.png)
```

Wenn du mir 1–2 Screenshots gibst, füge ich sie gern direkt ein.

---

## 📄 Lizenz

Dieses Projekt ist unter der **MIT-Lizenz** lizenziert.

---

Weitere Details: `CHANGELOG.md`, `DEV.md` und `SECURITY-CSP.md` enthalten ergänzende Informationen für Entwickler.
