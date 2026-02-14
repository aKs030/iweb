# Cloudflare AI Search Beta - Setup & Re-Crawling

## Aktuelles Problem

Die Cloudflare AI Search Beta (`wispy-pond-1055`) indexiert:

- Duplikate (mehrere Chunks der gleichen Seite)
- Rohe Metadaten (JSON-LD, strukturierte Daten)
- Menü-Texte und Footer-Inhalte

## Lösung: Re-Crawling durchführen

### Schritt 1: Im Cloudflare Dashboard

1. Gehe zu [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigiere zu **AI** → **AI Search Beta**
3. Wähle dein Projekt `wispy-pond-1055`
4. Klicke auf **Settings** oder **Manage**
5. Wähle **Re-crawl** oder **Delete & Re-index**

### Schritt 2: Crawling-Einstellungen optimieren

Im AI Search Beta Dashboard:

**Crawl Settings:**

- **Start URL**: `https://www.abdulkerimsesli.de/`
- **Max Pages**: 50-100 (je nach Bedarf)
- **Crawl Depth**: 3
- **Respect robots.txt**: ✅ Enabled

**Content Extraction:**

- **Extract main content only**: ✅ Enabled
- **Ignore navigation**: ✅ Enabled
- **Ignore footer**: ✅ Enabled
- **Ignore scripts**: ✅ Enabled

### Schritt 3: Warten auf Re-Crawl

Der Crawl-Prozess dauert ca. 5-15 Minuten. Du kannst den Status im Dashboard verfolgen.

## Alternative: Manuelle Konfiguration via API

Falls du die Cloudflare API nutzen möchtest:

```bash
# 1. Hole deine Account ID und API Token
ACCOUNT_ID="your-account-id"
API_TOKEN="your-api-token"
PROJECT_ID="wispy-pond-1055"

# 2. Trigger Re-Crawl
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/search/${PROJECT_ID}/recrawl" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json"

# 3. Check Status
curl -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/search/${PROJECT_ID}/status" \
  -H "Authorization: Bearer ${API_TOKEN}"
```

## Optimierungen für besseres Crawling

### 1. Semantic HTML verwenden

Stelle sicher, dass alle Seiten `<main>`, `<article>`, `<section>` Tags nutzen:

```html
<main id="main-content">
  <article>
    <h1>Hauptinhalt</h1>
    <p>Relevanter Text...</p>
  </article>
</main>
```

### 2. Meta-Tags optimieren

Jede Seite sollte haben:

```html
<meta name="description" content="Kurze, präzise Beschreibung" />
<meta property="og:description" content="Kurze, präzise Beschreibung" />
```

### 3. Strukturierte Daten minimieren

Reduziere JSON-LD auf das Nötigste oder verschiebe es ans Ende der Seite.

## Nach dem Re-Crawl

1. **Cache leeren**: Erhöhe die `CACHE_VERSION` in `functions/api/search.js`
2. **Testen**: Suche nach "abdulkerim" und prüfe die Ergebnisse
3. **Monitoring**: Überwache die Suchergebnisse für 24h

## Troubleshooting

### Problem: Immer noch Duplikate

**Lösung**: Erhöhe `MAX_PER_CATEGORY` in `functions/api/search.js` auf 2 oder 1

### Problem: Schlechte Beschreibungen

**Lösung**: Verbessere die `<meta name="description">` Tags auf allen Seiten

### Problem: Zu wenige Ergebnisse

**Lösung**: Erhöhe `max_num_results` im API-Call (aktuell: `topK`)

## Kontakt

Bei Problemen mit Cloudflare AI Search Beta:

- [Cloudflare Community](https://community.cloudflare.com/)
- [Cloudflare Support](https://support.cloudflare.com/)
