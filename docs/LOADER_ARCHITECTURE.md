# Loader Architecture

**Version:** 3.0.0  
**Last Updated:** 2026-01-31

## Übersicht

Das Projekt verwendet ein zentralisiertes Loader-System für konsistente Fortschrittsanzeigen über alle Seiten hinweg.

## Kern-Komponenten

### 1. Global Loader (`content/core/global-loader.js`)

Zentrale API für alle Loader-Operationen:

```javascript
import {
  updateLoader,
  showLoader,
  hideLoader,
  isLoaderVisible,
} from '/content/core/global-loader.js';

// Loader anzeigen
showLoader('Lädt...', { initialProgress: 0.1 });

// Fortschritt aktualisieren
updateLoader(0.5, 'Lade Daten...', { silent: false });

// Loader verstecken
hideLoader(100, { immediate: false });

// Status prüfen
if (isLoaderVisible()) {
  // Loader ist sichtbar
}
```

#### Features

- **Element-Caching**: Loader-Elemente werden für 5 Sekunden gecacht
- **Batch-Updates**: DOM-Updates werden optimiert
- **Event-System**: Feuert Events für `loading:show`, `loading:update`, `loading:hide`
- **Fehlerbehandlung**: Robuste Fehlerbehandlung mit Fallbacks

### 2. Seiten-spezifische Loader

Jede Seite implementiert ihren eigenen Loader mit konsistenten Fortschrittsschritten:

#### Blog (`pages/blog/blog-app.js`)

```javascript
0.1  → Lade Blog...
0.2  → Lese Sitemap...
0.3  → X Artikel gefunden...
0.3-0.7 → Lade Artikel X/Y...
0.75 → Verarbeite Artikel...
0.9  → X Artikel geladen
1.0  → Blog bereit!
```

#### Videos (`pages/videos/videos.js`)

```javascript
0.1  → Lade Videos...
0.3  → Verbinde mit YouTube...
0.6  → Verarbeite X Videos...
0.6-0.9 → Lade Videos X/Y...
0.95 → X Videos geladen
1.0  → Videos bereit!
```

#### Gallery (`pages/gallery/gallery-app.js`)

```javascript
0.1  → Initialisiere Galerie...
0.3  → Lade Bilder...
0.6  → Bereite Ansicht vor...
0.9  → Fast fertig...
1.0  → Galerie bereit!
```

#### Projekte (`pages/projekte/loader.js`)

```javascript
0.1  → Initialisiere Projekte...
0.3  → Lade Komponenten...
0.6  → Konfiguriere 3D-Ansicht...
0.9  → Fast fertig...
1.0  → Projekte bereit!
```

#### About (`pages/about/about-loader.js`)

```javascript
0.1  → Lade Seite...
0.3  → Initialisiere Komponenten...
0.5  → Lade Icons...
0.7  → Animiere Elemente...
0.9  → Aktiviere Interaktionen...
0.95 → Seite bereit
```

## Best Practices

### 1. Fortschrittsschritte

- **0.0 - 0.2**: Initialisierung
- **0.2 - 0.8**: Hauptladevorgang (mit inkrementellen Updates)
- **0.8 - 0.95**: Finalisierung
- **0.95 - 1.0**: Bereit (kurze Verzögerung vor hideLoader)

### 2. Fehlerbehandlung

```javascript
try {
  updateLoader(0.1, 'Starte...');
  // ... Ladevorgang
  updateLoader(0.95, 'Fertig');
  setTimeout(() => {
    updateLoader(1, 'Bereit!');
    hideLoader(100);
  }, 100);
} catch (error) {
  log.error('Loading failed:', error);
  updateLoader(0.95, 'Fehler beim Laden');
  hideLoader(500);
}
```

### 3. Performance-Optimierung

- Verwende `{ silent: true }` für häufige Updates in Schleifen
- Batch DOM-Updates wo möglich
- Nutze `requestAnimationFrame` für UI-Updates bei intensiven Operationen

### 4. Accessibility

Der Loader ist vollständig barrierefrei:

- `role="status"` für Screen Reader
- `aria-live="polite"` für Status-Updates
- `aria-hidden="true"` wenn versteckt

## Migration von altem Code

### Vorher (veraltet)

```javascript
const loader = document.getElementById('app-loader');
loader.style.display = 'none';
```

### Nachher (empfohlen)

```javascript
import { hideLoader } from '/content/core/global-loader.js';
hideLoader();
```

## Deprecated Hooks (REMOVED)

Die folgenden Hooks wurden **entfernt**, da ihre Funktionalität vollständig in die Hauptdateien integriert wurde:

- ❌ `pages/blog/hooks/useBlogLoader.js` → Funktionalität in `blog-app.js`
- ❌ `pages/gallery/hooks/useImageLoader.js` → Funktionalität in `gallery-app.js`
- ❌ `pages/videos/hooks/useVideoLoader.js` → Funktionalität in `videos.js`

**Status:** Alle Hooks und leeren Verzeichnisse wurden am 31.01.2026 gelöscht.

## Events

Das Loader-System feuert folgende Events:

```javascript
// Loader wird angezeigt
document.addEventListener('loading:show', (e) => {
  console.log('Loader shown:', e.detail.message);
});

// Fortschritt aktualisiert
document.addEventListener('loading:update', (e) => {
  console.log('Progress:', e.detail.progress, e.detail.message);
});

// Loader wird versteckt
document.addEventListener('loading:hide', () => {
  console.log('Loader hidden');
});

// App bereit (globales Event)
window.addEventListener('app-ready', () => {
  console.log('Application ready');
});
```

## Troubleshooting

### Loader verschwindet nicht

```javascript
// Prüfe ob Loader sichtbar ist
import { isLoaderVisible } from '/content/core/global-loader.js';

if (isLoaderVisible()) {
  // Force hide
  hideLoader(0, { immediate: true });
}
```

### Fortschritt springt zurück

- Stelle sicher, dass Fortschrittswerte monoton steigend sind
- Verwende keine parallelen Updates ohne Koordination

### Performance-Probleme

- Nutze `{ silent: true }` für Updates in Schleifen
- Reduziere Update-Frequenz bei vielen Items
- Verwende Batch-Updates statt einzelner Aufrufe

## Zukünftige Verbesserungen

- [x] Alte Hook-Dateien entfernen ✅ (31.01.2026)
- [ ] Loader-Themes für verschiedene Seiten
- [ ] Animierte Übergänge zwischen Fortschrittsschritten
- [ ] Detaillierte Fehler-Anzeige mit Retry-Option
- [ ] Loader-Analytics für Performance-Monitoring
