# Cloudflare Pages Setup

## Build-Konfiguration (WICHTIG!)

Da das Projekt **KEIN Build-System** mehr nutzt, muss die Cloudflare Pages Build-Konfiguration angepasst werden.

### Schritt-für-Schritt Anleitung

#### 1. Cloudflare Dashboard öffnen

```
https://dash.cloudflare.com/
```

#### 2. Projekt auswählen

- Account: `652ca9f4abc93203c1ecd059dc00d1da`
- Projekt: `1web`
- Domain: `abdulkerimsesli.de`

#### 3. Build Settings anpassen

Navigiere zu: **Settings** → **Builds & deployments**

**Build configuration:**

```
Framework preset:        None
Build command:           (leer lassen)
Build output directory:  /
Root directory:          (leer lassen)
Node version:            18 (oder höher)
```

**WICHTIG - Build output directory:**

- Setze auf `/` (Root-Verzeichnis)
- NICHT `.` (Punkt) oder `dist`
- Das bedeutet: Cloudflare deployed alle Dateien aus dem Repository-Root

- Build command MUSS leer sein oder `echo "No build needed"`
- Build output directory MUSS `.` sein (aktuelles Verzeichnis)

#### 4. Environment Variables prüfen

**Production Environment:**

- `MAX_SEARCH_RESULTS` → Wird aus `wrangler.toml` geladen
- `GROQ_API_KEY` → Secret (bereits gesetzt)

**Keine weiteren Variablen nötig!**

#### 5. Bindings prüfen

Sollten automatisch aus `wrangler.toml` geladen werden:

- **AI Binding**: `AI`
- **R2 Bucket**: `GALLERY_BUCKET` → `img`

#### 6. Deployment testen

Nach dem Speichern:

1. Gehe zu **Deployments**
2. Klicke auf **Retry deployment** (falls letzter Build fehlgeschlagen)
3. Oder: Push auf GitHub → automatisches Deployment

**Erwartetes Ergebnis:**

```
✓ Cloning repository
✓ Installing dependencies (npm install)
✓ No build command - skipping
✓ Deploying to Cloudflare Pages
✓ Success!
```

### Troubleshooting

**Problem: "Build failed - dist directory not found"**

- Lösung: Build output directory auf `.` setzen

**Problem: "npm run build failed"**

- Lösung: Build command leer lassen

**Problem: "Functions not working"**

- Lösung: Prüfe ob `functions/` Ordner deployed wurde
- Prüfe Bindings in Settings

**Problem: "AI Search not working"**

- Lösung: Prüfe AI Binding in `wrangler.toml`
- Prüfe ob AI Search Instance `wispy-pond-1055` existiert

### Deployment-Logs prüfen

1. Gehe zu **Deployments**
2. Klicke auf den neuesten Deployment
3. Prüfe die Logs:
   - ✓ "Cloning repository" → GitHub Connection OK
   - ✓ "Installing dependencies" → npm install OK
   - ✓ "No build command" → Kein Build (gewünscht!)
   - ✓ "Deploying" → Files werden kopiert
   - ✓ "Success" → Deployment erfolgreich

### Wichtige URLs

- **Dashboard**: https://dash.cloudflare.com/652ca9f4abc93203c1ecd059dc00d1da/pages/view/1web
- **Production**: https://abdulkerimsesli.de
- **AI Search**: https://dash.cloudflare.com/652ca9f4abc93203c1ecd059dc00d1da/ai/ai-search/wispy-pond-1055

### Nächste Schritte

Nach erfolgreicher Konfiguration:

1. Push auf GitHub
2. Warte auf automatisches Deployment (~2-3 Minuten)
3. Teste die Website: https://abdulkerimsesli.de
4. Teste AI Search und Robot Chat

Fertig! 🚀
