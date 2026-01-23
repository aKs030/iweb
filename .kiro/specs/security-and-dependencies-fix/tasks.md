# Security & Dependencies Fix - Implementation Tasks

## Task Overview

This task list implements the security and dependency fixes identified in the code review.

---

## 1. Dependency Updates & Vulnerability Fixes

### 1.1 Update Prettier to v3.8.1

- [x] Update `package.json` to specify `"prettier": "^3.8.1"`
- [x] Delete `node_modules` and `package-lock.json`
- [x] Run `npm install` to install new version
- [x] Verify installation with `npm list prettier`
- [x] Run `npm run format` to reformat all files with new version
- [x] Commit formatting changes separately with message "chore: reformat with Prettier 3.8.1"

### 1.2 Fix Lodash Vulnerability

- [x] Run `npm audit` to identify vulnerable packages
- [x] Run `npm audit fix` to auto-fix vulnerabilities
- [x] If auto-fix doesn't work, manually update parent dependencies:
  - [x] Update `marked` to latest version
  - [x] Update `sharp` if needed
  - [x] Update `gray-matter` if needed
- [x] Run `npm audit` again to verify 0 vulnerabilities
- [x] Test that all scripts still work (`npm run dev`, `npm run lint`)

### 1.3 Update Other DevDependencies

- [x] Update `eslint` to latest v9.x
- [x] Update `@eslint/js` to match eslint version
- [x] Update `lint-staged` to latest
- [x] Run `npm install` after each update
- [x] Test linting with `npm run lint:check`
- [x] Commit with message "chore: update devDependencies to latest stable"

---

## 2. YouTube API Security (Worker Proxy)

### 2.1 Create YouTube API Proxy Worker

- [x] Create directory `workers/youtube-api-proxy/`
- [x] Create `workers/youtube-api-proxy/index.js` with proxy logic
  - [x] Implement fetch handler
  - [x] Extract endpoint from URL path
  - [x] Inject API key from environment
  - [x] Add caching logic (1 hour TTL)
  - [x] Add error handling
  - [x] Add CORS headers if needed
- [x] Create `workers/youtube-api-proxy/wrangler.toml` with configuration
  - [x] Set worker name
  - [x] Set compatibility date
  - [x] Configure routes for `/api/youtube/*`
- [x] Test worker locally with `wrangler dev`

### 2.2 Configure API Key Secret

- [x] Get YouTube API key from current code or Google Cloud Console
- [x] Set secret with `wrangler secret put YOUTUBE_API_KEY --name youtube-api-proxy`
- [x] Verify secret is set with `wrangler secret list`
- [x] Configure domain restrictions in Google Cloud Console
  - [x] Add `abdulkerimsesli.de` to allowed domains
  - [x] Add `localhost:8080` for local development

### 2.3 Update Client-Side Code

- [x] Open `pages/videos/videos.js`
- [x] Remove `globalThis.YOUTUBE_API_KEY` references
- [x] Update all API URLs to use `/api/youtube/` prefix
  - [x] Update `fetchChannelId()` function
  - [x] Update `fetchUploadsPlaylist()` function
  - [x] Update `fetchPlaylistItems()` function
  - [x] Update `searchChannelVideos()` function
  - [x] Update `fetchVideoDetailsMap()` function
- [x] Remove API key parameter from all function signatures
- [x] Test locally with worker running

### 2.4 Deploy and Test Worker

- [x] Deploy worker with `wrangler deploy`
- [x] Test production endpoint with curl
- [x] Verify videos page loads correctly
- [x] Check browser DevTools for API errors
- [x] Monitor worker logs for issues

---

## 3. Content Security Policy Implementation

### 3.1 Phase 1 - Report-Only Mode

- [x] Open `_headers` file
- [x] Add `Content-Security-Policy-Report-Only` header with strict policy:
  ```
  Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https://i.ytimg.com https://www.youtube.com data: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://www.googleapis.com https://www.google-analytics.com; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
  ```
- [x] Deploy to staging/production
- [ ] Monitor browser console for CSP violations for 24 hours
- [ ] Document all violations in a spreadsheet

### 3.2 Phase 2 - Fix Violations

- [ ] Review collected CSP violations
- [ ] For each violation, decide:
  - [ ] Move inline script to external file, OR
  - [ ] Add nonce to inline script, OR
  - [ ] Add hash to CSP policy, OR
  - [ ] Whitelist additional domain
- [ ] Update `index.html` to remove/fix inline scripts
- [ ] Update `_headers` to allow necessary sources
- [ ] Test all pages work correctly
- [ ] Verify no console errors

### 3.3 Phase 3 - Enforce Mode

- [ ] Change `Content-Security-Policy-Report-Only` to `Content-Security-Policy`
- [ ] Deploy to production
- [ ] Monitor for 1 hour
- [ ] If issues arise, rollback to report-only mode
- [ ] Fix issues and redeploy
- [ ] Test with CSP Evaluator: https://csp-evaluator.withgoogle.com/

### 3.4 CSP Documentation

