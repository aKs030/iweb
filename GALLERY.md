# Photo Gallery Documentation

## 📸 Überblick

Die Photo Gallery ist eine React-basierte, vollständig responsive Fotogalerie mit modernen Features und Optimierungen.

**URL**: `/pages/gallery/gallery.html`

## ⚙️ Technologie Stack

- **Framework**: React 18 (UMD Build)
- **Styling**: Lokale Utility-CSS (`/pages/gallery/gallery-styles.css`)
- **Icons**: Lucide Icons
- **Performance**: Optimiert mit React.memo, useMemo, useCallback, Debouncing

## 🎯 Features

### Galerie-Funktionen

- ✅ **Filter nach Kategorie**: All, Nature, Urban, Travel, Landscape
- ✅ **Suchfunktion**: Nach Titel, Tags, Ort (mit 300ms Debounce)
- ✅ **Sortierung**: Nach Datum, Titel, Beliebtheit
- ✅ **Grid-Ansicht**: 2x2 oder 3x3 Spalten
- ✅ **Lazy Loading**: Bilder laden asynchron mit Spinner
- ✅ **Favoriten**: Lokale Favoriten-Verwaltung

### Lightbox-Features

- ✅ **Zoom**: 50% - 300% in 25% Schritten
- ✅ **Navigation**: Keyboard (← → Pfeile, ESC) und Buttons
- ✅ **Slideshow**: Auto-Play mit 3s Intervall + Progress-Bar
- ✅ **Download**: Direkter Download mit korrektem Dateinamen
- ✅ **Share**: Native Share-API (wenn verfügbar)
- ✅ **Foto-Details**: Kamera, Blende, ISO, Ort, Datum, Tags

## 📁 Dateistruktur

```
pages/gallery/
├── gallery.html       # Haupt-HTML mit Head/Footer Integration
├── gallery-app.js     # React-Komponente (677 Zeilen)
└── (kein Symlink mehr)
```

## 🔧 Daten-Struktur

Jedes Foto folgt dieser Struktur:

```javascript
{
  id: number,
  url: string,              // Bildquelle (mit ?w=1200)
  category: string,         // all|nature|urban|travel|landscape
  title: string,
  tags: string[],
  date: string,            // ISO Format: YYYY-MM-DD
  camera: string,
  aperture: string,        // z.B. f/8
  iso: string,
  location: string
}
```

## 🚀 Performance-Optimierungen

### 1. React Optimierungen

- **useMemo**: Filter/Sort-Logik (abhängig von filter, searchQuery, sortBy)
- **useCallback**: Event-Handler (navigateImage, handleDownload, toggleFavorite)
- **useDebounce**: Search-Input mit 300ms Debounce zur CPU-Last Reduktion

### 2. Rendering-Optimierungen

- Icons als inline SVG (keine zusätzlichen HTTP-Requests)
- React.createElement statt JSX (direktere Compilation)
- Conditional Rendering für Info-Panel und Lightbox

### 3. CSS-Optimierungen

- Tailwind Production Build via CDN
- Keine doppelten Selektoren
- Hardware-accelerated Animationen (transform, opacity)

## 🎨 Anpassung der Fotos

### Neue Fotos hinzufügen

1. Öffne `gallery-app.js`
2. Navigiere zum `photos` Array (ca. Zeile 120)
3. Füge neuen Foto-Eintrag am Ende hinzu:

```javascript
{
  id: 13,                              // Neue ID
  url: 'https://images.unsplash.com/...?w=1200',
  category: 'nature',                  // Kategorie
  title: 'Mein neues Foto',           // Deutscher Titel
  tags: ['tag1', 'tag2'],
  date: '2024-12-06',                  // Heutiges Datum
  camera: 'Canon EOS R5',
  aperture: 'f/8',
  iso: '100',
  location: 'Ort'
}
```

### Kategorien

Erlaubte Kategorien: `all`, `nature`, `urban`, `travel`, `landscape`

> **Hinweis**: "all" ist eine virtuelle Kategorie und wird nicht als Filter-Option angezeigt

## 🔐 Sicherheit & PWA

- ✅ In `sw.js` für Offline-Support gecacht
- ✅ CSP-kompatibel (Tailwind CDN in Head erlaubt)
- ✅ Responsive und mobile-optimiert
- ✅ Accessibility: ARIA-Labels auf allen Buttons

## 🐛 Bekannte Limitierungen

1. **Share-API**: Funktioniert nur auf https:// oder localhost
2. **Bilder-Quellen**: Momentan von Unsplash (externe URLs)
3. **Favoriten**: Gespeichert im Browser-State (nicht persistent)

## 📈 Zukünftige Verbesserungen

- [ ] Backend-Integration für echte Bilder
- [ ] Persistente Favoriten (localStorage/API)
- [ ] Infinite Scroll statt Pagination
- [ ] Bildfilter (Brightness, Contrast, etc.)
- [ ] Kommentar-System
- [ ] Social Media Integration

## 🔗 Integration mit Projekt

- Menu: Via `head-complete.js` geladen
- Footer: Via `footer-complete.js` geladen
- Links: `/pages/gallery/gallery.html`
- Card-Link: Updated in `pages/cards/karten.html`

## 📝 Debugging-Tipps

### Performance prüfen

```javascript
// DevTools Console
React.Profiler in DevTools > Profiler Tab
```

### Search nicht funktioniert?

- Prüfe Debounce-Zeit (standardmäßig 300ms)
- Überprüfe `searchQuery` State

### Bilder laden nicht?

- Überprüfe Internet-Verbindung (Unsplash URLs brauchen CORS)
- Überprüfe Browser-Konsole auf Fehler

## 🔄 Update Checklist

Beim Update von Bildern/Features:

- [ ] Neue Fotos mit vollständigen Metadaten hinzufügen
- [ ] Kategorien validieren
- [ ] Service Worker Version bumpen (sw.js)
- [ ] Tests durchführen (Filter, Search, Zoom, Download)
- [ ] Responsive auf Mobile testen

---

**Letzte Aktualisierung**: 6. Dezember 2025 **Version**: 1.0.0
