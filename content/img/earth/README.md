# Earth Textures für Three.js System

## Aktuelle Texturen (NASA-Quellen)

**Pfad:** `/content/img/earth/textures/`

### Produktive Texturen:
- ✅ `earth_day.jpg` (463KB) - NASA Blue Marble Tag-Textur
- ✅ `earth_night.jpg` (255KB) - NASA Earth at Night  
- ✅ `earth_normal.jpg` (337KB) - NASA Topographie Normal Map
- ✅ `earth_bump.jpg` (223KB) - NASA Elevation Bump Map

**Status:** Alle Texturen erfolgreich geladen und im Three.js System aktiv.

## Texture Loading Strategy

Das Three.js System lädt Texturen mit automatischem Fallback:

1. **High Performance (LOD 1):** Alle 4 Texturen für Shader-Material
2. **Medium Performance (LOD 2):** Nur Day + Normal für Standard-Material  
3. **Low Performance (LOD 3):** Nur Day-Textur
4. **Fallback:** Prozedurales Material wenn keine Texturen verfügbar

## Performance Monitoring

```javascript
// Texture Loading wird überwacht:
- Timeout: 2s pro Textur
- Fallback: Automatisch zu prozeduralem Material
- Logging: Detaillierte Load-Statistiken verfügbar
```

## Quellen

- **NASA Blue Marble:** [Visible Earth](https://visibleearth.nasa.gov/collection/1484/blue-marble)
- **NASA Earth at Night:** [Black Marble](https://earthobservatory.nasa.gov/features/NightLights)
- **Elevation Data:** [NASA SRTM](https://www2.jpl.nasa.gov/srtm/)

---

*Texturen sind hochwertige NASA-Satellitenbilder für realistische Earth-Darstellung.*
```

### JPEG Fallbacks:
```bash
# Für ältere Browser
convert earth_8k.jpg -resize 1024x512 -quality 85 earth_day.jpg
convert earth_night_8k.jpg -resize 1024x512 -quality 80 earth_night.jpg
```

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