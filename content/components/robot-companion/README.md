# Robot Companion

Cloudflare-AI-first Roboter-Begleiter mit Streaming-Chat, Tool-Calling und Memory.

## Features

- KI-Chat via `POST /api/ai-agent` (SSE Streaming)
- Tool-Calling fuer Navigation, Theme, Suche, Menu, Scroll und Utility-Aktionen
- Integrations-Tools: externe Links, Social-Profile, Mail-Entwurf, Kalender-Erinnerung
- Confirm-Step fuer sensible Tool-Aktionen (Browser-Bestaetigung)
- Bildanalyse (Upload im Chat)
- Session-Chatverlauf nur im RAM (kein localStorage)
- Persistente User-ID über `localStorage` plus First-Party-Cookie für Cloudflare-Memory
- Automatische Profil-Recovery über gespeicherte Namen bei Browserwechseln plus Cookie-Fallback für gespeicherte Erinnerungen
- Sichtbarer Profilstatus im Chat-Header sowie Aktionen für Erinnerungen, Profilwechsel, Gerät trennen und Bearbeiten
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
robot.init();
```

## Actions

```js
ROBOT_ACTIONS = {
  START: 'start',
  TOGGLE_THEME: 'toggleTheme',
  SEARCH_WEBSITE: 'searchWebsite',
  SCROLL_FOOTER: 'scrollFooter',
  OPEN_MENU: 'openMenu',
  CLOSE_MENU: 'closeMenu',
  OPEN_SEARCH: 'openSearch',
  CLOSE_SEARCH: 'closeSearch',
  SCROLL_TOP: 'scrollTop',
  COPY_CURRENT_URL: 'copyCurrentUrl',
  SHOW_MEMORIES: 'showMemories',
  EDIT_PROFILE: 'editProfile',
  SWITCH_PROFILE: 'switchProfile',
  DISCONNECT_PROFILE: 'disconnectProfile',
  CLEAR_CHAT: 'clearChat',
};
```

Bildanalyse wird direkt ueber den Upload-Button im Composer gestartet, nicht ueber eine separate `ROBOT_ACTIONS`-Konstante.

## Wichtige Hinweise

- Chat-Antworten laufen ueber den Cloudflare-Agenten.
- Lokale statische Textquellen fuer Chatflows wurden entfernt.
- Lokale Bubble-Texte sind im Runtime-Flow deaktiviert (`disableLocalBubbleTexts`).
- Tool-Ergebnisse zeigen kurze technische Statusmeldungen im Chat.

## Entwicklung

```bash
npx eslint content/components/robot-companion --max-warnings=0
npm run qa
```

## Verwandte Dateien

- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- [CHANGELOG.md](./CHANGELOG.md)
