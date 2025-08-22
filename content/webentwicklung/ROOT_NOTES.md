Root CSS notes
=================

Datum: 2025-08-22

Was wurde gemacht:

- Globale CSS-Variablen in `content/webentwicklung/root.css` zusammengeführt.
- Lokaler `:root`-Block in `content/webentwicklung/index.css` entfernt.
- `root.css` in die wichtigsten HTML-Dateien eingebunden (z.B. `index.html`, Seiten unter `pages/`).

Hinweise & Empfehlungen:

- Komponenten-spezifische CSS-Variablen (z.B. `--greet-*` in `greeting-text-hero.css`) wurden absichtlich nicht entfernt — sie sind lokal und sollten dort bleiben, können aber bei Bedarf in `root.css` verschoben werden, wenn sie projektweit benötigt werden.
- Falls weitere HTML-Dateien existieren, die CSS direkt einbinden, bitte prüfen und `root.css` vor `index.css` einfügen.

Wie weiter:

- Optional: Variablen in `root.css` erweitern (z.B. `--color-link`, `--font-size-*`) und Komponenten anpassen.
- Optional: Single-source of truth für Farben/Spacing in einer JSON/SCSS-Map pflegen, wenn die Seite wächst.
