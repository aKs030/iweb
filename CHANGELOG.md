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

### 2025-12-20 — Videos page finalization

- Komplette Neugestaltung der Videos-Seite (dunkles Theme, animierter Titel, Karten mit Hover-Glow) ✅
- Play-Button mit Lazy-Load (Click-to-Play), YouTube Abonnieren- und Teilen-Buttons hinzugefügt ✅
- JSON-LD: `VideoObject` & `VideoGallery` Markup hinzugefügt/validiert ✅
- Sitemap aktualisiert und Thumbnails ergänzt; `/videos/` Redirect angelegt ✅
- Wikidata `sameAs` Links in Person JSON-LD ergänzt ✅
