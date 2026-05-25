# PR: Modernization — Asset centralization & component cleanup

Kurz: Diese PR konsolidiert statische Asset‑URLs über die vorhandene R2/CDN‑Schicht, extrahiert Layout‑Konstanten aus dem großen Earth‑Particle‑Modul und entfernt eine doppelte Animation in der Admin‑CSS.

Geänderte Dateien (Auszug):

- `content/components/particles/earth/texture-paths.js` — nutzt jetzt `resolveR2Path` zur Erzeugung produktions‑/dev‑geeigneter URLs
- `content/components/particles/earth/card-layouts.js` — neu: ausgelagerte Layout‑Konstanten
- `content/components/particles/earth/cards.js` — Referenz auf ausgelagerte Layouts
- `pages/admin/admin.css` — entfernte lokale `fadeIn` Keyframes
- `analysis/modernization-report.md` — aktualisierter Analysebericht

Test / Verifikation:

- Lokale Modulladeprüfung: `node --input-type=module -e "await import('./content/components/particles/earth/texture-paths.js'); console.log('ok')"` (sollte `ok` ausgeben)
- Prettier: `npm exec --yes prettier --check <paths>`
- ESLint: `npm exec --yes eslint <paths>`

Deployment‑Hinweise:

- R2/CDN: Keine Schlüsseländerungen — `resolveR2Path` nutzt bestehende Basis‑URL (`content/config/media-urls.js`). Prüfe in Prod, dass `R2_PUBLIC_BASE_URL` korrekt gesetzt ist.
- Wenn du eine Bucket‑Migration planst, mappe existierende Keys unter `content/media/img/...` auf die R2‑Keys.

Optional nächste Schritte (empfohlen):

- Automatische Bildoptimierung + Versions-Varianten (siehe `analysis/modernization-report.md`).
- Optional: konsolidieren der page‑level CSS in `content/styles/main.css` + kritisches Inline‑CSS für die Startseite.
