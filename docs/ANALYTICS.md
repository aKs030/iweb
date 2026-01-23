# Analytics Events — iweb 📊

Kurz: Dieses Dokument beschreibt die benutzerdefinierten Analytics‑Events, die auf der Website verwendet werden (GA4‑freundlich). Es hilft bei der Konfiguration von Events in Google Analytics / GA4.

## Event: open_video_page ✅

- Zweck: Erfassung, wenn ein Nutzer die per‑Video‑Landing‑Page öffnet (Button „Seite öffnen“ auf der `/videos/` Seite).
- Aufruf: clientseitig durch `gtag('event', 'open_video_page', { ...params })` oder `dataLayer.push({ event: 'open_video_page', ...params })`.

### Parameter (GA4‑Empfehlung)

- **video_id** (string) — YouTube Video ID (z. B. `UorHOTKWtK4`) 🔑
- **video_title** (string) — Titel des Videos
- **page_location** (string) — URL der Seite, von der das Event ausgelöst wurde (z. B. `https://www.abdulkerimsesli.de/videos/`)

### Optional (Kompatibilität / UA)

- **event_category**: `video`
- **event_label**: `video_title`

### Sicht in GA4

- Ansicht: `Configure → Events` (eigene Events tauchen nach kurzer Zeit auf).
- Empfehlung: In GA4 unter `Events` das Event `open_video_page` anlegen und ggf. Parameter als benutzerdefinierte Dimension registrieren (z. B. `video_id`).

---

## Implementierungshinweise für Entwickler 🔧

- Der Link `Seite öffnen` hat `data-video-id` und `data-video-title` Attribute.
- Beim Klick wird zuerst versucht, `gtag` zu verwenden, sonst ein `dataLayer.push(...)`.
- Fehler werden still ignoriert, damit die Navigation nicht blockiert wird.

---

Wenn du möchtest, erweitere ich die Dokumentation um Beispiel‑Screenshots aus GA4 oder erstelle eine kurze Anleitung, wie man in GA4 eine benutzerdefinierte Dimension für `video_id` anlegt. Willst du das? (Ja / Nein)
