Token System
============

Kurz: zentrale Theme-Token liegen in `content/webentwicklung/root.css`.

Konventionen
- Global tokens: `--<purpose>-<name>` (z. B. `--color-link`, `--spacing-md`).
- Komponentenspezifische Tokens: `--<component>-<name>` (z. B. `--card-pad`, `--greet-*`).
- Schriftgrößen / responsive tokens: verwenden `clamp()` in token definitions.

Wie benutzen
- Lade `root.css` vor allen anderen CSS-Dateien.
- Komponenten können lokale Tokens definieren, wenn sie ausschließlich intern sind. Falls mehrere Komponenten dieselben Tokens brauchen, verschiebe sie nach `root.css`.

Automatisierung
- `scripts/consolidate-tokens.sh` (wird erstellt) sammelt Variablen, die außerhalb von `root.css` vorkommen, und erzeugt einen Report.
- Der Report zeigt: Variable, Datei, Zeile. Der Script bietet optionales Appending fehlender Tokens in `root.css` (nur Report-Modus standardmäßig).

Best Practices
- Verwende Variablen für Farben, Abstände, Radius, Schatten und Animation-Dauern.
- Bevor du eine Variable umbenennst, führe ein Repo-weites Search-and-Replace durch oder nutze das Konsolidierungs-Skript, um Kollisionen zu vermeiden.

***
