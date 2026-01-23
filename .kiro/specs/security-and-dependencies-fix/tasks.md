# Security & Dependencies Fix - Implementation Tasks

## Task Overview

This task list implements the security and dependency fixes identified in the code review.

---

## 1. Dependency Updates & Vulnerability Fixes

### 1.1 Update Prettier to v3.8.1

- [ ] Update `package.json` to specify `"prettier": "^3.8.1"`
- [ ] Delete `node_modules` and `package-lock.json`
- [ ] Run `npm install` to install new version
- [ ] Verify installation with `npm list prettier`
- [ ] Run `npm run format` to reformat all files with new version
- [ ] Commit formatting changes separately with message "chore: reformat with Prettier 3.8.1"

### 1.2 Fix Lodash Vulnerability

- [ ] Run `npm audit` to identify vulnerable packages
- [ ] Run `npm audit fix` to auto-fix vulnerabilities
- [ ] If auto-fix doesn't work, manually update parent dependencies:
  - [ ] Update `marked` to latest version
  - [ ] Update `sharp` if needed
  - [ ] Update `gray-matter` if needed
- [ ] Run `npm audit` again to verify 0 vulnerabilities
- [ ] Test that all scripts still work (`npm run dev`, `npm run lint`)

### 1.3 Update Other DevDependencies

- [ ] Update `eslint` to latest v9.x
- [ ] Update `@eslint/js` to match eslint version
- [ ] Update `lint-staged` to latest
- [ ] Run `npm install` after each update
- [ ] Test linting with `npm run lint:check`
- [ ] Commit with message "chore: update devDependencies to latest stable"

---

## 2. YouTube API Security (Worker Proxy)

### 2.1 Create YouTube API Proxy Worker

- [ ] Create directory `workers/youtube-api-proxy/`
- [ ] Create `workers/youtube-api-proxy/index.js` with proxy logic
  - [ ] Implement fetch handler
  - [ ] Extract endpoint from URL path
  - [ ] Inject API key from environment
  - [ ] Add caching logic (1 hour TTL)
  - [ ] Add error handling
  - [ ] Add CORS headers if needed
- [ ] Create `workers/youtube-api-proxy/wrangler.toml` with configuration
  - [ ] Set worker name
  - [ ] Set compatibility date
  - [ ] Configure routes for `/api/youtube/*`
- [ ] Test worker locally with `wrangler dev`

### 2.2 Configure API Key Secret

- [ ] Get YouTube API key from current code or Google Cloud Console
- [ ] Set secret with `wrangler secret put YOUTUBE_API_KEY --name youtube-api-proxy`
- [ ] Verify secret is set with `wrangler secret list`
- [ ] Configure domain restrictions in Google Cloud Console
  - [ ] Add `abdulkerimsesli.de` to allowed domains
  - [ ] Add `localhost:8080` for local development

### 2.3 Update Client-Side Code

- [ ] Open `pages/videos/videos.js`
- [ ] Remove `globalThis.YOUTUBE_API_KEY` references
- [ ] Update all API URLs to use `/api/youtube/` prefix
  - [ ] Update `fetchChannelId()` function
  - [ ] Update `fetchUploadsPlaylist()` function
  - [ ] Update `fetchPlaylistItems()` function
  - [ ] Update `searchChannelVideos()` function
  - [ ] Update `fetchVideoDetailsMap()` function
- [ ] Remove API key parameter from all function signatures
- [ ] Test locally with worker running

### 2.4 Deploy and Test Worker

- [ ] Deploy worker with `wrangler deploy`
- [ ] Test production endpoint with curl
- [ ] Verify videos page loads correctly
- [ ] Check browser DevTools for API errors
- [ ] Monitor worker logs for issues

---

## 3. Content Security Policy Implementation

### 3.1 Phase 1 - Report-Only Mode

- [ ] Open `_headers` file
- [ ] Add `Content-Security-Policy-Report-Only` header with strict policy:
  ```
  Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https://i.ytimg.com https://www.youtube.com data: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://www.googleapis.com https://www.google-analytics.com; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
  ```
- [ ] Deploy to staging/production
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

- [ ] Open `content/utils/shared-utilities.js`
- [ ] Add production detection to `createLogger()`
- [ ] Modify `warn()` to skip in production
- [ ] Modify `info()` to skip in production
- [ ] Keep `error()` always enabled
- [ ] Test logger in dev mode
- [ ] Test logger in production mode (check hostname)

### 4.2 Clean Up Main Application

- [ ] Open `content/main.js`
- [ ] Replace `console.log` with `log.info()`
- [ ] Replace `console.warn` with `log.warn()`
- [ ] Replace `console.error` with `log.error()`
- [ ] Remove unnecessary debug statements
- [ ] Test application still works

### 4.3 Clean Up Blog App

- [ ] Open `pages/blog/blog-app.js`
- [ ] Import `createLogger` from shared-utilities
- [ ] Create logger instance: `const log = createLogger('BlogApp')`
- [ ] Replace `console.warn` with `log.warn()`
- [ ] Test blog page loads correctly

### 4.4 Clean Up Head Components

- [ ] Open `content/components/head/head-inline.js`
- [ ] Replace `console.error` with logger
- [ ] Test head scripts load correctly
- [ ] Open `content/components/head/head-complete.js`
- [ ] Verify logger is already used (it is)
- [ ] Remove any remaining console statements

### 4.5 Clean Up Video Config Loader

- [ ] Open `content/config/videos-config-loader.js`
- [ ] Replace `console.warn` with logger
- [ ] Test videos page loads correctly

### 4.6 Verify Cleanup

- [ ] Search entire codebase for `console.log` (excluding node_modules, dev-server.js)
- [ ] Search for `console.warn` (excluding dev-only files)
- [ ] Search for `console.error` (excluding dev-only files)
- [ ] Verify only logger calls remain in production code
- [ ] Test production build has no console output

---

## 5. Testing & Verification

### 5.1 Dependency Testing

- [ ] Run `npm audit` - verify 0 vulnerabilities
- [ ] Run `npm run lint` - verify no errors
- [ ] Run `npm run format` - verify formatting works
- [ ] Run `npm run dev` - verify dev server starts
- [ ] Test all pages load correctly

### 5.2 API Proxy Testing

- [ ] Test videos page loads
- [ ] Verify videos display correctly
- [ ] Check Network tab - verify requests go to `/api/youtube/`
- [ ] Verify no API key in request URLs
- [ ] Test with slow network (throttling)
- [ ] Test error handling (invalid requests)

### 5.3 CSP Testing

- [ ] Open browser DevTools console
- [ ] Navigate to all pages
- [ ] Verify no CSP violations
- [ ] Test with Chrome, Firefox, Safari
- [ ] Test on mobile devices
- [ ] Run Lighthouse audit - check security score

### 5.4 Console Cleanup Testing

- [ ] Open production site in browser
- [ ] Open DevTools console
- [ ] Navigate through all pages
- [ ] Verify no console.log/warn output (only errors if any)
- [ ] Test in dev mode - verify logger works

---

## 6. Documentation & Cleanup

### 6.1 Update Documentation

- [ ] Update `README.md` with security section
- [ ] Create `docs/SECURITY.md` with:
  - [ ] CSP explanation
  - [ ] API key management guide
  - [ ] Dependency update process
  - [ ] Security best practices
- [ ] Update `CHANGELOG.md` with all changes
- [ ] Add comments to `_headers` explaining CSP directives

### 6.2 Code Review Checklist

- [ ] All tasks completed
- [ ] No API keys in client code
- [ ] CSP header active and working
- [ ] No console statements in production
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Git commits are clean and atomic

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
