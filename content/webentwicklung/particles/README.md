# Enhanced Particles System - 2D Canvas

Erweiterte und optimierte 2D-Canvas-Partikelsystem für iweb mit umfangreichen Features.

## 🚀 Quick Start
```js
import { initParticles } from './particle-system.js';
const cleanup = initParticles({ getElement, throttle, checkReducedMotion });

// Cleanup bei Bedarf
cleanup();
```

## ✨ Features

### 🔶 Erweiterte Partikeltypen
- **Circle**: Standard kreisförmige Partikel
- **Triangle**: Rotierende Dreiecke
- **Star**: 5-zackige Sterne mit Animation
- **Pulse**: Pulsierende Kreise mit Transparenz-Effekt
- **Square**: Rotierende Quadrate
- **Gewichtete Verteilung**: Konfigurierbare Häufigkeit pro Typ

### ⚡ Physik-Engine
- **Schwerkraft**: Konfigurierbare X/Y-Gravitationskräfte
- **Kollisionserkennung**: Elastische Kollisionen zwischen Partikeln
- **Bounce-Modus**: Realistische Reflexion an Bildschirmgrenzen
- **Energie-Verlust**: Geschwindigkeitsdämpfung bei Kollisionen

### 🚀 Performance-Optimierungen
- **Spatial Grid**: Optimierte Nachbarschaftssuche (Original)
- **Quad-Tree**: Erweiterte Spatial-Optimierung für große Partikelmengen
- **Adaptive FPS**: Automatische Partikel-Reduzierung bei niedrigen FPS
- **OffscreenCanvas Ready**: Vorbereitet für WebWorker-Implementation

### 🔧 Debug & Konfiguration
- **Live Debug-Overlay**: Performance-Statistiken und FPS-Monitor
- **Grid-Visualisierung**: Spatial-Grid für Entwicklung sichtbar machen
- **Umfangreiche API**: Programmatische Kontrolle aller Features
- **Runtime-Konfiguration**: Alle Settings über Data-Attribute steuerbar

## 📋 Data-Attribute Konfiguration

### Basis-Features
```html
<div class="global-particle-background"
     data-particle-gradient="radial"           <!-- linear|radial -->
     data-particle-alpha-scale="1.2"           <!-- 0.2-2.0 -->
     data-particle-connections="true"          <!-- true|false -->
     data-particle-show="true">                <!-- true|false -->
```

### Partikeltypen
```html
<!-- JSON-Format für gewichtete Verteilung -->
data-particle-types='{"circle":3,"star":1,"pulse":1}'

<!-- Oder einfache Liste -->
data-particle-types="circle,triangle,star"
```

### Physik-Settings
```html
<!-- Schwerkraft (JSON) -->
data-particle-gravity='{"x":0,"y":0.001}'

<!-- Oder nur Y-Schwerkraft -->
data-particle-gravity="0.001"

<!-- Kollisionen & Bounce -->
data-particle-collisions="true"
data-particle-bounce="true"
```

### Performance & Debug
```html
data-particle-quadtree="true"                 <!-- Quad-Tree aktivieren -->
data-particle-debug="true"                    <!-- Debug-Overlay -->
data-particle-debug-grid="true"               <!-- Grid visualisieren -->
```

### Opacity-Kontrolle
```html
data-particle-connection-opacity="0.8"        <!-- 0.0-1.0 -->
data-particle-opacity-scale="1.5"             <!-- 0.0-2.0 -->
```

### Parallax, Trails, Glow & Blend
```html
<!-- Maus-/Touch-Parallax (0.0 - 0.3; 0 = aus) -->
data-particle-parallax="0.15"

<!-- Weiche Bewegungs-Trails via destination-out -->
data-particle-trails="true"                    <!-- true|false -->
data-particle-trail-fade="0.08"                <!-- 0.005 - 0.5 (höher = stärkere Trails) -->

<!-- Glow/Leuchten über Blend-Mode (empf. lighter/screen) -->
data-particle-glow="true"                      <!-- true|false; schaltet automatisch auf 'lighter' wenn source-over -->
data-particle-blend="lighter"                  <!-- source-over|lighter|screen -->

<!-- Verbindungslinien Taktung & Begrenzung -->
data-particle-conn-skip="2"                    <!-- nur jede n-te Frame Verbindungen rendern (1 = jedes Frame) -->
data-particle-conn-cap="8"                     <!-- max. Verbindungen pro Partikel (>=1) -->
```

### Per-Section Kamera & Dolly-Zoom
Setze die folgenden Attribute auf deinen Section-Elementen (z. B. `<section class="section" data-camera-...>`). Fehlt ein Wert, wird ein sinnvoller Default pro Abschnitt verwendet.

```html
<section class="section"
  data-camera-zoom="1.25"          <!-- Zoom-Faktor, Default je Abschnitt; typ. 1.0 - 1.6 -->
  data-camera-tilt="0.05"          <!-- Rotation in Rad, klein halten: -0.2 .. 0.2 -->
  data-camera-pan-x="-10"          <!-- Horizontaler Versatz in px -->
  data-camera-pan-y="12"           <!-- Vertikaler Versatz in px -->
  data-camera-focal="680"          <!-- Brennweite für Pseudo-3D (z) -->
  data-camera-shake="0.02"         <!-- Kamerawackeln (0..~0.2), wird im Laufe gedämpft -->
  data-camera-dolly-dur="900"      <!-- Dauer des Dolly-Zooms in ms (>=200) -->
  data-camera-dolly-lock-depth="-80"> <!-- Tiefe, die während Dolly visuell konstant bleibt -->
</section>
```

