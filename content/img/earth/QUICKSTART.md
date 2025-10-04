# 🚀 Quick Start: Three.js Earth v5.0 Features

Schnelle Anleitung zur Nutzung der neuen Advanced Rendering Features.

---

## ⚡ Sofort-Aktivierung

### Option 1: Vollständig aktivieren (High-End Desktop)

In `/content/webentwicklung/particles/three-earth-system.js`:

```javascript
CONFIG.VOLUMETRIC_CLOUDS = {
  ENABLED: true, // Aktiviert volumetrische Wolken
  LAYERS: 3,
  // ... rest bleibt default
}
```

Das war's! Atmospheric Scattering und Ocean Reflections sind automatisch aktiv.

---

## 🎛️ Feintuning

### Performance vs Quality Balance

**Desktop High-End (60+ FPS):**
```javascript
CONFIG.ATMOSPHERE.SAMPLES = 16;
CONFIG.ATMOSPHERE.LIGHT_SAMPLES = 8;
CONFIG.VOLUMETRIC_CLOUDS.ENABLED = true;
CONFIG.VOLUMETRIC_CLOUDS.LAYERS = 3;
CONFIG.VOLUMETRIC_CLOUDS.OCTAVES = 3;
```

**Desktop Mid-Range (30-60 FPS):**
```javascript
CONFIG.ATMOSPHERE.SAMPLES = 12;
CONFIG.ATMOSPHERE.LIGHT_SAMPLES = 6;
CONFIG.VOLUMETRIC_CLOUDS.ENABLED = true;
CONFIG.VOLUMETRIC_CLOUDS.LAYERS = 2;
CONFIG.VOLUMETRIC_CLOUDS.OCTAVES = 2;
```

**Laptop/Mobile (< 30 FPS):**
```javascript
// Features werden automatisch deaktiviert!
// Fallback zu Classic Mode (2D Clouds, Basic Atmosphere)
CONFIG.VOLUMETRIC_CLOUDS.ENABLED = false;
```

---

## 🎨 Visuelle Anpassungen

### Atmospheric Scattering Farbe

```javascript
// Mehr Blau → Kühlerer Himmel
CONFIG.ATMOSPHERE.RAYLEIGH_COEFFICIENT = [8.0e-6, 15.0e-6, 25.0e-6];

// Weniger Blau → Wärmerer Himmel
CONFIG.ATMOSPHERE.RAYLEIGH_COEFFICIENT = [4.0e-6, 10.0e-6, 18.0e-6];
```

### Cloud Density & Coverage

```javascript
// Dichtere Wolken
CONFIG.VOLUMETRIC_CLOUDS.DENSITY = 0.6;
CONFIG.VOLUMETRIC_CLOUDS.COVERAGE = 0.7;

// Lockere, verstreute Wolken
CONFIG.VOLUMETRIC_CLOUDS.DENSITY = 0.3;
CONFIG.VOLUMETRIC_CLOUDS.COVERAGE = 0.4;
```

### Ocean Specular Intensity

```javascript
// Stärkere Reflexionen (Sonnenuntergang-Look)
CONFIG.OCEAN.SPECULAR_INTENSITY = 2.5;
CONFIG.OCEAN.SPECULAR_POWER = 256.0; // Schärfere Highlights

// Subtilere Reflexionen
CONFIG.OCEAN.SPECULAR_INTENSITY = 1.0;
CONFIG.OCEAN.SPECULAR_POWER = 64.0; // Weichere Highlights
```

---

## 🔧 Debugging

### Performance-Monitor aktivieren

Bereits automatisch aktiv! Overlay zeigt:
- FPS (real-time)
- Memory (geometries/textures)
- Render Calls
- Current Pixel Ratio

### Console-Logging

```javascript
?debug=true // URL-Parameter
// oder
localStorage.setItem("iweb-debug", "true");
```

Logs zeigen:
```
[threeEarthSystem] Advanced atmospheric scattering created successfully
[threeEarthSystem] Ocean specular reflections layer created successfully
[threeEarthSystem] Created 3 volumetric cloud layers
```

### Feature-Status prüfen

```javascript
// In Browser Console:
console.log(scatteringAtmosphere); // null = disabled, Object = enabled
console.log(oceanSpecularMesh);
console.log(volumetricCloudLayers.length); // 0 = disabled, 1-5 = enabled
```

---

