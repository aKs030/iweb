# Search API Improvements

## Version 10.0.0 - Enhanced Search Features

### Overview

Die Search-API wurde mit intelligenten Features erweitert, um die Suchqualität und Performance zu verbessern.

## Features

### 1. Query Expansion & Synonyme

Die Suche versteht jetzt semantische Zusammenhänge und erweitert Suchanfragen automatisch:

```javascript
// Beispiele:
"bilder" → erweitert zu: "bilder galerie photos fotos fotografie gallery"
"projekte" → erweitert zu: "projekte projects arbeiten portfolio werke"
"blog" → erweitert zu: "blog artikel posts beiträge articles"
```

**Vorteile:**

- Bessere Trefferquote durch semantisches Verständnis
- Mehrsprachige Suche (Deutsch/Englisch)
- Natürlichere Suchergebnisse

### 2. Fuzzy Matching (Tippfehler-Toleranz)

Levenshtein-Distanz-Algorithmus erkennt Tippfehler automatisch:

```javascript
// Beispiele:
"Projekkkt" → findet "Projekte"
"Galerie" → findet "Galerie"
"Kontackt" → findet "Kontakt"
```

**Konfiguration:**

- Wörter ≤4 Zeichen: 1 Zeichen Toleranz
- Wörter >4 Zeichen: 2 Zeichen Toleranz

### 3. Verbessertes Relevanz-Scoring

Ergebnisse werden nach mehreren Faktoren gewichtet:

| Faktor                          | Boost |
| ------------------------------- | ----- |
| Exakte Übereinstimmung im Titel | +10   |
| Übereinstimmung in URL          | +5    |
| Übereinstimmung in Beschreibung | +2    |
| Kürzere URL (wichtigere Seiten) | +0-5  |
| Kategorie-Boost (Projekte)      | +3    |
| Kategorie-Boost (Blog/Gallery)  | +2    |

**Ergebnis:** Relevantere Ergebnisse an erster Stelle

### 4. KV-basiertes Caching

Häufige Suchanfragen werden für 1 Stunde gecached:

```javascript
// Cache-Key-Format:
'search:{query}:{topK}';

// Beispiel:
'search:projekte:10';
```

**Vorteile:**

- Reduzierte AI-API-Kosten
- Schnellere Antwortzeiten (Cache Hit)
- Geringere Latenz für häufige Suchen

**Cache-Headers:**

- `X-Cache: HIT` → Aus Cache
- `X-Cache: MISS` → Neue AI-Suche
- `Cache-Control: public, max-age=3600`

### 5. Erweiterte Kategorisierung

Automatische Kategoriezuweisung basierend auf URL:

```javascript
/projekte/* → "Projekte"
/blog/* → "Blog"
/gallery/* → "Gallery"
/videos/* → "Videos"
/about/* → "About"
/contact/* → "Contact"
```

## Setup

### 1. KV Namespace erstellen

```bash
# Production
wrangler kv:namespace create "SEARCH_CACHE"

# Preview
wrangler kv:namespace create "SEARCH_CACHE" --preview
```

### 2. wrangler.toml aktualisieren

Ersetze `placeholder_id` mit den tatsächlichen KV Namespace IDs:

```toml
[[kv_namespaces]]
binding = "SEARCH_CACHE"
id = "your_actual_kv_id"

[[env.production.kv_namespaces]]
binding = "SEARCH_CACHE"
id = "your_production_kv_id"

[[env.preview.kv_namespaces]]
binding = "SEARCH_CACHE"
id = "your_preview_kv_id"
```

### 3. Deployment

```bash
npm run push
```

## API Response Format

```json
{
  "results": [
    {
      "url": "/projekte",
      "title": "Projekte",
      "category": "Projekte",
      "description": "Meine Web-Entwicklungsprojekte...",
      "score": 15.2
    }
  ],
  "summary": "Hier sind die Projekte von Abdulkerim...",
  "count": 5,
  "query": "projekte",
  "expandedQuery": "projekte projects arbeiten portfolio werke"
}
```

