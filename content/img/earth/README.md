# Earth Textures für Three.js System

## Aktuelle Texturen (NASA-Quellen)

**Pfad:** `/content/img/earth/textures/`

### Produktive Texturen (WebP):

- ✅ `earth_day.webp` - NASA Blue Marble Tag-Textur
- ✅ `earth_night.webp` - NASA Earth at Night
- ✅ `earth_normal.webp` - NASA Topographie Normal Map
- ✅ `earth_bump.webp` - NASA Elevation Bump Map

**Performance:** 513 KB (WebP) vs. 1.249 KB (JPG) - 58.9% Größenreduktion

## Three.js Earth System v5.0.0 Features

Das Three.js System (`/content/webentwicklung/particles/three-earth-system.js`) bietet folgende Features:

### 🌍 Visuelle Features

1. **Multi-Layer Atmosphäre** - Physikalisch basiertes Rayleigh & Mie Scattering
   - Rayleigh-Schicht (blaue Streuung) für realistische Atmosphäre
   - Mie-Schicht (warme Streuung) für Sonnenuntergangs-Effekte
   - Dynamische Shader-Updates basierend auf Sonnen-Position

2. **Ozean-Reflexionen** - Spekulare Highlights auf Ozeanen
   - Phong-Reflexionsmodell mit Sonnenlicht-Synchronisation
   - Automatische Ozean-Erkennung via Textur-Analyse
   - Konfigurierbare Shininess & Intensität

3. **Tag/Nacht-Zyklus** - Automatische oder manuelle Sonnen-Rotation
   - Beschleunigter Zyklus (konfigurierbar: 1x-100x Speed)
   - Stadtlichter synchronisiert mit Nacht-Seite
   - Toggle zwischen Auto/Manual Mode

4. **Meteoritenregen-System** - Erweiterte Shooting-Star-Events
   - Verschiedene Flugbahnen (3 vordefinierte Trajectories)
   - Shower-Events mit erhöhter Frequenz
   - Cooldown-System zur Vermeidung von Spam
   - Fade-out & Trail-Effekte

### 🎮 Interaktive Features

5. **Kamera-Flug-System**
   - `flyToLocation(lat, lon, zoom, duration)` - Fliege zu Koordinaten
   - `flyToPreset(name)` - Preset-Positionen (hero, portfolio, about)
   - Smooth easeInOutCubic Transitions
   - Section-basierte automatische Kamera-Wechsel

6. **Preset-Kamera-Positionen** - Vordefinierte Views für Sections
   - Integration mit IntersectionObserver
   - Konfigurierbare Transition-Duration (Standard: 2s)

## Texture Loading Strategy

Das System lädt Texturen mit automatischem Fallback:

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
- ✅ Dynamic Resolution Scaling (DRS) basierend auf FPS
- ✅ Multi-Layer Atmospheric Scattering (v5.0+)
- ✅ Ocean Specular Reflections (v5.0+)

Details siehe: [`OPTIMIZATIONS.md`](./OPTIMIZATIONS.md)

## Public API (v5.0.0)

```javascript
import { EarthSystemAPI } from "/content/webentwicklung/particles/three-earth-system.js";

// Fliege zu Location (z.B. Berlin)
EarthSystemAPI.flyToLocation(52.52, 13.405, 8, 2.5);

// Aktiviere Tag/Nacht-Zyklus (10x beschleunigt)
EarthSystemAPI.setDayNightCycle(true, 10);

// Triggere Meteoritenregen
EarthSystemAPI.triggerMeteorShower();

// Fliege zu Preset
EarthSystemAPI.flyToPreset("portfolio");

// Konfiguration anpassen
EarthSystemAPI.updateConfig({
  OCEAN: { SPECULAR_INTENSITY: 0.8 },
  DAY_NIGHT_CYCLE: { SPEED_MULTIPLIER: 20 },
});
```

## Quellen

- **NASA Blue Marble:** [Visible Earth](https://visibleearth.nasa.gov/collection/1484/blue-marble)
- **NASA Earth at Night:** [Black Marble](https://earthobservatory.nasa.gov/features/NightLights)
- **Elevation Data:** [NASA SRTM](https://www2.jpl.nasa.gov/srtm/)

---

_Texturen sind hochwertige NASA-Satellitenbilder für realistische Earth-Darstellung._
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