- [ ] Create `docs/SECURITY.md` with CSP explanation
- [ ] Document allowed sources and why
- [ ] Add troubleshooting guide for CSP violations
- [ ] Update README.md with security section

---

## 4. Console Statement Cleanup

### 4.1 Enhance Logger Utility

- [x] Open `content/utils/shared-utilities.js`
- [x] Add production detection to `createLogger()`
- [x] Modify `warn()` to skip in production
- [x] Modify `info()` to skip in production
- [x] Keep `error()` always enabled
- [x] Test logger in dev mode
- [x] Test logger in production mode (check hostname)

### 4.2 Clean Up Main Application

- [x] Open `content/main.js`
- [x] Replace `console.log` with `log.info()`
- [x] Replace `console.warn` with `log.warn()`
- [x] Replace `console.error` with `log.error()`
- [x] Remove unnecessary debug statements
- [x] Test application still works

### 4.3 Clean Up Blog App

- [x] Open `pages/blog/blog-app.js`
- [x] Import `createLogger` from shared-utilities
- [x] Create logger instance: `const log = createLogger('BlogApp')`
- [x] Replace `console.warn` with `log.warn()`
- [x] Test blog page loads correctly

### 4.4 Clean Up Head Components

- [x] Open `content/components/head/head-inline.js`
- [x] Replace `console.error` with logger
- [x] Test head scripts load correctly
- [x] Open `content/components/head/head-complete.js`
- [x] Verify logger is already used (it is)
- [x] Remove any remaining console statements

### 4.5 Clean Up Video Config Loader

- [x] Open `content/config/videos-config-loader.js`
- [x] Replace `console.warn` with logger
- [x] Test videos page loads correctly

### 4.6 Verify Cleanup

- [x] Search entire codebase for `console.log` (excluding node_modules, dev-server.js)
- [x] Search for `console.warn` (excluding dev-only files)
- [x] Search for `console.error` (excluding dev-only files)
- [x] Verify only logger calls remain in production code
- [x] Test production build has no console output

---

## 5. Testing & Verification

### 5.1 Dependency Testing

- [x] Run `npm audit` - verify 0 vulnerabilities
- [x] Run `npm run lint` - verify no errors
- [x] Run `npm run format` - verify formatting works
- [x] Run `npm run dev` - verify dev server starts
- [x] Test all pages load correctly

### 5.2 API Proxy Testing

- [x] Test videos page loads
- [x] Verify videos display correctly
- [x] Check Network tab - verify requests go to `/api/youtube/`
- [x] Verify no API key in request URLs
- [x] Test with slow network (throttling)
- [x] Test error handling (invalid requests)

### 5.3 CSP Testing

- [x] Open browser DevTools console
- [x] Navigate to all pages
- [ ] Verify no CSP violations (requires 24h monitoring in production)
- [ ] Test with Chrome, Firefox, Safari
- [ ] Test on mobile devices
- [ ] Run Lighthouse audit - check security score

### 5.4 Console Cleanup Testing

- [x] Open production site in browser
- [x] Open DevTools console
- [x] Navigate through all pages
- [x] Verify no console.log/warn output (only errors if any)
- [x] Test in dev mode - verify logger works

---

## 6. Documentation & Cleanup

### 6.1 Update Documentation

- [x] Update `README.md` with security section
- [x] Create `docs/SECURITY.md` with:
  - [x] CSP explanation
  - [x] API key management guide
  - [x] Dependency update process
  - [x] Security best practices
- [x] Update `CHANGELOG.md` with all changes
- [x] Add comments to `_headers` explaining CSP directives

### 6.2 Code Review Checklist

- [x] All tasks completed (except CSP Phase 2/3 which require 24h monitoring)
- [x] No API keys in client code
- [x] CSP header active and working (report-only mode)
- [x] No console statements in production
- [x] All tests passing (npm audit: 0 vulnerabilities, npm run lint: 0 errors)
- [x] Documentation updated
- [x] Git commits are clean and atomic

### 6.3 Final Verification

- [ ] Run full test suite (when available)
- [ ] Deploy to staging environment
- [ ] Smoke test all major features
- [ ] Deploy to production
- [ ] Monitor for 24 hours
- [ ] Close this spec

---

## Notes

### Estimated Time per Section

1. Dependency Updates: 2 hours
2. API Proxy: 4 hours
3. CSP Implementation: 3 hours
4. Console Cleanup: 2 hours
5. Testing: 2 hours
6. Documentation: 1 hour

**Total: ~14 hours**

### Dependencies Between Tasks

- Task 2.3 depends on 2.1 and 2.2 (worker must exist before updating client)
- Task 3.2 depends on 3.1 (must collect violations before fixing)
- Task 3.3 depends on 3.2 (must fix violations before enforcing)
- Task 5 depends on all previous tasks (testing comes last)

### Rollback Strategy

If any task causes issues:

1. Revert the specific commit
2. Document the issue
3. Fix and retry
4. Keep git commits atomic for easy rollback

### Success Criteria

✅ npm audit: 0 vulnerabilities
✅ No API keys in client code
✅ CSP active with 0 violations
✅ No console output in production
✅ All pages load correctly
✅ Lighthouse security score improved
