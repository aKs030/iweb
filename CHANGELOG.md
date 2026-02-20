# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Changed - Config & Tooling Cleanup (2026-02-20)

- ✅ ESLint-Globals über `globals` Paket dedupliziert
- ✅ Node/Tooling-Konfigurationen vereinheitlicht (`.node-version`, `engines`, aktualisierte Dev-Tool-Versionen)
- ✅ Contributor/README-Dokumentation an aktuelle Scripts angepasst

### Removed

- ✅ Ungenutzte Konfigurationsdateien entfernt: `.htmlvalidate.json`, `.lighthouserc.json`

### Security

- ✅ Sensitiven API-Key-Beispielwert in Doku entfernt

### Added - Bildoptimierung (2025-01-30)

- ✅ Vollständige Bildoptimierung mit AVIF/WebP Support
- ✅ Automatisches Lazy Loading mit Intersection Observer
- ✅ Performance-Monitoring für Bilder (LCP, CLS Tracking)
- ✅ React-Komponenten für optimierte Bilder (`OptimizedImage`, `OptimizedPicture`, `LazyImage`)
- ✅ Automatische Bildkonvertierungs-Scripts (Bash + Node.js)
- ✅ GitHub Actions Workflow für automatische Bildoptimierung
- ✅ CSS-Utilities für Loading-States (Blur, Spinner, Fade-in)
- ✅ Umfassende Dokumentation (Quick Start + Vollständiger Leitfaden)
- ✅ Live-Beispiele (`examples/image-optimization-examples.html`)

### Changed

- Gallery-App: Optimierte Bildlade-Strategie (erste 6 eager, Rest lazy)
- Videos-Seite: Optimierte Thumbnails mit Lazy Loading
- Main.js: Auto-Initialisierung der Bildoptimierung beim Seitenload
- README: Aktualisiert mit Bildoptimierungs-Features
- Docs: Neue Dokumentations-Struktur

### Performance

- Bildgröße: -40% bis -60% durch AVIF-Format
- LCP: Verbessert durch Preloading kritischer Bilder
- CLS: Nahezu 0 durch explizite Dimensionen
- Lazy Loading: Nur sichtbare Bilder werden geladen

### Files Added

- `content/core/image-optimizer.js` (400+ Zeilen) - Hauptmodul
- `content/core/image-loader-helper.js` (50 Zeilen) - Minimale API
- `content/styles/components/image-loading.css` (300+ Zeilen)
- `docs/IMAGE_OPTIMIZATION.md`
- `docs/IMAGE_OPTIMIZATION_GUIDE.md`

### Files Optimized

- ✅ 13 Bilder zu AVIF konvertiert
- ✅ 13 Bilder zu WebP konvertiert
- ✅ Alte JPG/PNG-Dateien gelöscht
- ✅ Backup gelöscht (nicht für Produktion nötig)
- 📊 Finale Größe: 2.0M (nur moderne Formate)

## [1.0.0] - 2025-01-30

### Added

- Initial Release
- 3D Earth Visualization mit Three.js
- AI Robot Companion mit Groq
- RAG Search System
- PWA Support
- Cloudflare Pages Functions Integration
- Responsive Design
- SEO Optimierung

[Unreleased]: https://github.com/aKs030/iweb/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/aKs030/iweb/releases/tag/v1.0.0
