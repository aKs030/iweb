# Robot Companion Capabilities

Aktueller Funktionsumfang des `robot-companion/`-Pakets.

## Laufzeit

- Streaming-Chat über `POST /api/ai-agent`
- Client-Tool-Ausführung für Navigation, Suche, Theme, Scroll und Integrationen
- Bildanalyse über den Upload-Button im Composer
- Session-Chatverlauf nur im RAM
- Cloudflare-Memory-Aktionen im Chat-Header:
  - Erinnerungen anzeigen
  - User-ID und Erinnerungen löschen

## UI und Verhalten

- animierter Avatar mit Chatfenster
- progressive Hydration
- kontextbezogene Reaktionen auf Scrollen, Sections und Form-Events
- Worker-gestützte Heuristiken für Idle-/Interaktionsreaktionen
- sichere DOM-Erstellung über `RobotDOMBuilder`

## Wichtige Module

- `robot-companion.js`: Hauptcontroller
- `ai-agent-service.js`: Client für `/api/ai-agent` und `/api/ai-agent-user`
- `modules/robot-chat.js`: Chat-UI, Streaming-Render, Composer-State
- `modules/tool-executor.js`: Browser-seitige Tool-Ausführung
- `runtime/robot-hydration.js`: progressive Hydration
- `modules/chat-history-store.js`: in-memory Chatverlauf

## Nicht mehr Teil des aktuellen Flows

- kein lokaler Offline-Chat-Fallback
- keine `localStorage`-Persistenz des Chatverlaufs
- keine separaten Robot-Actions mehr für Seitenzusammenfassung oder Bildanalyse
