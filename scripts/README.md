# Search Scripts

Scripts für Vectorize-basierte semantische Suche.

## Übersicht

1. **setup-vectorize.sh**: Erstellt Vectorize Index
2. **crawler.js**: Crawlt Website-Inhalte
3. **indexer.js**: Generiert Embeddings und indexiert in Vectorize

## Verwendung

### Kompletter Setup

```bash
# 1. Index erstellen
npm run vectorize:setup

# 2. Dependencies installieren
npm install

# 3. Umgebungsvariablen setzen
export CLOUDFLARE_ACCOUNT_ID="deine-account-id"
export CLOUDFLARE_API_TOKEN="dein-api-token"

# 4. Crawlen + Indexieren
npm run vectorize:full
```

### Einzelne Schritte

```bash
# Nur crawlen
npm run vectorize:crawl

# Nur indexieren (benötigt crawled-content.json)
npm run vectorize:index
```

## Dateien

- **crawled-content.json**: Gecrawlte Inhalte (wird generiert)
- **setup-vectorize.sh**: Bash-Script für Index-Erstellung
- **crawler.js**: Node.js Crawler
- **indexer.js**: Node.js Indexer

## Konfiguration

### Crawler (crawler.js)

```javascript
const BASE_URL = 'https://abdulkerimsesli.de';
const PAGES = [
  '/',
  '/projekte',
  // ... weitere Seiten
];
```

### Indexer (indexer.js)

```javascript
const INDEX_NAME = 'website-search-index';
const BATCH_SIZE = 100; // Vektoren pro Batch
```

## Embeddings

- **Modell**: @cf/baai/bge-base-en-v1.5
- **Dimensionen**: 768
- **Metrik**: Cosine Similarity

## Fehlerbehandlung

Beide Scripts loggen Fehler und fahren mit den nächsten Seiten fort.

## Siehe auch

- [VECTORIZE_SETUP.md](../docs/VECTORIZE_SETUP.md) - Vollständige Setup-Anleitung
- [Cloudflare Vectorize Docs](https://developers.cloudflare.com/vectorize/)
