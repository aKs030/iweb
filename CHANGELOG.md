# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2025-11-05
### Changed
- Remove test/dev-only workarounds from the About section CSS (use central theme variables and remove temporary `!important` fallbacks).
- Consolidate duplicate container styles in `pages/about/about.css` and rely on `content/webentwicklung/root.css` for global tokens.
- Remove local focus duplication in About buttons; use global focus styling for consistent a11y.

### Tested
- Playwright layout & accessibility smoke tests — 7 passed, 1 skipped (desktop/mobile matrix).

### Notes
- Follow-up: consider further minor CSS consolidation across pages (non-blocking).
