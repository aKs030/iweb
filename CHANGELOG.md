# Changelog

All notable changes to this project will be documented in this file.

## 0.2.2 - 2025-12-13

- Finalize and tidy repository: merged feature branches into `main`, removed stale remote branches, updated `.gitignore` (ignore `tmp/`), ran formatting and small cleanup scripts.

## Unreleased - 2025-12-20

- Extracted cards styles to `content/styles/components/cards.css` and lazy-loaded it from `index.html` to improve modularity and maintainability. ✅
- Removed the `karten` path detection from `robot-companion` and consolidated all ‘cards’ responses into the `features` intent for clearer conversational behavior. ✅
- Removed redundant duplicated rules from `content/styles/main.css` and centralized DOM fallback styles in the new component file. ✅
- Ran formatting and fixed leftover artifacts; the codebase is tidy. ✅
