# Functions API

Cloudflare Pages Functions für HTTP-Endpunkte und API-nahe Runtime-Logik.

## Public API

- `ai-agent.js`, `ai-agent-user.js`
- `admin.js`
- `comments.js`, `contact.js`, `likes.js`
- `gallery-items.js`, `search.js`
- `feed.xml.js`
- `project-apps/[[path]].js`, `youtube/[[path]].js`

`functions/feed.xml.js` liefert den kanonischen RSS-Feed unter `/feed.xml`; `/api/feed.xml` bleibt als Kompatibilitätsroute bestehen.

## Kommentar-Moderation

- Neue Kommentare werden mit Status `pending` gespeichert.
- Öffentliche Abfragen liefern ausschließlich `approved` Kommentare.
- Freigabe und Ablehnung erfolgen über den geschützten Admin-Endpunkt.
- Schreibzugriffe besitzen ein separates KV-basiertes Stundenlimit und optionale
  Turnstile-Prüfung.
- Schemaänderungen liegen unter `migrations/`; API-Requests führen keine DDL-Anweisungen aus.

## Intern

- Dateien mit führendem `_` sind interne Handler, Stores, Services oder Response-Helfer.
- Gemeinsame Functions-Logik gehört nach `functions/_shared`.
- Neue HTTP-Routen bleiben flach und explizit.
- Interne Hilfen werden nicht aus Frontend-Code importiert.
