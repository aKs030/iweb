# Projekte

Dieses Repo enthält mehrere kleine Web‑Apps unter `apps/`.

## Tailwind CSS (lokaler Build)

Das Projekt verwendet lokale Tailwind‑Assets statt des CDN (sicher für Produktion).

Installieren (einmal):

```bash
npm install
```

Entwicklungsmodus (mit Watch):

```bash
npm run dev:css
```

Produktion (minifiziert):

```bash
npm run build:css
```

Die generierte Datei liegt in `css/tailwind.css` und wird von den Apps unter `apps/*/index.html` eingebunden.
