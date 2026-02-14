# Vectorize Search Setup

Anleitung zur Einrichtung der Hybrid-Suche mit Vectorize + AI Search Beta.

## Übersicht

Die Hybrid-Suche kombiniert:

- **Vectorize**: Präzise semantische Suche mit Vector-Embeddings
- **AI Search Beta**: RAG-powered Zusammenfassungen

## Vorteile

- Bessere Suchgenauigkeit durch Embeddings
- Volle Kontrolle über Indexierung
- Schnellere Antwortzeiten
- AI-generierte Zusammenfassungen

## Setup-Schritte

### 1. Vectorize Index erstellen

```bash
npm run vectorize:setup
```

Oder manuell:

```bash
npx wrangler vectorize create website-search-index \
  --dimensions=768 \
  --metric=cosine
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Umgebungsvariablen setzen

Für den Indexer benötigst du:

```bash
export CLOUDFLARE_ACCOUNT_ID="deine-account-id"
export CLOUDFLARE_API_TOKEN="dein-api-token"
```

API Token erstellen:

1. Cloudflare Dashboard → My Profile → API Tokens
2. Create Token → Custom Token
3. Permissions:
   - Account → Workers AI → Edit
   - Account → Vectorize → Edit
4. Token kopieren und als `CLOUDFLARE_API_TOKEN` setzen

### 4. Website crawlen

```bash
npm run vectorize:crawl
```

Erstellt `scripts/crawled-content.json` mit allen Seiteninhalten.

### 5. Content indexieren

```bash
npm run vectorize:index
```

Generiert Embeddings und lädt sie in Vectorize hoch.

### 6. Alles in einem Schritt

```bash
npm run vectorize:full
```

Führt Crawling + Indexierung in einem Durchlauf aus.

## API-Endpunkte

### Hybrid Search (empfohlen)

```
POST /api/search-hybrid
```

Nutzt Vectorize für Ergebnisse + AI Search Beta für Zusammenfassung.

### AI Search Beta (aktuell)

```
POST /api/search
```

Nur AI Search Beta (mit Debug-Logging).

## Frontend-Integration

Um die Hybrid-Suche zu nutzen, ändere in `content/components/search/search.js`:

```javascript
// Zeile ~295
const response = await fetch('/api/search-hybrid', {
  // statt /api/search
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query, topK: 20 }),
});
```

## Wartung

### Content aktualisieren

Nach Website-Änderungen:

```bash
npm run vectorize:full
```

### Index löschen

```bash
npx wrangler vectorize delete website-search-index
```

### Index-Status prüfen

```bash
npx wrangler vectorize list
```

## Troubleshooting

### "AI binding not configured"

Stelle sicher, dass `wrangler.toml` das AI-Binding enthält:

```toml
[ai]
binding = "AI"
```

### "VECTORIZE binding not configured"

Stelle sicher, dass `wrangler.toml` das Vectorize-Binding enthält:

```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "website-search-index"
```

### Crawler findet keine Seiten

Überprüfe `BASE_URL` in `scripts/crawler.js` und stelle sicher, dass die Website erreichbar ist.

### Indexer schlägt fehl

Überprüfe:

1. `CLOUDFLARE_ACCOUNT_ID` und `CLOUDFLARE_API_TOKEN` sind gesetzt
2. API Token hat die richtigen Permissions
3. Vectorize Index existiert

## Performance

- **Embeddings**: ~768 Dimensionen pro Seite
- **Indexierung**: ~1-2 Sekunden pro Seite
- **Suche**: <100ms für semantische Suche
- **Cache**: 1 Stunde für Suchergebnisse

## Kosten

- **Vectorize**: Kostenlos bis 5M Vektoren + 30M Abfragen/Monat
- **Workers AI**: Kostenlos bis 10.000 Neurons/Tag
- **KV**: Kostenlos bis 100.000 Reads/Tag

Für deine Website (~20 Seiten) ist alles kostenlos.
