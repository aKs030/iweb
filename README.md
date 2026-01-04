# Abdulkerim Sesli — Portfolio

[![LinkedIn](https://img.shields.io/badge/LinkedIn-abdulkerim--sesli-0077B5?logo=linkedin)](https://linkedin.com/in/abdulkerimsesli) [![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

**Portfolio website of Abdulkerim Sesli — Web Developer & Photographer in Berlin. PWA-ready, accessible, and featuring interactive Three.js visualizations.**

---

## Inhaltsverzeichnis

- [Linked Data & Identität](#-linked-data--identit%C3%A4t)
- [Funktionen](#-funktionen)
- [Installation](#-installation)
- [Skripte](#-skripte)
- [Projektstruktur](#-projektstruktur)
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
# Lokalen Server starten
npm run dev
```

**Wichtig:** `node_modules/` sollte lokal bleiben und **nicht** ins Repository committet werden. Ich habe deshalb eine `.gitignore` angelegt, die `node_modules/` und lokale Konfigdateien (`content/config/videos-part-*.js`) ausschließt.

Wenn `node_modules` bereits versehentlich ins Repo committet wurde, entferne sie aus dem Index mit:

```bash
git rm -r --cached node_modules
git commit -m "Remove node_modules from repo"
```

Danach sicherstellen, dass `.gitignore` committed ist, damit `node_modules/` nicht erneut hinzugefügt wird.

---

## 📦 Skripte

| Befehl                    | Beschreibung                                   |
| ------------------------- | ---------------------------------------------- |
| `npm run dev`             | Startet lokalen Entwicklungsserver (Port 8080) |
| `npm run start`           | Alias für `npm run dev`                        |
| `npm run format`          | Formatiert Code mit Prettier                   |
| `npm run lint`            | Führt ESLint aus und behebt Probleme           |
| `npm run prepare`         | Installiert Husky-Git-Hooks                    |
| `npm run config:validate` | Validiert Konfigurationsdateien                |
| `npm run sync:gtm`        | Synchronisiert GTM-Container mit Site-Config   |

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

### 🔧 Konfiguration
Zentrale Host-/Site-abhängige Einstellungen (GTM/GA4/Ads-IDs, Ads-Conversion-Label, Feature-Flags) befinden sich in `content/config/site-config.js`. Ändere dort Host-Mapping-Einträge (Schlüssel sind Hostnamen, `default` wird als Fallback verwendet).
```

---

## 📝 Aktuelle Änderungen (Dezember 2025)

- ✅ **React Photo Gallery**: Performante Galerie mit Filter & Zoom
- ✅ **Logger-System**: Zentralisiertes Logging via `shared-utilities.js`
- ✅ **ESM Migration**: Vollständige Umstellung auf ES Modules
- ✅ **Code-Cleanup**: Playwright & React entfernt (nicht verwendet)
- ✅ **Vendor-Ordner optimiert**: Three.js von CDN (statt lokal)
- ✅ **Performance**: Earth-Loader optimiert, CSS-Preloads bereinigt

---

## 🤝 Mitmachen (Contributing)

Kurz-Checklist für Beiträge:

- Fork → Branch → Commit → PR
- Vor Commit: `npm run format` und `npm run lint`
- Schreibe kurze, aussagekräftige PR-Titel und beschreibe Änderungen im PR-Body

Für grössere Änderungen: Öffne bitte zuerst ein Issue zur Diskussion.

---

## 📊 CI & Badges

✅ **GitHub Actions CI aktiviert** - siehe `.github/workflows/ci.yml`:

- ESLint Linting auf alle `.js` und `.ts` Dateien
- Konfiguration-Validierung
- Läuft auf Node.js 20 LTS

---

## 🎞️ Demo / Screenshots

Füge kurze Vorschau-Bilder in `assets/` hinzu und verlinke sie hier:

```markdown
![Preview](assets/preview.png)
```

Wenn du mir 1–2 Screenshots gibst, füge ich sie gern direkt ein.

## 📄 Verfügbare Assets

- `content/assets/Abdulkerim_Sesli_CV_DE.pdf` — Platzhalter für den deutschen Lebenslauf (PDF). Ersetze die Datei durch die finale Version, wenn du sie bereitstellst.

---

## 📄 Lizenz

Dieses Projekt ist unter der **MIT-Lizenz** lizenziert.

---

Weitere Details: `CHANGELOG.md`, `DEV.md` und `SECURITY-CSP.md` enthalten ergänzende Informationen für Entwickler.
