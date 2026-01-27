# Webgame Repository Optimierung - Prompt

## 🎯 Ziel

Optimiere das GitHub Repository `aKs030/Webgame` für bessere Performance, Struktur und automatisches Laden in die Portfolio-Website.

## 📁 Aktuelle Repository-Struktur

```
Webgame/
└── apps/
    ├── schere-stein-papier/
    ├── zahlen-raten/
    ├── color-changer/
    ├── todo-liste/
    └── [weitere-projekte]/
```

## 🔧 Optimierungsaufgaben

### 1. **Repository-Struktur standardisieren**

Jedes Projekt im `apps/` Ordner sollte folgende Struktur haben:

```
apps/projekt-name/
├── index.html          # Haupt-App-Datei
├── package.json        # Metadaten für automatisches Laden
├── README.md           # Projektbeschreibung (optional)
├── style.css           # Styling (falls separate Datei)
├── script.js           # JavaScript (falls separate Datei)
└── assets/             # Bilder, Icons, etc. (optional)
```

### 2. **package.json für jedes Projekt erstellen**

Jede App sollte eine `package.json` mit folgenden Metadaten haben:

```json
{
  "name": "projekt-name",
  "version": "1.0.0",
  "description": "Kurze, prägnante Beschreibung des Projekts",
  "keywords": ["javascript", "kategorie", "technologie"],
  "category": "game|puzzle|ui|productivity|web|utility",
  "author": "Abdulkerim Sesli",
  "license": "MIT",
  "homepage": "https://www.abdulkerimsesli.de/projekte/",
  "repository": {
    "type": "git",
    "url": "https://github.com/aKs030/Webgame.git"
  }
}
```

### 3. **Kategorien-Mapping optimieren**

Verwende diese Kategorien für bessere automatische Zuordnung:

- **game**: Spiele, Unterhaltung, interaktive Erlebnisse
- **puzzle**: Logik-Spiele, Rätsel, Denkaufgaben
- **ui**: Design-Tools, Farbwähler, UI-Komponenten
- **productivity**: To-Do-Listen, Kalender, Produktivitäts-Tools
- **web**: API-Tools, Netzwerk-Utilities, Web-Services
- **utility**: Rechner, Konverter, Hilfsprogramme

### 4. **Keywords für bessere Erkennung**

Füge relevante Keywords in die `package.json` ein:

**Beispiele:**

- Schere-Stein-Papier: `["game", "spiel", "rock-paper-scissors", "javascript"]`
- Zahlen-Raten: `["puzzle", "logic", "guessing", "numbers", "math"]`
- Color-Changer: `["ui", "design", "color", "css", "theme"]`
- To-Do-Liste: `["productivity", "todo", "tasks", "crud", "organization"]`

### 5. **HTML-Struktur optimieren**

Jede `index.html` sollte:

```html
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Projekt Name</title>
    <meta name="description" content="Kurze Projektbeschreibung" />
    <style>
      /* Inline CSS für bessere Performance */
      body {
        font-family:
          system-ui,
          -apple-system,
          sans-serif;
        margin: 0;
        padding: 20px;
        background: #f5f5f5;
      }
      /* Weitere Styles... */
    </style>
  </head>
  <body>
    <!-- App Content -->

    <script>
      // Inline JavaScript für bessere Performance
      // App Logic hier...
    </script>
  </body>
</html>
```

### 6. **Performance-Optimierungen**

- **Inline CSS/JS**: Für kleine Apps alles in die HTML-Datei
- **Minimale Dependencies**: Keine externen Libraries wenn möglich
- **Responsive Design**: Mobile-first Ansatz
- **Fast Loading**: Optimierte Bilder und Assets

### 7. **README.md für jedes Projekt**

Optional, aber empfohlen:

```markdown
# Projekt Name

Kurze Beschreibung des Projekts.

## Features

- Feature 1
- Feature 2
- Feature 3

## Technologien

- HTML5
- CSS3
- Vanilla JavaScript

## Demo

[Live Demo](https://rawcdn.githack.com/aKs030/Webgame/main/apps/projekt-name/index.html)
```

### 8. **Neue Projekte hinzufügen**

Für neue Projekte:

1. Erstelle Ordner in `apps/neues-projekt/`
2. Füge `index.html`, `package.json` hinzu
3. Teste die App lokal
4. Committe und pushe zum Repository
5. Die App erscheint automatisch auf der Portfolio-Website

### 9. **Qualitätssicherung**

Jede App sollte:

- ✅ Funktional und fehlerfrei sein
- ✅ Responsive Design haben
- ✅ Sauberen, kommentierten Code haben
- ✅ Benutzerfreundlich sein
- ✅ Schnell laden (< 2 Sekunden)

### 10. **Repository-Wartung**

- **Regelmäßige Updates**: Veraltete Apps aktualisieren
- **Konsistente Namensgebung**: kebab-case für Ordnernamen
- **Dokumentation**: README.md auf Repository-Ebene
- **Lizenz**: MIT-Lizenz für Open Source

## 🚀 Erwartetes Ergebnis

Nach der Optimierung:

- ⚡ **Automatisches Laden**: Alle Apps werden dynamisch auf der Portfolio-Website angezeigt
- 🎨 **Konsistente Darstellung**: Einheitliche Kategorisierung und Styling
- 📱 **Mobile-optimiert**: Alle Apps funktionieren perfekt auf allen Geräten
- 🔍 **SEO-freundlich**: Bessere Metadaten für Suchmaschinen
- 🛠️ **Wartbar**: Einfache Struktur für zukünftige Erweiterungen

## 📋 Checkliste für jede App

- [ ] `index.html` mit vollständiger App
- [ ] `package.json` mit korrekten Metadaten
- [ ] Responsive Design implementiert
- [ ] Funktionalität getestet
- [ ] Performance optimiert
- [ ] Kategorie korrekt zugeordnet
- [ ] Keywords für Suche hinzugefügt
- [ ] README.md erstellt (optional)

## 🔗 Integration mit Portfolio

Die Portfolio-Website lädt automatisch:

1. Alle Ordner aus `apps/`
2. Metadaten aus `package.json`
3. Kategorisiert nach Keywords
4. Zeigt Live-Previews an
5. Ermöglicht direkten Zugriff auf Apps

**Repository URL**: `https://github.com/aKs030/Webgame`
**Apps Pfad**: `/apps/`
**Branch**: `main`
