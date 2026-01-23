# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **YouTube API Key Protection**: Implemented Cloudflare Worker proxy to secure YouTube Data API v3 key
  - Created `/api/youtube/*` proxy endpoint
  - API key now stored server-side as environment variable
  - Added 1-hour caching to reduce API quota usage
  - Updated all client-side code to use proxy endpoint
- **Content Security Policy**: Added CSP header in report-only mode (Phase 1)
  - Monitoring violations before enforcement
  - Configured strict policy with necessary allowlists
  - Added comprehensive documentation in `_headers` file
- **Security Headers**: Enhanced security headers configuration
  - `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
  - `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
  - `Strict-Transport-Security` - Forces HTTPS connections
  - `X-Frame-Options: DENY` - Prevents clickjacking attacks
  - `Permissions-Policy` - Restricts browser features

### Changed

- **Dependencies**: Updated all dependencies to latest stable versions
  - Prettier: 2.8.8 → 3.8.1
  - Marked: 5.1.2 → 17.0.1
  - ESLint: Updated to v9.x with flat config
  - Fixed Lodash vulnerability (0 vulnerabilities remaining)
- **Logging System**: Enhanced production-aware logger
  - Automatic production environment detection
  - Error-only logging in production
  - Full logging in development mode
  - Debug mode support via URL parameter or localStorage
- **Code Quality**: Cleaned up console statements in production code
  - Replaced all `console.log/warn/error` with logger calls
  - Removed debug statements from production code
  - Added ESLint rules for browser and Cloudflare Worker globals

### Added

- **Documentation**: Created comprehensive security documentation
  - `docs/SECURITY.md` - Complete security guide
  - Updated `README.md` with security section
  - Added inline comments to `_headers` explaining CSP directives
- **ESLint Configuration**: Enhanced linting setup
  - Added missing browser globals (alert, getComputedStyle, etc.)
  - Added Cloudflare Worker globals (Request, Response, Headers)
  - Removed invalid `import/no-unused-modules` rule references

### Fixed

- **Linting**: Fixed all ESLint errors (40 warnings remain, all acceptable)
- **Formatting**: All files formatted with Prettier 3.8.1

## [1.0.0] - Previous Release

Initial release of the portfolio website.

---

## Roadmap

### Phase 2: CSP Violation Fixes (Planned)

- Monitor CSP violations for 24 hours
- Remove `unsafe-inline` from script-src
- Remove `unsafe-inline` from style-src
- Move inline scripts to external files
- Add nonces to necessary inline scripts

### Phase 3: CSP Enforcement (Planned)

- Switch from report-only to enforcement mode
- Monitor for issues
- Run security audits

### Future Enhancements

- Add automated security testing
- Implement regular dependency update schedule
- Add API rate limiting
- Consider adding Subresource Integrity (SRI) for CDN resources
