# Particle System

Enhanced particle system with advanced 3D animations, GPU acceleration, and adaptive performance optimization.

## 🌟 Features

### 3D Animation Effects
- **Rotate**: Continuous rotation around multiple axes with depth-based perspective
- **Float**: Gentle floating motion with varying frequencies and depth-based fading
- **Pulse**: Size and opacity pulsing synchronized across 3D space
- **Parallax**: Depth-based movement creating parallax scrolling effects
- **Spiral**: Complex spiral patterns around central axis with height variations

### Performance Optimizations
- **Adaptive Quality**: Automatically adjusts rendering quality based on FPS
- **GPU Acceleration**: Utilizes CSS transforms and hardware acceleration hints
- **Spatial Grid**: Efficient particle collision and connection calculations
- **Frame Rate Monitoring**: Real-time FPS tracking with particle count adaptation

### Cross-Browser Compatibility
- **Feature Detection**: Automatically detects 3D support capabilities
- **Graceful Fallback**: Falls back to 2D mode for unsupported browsers
- **Reduced Motion Support**: Respects `prefers-reduced-motion` settings

## 🚀 Usage

### Basic Usage

```js
import { initParticles } from './particle-system.js';
const stop = initParticles({ getElement, throttle, checkReducedMotion });
```

Rückgabe ist eine Stop/Cleanup Funktion.

### HTML Data Attributes

Enable 3D effects using the `data-3d-effect` attribute:

```html
<!-- 3D-Rotation aktivieren -->
<div class="global-particle-background" data-3d-effect="rotate">
  <canvas id="particleCanvas" class="particle-canvas"></canvas>
</div>

<!-- Parallax-Effekt mit radialem Gradient -->
<div class="global-particle-background" 
     data-3d-effect="parallax" 
     data-particle-gradient="radial">
  <canvas id="particleCanvas" class="particle-canvas"></canvas>
</div>
```

### JavaScript API

Control effects programmatically:

```javascript
// Zugriff auf den 3D-Controller
const bgRoot = document.querySelector('.global-particle-background');
const controller = bgRoot._particle3DController;

// Effekt zur Laufzeit ändern
controller.setEffect('float');

// Konfiguration anpassen
controller.updateConfig({
  rotationSpeed: 0.02,
  floatAmplitude: 30
});
```

### Global Controls

Use global controls for multiple particle systems:

```javascript
// Interaktive Steuerung in der Browser-Konsole
window.particle3DControls.setGlobalEffect("rotate");
window.particle3DControls.setGlobalEffect("spiral");

// Alle Controller abrufen
const controllers = window.particle3DControls.getControllers();
```

## Data-Attribute

### Standard Attributes
- `data-particle-gradient="linear|radial"` Umschaltung Gradient-Modus
- `data-particle-alpha-scale="0.2..2"` Verstärkung/Abschwächung Füll-Alpha
- (indirekt) `data-particle-color` / `data-particle-opacity` -> werden in anderem Code in CSS Variablen überführt

### 3D Effect Attributes
- `data-3d-effect="none|rotate|float|pulse|parallax|spiral"` Aktiviert 3D-Effekte

## CSS Variablen
- `--particle-color` rgba Wert für Partikel & Linien
- `--particle-opacity` Grund-Opacity des Canvas

## Adaptive Faktoren
- Scrollposition reduziert Intensität nach unten hin
- Dichte (Anzahl pro Bucket) moduliert Linien- und Füll-Alpha
- FPS Fenster (20 Samples) passt Partikelanzahl dynamisch an (20..140)
- 3D Quality Adaptation: Passt Rendering-Qualität basierend auf Performance an

## API

### Standard API
- `setColor(rgba)` - Setzt Partikelfarbe
- `setGradientMode(mode)` - Umschaltung zwischen linear/radial
- `setAlphaScale(factor)` - Alpha-Skalierung
- `stop()` - Beendet System und räumt auf

### 3D API
- `set3DEffect(effect)` - Setzt 3D-Effekt
- `get3DController()` - Gibt 3D-Controller zurück

## 🎮 Demo

A comprehensive demo is available at `particle-3d-demo.html` showcasing:
- Interactive effect switching
- Real-time performance statistics
- Configuration examples
- Console commands

## ⚙️ Configuration Options

### 3D Controller Settings

```javascript
const config = {
  perspective: 800,        // 3D perspective distance
  depth: 500,             // Maximum Z-depth range
  rotationSpeed: 0.01,    // Rotation animation speed
  floatAmplitude: 20,     // Float effect amplitude
  floatSpeed: 0.005,      // Float animation speed
  pulseSpeed: 0.008,      // Pulse animation speed
  spiralRadius: 150,      // Spiral effect radius
  spiralSpeed: 0.004,     // Spiral animation speed
  parallaxFactor: 0.3     // Parallax movement intensity
};
```

## Cleanup
Stop-Funktion beendet Loop und Observer und räumt 3D-Controller auf.

## 🧪 Testing

Comprehensive test suite included:

```bash
npm test  # Run all tests including 3D functionality
```

Test coverage includes:
- 3D controller initialization
- Effect management and switching  
- Animation state updates
- Performance adaptation
- 3D transformations and projections

## 🎯 Performance Tips

1. **Adaptive Quality**: The system automatically adjusts quality based on performance
2. **Particle Count**: Automatically scales from 20-140 particles based on FPS
3. **GPU Acceleration**: Uses CSS transforms and `will-change` hints
4. **Reduced Motion**: Automatically disables complex effects when `prefers-reduced-motion` is set

## 🔧 Browser Support

- **Modern Browsers**: Full 3D effects with GPU acceleration
- **Legacy Browsers**: Graceful fallback to 2D mode
- **Mobile Devices**: Adaptive performance optimization
