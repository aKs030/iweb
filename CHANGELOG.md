# Changelog

All notable changes to this project will be documented in this file.

## 0.2.2 - 2025-12-13

- Finalize and tidy repository: merged feature branches into `main`, removed stale remote branches, updated `.gitignore` (ignore `tmp/`), ran formatting and small cleanup scripts.

## Unreleased - 2025-12-20

- Extracted cards styles to `content/styles/cards.css` and lazy-loaded it from `index.html` to improve modularity and maintainability. ✅
- Removed the `karten` path detection from `robot-companion` and consolidated all ‘cards’ responses into the `features` intent for clearer conversational behavior. ✅
- Extracted all features/cards responsive & DOM rules from `content/styles/main.css` into `content/styles/cards.css` and removed duplications. ✅
- Consolidated card tokens in `content/styles/root.css` and removed historical references. ✅
- Ran formatting and final cleanup; the codebase is tidy. ✅

### 2025-12-25 — Footer improvements

- Fixed handler cleanup and memory leaks in `content/components/footer/footer-complete.js` (handlers attached to DOM nodes and removed on close). ✅
- Improved keyboard interactions: ESC now reliably closes cookie view and expanded footer (via a11y event) and focus is trapped/released properly. ✅
- Added ARIA announcements for cookie actions and newsletter submissions using the accessibility manager (screen reader friendly). ✅
- Added client-side validation to the newsletter form and appropriate a11y feedback. ✅
- Small responsive/touch-target improvements for mobile (larger hit areas, adjusted footer width). ✅
- Adjusted footer scroll thresholds on desktop (expand: 0.01, collapse: 0.005) to reduce accidental triggers while keeping sensitivity. ✅
- Added Playwright E2E tests for cookie interactions (`tests/footer.spec.js`) and verified they pass. ✅

### 2025-12-20 — Videos page finalization

- Komplette Neugestaltung der Videos-Seite (dunkles Theme, animierter Titel, Karten mit Hover-Glow) ✅
- Play-Button mit Lazy-Load (Click-to-Play), YouTube Abonnieren- und Teilen-Buttons hinzugefügt ✅
- JSON-LD: `VideoObject` & `VideoGallery` Markup hinzugefügt/validiert ✅
- Sitemap aktualisiert und Thumbnails ergänzt; `/videos/` Redirect angelegt ✅
- Wikidata `sameAs` Links in Person JSON-LD ergänzt ✅

### 2025-12-24 — Logging cleanup

- Konsolidiertes Logging: Ersetzte direkte `console.warn`/`console.error` Aufrufe durch `createLogger()` und `log.warn`/`log.error` in mehreren Modulen. ✅
  - Dateien aktualisiert: u.a. `content/main.js`, `content/components/particles/three-earth-system.js`, `content/components/typewriter/TypeWriter.js`, `content/components/robot-companion/*`, `pages/*`.
  - Ziel: Einheitliches, ESLint-konformes Logging und bessere Kontext-Labels in Logausgaben.
