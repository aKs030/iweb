# Bildoptimierung

## Übersicht

Native Browser-Features für Bildoptimierung nutzen - keine zusätzlichen JavaScript-Module erforderlich.

## Features

- ✅ **Native Lazy Loading** - Browser-integriert mit `loading="lazy"`
- ✅ **Fetchpriority** - Kritische Bilder priorisieren
- ✅ **Picture Element** - Moderne Formate (AVIF/WebP) mit Fallbacks
- ✅ **Responsive Images** - Native srcset und sizes
- ✅ **Decoding Async** - Non-blocking Bildverarbeitung

## Quick Start

### 1. Einfaches Lazy Loading

```html
<!-- Standard Lazy Loading -->
<img src="photo.webp" alt="Beschreibung" loading="lazy" decoding="async" />
```

### 2. Kritische Bilder

```html
<!-- Hero/Above-the-fold Bilder -->
<img src="hero.jpg" alt="Hero" fetchpriority="high" decoding="async" />
```

### 3. Responsive Images

```html
<!-- Mit srcset für verschiedene Bildschirmgrößen -->
<img
  srcset="photo-320.webp 320w, photo-640.webp 640w, photo-960.webp 960w"
  sizes="(max-width: 640px) 100vw, 50vw"
  src="photo.webp"
  alt="Beschreibung"
  loading="lazy"
  decoding="async"
/>
```

### 4. Moderne Formate mit Fallback

```html
<!-- Picture Element für AVIF/WebP mit JPEG Fallback -->
<picture>
  <source type="image/avif" srcset="photo.avif" />
  <source type="image/webp" srcset="photo.webp" />
  <img src="photo.jpg" alt="Beschreibung" loading="lazy" decoding="async" />
</picture>
```

## Browser Support

Alle Features werden von modernen Browsern unterstützt:

- **loading="lazy"**: Chrome 77+, Firefox 75+, Safari 15.4+
- **fetchpriority**: Chrome 101+, Edge 101+
- **decoding="async"**: Chrome 65+, Firefox 63+, Safari 14+
- **AVIF**: Chrome 85+, Firefox 93+, Safari 16+
- **WebP**: Chrome 23+, Firefox 65+, Safari 14+

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
- [ ] `<picture>` Element mit AVIF/WebP verwenden
- [ ] `loading` und `fetchpriority` Attribute setzen
- [ ] `sizes` Attribut für responsive Bilder
- [ ] `width` und `height` Attribute angeben
- [ ] Aussagekräftigen `alt` Text schreiben
- [ ] Performance mit Lighthouse testen

## Weitere Dokumentation

- [Asset-Dokumentation](../content/assets/img/README.md)
