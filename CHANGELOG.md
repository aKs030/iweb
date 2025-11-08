# Changelog

All notable changes to this project will be documented in this file.

## [0.2.1] - 2025-11-08
### Fixed
- Cookie-Settings dialog opening issue: Changed CSS positioning from absolute to relative
- Footer `.footer-maximized` height calculation fixed

### Changed
- Ultra-compact cookie settings UI: reduced font sizes (7-13px), margins, and padding by 30-50%
- Improved accessibility with comprehensive ARIA labels throughout footer
- Updated datenschutz.html (date: 08.11.2025)
- Cleaned up impressum.html
- Enhanced legal-pages.css with accessibility features

### Removed
- All debug code (console.log, alert statements)
- Cache-busting query parameters
- Unnecessary min-height declarations after positioning fix

### Updated
- File timestamps updated to 2025-11-08

## [0.2.0] - 2025-11-05
### Changed
- Remove test/dev-only workarounds from the About section CSS (use central theme variables and remove temporary `!important` fallbacks).
- Consolidate duplicate container styles in `pages/about/about.css` and rely on `content/webentwicklung/root.css` for global tokens.
- Remove local focus duplication in About buttons; use global focus styling for consistent a11y.

### Tested
- Playwright layout & accessibility smoke tests — 7 passed, 1 skipped (desktop/mobile matrix).

### Notes
- Follow-up: consider further minor CSS consolidation across pages (non-blocking).
