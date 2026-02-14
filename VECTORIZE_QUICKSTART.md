# Vectorize Hybrid Search - Quick Start

Schnellanleitung zur Einrichtung der verbesserten Suche.

## Was wurde erstellt?

✅ **Vectorize Index Setup** (`scripts/setup-vectorize.sh`)
✅ **Website Crawler** (`scripts/crawler.js`)
✅ **Vectorize Indexer** (`scripts/indexer.js`)
✅ **Hybrid Search API** (`functions/api/search-hybrid.js`)
✅ **Konfiguration** (`wrangler.toml` aktualisiert)
✅ **NPM Scripts** (`package.json` aktualisiert)
✅ **Dokumentation** (`docs/VECTORIZE_SETUP.md`)

## Nächste Schritte

### 1. Dependencies installieren

```bash
npm install
```

### 2. Vectorize Index erstellen

```bash
npm run vectorize:setup
```

Dies erstellt den Index `website-search-index` in deinem Cloudflare Account.

### 3. Vectorize Bindings aktivieren

Entferne die Kommentare in `wrangler.toml`:

```toml
# Zeile ~10
[[vectorize]]
binding = "VECTORIZE"
index_name = "website-search-index"

# Zeile ~30 (Production)
[[env.production.vectorize]]
binding = "VECTORIZE"
index_name = "website-search-index"

# Zeile ~45 (Preview)
[[env.preview.vectorize]]
binding = "VECTORIZE"
index_name = "website-search-index"
```

### 4. Umgebungsvariablen setzen

```bash
export CLOUDFLARE_ACCOUNT_ID="deine-account-id"
export CLOUDFLARE_API_TOKEN="dein-api-token"
```

**Account ID finden:**

- Cloudflare Dashboard → Rechte Sidebar → Account ID

**API Token erstellen:**

- Cloudflare Dashboard → My Profile → API Tokens → Create Token
- Permissions: Workers AI (Edit) + Vectorize (Edit)

### 5. Content crawlen und indexieren

```bash
npm run vectorize:full
```

Das dauert ca. 1-2 Minuten für ~20 Seiten.

### 6. Deployen

```bash
npm run push
```

## ⚠️ Wichtig: Reihenfolge beachten!

**Du musst den Vectorize Index ERST erstellen (Schritt 2), BEVOR du die Bindings in wrangler.toml aktivierst (Schritt 3)!**

Sonst schlägt das Deployment mit diesem Fehler fehl:

```
Error: No index was found with name 'website-search-index'
```

Die Bindings sind aktuell auskommentiert, damit das Deployment funktioniert. Nach dem Index-Setup kannst du sie aktivieren.

## Hybrid Search testen

Nach dem Deployment ist die Hybrid-API verfügbar unter:

```
POST https://abdulkerimsesli.de/api/search-hybrid
```

## Frontend umstellen (optional)

Um die Hybrid-Suche im Frontend zu nutzen, ändere in `content/components/search/search.js` Zeile ~295:

```javascript
const response = await fetch('/api/search-hybrid', {  // statt /api/search
```

## Aktuelles Problem diagnostizieren

Die Debug-Logs in `/api/search` sind bereits aktiv. Überprüfe die Cloudflare Pages Logs:

1. Cloudflare Dashboard → dein Projekt
2. Functions → Logs
3. Führe eine Suche durch
4. Schaue dir die Logs an

Die Logs zeigen:

- Was AI Search Beta zurückgibt
- Wie viele Ergebnisse gefunden werden
- Wo Ergebnisse verloren gehen

## Vorteile der Hybrid-Suche

- ✅ Präzisere Ergebnisse durch Embeddings
- ✅ Volle Kontrolle über Indexierung
- ✅ Schnellere Antwortzeiten (<100ms)
- ✅ AI-Zusammenfassungen bleiben erhalten
- ✅ Kostenlos für deine Website-Größe

## Hilfe

Vollständige Dokumentation: `docs/VECTORIZE_SETUP.md`
