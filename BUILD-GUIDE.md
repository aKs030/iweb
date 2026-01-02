# Build & Optimization Guide

Dieses Guide erklärt die Minification, Tree-shaking und Brotli-Kompression für das iweb-Projekt.

## 📦 Build Pipeline

### 1. Minification mit esbuild

```bash
npm run build
```

Dies minifiziert alle kritischen JavaScript-Dateien:

- `content/components/typewriter/TypeWriter.js` (4.89 KiB → ~1.5 KiB)
- `content/components/footer/footer-complete.js` (8.4 KiB → ~2.5 KiB)
- `content/components/particles/three-earth-system.js` (11.10 KiB → ~3.5 KiB)
- `content/main.js` (8.5 KiB → ~2.5 KiB)
- `content/vendor/three/three.module.js` (1.276 MiB → ~390 KiB mit Minification)

**Erwartete Einsparung:** ~3-4 MiB nach Minification und Brotli.

### 2. Brotli-Kompression

```bash
npm run build:brotli
```

Erzeugt `.br`-Dateien für große Assets (Brotli ist 15-20% effizienter als gzip):

- `three.module.js` (1.276 MiB → ~300 KiB with Brotli)
- `TypeWriter.js` (4.89 KiB → ~1.2 KiB)
- `footer-complete.js` (8.4 KiB → ~2.0 KiB)

**Server-Setup erforderlich:** Der Server muss mit `.br`-Dateien konfiguriert sein.

---

## 🌲 Tree-shaking für Three.js

Three.js wird vollständig geladen, aber nur folgende Features werden in der App genutzt:

### Aktuell genutzte Three.js Features:

```javascript
// content/components/particles/earth/scene.js
-THREE.Scene -
  THREE.Sphere -
  THREE.MeshPhongMaterial -
  THREE.PointLight -
  THREE.AmbientLight -
  // content/components/particles/earth/camera.js
  THREE.PerspectiveCamera -
  // content/components/particles/earth/assets.js
  THREE.TextureLoader -
  THREE.Mesh -
  THREE.SphereGeometry -
  // content/components/particles/three-earth-system.js
  THREE.WebGLRenderer -
  THREE.Vector3 -
  THREE.Raycaster;
```

### Optimierungs-Möglichkeiten:

1. **Custom Three.js Build** (empfohlen):

   ```bash
   # Herunterladen und nur benötigte Features bauen
   git clone https://github.com/mrdoob/three.js.git
   cd three.js
   npm install
   npm run build -- -- rollup.config.three.js
   ```

2. **Externe Minifier nutzen**:

   - [Terser](https://terser.org/) für aggressive Minification
   - [esbuild](https://esbuild.github.io/) für schnelle Builds

3. **CDN-Version mit Tree-shaking**:
   ```html
   <!-- Statt vollständiger three.module.js nutzen -->
   <script src="https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js"></script>
   ```

---

## 🔧 Server-Konfiguration für Brotli

### Cloudflare Workers

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Prüfe ob Client Brotli akzeptiert
    const acceptEncoding = request.headers.get("accept-encoding") || "";

    if (acceptEncoding.includes("br")) {
      const brPath = url.pathname + ".br";
      const brResponse = await fetch(brPath);
      if (brResponse.ok) {
        return new Response(brResponse.body, {
          headers: {
            "Content-Encoding": "br",
            "Content-Type": "application/javascript",
            Vary: "Accept-Encoding",
            ...brResponse.headers,
          },
        });
      }
    }

    return fetch(request);
  },
};
```

### Nginx

```nginx
gzip on;
gzip_types application/javascript text/css text/plain;
gzip_static on;
gzip_vary on;

# Oder für Brotli:
brotli on;
brotli_comp_level 11;
brotli_types application/javascript text/css text/plain;
```

### Apache

```apache
<FilesMatch "\.js\.br$">
  Header set Content-Encoding br
  Header set Content-Type "application/javascript"
  Header set Vary "Accept-Encoding"
</FilesMatch>

<FilesMatch "\.css\.br$">
  Header set Content-Encoding br
  Header set Content-Type "text/css"
  Header set Vary "Accept-Encoding"
</FilesMatch>
```

---

## 📊 Performance-Metriken

### Vor Optimierung

- **three.module.js**: 1.276 MiB (unminified)
- **Gesamtes JS**: ~5-6 MiB
- **Estimated LCP**: ~1200 ms

### Nach Minification

- **three.module.js**: ~390 KiB (esbuild)
- **Gesamtes JS**: ~1.2 MiB
- **Improvement**: ~70% Größenreduktion

### Nach Brotli-Kompression

- **three.module.js**: ~300 KiB (over-the-wire)
- **Gesamtes JS**: ~500 KiB
- **Improvement**: ~80% Größenreduktion

### Nach Tree-shaking (potenzial)

- **three.module.js**: ~150-200 KiB (custom build)
- **Improvement**: ~85% Größenreduktion

---

## 🚀 Deployment Checklist

- [ ] `npm run build` lokal ausführen
- [ ] `npm run build:brotli` um .br-Dateien zu erzeugen
- [ ] `npm run dev` testen um sicherzustellen, dass alles funktioniert
- [ ] `.br`-Dateien mit originalem Code zu Production hochladen
- [ ] Server für Brotli-Content-Encoding konfigurieren
- [ ] Lighthouse/PageSpeed neuerdings überprüfen
- [ ] Real User Monitoring (RUM) überprüfen für echte Metriken

---

## 📝 Troubleshooting

### Build schlägt fehl: "esbuild not found"

```bash
npm install
npm run build
```

### Browser lädt .br-Datei als Download statt zu dekomprimieren

→ Server sendet nicht `Content-Encoding: br` Header. Siehe Server-Konfiguration oben.

### Minified Code funktioniert nicht richtig

- Überprüfe dass alle `export` Statements korrekt sind
- Nutze `--sourcemap` Option beim Build für Debugging
- Überprüfe Browser Console auf Fehler

### Three.js wird nicht geladen

```javascript
// Debug: Prüfe ob THREE global verfügbar ist
console.log(window.THREE);
```

---

## 📚 Weitere Ressourcen

- [esbuild Dokumentation](https://esbuild.github.io/)
- [Brotli Kompression](https://en.wikipedia.org/wiki/Brotli)
- [Three.js Build Anleitung](https://threejs.org/docs/#manual/en/introduction/Installation)
- [Performance Budgets](https://web.dev/performance-budget-101/)
