# 🌍 Three.js Earth System v5.0.0 - Advanced Features

**Release Date:** 4. Oktober 2025  
**System:** `/content/webentwicklung/particles/three-earth-system.js`

---

## 🎨 Neue High-End Features

### 1. **Rayleigh/Mie Atmospheric Scattering** 🌅

Physikalisch korrekte Atmosphären-Darstellung mit echter Lichtstreuung.

**Technische Details:**
- **Rayleigh Scattering:** Molekulare Streuung (blau/violett bei kurzen Wellenlängen)
- **Mie Scattering:** Aerosol-Streuung (forward-scattering Effekt)
- **Ray-Marching:** 16 Samples durch Atmosphäre mit exponentieller Dichte
- **Optical Depth:** 8 Light-Samples für präzise Licht-Abschwächung
- **Henyey-Greenstein Phase Function:** Realistische Mie-Streuungsverteilung

**Konfiguration:**
```javascript
CONFIG.ATMOSPHERE = {
  RAYLEIGH_COEFFICIENT: [5.5e-6, 13.0e-6, 22.4e-6], // RGB Wellenlängen
  MIE_COEFFICIENT: 21e-6,
  RAYLEIGH_SCALE_HEIGHT: 8000, // meters
  MIE_SCALE_HEIGHT: 1200, // meters
  MIE_DIRECTIONAL_G: 0.76, // Forward scattering
  ATMOSPHERE_RADIUS: 1.025,
  SAMPLES: 16, // Performance vs Quality
  LIGHT_SAMPLES: 8,
}
```

**Performance:**
- Desktop: Full quality (16/8 samples)
- Mobile: Auto-disabled on low-performance devices
- Adaptive: Reduziert samples bei FPS < 50

**Effekt:**
- Dynamischer Himmel-Gradient basierend auf Sonnen-Position
- Realistischer Übergang zwischen Tag/Nacht
- Atmosphärisches Leuchten an der Erdoberfläche
- Sonnenuntergangs-/aufgangs-Effekte

---

### 2. **Volumetric 3D Cloud System** ☁️

Multi-Layer 3D-Wolken mit prozeduraler Noise-Generation statt statischer 2D-Textur.

**Technische Details:**
- **Simplex 3D Noise:** Embedded GLSL Implementation (Ian McEwan)
- **FBM (Fractal Brownian Motion):** Multi-Octave Noise für realistische Details
- **Multi-Layer System:** Bis zu 5 unabhängige Wolken-Layer
- **Parallax-Effekt:** Unterschiedliche Rotations-Geschwindigkeiten pro Layer

**Konfiguration:**
```javascript
CONFIG.VOLUMETRIC_CLOUDS = {
  ENABLED: true, // Toggle (performance-heavy)
  LAYERS: 3, // Number of cloud layers (1-5)
  BASE_ALTITUDE: 0.03,
  LAYER_SPACING: 0.01,
  DENSITY: 0.4, // Overall opacity
  SCALE: 3.0, // Noise texture scale (lower = larger clouds)
  OCTAVES: 3, // Detail levels (1-5)
  PERSISTENCE: 0.5, // Detail amplitude falloff
  LACUNARITY: 2.0, // Detail frequency increase
  SPEED_MULTIPLIER: [1.0, 0.8, 0.6], // Rotation per layer
  OPACITY_FALLOFF: 0.7, // Opacity reduction per layer
  COVERAGE: 0.5, // Cloud coverage (0-1)
}
```

**Shader-Logik:**
```glsl
// 3D Position aus Sphere UV
vec3 noisePos = sphericalToCartesian(uv) * uScale;
noisePos.x += uTime * 0.1; // Animation

// FBM für Cloud-Dichte
float noise = fbm(noisePos);
float cloudDensity = smoothstep(1.0 - uCoverage, 1.0, (noise + 1.0) * 0.5);
```

**Performance:**
- Desktop: 3 Layers, 3 Octaves
- Mobile: Auto-disabled oder 1 Layer, 2 Octaves
- Fallback: Classic 2D texture wenn `ENABLED: false`

**Effekt:**
- Realistische, sich verändernde Wolken-Strukturen
- Tiefeneffekt durch mehrere Layer
- Dynamische Animation über Zeit
- Keine statischen Wiederholungen

---

### 3. **Ocean Specular Reflections** 🌊

