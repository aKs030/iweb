# Functions API

Cloudflare-Pages-Functions fuer HTTP-Endpunkte und API-nahe Runtime-Logik.

## Public API

Die oeffentliche API sind die HTTP-Routen:

- `ai-agent.js`, `ai-agent-user.js`
- `admin.js`
- `comments.js`, `contact.js`, `likes.js`
- `gallery-items.js`, `search.js`
- `feed.xml.js`
- `project-apps/[[path]].js`, `youtube/[[path]].js`

Der kanonische RSS-Feed wird oeffentlich unter `/feed.xml` durch
`functions/feed.xml.js` bereitgestellt; `/api/feed.xml` bleibt als
API-nahe Kompatibilitaetsroute erhalten.

## Intern

- Dateien mit fuehrendem `_` sind interne Handler, Stores, Services oder Response-Helfer.
- Gemeinsame Functions-Logik gehoert nach `functions/_shared`.
- Feature-spezifische Datenmodelle bleiben beim jeweiligen Frontend-/Domain-Feature, wenn sie nicht von mehreren API-Bereichen geteilt werden.

## Migration

- Neue HTTP-Routen bleiben flach und explizit.
- Interne Hilfen werden nicht aus Frontend-Code importiert.
- Re-Exports oder Shims in API-Naehe nur temporaer nutzen und nach Import-Migration loeschen.
