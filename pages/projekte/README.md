# Projekte Seite - Modernisiert & Kompakt

## 🎯 Aktuelle Verbesserungen (2025)

### Design & Layout

- **Kompakte Karten**: Projekte werden in einem responsiven Grid mit modernen Karten dargestellt
- **Bessere Typografie**: Optimierte Schriftgrößen und Abstände für bessere Lesbarkeit
- **Moderne Buttons**: Neue Button-Designs mit besseren Hover-Effekten
- **Responsive Design**: Verbesserte mobile Darstellung

### Performance

- **Optimierte Animationen**: Reduzierte und performantere Animationen
- **Bessere Loading States**: Klarere Ladezustände mit Spinner
- **Accessibility**: Verbesserte Barrierefreiheit mit Focus-States

### Benutzerfreundlichkeit

- **Kompaktere Modals**: Überarbeitete Modal-Fenster für App-Vorschauen
- **Bessere Navigation**: Optimierte Scroll-Navigation zwischen Bereichen
- **Klarere Struktur**: Übersichtlichere Anordnung der Projektinformationen

---

# Dynamisches Projekt-Loading System

## Übersicht

Das Projekte-System lädt automatisch alle Projekte aus dem GitHub Repository `https://github.com/aKs030/Webgame.git` und zeigt sie dynamisch auf der Projekte-Seite an.

## Funktionsweise

### 1. Dynamisches Laden

- Das System verwendet die GitHub API, um alle Ordner im `apps/` Verzeichnis zu scannen
- Für jedes gefundene Projekt wird automatisch eine Projektseite generiert
- Metadaten werden aus `package.json` oder `README.md` extrahiert

### 2. Intelligente Kategorisierung

Projekte werden automatisch kategorisiert basierend auf:

- Titel und Beschreibung
- Keywords/Tags
- Dateiinhalte

### 3. Fallback-System

- Bei API-Fehlern werden statische Fallback-Projekte angezeigt
- Graceful Degradation ohne Funktionsverlust

## Konfiguration

### GitHub Repository Settings

```javascript
// github-config.js
export const GITHUB_CONFIG = {
  owner: 'aKs030',
  repo: 'Webgame',
  branch: 'main',
  appsPath: 'apps',
  // ...weitere Einstellungen
};
```

### Projekt-Metadaten

Jedes Projekt kann eine `package.json` mit folgender Struktur haben:

```json
{
  "name": "projekt-name",
  "description": "Projektbeschreibung",
  "keywords": ["javascript", "game", "interactive"],
  "category": "game",
  "version": "1.0.0",
  "author": "Abdulkerim Sesli",
  "homepage": "https://example.com"
}
```

### Unterstützte Kategorien

- **game**: Spiele und interaktive Unterhaltung
- **puzzle**: Logik- und Denkspiele
- **ui**: UI/UX und Design-Projekte
- **productivity**: Produktivitäts-Tools
- **web**: Web-APIs und Netzwerk-Tools
- **utility**: Hilfsprogramme und Konverter

## Dateistruktur

```
pages/projekte/
├── README.md                 # Diese Dokumentation
├── github-config.js         # Konfiguration für GitHub API
├── projects-data.js         # Haupt-Datenlogik
├── projekte-app.js         # React-Anwendung
├── projekte-loader.js      # Initialisierung
├── projekte.css           # Styling
└── index.html             # HTML-Template
```

## Erwartete Repository-Struktur

```
Webgame/
└── apps/
    ├── schere-stein-papier/
    │   ├── index.html
    │   ├── package.json (optional)
    │   └── README.md (optional)
    ├── zahlen-raten/
    │   ├── index.html
    │   └── ...
    └── weitere-projekte/
        └── ...
```

## Features

### ✅ Implementiert

- [x] **Modernisiertes Design (2025)**: Kompakte Karten, bessere Typografie, moderne Buttons
- [x] **Responsive Grid-Layout**: Optimiert für alle Bildschirmgrößen
- [x] **Verbesserte Accessibility**: Focus-States, ARIA-Labels, Reduced Motion Support
- [x] Dynamisches Laden aus GitHub API
- [x] Intelligente Kategorisierung
- [x] Automatische Icon-Zuordnung
- [x] Fallback auf statische Projekte
- [x] Loading States und Error Handling
- [x] SEO-optimierte Metadaten

### 🔄 Geplant

- [ ] Caching für bessere Performance
- [ ] Projekt-Favoriten
- [ ] Suchfunktion
- [ ] Sortierung nach Kategorien
- [ ] Live-Preview Integration

## 📱 Responsive Breakpoints

- **Mobile**: < 768px - Einspaltige Darstellung
- **Tablet**: 768px - 1200px - Zweispaltige Darstellung
- **Desktop**: > 1200px - Optimierte zweispaltige Darstellung

## 🎨 Design System

### Farben

- **Primär**: Weiß/Grau-Gradient für Buttons
- **Akzent**: Blau-Lila-Pink Gradient für Highlights
- **Hintergrund**: Dunkle Glasmorphismus-Effekte

### Abstände

- Kompaktere Paddings und Margins
- Konsistente Gap-Größen im Grid
- Optimierte Abstände für mobile Geräte

## Troubleshooting

### Häufige Probleme

1. **Projekte werden nicht geladen**
   - Prüfen Sie die GitHub API Rate Limits
   - Überprüfen Sie die Repository-URL in `github-config.js`

2. **Falsche Kategorisierung**
   - Aktualisieren Sie die Keywords in `package.json`
   - Erweitern Sie die Kategorien in `github-config.js`

3. **Styling-Probleme**
   - Überprüfen Sie die CSS-Klassen in `projekte.css`
   - Stellen Sie sicher, dass alle Theme-Farben definiert sind

## Performance

- **Lazy Loading**: Projekte werden nur bei Bedarf geladen
- **Caching**: API-Responses werden temporär gecacht
- **Optimierte Requests**: Minimale API-Calls durch intelligente Batching

## Sicherheit

- **CSP-konform**: Alle externen Ressourcen sind whitelisted
- **XSS-Schutz**: Alle Benutzereingaben werden sanitized
- **CORS-ready**: Konfiguriert für Cross-Origin Requests