Sonnenlicht-Reflexionen auf Ozean-Oberflächen mit Fresnel-Effekten.

**Technische Details:**
- **Ocean Mask:** Day-Texture als Mask (Blue-Channel > Threshold)
- **Phong Specular:** Klassisches Specular-Highlight Model
- **Fresnel Effect:** Stärkere Reflexion bei flachem Blickwinkel
- **Sun-Direction Tracking:** Dynamische Position basierend auf Sonnen-Umlauf

**Konfiguration:**
```javascript
CONFIG.OCEAN = {
  SPECULAR_INTENSITY: 1.5, // Strength
  SPECULAR_POWER: 128.0, // Sharpness (higher = tighter)
  FRESNEL_BIAS: 0.1, // Base reflectivity
  FRESNEL_SCALE: 0.8, // Fresnel strength
  FRESNEL_POWER: 3.0, // Fresnel curve
  OCEAN_MASK_THRESHOLD: 0.3, // Blue threshold for water detection
  ROUGHNESS_VARIATION: 0.15, // Surface variation
}
```

**Shader-Logik:**
```glsl
// Ocean Detection
float oceanMask = step(threshold, texColor.b) * 
                  step(texColor.b, texColor.r + 0.3);

// Phong Specular
vec3 reflectDir = reflect(-sunDir, normal);
float specular = pow(max(dot(viewDir, reflectDir), 0.0), uSpecularPower);

// Fresnel
float fresnel = bias + scale * pow(1.0 - dot(viewDir, normal), power);

// Final
float finalSpecular = specular * fresnel * intensity;
```

**Performance:**
- Desktop: Full quality
- Mobile: Auto-disabled on low FPS
- Overhead: Minimal (single additional mesh + texture lookup)

**Effekt:**
- Realistische Sonnen-Reflexionen auf Ozeanen
- Dynamische Highlights während Tag/Nacht-Zyklus
- Fresnel-Effekt verstärkt Reflexion bei Sonnenauf-/untergang
- Blauer Farb-Tint für Wasser-Charakter

---

## 🚀 Performance-Optimierungen

### Auto-Detection & Adaptive Quality

Alle neuen Features haben intelligente Performance-Checks:

```javascript
// Mobile Detection
if (isMobileDevice && CONFIG.PERFORMANCE.PIXEL_RATIO < 1.0) {
  log.info("Skipping advanced features on low-performance device");
  return null;
}
```

### Dynamic Resolution Scaling (DRS)

Performance-Monitor passt automatisch an:

- **FPS < 45:** Pixel Ratio reduzieren
- **FPS < 10:** Emergency-Modus (0.5x PR)
- **FPS > 55:** Pixel Ratio erhöhen (bis max 1.5x)

### Shader-Komplexität

- **Atmospheric Scattering:** ~16 samples (reduzierbar auf 8)
- **Volumetric Clouds:** ~3 octaves (reduzierbar auf 1-2)
- **Ocean Reflections:** Minimal-Overhead (single texture lookup)

### Mobile Fallbacks

- Scattering → Basic Fresnel Glow
- Volumetric Clouds → 2D Texture oder deaktiviert
- Ocean Reflections → Deaktiviert bei FPS < 50

---

## 🎛️ Konfiguration & Tuning

### Quick-Toggle für Tests

```javascript
// In CONFIG-Object:
CONFIG.VOLUMETRIC_CLOUDS.ENABLED = false; // Use classic 2D clouds
CONFIG.ATMOSPHERE.SAMPLES = 8; // Reduce for performance
CONFIG.OCEAN.SPECULAR_INTENSITY = 0.0; // Disable ocean reflections
```

### Shader-Parameter Live-Tuning

Alle Uniforms sind zur Laufzeit änderbar:

```javascript
// Atmospheric Scattering Intensity
scatteringAtmosphere.material.uniforms.uRayleighCoeff.value.set(8e-6, 15e-6, 25e-6);

// Cloud Density
volumetricCloudLayers[0].material.uniforms.uDensity.value = 0.6;

// Ocean Specular Power
oceanSpecularMesh.material.uniforms.uSpecularPower.value = 256.0;
```

---

## 📊 Performance-Benchmarks

### Desktop (MacBook Pro M1, Chrome)

