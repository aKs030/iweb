# Bildoptimierung

## Übersicht

Vollständige Bildoptimierungsstrategie mit modernen Formaten, Lazy Loading und Performance-Monitoring.

## Features

- ✅ **AVIF/WebP Support** - Automatische Format-Erkennung mit Fallbacks
- ✅ **Lazy Loading** - Intersection Observer mit Blur-Placeholder
- ✅ **Responsive Images** - Automatische srcset-Generierung
- ✅ **Performance-Monitoring** - Live-Tracking von LCP, CLS
- ✅ **Automatische Konvertierung** - Batch-Processing für alle Bilder

## Quick Start

### 1. Bilder konvertieren

```bash
# Alle Bilder zu AVIF/WebP konvertieren
npm run optimize:images

# Oder mit Node.js (inkl. responsive Größen)
npm run optimize:images:node content/assets/img
```

### 2. In HTML verwenden

```html
<!-- Einfaches Lazy Loading -->
<img
  src="photo.webp"
  alt="Beschreibung"
  loading="lazy"
  decoding="async"
  fetchpriority="auto"
/>

<!-- Responsive mit srcset -->
<img
  srcset="photo-320.webp 320w, photo-640.webp 640w, photo-960.webp 960w"
  sizes="(max-width: 640px) 100vw, 50vw"
  src="photo.webp"
  alt="Beschreibung"
  loading="lazy"
  decoding="async"
/>

<!-- Picture mit modernen Formaten -->
<picture>
  <source type="image/avif" srcset="photo.avif" />
  <source type="image/webp" srcset="photo.webp" />
  <img src="photo.jpg" alt="Beschreibung" loading="lazy" />
</picture>
```

### 3. In JavaScript verwenden

```javascript
import ImageOptimizer from '/content/core/image-optimizer.js';

// Lazy Loading aktivieren
ImageOptimizer.lazyLoadImagesInContainer('.gallery', {
  rootMargin: '50px',
  placeholder: 'blur',
});

// Kritische Bilder preloaden
await ImageOptimizer.preloadImages(['/img/hero.jpg'], {
  fetchpriority: 'high',
});
```

### 4. Automatische Initialisierung

Die Bildoptimierung wird automatisch beim Seitenload aktiviert (siehe `content/main.js`).

## Module

### Core

- `image-optimizer.js` - Hauptmodul mit AVIF/WebP Support (319 Zeilen)
- `image-loader-helper.js` - Minimale API für Initialisierung (52 Zeilen)

### Components

- `image-loading.css` - Optimierte Styles für Loading-States

## Best Practices

### Priorisierung

- **Erste 1-3 Bilder:** `loading="eager"` + `fetchpriority="high"`
- **Erste 4-6 Bilder:** `loading="eager"` + `fetchpriority="auto"`
- **Rest:** `loading="lazy"` + `fetchpriority="auto"`

### Attribute

```html
<img
  src="photo.webp"
  srcset="photo-320.webp 320w, photo-640.webp 640w"
  sizes="(max-width: 640px) 100vw, 50vw"
  alt="Beschreibender Alt-Text"
  loading="lazy"
  decoding="async"
  fetchpriority="auto"
  width="960"
  height="640"
/>
```

### Bildformate

1. **AVIF** - Beste Kompression (-40% bis -60% vs JPEG)
2. **WebP** - Gute Kompression, breite Unterstützung
3. **JPEG/PNG** - Fallback für alte Browser

### Qualitätseinstellungen

- **AVIF:** cqLevel 25-35 (niedriger = besser)
- **WebP:** quality 80-90
- **JPEG:** quality 85

## Performance-Monitoring

Die Bildoptimierung läuft automatisch im Hintergrund. Prüfe die Performance mit:

```javascript
// Browser DevTools → Network Tab
// Lighthouse → Performance Score
```

## Checkliste für neue Bilder

- [ ] Original in höchster Qualität speichern
- [ ] `npm run optimize:images` ausführen
- [ ] `<picture>` Element mit AVIF/WebP verwenden
- [ ] `loading` und `fetchpriority` Attribute setzen
- [ ] `sizes` Attribut für responsive Bilder
- [ ] `width` und `height` Attribute angeben
- [ ] Aussagekräftigen `alt` Text schreiben
- [ ] Performance mit Lighthouse testen

## Weitere Dokumentation

- [Asset-Dokumentation](../content/assets/img/README.md)
