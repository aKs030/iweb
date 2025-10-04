# Earth Textures für Three.js System

## 🎨 Three.js Earth System v5.0.0

Das Earth System wurde mit **Advanced Rendering Features** erweitert!

### Neue High-End Features:
- 🌅 **Rayleigh/Mie Atmospheric Scattering** - Physikalisch korrekte Atmosphäre
- ☁️ **Volumetric 3D Clouds** - Multi-Layer volumetrische Wolken mit Simplex Noise
- 🌊 **Ocean Specular Reflections** - Fresnel-basierte Sonnenreflexionen

📖 **Vollständige Dokumentation:** [`ADVANCED_FEATURES.md`](./ADVANCED_FEATURES.md)

---

## Aktuelle Texturen (NASA-Quellen)

**Pfad:** `/content/img/earth/textures/`

### Produktive Texturen (WebP):

- ✅ `earth_day.webp` - NASA Blue Marble Tag-Textur (auch als Ocean-Mask für Reflections)
- ✅ `earth_night.webp` - NASA Earth at Night
- ✅ `earth_normal.webp` - NASA Topographie Normal Map
- ✅ `earth_bump.webp` - NASA Elevation Bump Map

**Performance:** 513 KB (WebP) vs. 1.249 KB (JPG) - 58.9% Größenreduktion

## Texture Loading Strategy

Das Three.js System (`/content/webentwicklung/particles/three-earth-system.js`) lädt Texturen mit automatischem Fallback:

1. **High Performance (LOD 1):** Alle 4 Texturen für Shader-Material
2. **Medium Performance (LOD 2):** Nur Day + Normal für Standard-Material
3. **Low Performance (LOD 3):** Nur Day-Textur
4. **Fallback:** Prozedurales Material wenn keine Texturen verfügbar

**Timeout:** 2s pro Textur mit automatischem Fallback

## Performance Features

- ✅ WebP-Format mit JPEG-Fallback (Browser-Kompatibilität)
- ✅ GPU-Optimierungen (`StaticDrawUsage`, `frustumCulled`)
- ✅ LOD-basiertes Textur-Loading
- ✅ Touch-Gesten (Pinch-to-Zoom, Drag-Rotation)
- ✅ Smooth Inertia/Dampening (0.95)
- ✅ Shooting Stars Animation
- ✨ **NEW:** Adaptive Shader Quality (Auto-disable auf Mobile)
- ✨ **NEW:** Dynamic Resolution Scaling (FPS-based)
- ✨ **NEW:** Multi-Layer Cloud System mit Parallax

Details siehe: [`OPTIMIZATIONS.md`](./OPTIMIZATIONS.md) & [`ADVANCED_FEATURES.md`](./ADVANCED_FEATURES.md)

## Quellen

- **NASA Blue Marble:** [Visible Earth](https://visibleearth.nasa.gov/collection/1484/blue-marble)
- **NASA Earth at Night:** [Black Marble](https://earthobservatory.nasa.gov/features/NightLights)
- **Elevation Data:** [NASA SRTM](https://www2.jpl.nasa.gov/srtm/)

---

_Texturen sind hochwertige NASA-Satellitenbilder für realistische Earth-Darstellung._

### Basis Texture (für WebGL Fallback):

```bash
# Sehr kleine Grundtextur für prozedurales Material
cwebp -q 70 -resize 256 128 earth_basic.jpg -o earth_basic.webp
```

## Performance Level Texturen:

### High Performance (Desktop):

- Resolution: 2048x1024
- Format: WebP mit Q85-90
- Normal Maps: Aktiviert
- Night Textures: Aktiviert

### Medium Performance (Tablet):

- Resolution: 1024x512
- Format: WebP mit Q80-85
- Normal Maps: Optional
- Night Textures: Deaktiviert

### Low Performance (Mobile):

- Resolution: 512x256
- Format: WebP mit Q70-75
- Prozedurales Material als Fallback
- Alle zusätzlichen Maps deaktiviert

## Textur-Quellen:

### NASA Earth Observatory:

- Blue Marble: https://visibleearth.nasa.gov/images/57752/blue-marble-land-surface-shallow-water-and-shaded-topography
- Night Lights: https://visibleearth.nasa.gov/images/55167/earths-city-lights

### Alternative Quellen:

- Natural Earth: https://www.naturalearthdata.com/
- USGS: https://www.usgs.gov/
- ESA: https://earth.esa.int/

## MIP-Map Generierung:

Das Three.js System generiert automatisch MIP-Maps für bessere Performance bei verschiedenen Zoom-Stufen.

## Texture Repeat:

- Basis-Texturen: Keine Wiederholung (clamp)
- Detail-Texturen: Wiederholung aktiviert
- Cloud-Texturen: Prozedural generiert

## Optimierungen:

- Anisotropic Filtering: Max 4x (für Performance)
- Texture Filtering: Linear mit MipMaps
- WebGL Texture Compression: Automatisch erkannt
- Progressive Loading: Niedrige Auflösung zuerst

## Debugging:

- Texture Inspector im Browser DevTools
- Three.js Stats für Texture-Memory
- Performance Overlay zeigt aktuelle LOD

## Browser-Unterstützung:

- WebP: Chrome 23+, Firefox 65+, Safari 14+
- JPEG Fallback: Alle Browser
- WebGL: Chrome 9+, Firefox 4+, Safari 5.1+