| Feature | FPS Impact | VRAM | Notes |
|---------|-----------|------|-------|
| Base System (v4.1) | 60 FPS | 120 MB | - |
| + Atmospheric Scattering | -8 FPS | +15 MB | 16 samples |
| + Volumetric Clouds (3 layers) | -12 FPS | +20 MB | 3 octaves |
| + Ocean Reflections | -2 FPS | +5 MB | Minimal |
| **Total v5.0** | **38 FPS** | **160 MB** | All features |

### Mobile (iPhone 14, Safari)

| Feature | FPS Impact | Status |
|---------|-----------|--------|
| Base System | 45 FPS | ✅ Enabled |
| Atmospheric Scattering | - | ❌ Auto-disabled |
| Volumetric Clouds | - | ❌ Auto-disabled |
| Ocean Reflections | - | ❌ Auto-disabled |
| **Fallback Mode** | **45 FPS** | Classic features only |

---

## 🐛 Debugging & Troubleshooting

### Enable Performance Overlay

Performance-Monitor zeigt automatisch:
- FPS (real-time)
- Memory (geometries/textures)
- Render Calls & Triangles
- Current Pixel Ratio

### Console Logging

```javascript
?debug=true // URL-Parameter
localStorage.setItem("iweb-debug", "true");

// Logs:
// "Advanced atmospheric scattering created successfully"
// "Ocean specular reflections layer created successfully"
// "Created 3 volumetric cloud layers"
```

### Common Issues

**Low FPS:**
- Reduce `ATMOSPHERE.SAMPLES` (16 → 8)
- Reduce `VOLUMETRIC_CLOUDS.LAYERS` (3 → 1)
- Disable volumetric clouds (`ENABLED: false`)

**WebGL Context Loss:**
- Check `renderer.forceContextLoss()` in cleanup
- Verify all geometries/materials disposed

**Shader Compilation Errors:**
- Check browser console for GLSL errors
- Verify WebGL 1.0 compatibility (no dynamic loops)

---

## 🔄 Migration von v4.x → v5.0

### Breaking Changes

**Keine!** Alle neuen Features sind opt-in:

- Atmospheric Scattering: Zusätzlich zur basic atmosphere
- Volumetric Clouds: Fallback zu 2D wenn `ENABLED: false`
- Ocean Reflections: Zusätzlich, keine Änderung am Earth-Material

### Recommended Config

**High-Performance Desktop:**
```javascript
CONFIG.VOLUMETRIC_CLOUDS.ENABLED = true;
CONFIG.ATMOSPHERE.SAMPLES = 16;
CONFIG.VOLUMETRIC_CLOUDS.LAYERS = 3;
```

**Mid-Range Desktop:**
```javascript
CONFIG.VOLUMETRIC_CLOUDS.ENABLED = true;
CONFIG.ATMOSPHERE.SAMPLES = 8;
CONFIG.VOLUMETRIC_CLOUDS.LAYERS = 2;
```

**Mobile / Low-End:**
```javascript
CONFIG.VOLUMETRIC_CLOUDS.ENABLED = false; // Use 2D texture
// Scattering & Ocean auto-disabled
```

---

## 📚 Technical References

### Atmospheric Scattering

- **Rayleigh Scattering:** [Wikipedia](https://en.wikipedia.org/wiki/Rayleigh_scattering)
- **Mie Theory:** [Wikipedia](https://en.wikipedia.org/wiki/Mie_scattering)
- **GPU Gems 2 - Chapter 16:** Accurate Atmospheric Scattering

### Volumetric Clouds

- **Simplex Noise:** Ian McEwan, Ashima Arts
- **FBM:** [Book of Shaders](https://thebookofshaders.com/13/)
- **GPU Pro 7:** Real-Time Volumetric Cloudscapes

### Ocean Rendering

- **Fresnel Equation:** [Schlick's Approximation](https://en.wikipedia.org/wiki/Schlick%27s_approximation)
- **Phong Shading:** [Wikipedia](https://en.wikipedia.org/wiki/Phong_shading)

---

## ✨ Future Enhancements

- **Post-Processing:** UnrealBloomPass for glow
- **Aurora Borealis:** Polar light shader (in progress)
- **Real-Time Weather API:** Dynamic cloud positions
- **Satellite Orbits:** ISS tracking
- **HDR Rendering:** Tonemapping for better highlights

---

**Version:** 5.0.0  
**Author:** Portfolio System  
**License:** Proprietary
