# Robot Companion

Cloudflare-AI-first Roboter-Begleiter mit Streaming-Chat, Tool-Calling und Memory.

## Public API

- `index.js`: oeffentliche Facade fuer Robot-Initialisierung, Events, Memory-Schema und geteilte Tool-Definitionen.

```js
import { initRobotCompanion, ROBOT_EVENTS } from "./index.js";

await initRobotCompanion();
```

## Intern

- `robot-companion.js`: Browser-Runtime und Hauptklasse; wird ueber `index.js` lazy geladen.
- `ai-agent-service.js`: Client fuer `/api/ai-agent`.
- `constants/`: Events und Actions.
- `dom/`: DOM-Aufbau.
- `memory/`: Robot-Memory-Schema.
- `modules/`: Chat, Tools, Animation, Kontextreaktionen und Identity.
- `state/`: Robot-spezifischer Zustand.
- `styles/`: CSS-Teile; `robot-companion.css` ist die Style-Fassade.
- `workers/`: Worker fuer Intelligence-Tasks.

## Migration

- Neue Browser-Aufrufer gehen ueber `index.js`.
- Robot-Memory gehoert zu `memory/robot-memory-schema.js`, nicht zu `content/core`.
- Tiefe Imports aus `modules/`, `state/` oder `memory/` nur innerhalb des Features oder als kurzlebige Migrationsausnahme verwenden.
- Shims nach Import-Migration loeschen.
