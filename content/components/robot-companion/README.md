# Robot Companion

Cloudflare-AI-first Roboter-Begleiter mit Streaming-Chat, Tool-Calling und Memory.

## Features

- KI-Chat via `POST /api/ai-agent` (SSE Streaming)
- Tool-Calling fuer Navigation, Theme, Suche, Menu, Scroll und Utility-Aktionen
- Bildanalyse (Upload im Chat)
- Persistenter Chatverlauf (lokal) inkl. Export
- Stateful Robot-UI (Animation, Kollision, Kontextreaktionen)
- XSS-sichere DOM-Erstellung

## Architektur

```text
robot-companion/
├── constants/events.js
├── state/RobotStateManager.js
├── dom/RobotDOMBuilder.js
├── modules/
│   ├── robot-chat.js
│   ├── tool-executor.js
│   ├── robot-animation.js
│   ├── robot-collision.js
│   ├── robot-context-reactions.js
│   ├── robot-emotions.js
│   ├── robot-intelligence.js
│   ├── markdown-renderer.js
│   └── chat-history-store.js
├── ai-agent-service.js
├── robot-companion.js
└── robot-companion.css
```

## Verwendung

```js
import { RobotCompanion } from './robot-companion.js';

const robot = new RobotCompanion();
await robot.initialize();
```

## Actions

```js
ROBOT_ACTIONS = {
  START: 'start',
  SUMMARIZE_PAGE: 'summarizePage',
  UPLOAD_IMAGE: 'uploadImage',
  TOGGLE_THEME: 'toggleTheme',
  SEARCH_WEBSITE: 'searchWebsite',
  SCROLL_FOOTER: 'scrollFooter',
  OPEN_MENU: 'openMenu',
  CLOSE_MENU: 'closeMenu',
  OPEN_SEARCH: 'openSearch',
  CLOSE_SEARCH: 'closeSearch',
  SCROLL_TOP: 'scrollTop',
  COPY_CURRENT_URL: 'copyCurrentUrl',
  CLEAR_CHAT: 'clearChat',
  EXPORT_CHAT: 'exportChat',
};
```

## Wichtige Hinweise

- Chat-Antworten laufen ueber den Cloudflare-Agenten.
- Lokale statische Textquellen fuer Chatflows wurden entfernt.
- Lokale Bubble-Texte sind im Runtime-Flow deaktiviert (`disableLocalBubbleTexts`).
- Tool-Ergebnisse zeigen kurze technische Statusmeldungen im Chat.
- **Cloud‑Only / Memory**: the robot stores conversations and memories exclusively in Cloudflare KV and vector index. No client storage is used once a name is chosen; the user ID is never written to cookies or local/session storage. Conversation history is also disabled in cloud-only mode. When the browser refuses storage (e.g. Indigo), the page will **automatically append the stable ID to the address bar** and notify the user in chat, so the same link can be reused across windows.
- **Name‑based login**: users supply `?name=xyz` or click the `Name` button. The service now parses the query string immediately on each request so the identity works even if the first API call happens before the UI has finished initializing. The identity is persisted via URL and remembered across browsers & incognito tabs.
- **Share link**: the header includes a "Link" button that copies a sharable URL including the current name, allowing others to continue the same memory session.

## Entwicklung

```bash
npx eslint content/components/robot-companion --max-warnings=0
npm run lint:types
```

## Verwandte Dateien

- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- [CHANGELOG.md](./CHANGELOG.md)
