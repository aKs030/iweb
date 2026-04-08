# Robot Companion Capabilities

Aktueller Funktionsumfang des `robot-companion/`-Pakets.

## Laufzeit

- Streaming-Chat über `POST /api/ai-agent`
- Client-Tool-Ausführung für Navigation, Suche, Theme, Scroll und Integrationen
- Bildanalyse über den Upload-Button im Composer
- Session-Chatverlauf nur im RAM
- optionale Namenszuordnung für Share-Link und serverseitiges Memory
- Quick Actions und Namensabfrage als echte Chat-Nachrichten im Verlauf

## UI und Verhalten

- animierter Avatar mit Chatfenster
- Workspace-Sidepanel für Profil, Export und Memories
- Session-Bar mit Status, Seitenkontext und aktivem Profil
- mehrzeiliger Composer mit `Shift+Enter`
- progressive Hydration
- kontextbezogene Reaktionen auf Scrollen, Sections und Form-Events
- Worker-gestützte Heuristiken für Idle-/Interaktionsreaktionen
- sichere DOM-Erstellung über `RobotDOMBuilder`
- dynamische Chat-Höhe passend zum Inhalt
- anonymer Chat bleibt ohne Namen nutzbar

## Wichtige Module

- `robot-companion.js`: Hauptcontroller
- `ai-agent-service.js`: Client für `POST /api/ai-agent`
- `dom/RobotDOMBuilder.js`: sichere DOM-Erstellung für Avatar und Chatfenster
- `modules/robot-chat.js`: Chat-UI, Streaming-Render, Composer-State
- `modules/robot-animation.js`: Avatar-Animationen und Suchflug-Reaktionen
- `modules/robot-collision.js`: Layout-/Footer-Kollision und Positionierung
- `modules/robot-context-reactions.js`: Reaktionen auf Seitenkontext und Navigation
- `modules/robot-emotions.js`: Robot-Mood und Emotionszustände
- `modules/robot-intelligence.js`: Heuristiken und Worker-gestützte Assistenzlogik
- `modules/tool-executor.js`: Browser-seitige Tool-Ausführung
- `state/RobotStateManager.js`: zentraler Robot-/Chat-Status
- `modules/chat-history-store.js`: UI-seitiger Chatverlauf im aktuellen Tab

## Nicht mehr Teil des aktuellen Flows

- kein lokaler Offline-Chat-Fallback
- keine `localStorage`-Persistenz des Chatverlaufs
- keine separaten Robot-Actions mehr für Seitenzusammenfassung oder Bildanalyse
- keine alten Profil-/Recovery-Karten im Chat-Header oder Nachrichtenverlauf
