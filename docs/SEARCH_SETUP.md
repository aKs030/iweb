# Search Cache Setup Guide

## Quick Setup

Die KV Namespaces wurden bereits erstellt und konfiguriert:

- **Production KV ID**: `87763b0924a446fa961f2e500f227af3`
- **Preview KV ID**: `6028ef0f481e4cf3b314c20ee80f06b0`

## Deployment

```bash
npm run push
```

Das war's! Die Search-API ist jetzt mit allen Verbesserungen live.

## Features

✅ Query-Expansion mit Synonymen  
✅ Fuzzy-Matching für Tippfehler  
✅ Verbessertes Relevanz-Scoring  
✅ KV-basiertes Caching (1 Stunde)  
✅ Erweiterte Kategorisierung

## Testing

Nach dem Deployment kannst du die Suche testen:

```bash
# Test mit Synonym
curl -X POST https://abdulkerimsesli.de/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "bilder"}'

# Test mit Tippfehler
curl -X POST https://abdulkerimsesli.de/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "projekkkt"}'
```

## Monitoring

Cache-Performance überwachen:

```bash
# Logs anschauen
wrangler tail

# KV-Einträge auflisten
wrangler kv key list --binding=SEARCH_CACHE
```

Achte auf diese Log-Meldungen:

- `Cache hit for query: ...` → Cache funktioniert
- `Expanded query: ...` → Query-Expansion aktiv

## Weitere Infos

Siehe `docs/SEARCH_IMPROVEMENTS.md` für Details zu allen Features, Performance-Metriken und Troubleshooting.
