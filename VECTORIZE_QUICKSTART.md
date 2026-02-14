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

### 3. Umgebungsvariablen setzen

```bash
export CLOUDFLARE_ACCOUNT_ID="deine-account-id"
export CLOUDFLARE_API_TOKEN="dein-api-token"
```

**Account ID finden:**

- Cloudflare Dashboard → Rechte Sidebar → Account ID

**API Token erstellen:**

- Cloudflare Dashboard → My Profile → API Tokens → Create Token
- Permissions: Workers AI (Edit) + Vectorize (Edit)

### 4. Content crawlen und indexieren

```bash
npm run vectorize:full
```

Das dauert ca. 1-2 Minuten für ~20 Seiten.

### 5. Deployen

```bash
npm run push
```

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
