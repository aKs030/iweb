Content Security Policy (CSP) — Final status
=============================================

Kurzfassung
-----------
Die Repository-Änderungen auf Branch `csp/report-only-deploy` wurden abgeschlossen: alle runtime-injizierten `<style>`-Tags wurden entfernt und in externe Stylesheets verschoben. Die CSP-Header wurden danach wieder verschärft (kein `style-src 'unsafe-inline'`). Inline JSON-LD bleibt erlaubt via präcomputed sha256-Tokens.

Was geändert wurde
-------------------
- Inline CSS, das zuvor per JavaScript in `<style>`-Tags injiziert wurde, wurde extrahiert in:
  - `content/webentwicklung/animations/theme-transitions.css`
  - `content/webentwicklung/footer/day-night-artwork.css`

- Die entsprechenden JS-Module wurden angepasst, um die externen Stylesheets per `<link rel="stylesheet">` zu laden statt Laufzeit-Styles zu erzeugen:
  - `content/webentwicklung/theme/theme-system.js`
  - `content/webentwicklung/footer/day-night-artwork.js`

- Die temporäre Lockerung (`style-src 'unsafe-inline'`) wurde nach dem Refactor aus den Headern entfernt und die CSP wieder restriktiv gesetzt (nur `style-src 'self'`).

JSON-LD Hashes (aktuelle Tokens)
--------------------------------
Die folgenden sha256-Tokens wurden mit `scripts/compute-csp-hash.cjs` erzeugt und in die Header aufgenommen, damit strukturierte Daten weiterhin inline bleiben können ohne `unsafe-inline`:

- `scripts/csp-inline/creativework.jsonld` => sha256-K9WmLnXZNonKm1ZThJXtTdZa01o72qlCk4TRxkUq1xw=
- `scripts/csp-inline/faq.jsonld` => sha256-3/tZpFDa7mZ0bMj3Z/vnn9t7rm57FDcbV1P+mqgRjJc=
- `scripts/csp-inline/person.jsonld` => sha256-5quy27/OlecHHnU7BVxn3EAwEiSxslEPcPWRsGTms8c=
- `scripts/csp-inline/professional-service.jsonld` => sha256-2T1B6WHceR3weWPsi+cTt0B9SaXiaT85uMNHQD8YHtA=
- `scripts/csp-inline/website.jsonld` => sha256-bxyjtbqvaCRoPbsWM9cB1EZSl6UoxpKFelUYImysCZU=

Diese Tokens sind bereits in den Header-Dateien (`_headers`, `security/_headers`, `security/security-headers.conf`) enthalten.

Tests & Validierung
--------------------
- Das Projekt-Skript `bash ./scripts/check-root.sh` wurde ausgeführt — Ergebnis: All checks passed.
- Repo-weite Suche ergab keine verbliebenen `document.createElement('style')` Vorkommen und keine relevanten `style=""` Attribute in produktivem HTML (nur Dokumentations/Scan-RegEx Einträge).

Empfohlene nächsten Schritte
---------------------------
1) Report-Only für 48–72 Stunden laufen lassen (Staging)
   - Deploye `security/_headers-report-only` oder wandle die CSP-Zeile in euer Server-Header-Format um.
   - Sammle die Browser-Reports und Console-Warnungen für zwei bis drei Tage.

2) Behandle gefundene Violations
   - Statische Inline-Snippets → auslagern oder Hash generieren und Header updaten (`scripts/update-csp-hashes.cjs` kann helfen).
   - Dynamische, per-click Positionen (z. B. Ripple-Effekte) → bestmöglich per CSS-Klassen + bereits extrahierter Keyframes abbilden oder per Canvas implementieren.

3) Nach sauberer Report-Only-Periode → `Content-Security-Policy` (enforce) aktivieren.

Extras & Maintenance
--------------------
- `scripts/update-csp-hashes.cjs` existiert, um Hashes neu zu erzeugen wenn JSON-LD/inline Inhalte verändert werden.
- Wenn künftig neue Inline-Styles eingeführt werden, gilt: erst auslagern; falls nicht möglich, dann Hash erzeugen oder Report-Only prüfen.

Changelog (wichtig)
--------------------
- 2025-09-17: Alle runtime-injizierten Styles entfernt, JSON-LD refactored & gehasht. CSP-Headers wieder restriktiv; Report-Only helpers und docs bereitgestellt.

Wenn du willst, kann ich jetzt die PR-Beschreibung updaten und den PR als "ready for review" markieren sowie die GitHub Actions im Auge behalten.