## 🐛 Troubleshooting

### "Keine sichtbaren Effekte"

1. **Check Config:**
   ```javascript
   console.log(CONFIG.VOLUMETRIC_CLOUDS.ENABLED); // sollte true sein
   ```

2. **Check Performance:**
   - Features werden bei FPS < 50 automatisch deaktiviert auf Mobile
   - Schaue auf Performance-Overlay FPS

3. **Browser-Kompatibilität:**
   - Benötigt WebGL 1.0+ (alle modernen Browser)
   - Shader-Compilation-Errors in Console prüfen

### "Performance zu niedrig"

1. **Reduziere Samples:**
   ```javascript
   CONFIG.ATMOSPHERE.SAMPLES = 8; // von 16
   CONFIG.ATMOSPHERE.LIGHT_SAMPLES = 4; // von 8
   ```

2. **Weniger Cloud-Layers:**
   ```javascript
   CONFIG.VOLUMETRIC_CLOUDS.LAYERS = 1; // von 3
   CONFIG.VOLUMETRIC_CLOUDS.OCTAVES = 2; // von 3
   ```

3. **Komplette Deaktivierung:**
   ```javascript
   CONFIG.VOLUMETRIC_CLOUDS.ENABLED = false;
   ```

### "WebGL Context Loss"

- Normalerweise auto-recovery durch System
- Check Browser Console für Speicher-Errors
- Reduziere `PIXEL_RATIO` in CONFIG.PERFORMANCE

---

## 📊 A/B Vergleich

### Vorher (v4.1) vs Nachher (v5.0)

**Visuelle Verbesserungen:**
- ✅ Atmosphäre: Basic Fresnel Glow → Physikalisch korrekte Streuung
- ✅ Wolken: Statische 2D-Textur → Dynamische 3D-Procedural
- ✅ Ozean: Flat Textur → Realistische Sonnenreflexionen

**Performance:**
- Desktop: 60 FPS → 38-45 FPS (mit allen Features)
- Mobile: Auto-fallback zu v4.1 classic mode

**Aktivierung:**
```javascript
// v4.1 Classic Mode (Best Performance)
CONFIG.VOLUMETRIC_CLOUDS.ENABLED = false;

// v5.0 Full Mode (Best Quality)
CONFIG.VOLUMETRIC_CLOUDS.ENABLED = true;
```

---

## 🎯 Best Practices

### 1. Progressive Enhancement

Starte mit Classic Mode, aktiviere Features schrittweise:

```javascript
// Step 1: Nur Ocean Reflections (minimal overhead)
CONFIG.VOLUMETRIC_CLOUDS.ENABLED = false;

// Step 2: + Atmospheric Scattering (medium impact)
// Automatisch aktiv, reduziere samples wenn nötig

// Step 3: + Volumetric Clouds (high impact)
CONFIG.VOLUMETRIC_CLOUDS.ENABLED = true;
CONFIG.VOLUMETRIC_CLOUDS.LAYERS = 1; // Start klein

// Step 4: Full Quality
CONFIG.VOLUMETRIC_CLOUDS.LAYERS = 3;
CONFIG.VOLUMETRIC_CLOUDS.OCTAVES = 3;
```

### 2. User-Device Detection

```javascript
// Bereits implementiert! System erkennt automatisch:
// - Mobile vs Desktop
// - High vs Low Pixel Ratio
// - Real-time FPS

// Du musst nichts tun - Auto-Quality funktioniert out-of-the-box
```

### 3. Live Parameter-Tuning (Development)

```javascript
// In Browser Console (während System läuft):

// Atmospheric Scattering
scatteringAtmosphere.material.uniforms.uMieCoeff.value = 30e-6;

// Cloud Density
volumetricCloudLayers[0].material.uniforms.uDensity.value = 0.8;

// Ocean Power
oceanSpecularMesh.material.uniforms.uSpecularPower.value = 512.0;
```

---

## 📚 Weiterführende Docs

- **Full Feature Documentation:** [`ADVANCED_FEATURES.md`](./ADVANCED_FEATURES.md)
- **Performance Optimization:** [`OPTIMIZATIONS.md`](./OPTIMIZATIONS.md)
- **Texture Details:** [`README.md`](./README.md)

---

**Quick Start Version:** 1.0  
**Compatible with:** Three.js Earth System v5.0.0+  
**Last Updated:** 4. Oktober 2025
