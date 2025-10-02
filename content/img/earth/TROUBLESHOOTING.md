# 🔧 Troubleshooting Guide - Earth-Grafik Wolken & Atmosphäre

## Problem: Wolken oder Atmosphäre nicht sichtbar

### ✅ Fix Applied (2. Oktober 2025)

**Änderungen:**
1. ✅ **Wolken-Opacity erhöht**: 0.6 → 0.9 (50% sichtbarer)
2. ✅ **Wolken-Frequenz**: 8.0 → 6.0 (größere Wolken)
3. ✅ **Wolken-Threshold**: smoothstep(0.4, 0.7) → (0.3, 0.65) (mehr Wolken)
4. ✅ **Atmosphären-Alpha**: 0.6 → 0.85 (42% sichtbarer)
5. ✅ **Error-Handling** verbessert
6. ✅ **Debug-Logging** hinzugefügt

---

## 🛠️ Schritt-für-Schritt Diagnose

### 1. Browser Console öffnen
```bash
# Chrome/Edge: F12 oder Cmd+Option+I (Mac)
# Firefox: F12 oder Cmd+Option+K (Mac)
```

### 2. Prüfe Three.js Logs

**Erwartete Logs:**
```
[threeEarthSystem] Earth system created with clouds and atmosphere
[threeEarthSystem] Cloud layer created and attached to Earth
[threeEarthSystem] Atmosphere glow created at position: {x: 0, y: -2.8, z: 0}
```

**Fehler-Logs zu prüfen:**
```
❌ "Cloud layer creation failed:" → Shader-Compilation-Error
❌ "Atmosphere glow creation failed:" → Shader-Compilation-Error
❌ "earthMesh not available" → Initialisierungs-Reihenfolge-Problem
```

### 3. WebGL Shader-Fehler prüfen

**Console-Befehle:**
```javascript
// Im Browser Console eingeben:

// Prüfe ob Wolken existieren
const earth = scene.getObjectByName('earthMesh');
const clouds = earth?.getObjectByName('earthClouds');
console.log('Clouds:', clouds);

// Prüfe ob Atmosphäre existiert
const atmosphere = scene.getObjectByName('earthAtmosphere');
console.log('Atmosphere:', atmosphere);

// Prüfe Shader-Material
console.log('Cloud Material:', clouds?.material);
console.log('Atmosphere Material:', atmosphere?.material);
```

### 4. Sichtbarkeits-Checks

**WebGL Renderer Info:**
```javascript
// Im Browser Console:
console.log('Renderer Info:', renderer.info);
// Sollte zeigen: programs: 3+ (Earth, Clouds, Atmosphere, Stars)
```

**Scene Graph:**
```javascript
scene.traverse((obj) => {
  console.log(obj.name, obj.type, obj.visible);
});
// Sollte zeigen:
// - earthMesh Mesh true
// - earthClouds Mesh true (als Child von earthMesh)
// - earthAtmosphere Mesh true
```

---

## 🔍 Häufige Probleme & Lösungen

### Problem 1: "Shader compilation failed"
**Symptom:** Console-Errors mit "GL ERROR"
**Lösung:**
```bash
# WebGL Context-Limit erreicht
# Browser neu starten oder anderen Browser testen
```

### Problem 2: Wolken existieren, aber unsichtbar
**Symptom:** `clouds` Objekt existiert, aber nicht sichtbar
**Diagnose:**
```javascript
// Prüfe Material-Eigenschaften
console.log(clouds.material.opacity); // Sollte > 0 sein
console.log(clouds.material.transparent); // Sollte true sein
console.log(clouds.material.visible); // Sollte true sein
console.log(clouds.visible); // Sollte true sein
```

**Fix:**
```javascript
// Manuell Sichtbarkeit setzen
clouds.material.opacity = 0.9;
clouds.material.needsUpdate = true;
clouds.visible = true;
```

### Problem 3: Atmosphäre zu schwach
**Symptom:** Blauer Glow kaum sichtbar
**Fix:**
```javascript
// Erhöhe Glow-Intensität
const atmo = scene.getObjectByName('earthAtmosphere');
atmo.material.uniforms.glowIntensity.value = 1.2; // Standard: 0.8
atmo.material.uniforms.glowColor.value.set(0x6699ff); // Helleres Blau
```

### Problem 4: Wolken rotieren nicht
**Symptom:** Wolken statisch, keine Animation
**Diagnose:**
```javascript
// Prüfe ob Animation-Loop läuft
console.log('Animation Frame ID:', animationFrameId);
// Sollte nicht null sein
```

