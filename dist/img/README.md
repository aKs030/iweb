# Assets / Images

## Verzeichnisstruktur

```
content/assets/img/
├── earth/          # 3D Earth Texturen
├── icons/          # Favicons und App Icons
├── og/             # Open Graph Images
└── videos/         # Video Thumbnails
```

## Bildformate

Alle Bilder sollten in modernen Formaten vorliegen:

1. **AVIF** - Beste Kompression (Hauptformat)
2. **WebP** - Gute Kompression (Fallback)
3. **JPEG/PNG** - Legacy Fallback

## Bildoptimierung

### Automatische Konvertierung

```bash
# Alle Bilder konvertieren
./scripts/optimize-images.sh

# Einzelnes Verzeichnis
node content/core/image-conversion-script.js content/assets/img/og
```

### Manuelle Konvertierung

```bash
# AVIF
npx @squoosh/cli --avif '{"cqLevel":30,"speed":6}' input.jpg

# WebP
npx @squoosh/cli --webp '{"quality":85}' input.jpg
```

## Responsive Größen

Für jedes Bild sollten folgende Größen existieren:

- **320px** - Mobile (klein)
- **640px** - Mobile (groß) / Tablet
- **960px** - Tablet / Desktop (klein)
- **1280px** - Desktop (mittel)
- **1920px** - Desktop (groß) / Retina

Beispiel:

```
hero.jpg
hero-320.jpg
hero-640.jpg
hero-960.jpg
hero-1280.jpg
hero-1920.jpg
hero.avif
hero-320.avif
hero-640.avif
...
```

## Verwendung im Code

### HTML

```html
<picture>
  <source
    type="image/avif"
    srcset="
      /content/assets/img/photo-320.avif 320w,
      /content/assets/img/photo-640.avif 640w,
      /content/assets/img/photo-960.avif 960w
    "
    sizes="(max-width: 768px) 100vw, 50vw"
  />
  <source
    type="image/webp"
    srcset="
      /content/assets/img/photo-320.webp 320w,
      /content/assets/img/photo-640.webp 640w,
      /content/assets/img/photo-960.webp 960w
    "
    sizes="(max-width: 768px) 100vw, 50vw"
  />
  <img
    src="/content/assets/img/photo.jpg"
    alt="Beschreibung"
    loading="lazy"
    decoding="async"
  />
</picture>
```

### JavaScript

```javascript
import ImageOptimizer from '/content/core/image-optimizer.js';

// Responsive Bild erstellen
const picture = await ImageOptimizer.createResponsiveImage({
  src: '/content/assets/img/photo.jpg',
  alt: 'Mein Bild',
  sizes: '(max-width: 768px) 100vw, 50vw',
  loading: 'lazy',
});

document.body.appendChild(picture);
```

## Richtlinien

### Dateigrößen

- **Hero Images:** < 200KB
- **Thumbnails:** < 50KB
- **Icons:** < 10KB
- **OG Images:** < 300KB

### Qualität

- **AVIF:** cqLevel 25-35 (niedriger = besser)
- **WebP:** quality 80-90
- **JPEG:** quality 85

### Benennung

- Kleinbuchstaben
- Bindestriche statt Leerzeichen
- Beschreibende Namen
- Größe im Dateinamen: `hero-1280.avif`

### Alt-Texte

- Beschreibend und präzise
- Keine "Bild von..." oder "Foto von..."
- Kontext berücksichtigen
- Leer bei dekorativen Bildern: `alt=""`

## Checkliste für neue Bilder

- [ ] Original in höchster Qualität gespeichert
- [ ] Zu AVIF konvertiert
- [ ] Zu WebP konvertiert
- [ ] Responsive Größen generiert
- [ ] Dateigröße optimiert
- [ ] Alt-Text definiert
- [ ] Im Code mit `<picture>` eingebunden
- [ ] Lazy Loading aktiviert
- [ ] Performance getestet

## Tools

### Empfohlene Tools

- **@squoosh/cli** - Kommandozeilen-Tool für Bildkonvertierung
- **sharp** - Node.js Bibliothek für Bildverarbeitung
- **ImageOptim** - macOS GUI für Bildoptimierung
- **Squoosh.app** - Web-basiertes Tool

### Installation

```bash
# Squoosh CLI
npm install -g @squoosh/cli

# Sharp (für Resize)
npm install --save-dev sharp
```

## Performance-Monitoring

Prüfe regelmäßig:

- Lighthouse Score (Performance)
- LCP (Largest Contentful Paint)
- CLS (Cumulative Layout Shift)
- Bildgrößen im Network Tab

Ziele:

- LCP < 2.5s
- CLS < 0.1
- Performance Score > 90

## Weitere Ressourcen

- [Bildoptimierungs-Leitfaden](../../docs/IMAGE_OPTIMIZATION.md)
- [Web.dev: Optimize Images](https://web.dev/fast/#optimize-your-images)
- [Squoosh Documentation](https://github.com/GoogleChromeLabs/squoosh)
