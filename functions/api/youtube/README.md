# YouTube Data API v3 Integration

## Setup

### 1. API-Key erstellen

1. Gehe zur [Google Cloud Console](https://console.cloud.google.com/)
2. Erstelle ein neues Projekt oder wähle ein bestehendes aus
3. Aktiviere die **YouTube Data API v3**:
   - Navigation: APIs & Services → Library
   - Suche nach "YouTube Data API v3"
   - Klicke auf "Enable"
4. Erstelle einen API-Key:
   - Navigation: APIs & Services → Credentials
   - Klicke auf "Create Credentials" → "API Key"
   - Kopiere den generierten Key

### 2. API-Key in Cloudflare Pages eintragen

#### Option A: Cloudflare Dashboard (empfohlen)

1. Gehe zu deinem Cloudflare Pages Projekt
2. Settings → Environment Variables
3. Füge hinzu:
   - Variable name: `YOUTUBE_API_KEY`
   - Value: `AIzaSyA1uN-8I94wyGRSA9WylFetW9PaUehgTcY`
   - Environment: Production & Preview

#### Option B: Wrangler CLI

```bash
# Production
wrangler pages secret put YOUTUBE_API_KEY --project-name=1web

# Preview
wrangler pages secret put YOUTUBE_API_KEY --project-name=1web --env=preview
```

### 3. Lokale Entwicklung

Erstelle eine `.dev.vars` Datei im Root:

```bash
YOUTUBE_API_KEY=AIzaSyA1uN-8I94wyGRSA9WylFetW9PaUehgTcY
```

**Wichtig:** Diese Datei ist bereits in `.gitignore` und wird nicht committed.

## API Endpoints

Die Cloudflare Function fungiert als Proxy für die YouTube Data API v3:

- `/api/youtube/channels?part=snippet&id=CHANNEL_ID`
- `/api/youtube/playlistItems?part=snippet&playlistId=PLAYLIST_ID`
- `/api/youtube/videos?part=snippet,contentDetails,statistics&id=VIDEO_IDS`
- `/api/youtube/search?part=snippet&q=QUERY`

Alle Query-Parameter werden automatisch an die YouTube API weitergeleitet.

## Sicherheit

- Der API-Key wird nur serverseitig verwendet (Cloudflare Pages Function)
- Der Key ist niemals im Client-Code sichtbar
- CORS-Header erlauben Zugriff nur von deiner Domain
- 5 Minuten Cache für API-Responses

## Quota & Limits

YouTube Data API v3 hat ein tägliches Quota:

- Standard: 10,000 units/day (kostenlos)
- Jede API-Anfrage kostet unterschiedlich viele Units
- Monitoring: [Google Cloud Console → APIs & Services → Dashboard](https://console.cloud.google.com/apis/dashboard)

### Quota-Optimierung

- Caching: 5 Minuten Cache reduziert API-Calls
- Batch-Requests: Mehrere Video-IDs in einem Request
- Fallback: Bei Quota-Überschreitung werden statische Videos angezeigt

## Troubleshooting

### Fehler: "YouTube API key not configured"

→ API-Key wurde nicht in Cloudflare Pages Environment Variables eingetragen

### Fehler: 403 "API_KEY_INVALID"

→ API-Key ist ungültig oder YouTube Data API v3 ist nicht aktiviert

### Fehler: 403 "quotaExceeded"

→ Tägliches Quota überschritten, warte bis Mitternacht (Pacific Time)

### Fehler: 400 "keyInvalid"

→ API-Key Format ist falsch oder Key wurde gelöscht