**Fix:**
```bash
# Hard-Reload im Browser
# Chrome/Firefox: Cmd+Shift+R (Mac) oder Ctrl+Shift+R (Windows)
```

---

## 🎨 Manuelle Anpassungen (optional)

### Wolken sichtbarer machen
```javascript
// Im Browser Console:
const clouds = scene.getObjectByName('earthMesh').getObjectByName('earthClouds');

// Erhöhe Opacity
clouds.material.uniforms.time.value = 0;
clouds.material.needsUpdate = true;

// Ändere Shader-Parameter (erfordert Reload)
// In three-earth-system.js:
// - smoothstep(0.2, 0.6, clouds) // Noch mehr Wolken
// - alpha = clouds * 1.0 // Maximale Opacity
```

### Atmosphäre intensivieren
```javascript
// Im Browser Console:
const atmo = scene.getObjectByName('earthAtmosphere');

// Stärkerer Glow
atmo.material.uniforms.glowIntensity.value = 1.5;
atmo.material.uniforms.glowColor.value.set(0x88aaff);
```

---

## 📊 Performance-Check

### FPS prüfen
```javascript
// Im Browser Console:
let lastTime = performance.now();
let frameCount = 0;

function checkFPS() {
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    console.log('FPS:', frameCount);
    frameCount = 0;
    lastTime = now;
  }
  requestAnimationFrame(checkFPS);
}
checkFPS();
```

**Erwartete FPS:**
- Desktop: 60 FPS
- Mobile: 30-60 FPS

Wenn FPS < 30: Wolken/Atmosphäre werden möglicherweise automatisch deaktiviert.

---

## 🚀 Quick-Fixes zum Testen

### 1. Hard-Reload
```bash
# Browser Cache leeren
Chrome/Firefox: Cmd+Shift+R (Mac) oder Ctrl+Shift+R (Windows)
```

### 2. WebGL Context neu erstellen
```javascript
// Im Browser Console:
location.reload(true); // Force-Reload mit Cache-Clear
```

### 3. Log-Level erhöhen
```javascript
// In Browser Console VOR Page-Load:
localStorage.setItem('logLevel', 'debug');
location.reload();
```

### 4. Alternativ-Browser testen
```bash
# Falls Chrome Probleme hat:
# - Teste in Firefox
# - Teste in Safari
# - Teste in Edge
```

---

## 📝 Debugging-Checklist

- [ ] Browser Console geöffnet
- [ ] Keine roten Errors sichtbar
- [ ] "Cloud layer created" Log erscheint
- [ ] "Atmosphere glow created" Log erscheint
- [ ] `scene.getObjectByName('earthClouds')` gibt Object zurück
- [ ] `scene.getObjectByName('earthAtmosphere')` gibt Object zurück
- [ ] FPS > 30
- [ ] WebGL Context nicht verloren
- [ ] Hard-Reload durchgeführt

---

## 🆘 Support-Informationen sammeln

Falls das Problem weiterhin besteht, sammle folgende Infos:

```javascript
// Im Browser Console ausführen:
console.log('Browser:', navigator.userAgent);
console.log('WebGL Version:', renderer.capabilities.maxTextures);
console.log('Renderer Info:', renderer.info);
console.log('Scene Children:', scene.children.map(c => c.name));

const earth = scene.getObjectByName('earthMesh');
console.log('Earth Children:', earth?.children.map(c => c.name));
console.log('Clouds Material:', earth?.getObjectByName('earthClouds')?.material);
console.log('Atmosphere Material:', scene.getObjectByName('earthAtmosphere')?.material);
```

---

## ✅ Erfolgreiche Installation prüfen

**Alle Checks sollten ✅ sein:**

```javascript
// Im Browser Console:
const checks = {
  earthExists: !!scene.getObjectByName('earthMesh'),
  cloudsExists: !!scene.getObjectByName('earthMesh')?.getObjectByName('earthClouds'),
  atmosphereExists: !!scene.getObjectByName('earthAtmosphere'),
  animationRunning: !!animationFrameId,
  webGLActive: !!renderer && !renderer.forceContextLoss
};

console.table(checks);
// Sollte alle true zeigen
```

---

**Stand**: 2. Oktober 2025  
**Fix-Version**: v3.0.1  
**Commit**: `06d53ea` - Verbesserte Sichtbarkeit