## Performance Metrics

### Ohne Cache (MISS)

- Latenz: ~500-1000ms (AI-Suche)
- Kosten: Pro Anfrage

### Mit Cache (HIT)

- Latenz: ~50-100ms (KV-Lookup)
- Kosten: Minimal (nur KV-Read)

### Cache-Hit-Rate (erwartet)

- Häufige Begriffe: 80-90%
- Seltene Begriffe: 10-20%

## Monitoring

### Cache-Statistiken prüfen

```bash
# KV-Einträge auflisten
wrangler kv:key list --binding=SEARCH_CACHE

# Spezifischen Cache-Eintrag lesen
wrangler kv:key get "search:projekte:10" --binding=SEARCH_CACHE
```

### Logs überwachen

```bash
wrangler tail
```

Achte auf:

- `Cache hit for query: ...` → Erfolgreicher Cache-Zugriff
- `Original query: ...` → Ursprüngliche Anfrage
- `Expanded query: ...` → Erweiterte Anfrage mit Synonymen

## Erweiterungsmöglichkeiten

### Weitere Synonyme hinzufügen

Bearbeite `functions/api/_search-utils.js`:

```javascript
export const SYNONYMS = {
  // Bestehende...
  neuer_begriff: ['synonym1', 'synonym2', 'synonym3'],
};
```

### Cache-Dauer anpassen

In `functions/api/search.js`:

```javascript
// Aktuell: 3600 Sekunden (1 Stunde)
isCacheValid(cached, 3600);

// Ändern zu z.B. 2 Stunden:
isCacheValid(cached, 7200);
```

### Relevanz-Scoring anpassen

In `functions/api/_search-utils.js`:

```javascript
// Boost-Werte anpassen:
if (titleLower.includes(queryLower)) {
  score += 10; // Erhöhen für stärkere Titel-Gewichtung
}
```

## Testing

### Manuelle Tests

```bash
# Test ohne Cache
curl -X POST https://abdulkerimsesli.de/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "projekte"}'

# Test mit Tippfehler
curl -X POST https://abdulkerimsesli.de/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "projekkkt"}'

# Test mit Synonym
curl -X POST https://abdulkerimsesli.de/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "bilder"}'
```

### Cache-Header prüfen

```bash
curl -I -X POST https://abdulkerimsesli.de/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "projekte"}'

# Erwartete Header:
# X-Cache: HIT oder MISS
# Cache-Control: public, max-age=3600
```

## Troubleshooting

### Cache funktioniert nicht

1. Prüfe KV Namespace Binding:

   ```bash
   wrangler kv:namespace list
   ```

2. Prüfe wrangler.toml Konfiguration

3. Prüfe Logs:
   ```bash
   wrangler tail
   ```

### Synonyme werden nicht erkannt

1. Prüfe `_search-utils.js` Syntax
2. Teste Query-Expansion isoliert
3. Prüfe Console-Logs für "Expanded query"

### Relevanz-Scoring ungenau

1. Passe Boost-Werte in `calculateRelevanceScore()` an
2. Füge weitere Faktoren hinzu
3. Teste mit verschiedenen Queries

## Migration Notes

### Breaking Changes

Keine Breaking Changes. Die API ist abwärtskompatibel.

### Neue Response-Felder

- `expandedQuery`: Nur wenn Query erweitert wurde
- `X-Cache` Header: Neu für Cache-Monitoring

## Changelog

### v10.0.0 (2026-02-14)

- ✨ Query Expansion mit Synonymen
- ✨ Fuzzy Matching für Tippfehler
- ✨ Verbessertes Relevanz-Scoring
- ✨ KV-basiertes Caching
- ✨ Erweiterte Kategorisierung
- 📝 Umfassende Dokumentation

### v9.0.0 (Previous)

- Cloudflare AI Search Beta Integration
- Basic search functionality