Hinweise:
- Dolly-Zoom koppelt Focal und Zoom gegenläufig, um eine Ebene in konstanter Tiefe zu „fixieren“.
- Wird `data-camera-dolly-dur` gesetzt, startet beim Section-Wechsel ein filmischer Dolly-Zoom; Zielzoom wird automatisch angepasst, um Rücksprünge zu vermeiden.
- `data-camera-shake` erzeugt kurzzeitig ein dynamisches Wackeln, das automatisch ausfadet.

## 🎛️ JavaScript API

### Basis-Funktionen
```js
const particleSystem = initParticles(dependencies);

// Farbe setzen
particleSystem.setColor('rgba(255, 100, 150, 0.8)');

// Gradient-Modus
particleSystem.setGradientMode('radial'); // 'linear' | 'radial'

// Alpha-Verstärkung
particleSystem.setAlphaScale(1.5); // 0.2 - 2.0
```

### Erweiterte Features
```js
// Partikeltypen
particleSystem.setParticleTypes({
  circle: 3,
  star: 1,
  pulse: 1,
  triangle: 1
});

// Physik
particleSystem.setGravity(0, 0.001);       // x, y
particleSystem.setCollisions(true);        // boolean
particleSystem.setBounce(true);            // boolean
particleSystem.setQuadTree(true);          // boolean

// Debug & Sichtbarkeit
particleSystem.setDebug(true);             // boolean
particleSystem.setShowConnections(false);  // boolean
particleSystem.setShowParticles(true);     // boolean
```

### Statistiken abrufen
```js
const stats = particleSystem.getStats();
console.log(stats);
// {
//   fps: 60.2,
//   count: 85,
//   mouseActive: true,
//   mouseMode: 'attract',
//   debugMode: false,
//   useQuadTree: true,
//   useOffscreen: false,
//   enableCollisions: true,
//   bounceEnabled: false,
//   particleTypes: { circle: 60, star: 20, pulse: 5 }
// }
```

## 🎨 CSS-Variablen

```css
.global-particle-background {
  --particle-color: rgba(9, 139, 255, 0.8);
  --particle-opacity: 0.4;
  --particle-alpha-scale: 1;
  --particle-connection-opacity: 1;
  --particle-opacity-scale: 1;
}
```

## 🔧 Fehlerbehebung

### Canvas-Fehler
```js
// Robuste Initialisierung
try {
  const cleanup = initParticles(deps);
} catch (error) {
  console.warn('Particle system failed:', error);
}
```

### Performance-Probleme
```html
<!-- Reduzierte Partikel für langsamere Geräte -->
<div data-particle-quadtree="false"
     data-particle-collisions="false"
     data-particle-types='{"circle":1}'>
```

### Debug-Modus
```html
<!-- Vollständiges Debug-Setup -->
<div data-particle-debug="true"
     data-particle-debug-grid="true">
```

## 🌟 Best Practices

1. **Performance**: Nutze Quad-Tree nur bei >100 Partikeln
2. **Mobile**: Deaktiviere Kollisionen auf Touch-Geräten
3. **Accessibility**: System respektiert `prefers-reduced-motion`
4. **Debugging**: Debug-Modus nur in Development verwenden

## 📊 Performance-Benchmarks

- **Basis-System**: 60+ FPS bei 100 Partikeln
- **Mit Kollisionen**: 45+ FPS bei 100 Partikeln  
- **Quad-Tree**: Skaliert bis 300+ Partikel
- **Mobile**: Adaptive Reduzierung auf 20-40 Partikel

## 🔄 Migration vom alten System

Das neue System ist vollständig rückwärtskompatibel:

```js
// Alt (funktioniert weiterhin)
const cleanup = initParticles(deps);

// Neu (erweiterte Features)
const cleanup = initParticles(deps);
cleanup.setParticleTypes({circle: 2, star: 1});
```

## 🎯 Beispiel-Setups

### Minimalistisch
```html
<div class="global-particle-background">
  <canvas id="particleCanvas"></canvas>
</div>
```

### Interaktiv
```html
<div class="global-particle-background"
     data-particle-types='{"circle":2,"star":1}'>
  <canvas id="particleCanvas"></canvas>
</div>
```

### Vollausstattung
```html
<div class="global-particle-background"
     data-particle-gradient="radial"
     data-particle-types='{"circle":3,"star":1,"pulse":1}'
     data-particle-gravity='{"x":0,"y":0.0005}'
     data-particle-collisions="true"
     data-particle-quadtree="true"
     data-particle-debug="false">
  <canvas id="particleCanvas"></canvas>
</div>
```

---

## Integration im iweb-Projekt

Das System ist bereits vollständig in `main.js` integriert und wird automatisch geladen. Alle Features sind sofort verfügbar ohne zusätzliche Setup-Schritte.
