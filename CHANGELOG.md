# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Added - AI Indexing & Optimization (2026-02-21)

- ✅ Umfassende AI-Indexierung implementiert
- ✅ llms.txt & llms-full.txt für LLM-Crawler
- ✅ person.jsonld (Schema.org Person Markup)
- ✅ bio.md (Professionelle Biografie)
- ✅ ai-index.json (Strukturierte Site-Daten)
- ✅ OpenAPI Spezifikation für APIs
- ✅ AI Plugin Manifest (ChatGPT/Claude)
- ✅ robots.txt mit AI-Bot Direktiven
- ✅ Dynamische Sitemaps aktualisiert

### Changed - Zero-Config Optimization (2026-02-21)

- ✅ Zero-Build System implementiert
- ✅ Service Worker optimiert (350 → 200 Zeilen, 43% Reduktion)
- ✅ GitHub Workflows konsolidiert (4 → 2 Workflows, 42% Reduktion)
- ✅ Konfigurationsdateien komprimiert (eslint, prettier, tsconfig, wrangler)
- ✅ Moderne JavaScript Patterns durchgehend implementiert
- ✅ Cache-Busting via Meta-Tag statt Build-Script
- ✅ Issue Templates vereinfacht (77% Reduktion)

### Removed

- ✅ Build-System: `.pages.toml`, `.node-version`, `build.sh`, `scripts/inject-version.mjs`, `version.json`
- ✅ Alte Dokumentation: `DEPLOYMENT_SETUP.md`, `SECRETS_SETUP.md`, `docs/VERSION_MANAGEMENT.md`, `docs/CLOUDFLARE_PAGES_SETUP.md`
- ✅ Temporäre Reports: `OPTIMIZATION_SUMMARY.md`, `FINAL_OPTIMIZATION_REPORT.md`
- ✅ Ungenutzte Tools: `cspell.json`
- ✅ Duplikate: `about-me.json`, `llms-full.txt` (war fälschlich als gelöscht markiert)
- ✅ Statische Sitemap: `sitemap.xml` (dynamische Version wird verwendet)
- ✅ Log-Dateien: `server.log`
- ✅ macOS Metadaten: Alle `.DS_Store` Dateien

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
- Vollständige Bildoptimierung mit AVIF/WebP Support
- Automatisches Lazy Loading mit Intersection Observer
- Performance-Monitoring für Bilder (LCP, CLS Tracking)

[Unreleased]: https://github.com/aKs030/iweb/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/aKs030/iweb/releases/tag/v1.0.0
