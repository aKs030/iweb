# Robot Companion Notes

Kurze, komponentenspezifische Änderungsnotizen. Kein vollständiges Repo-Changelog.

## 2026-03-11

- Frontend-Agent gegen hängende Requests gehärtet:
  - Request-Timeout
  - Stream-Idle-Guard
  - saubere Abort-/Destroy-Pfade
- Chat-UI gegen stale Responses abgesichert:
  - laufende Antworten werden bei `clearHistory()` oder `destroy()` invalidiert
  - abgebrochene Requests schreiben nicht mehr in ein geleertes UI
- SSE-Parsing robuster gemacht:
  - finale Events am Stream-Ende werden korrekt verarbeitet
  - Client-Tool-Ausführung wird per Tool-Signatur dedupliziert
- Veraltete Robot-Dokumentation und tote Actions bereinigt:
  - `SUMMARIZE_PAGE` und `UPLOAD_IMAGE` entfernt
  - Docs auf `robot.init()` und den realen Composer-/Upload-Flow gezogen

## 2026-02-04

- Robot-Companion in Module für Chat, Animation, DOM, State und Reaktionen aufgeteilt
- Sichere DOM-Erstellung über `RobotDOMBuilder`
- Progressive Hydration und Worker-basierte Intelligenzpfade ergänzt
- Session-Chatverlauf auf In-Memory-Store begrenzt
