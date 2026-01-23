# Security & Dependencies Fix - Design Document

## Architecture Overview

This design addresses four critical areas:

1. **Dependency Management** - Version alignment and vulnerability fixes
2. **API Security** - Moving API keys to serverless layer
3. **Content Security Policy** - Defense-in-depth against XSS
4. **Code Quality** - Removing debug statements

## Design Decisions

### 1. Dependency Updates Strategy

**Decision:** Update Prettier to v3.x and fix lodash vulnerability via parent dependency updates

**Rationale:**

- Prettier 3.x has better performance and TypeScript support
- Lodash vulnerability is in transitive dependency (likely from Sharp or Marked)
- Updating to latest stable versions reduces future security debt

**Implementation:**

```json
// package.json changes
{
  "devDependencies": {
    "prettier": "^3.8.1", // was 2.8.8
    "marked": "^14.1.3", // update from 5.1.2
    "sharp": "^0.34.5" // keep current (already latest)
  }
}
```

**Migration Steps:**

1. Update package.json
2. Delete node_modules and package-lock.json
3. Run `npm install`
4. Run `npm audit` to verify fixes
5. Run `npm run format` to reformat with new Prettier
6. Commit formatting changes separately

---

### 2. YouTube API Proxy Architecture

**Decision:** Create dedicated Cloudflare Worker for YouTube API proxy

**Rationale:**

- Keeps API keys server-side only
- Enables rate limiting and caching
- Leverages existing Cloudflare Workers infrastructure
- No additional hosting costs

**Architecture Diagram:**

```
┌─────────────┐
│   Browser   │
│ (videos.js) │
└──────┬──────┘
       │ fetch('/api/youtube/...')
       ▼
┌─────────────────────┐
│ Cloudflare Worker   │
│ youtube-api-proxy   │
│ - Rate limiting     │
│ - Caching (1h)      │
│ - API key injection │
└──────┬──────────────┘
       │ YOUTUBE_API_KEY from env
       ▼
┌─────────────────────┐
│ YouTube Data API v3 │
└─────────────────────┘
```

**Worker Implementation:**

```javascript
// workers/youtube-api-proxy/index.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const apiKey = env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return new Response('API key not configured', { status: 500 });
    }

    // Extract YouTube API endpoint from path
    // /api/youtube/search -> https://www.googleapis.com/youtube/v3/search
    const endpoint = url.pathname.replace('/api/youtube/', '');
    const youtubeUrl = `https://www.googleapis.com/youtube/v3/${endpoint}${url.search}&key=${apiKey}`;

    // Check cache first
    const cache = caches.default;
    let response = await cache.match(request);

    if (!response) {
      response = await fetch(youtubeUrl);

      // Cache successful responses for 1 hour
      if (response.ok) {
        const cloned = response.clone();
        const headers = new Headers(cloned.headers);
        headers.set('Cache-Control', 'public, max-age=3600');
        response = new Response(cloned.body, {
          status: cloned.status,
          headers,
        });
        await cache.put(request, response.clone());
      }
    }

    return response;
  },
};
```

**Client-Side Changes:**

```javascript
// pages/videos/videos.js - BEFORE
const apiKey = globalThis.YOUTUBE_API_KEY;
const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&...`;

// pages/videos/videos.js - AFTER
const url = `/api/youtube/search?part=snippet&type=channel&...`;
// No API key in client code!
```

**Wrangler Configuration:**

```toml
# wrangler.toml - add new worker
[[workers]]
name = "youtube-api-proxy"
main = "workers/youtube-api-proxy/index.js"
compatibility_date = "2025-01-23"

[workers.routes]
pattern = "*/api/youtube/*"
zone_name = "abdulkerimsesli.de"
```

**Secret Management:**

```bash
# Set secret via Wrangler CLI
wrangler secret put YOUTUBE_API_KEY --name youtube-api-proxy
# Enter: [paste API key from Google Cloud Console]
```

---

### 3. Content Security Policy Implementation

**Decision:** Implement strict CSP with gradual rollout using report-only mode first

**Rationale:**

- CSP is the most effective defense against XSS attacks
- Report-only mode allows testing without breaking functionality
- Nonces for inline scripts provide flexibility while maintaining security

**CSP Header Configuration:**

```
# _headers - Add CSP
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{NONCE}' https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https://i.ytimg.com https://www.youtube.com data: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://www.googleapis.com https://www.google-analytics.com; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

**Nonce Generation Strategy:**

Since this is a static site, we'll use a hybrid approach:

1. Generate nonce at build time for static inline scripts
2. For dynamic scripts, move to external files
3. Use CSP hash for truly static inline scripts

**Implementation Steps:**

1. **Phase 1: Report-Only Mode** (Week 1, Day 1)

   ```
   Content-Security-Policy-Report-Only: [policy]
   ```

   - Monitor violations in browser console
   - Collect reports for 24 hours
   - Identify legitimate violations

2. **Phase 2: Fix Violations** (Week 1, Day 2)
   - Move inline scripts to external files
   - Add nonces to remaining inline scripts
   - Update third-party script sources

3. **Phase 3: Enforce Mode** (Week 1, Day 3)

   ```
   Content-Security-Policy: [policy]
   ```

   - Switch from report-only to enforce
   - Monitor for issues
   - Have rollback plan ready

**Inline Script Migration:**

```html
<!-- BEFORE: index.html -->
<script>
  window.YOUTUBE_API_KEY = 'AIza...';
</script>

<!-- AFTER: Remove entirely (API key now in worker) -->
<!-- OR if needed for other config: -->
<script nonce="BUILD_TIME_NONCE" src="/config.js"></script>
```

---

### 4. Console Statement Cleanup

**Decision:** Use existing `createLogger` utility consistently, remove debug statements

**Rationale:**

- Logger already supports log levels
- Centralized logging makes debugging easier
- Production builds can strip logger calls

**Logger Enhancement:**

```javascript
// content/utils/shared-utilities.js - ENHANCE
export function createLogger(category) {
  const prefix = `[${category}]`;
  const console = globalThis.console || {};
  const noop = () => {};

  // Check if we're in production
  const isProduction =
    globalThis.location?.hostname === 'www.abdulkerimsesli.de';

  return {
    error: (message, ...args) => {
      // Always log errors, even in production
      if (globalLogLevel >= LOG_LEVELS.error) {
        (console.error || noop)(prefix, message, ...args);
      }
    },
    warn: (message, ...args) => {
      // Warn only in dev or when explicitly enabled
      if (!isProduction && globalLogLevel >= LOG_LEVELS.warn) {
        (console.warn || noop)(prefix, message, ...args);
      }
    },
    info: (message, ...args) => {
      // Info only in dev
      if (!isProduction && globalLogLevel >= LOG_LEVELS.info) {
        (console.info || noop)(prefix, message, ...args);
      }
    },
    debug: (message, ...args) => {
      // Debug only when explicitly enabled
      if (globalLogLevel >= LOG_LEVELS.debug) {
        (console.debug || noop)(prefix, message, ...args);
      }
    },
  };
}
```

**Cleanup Strategy:**

1. **Keep:** Error logging (critical issues)
2. **Convert:** Info/warn to logger utility
3. **Remove:** Debug console.log statements
4. **Remove:** Console statements in dev-server.js (dev-only file)

**Files to Update:**

- `content/main.js` - Convert to logger
- `pages/blog/blog-app.js` - Convert to logger
- `content/components/head/head-inline.js` - Convert to logger
- `content/config/videos-config-loader.js` - Convert to logger
- `scripts/dev-server.js` - Keep (dev-only)

---

## Data Flow Diagrams

### Current (Insecure):

```
Browser → YouTube API (with exposed key)
```

### Proposed (Secure):

```
Browser → Worker (no key) → YouTube API (key from env)
```

---

## Security Considerations

### API Key Protection

- ✅ Keys stored in Wrangler secrets (encrypted at rest)
- ✅ Keys never exposed to client
- ✅ Rate limiting prevents abuse
- ✅ Domain restrictions in Google Cloud Console

### CSP Protection

- ✅ Blocks inline script injection
- ✅ Whitelists only trusted sources
- ✅ Prevents clickjacking (frame-ancestors)
- ✅ Upgrades insecure requests

### Dependency Security

- ✅ Regular updates via npm audit
- ✅ Automated vulnerability scanning
- ✅ Lock file prevents supply chain attacks

---

## Testing Strategy

### 1. Dependency Updates

```bash
# Verify no vulnerabilities
npm audit

# Verify formatting works
npm run format

# Verify linting works
npm run lint
```

### 2. API Proxy

```bash
# Test worker locally
wrangler dev workers/youtube-api-proxy/index.js

# Test endpoint
curl http://localhost:8787/api/youtube/search?part=snippet&q=test

# Deploy to staging
wrangler deploy --env staging

# Test production
curl https://www.abdulkerimsesli.de/api/youtube/search?part=snippet&q=test
```

### 3. CSP

- Use browser DevTools to check violations
- Test with CSP Evaluator: https://csp-evaluator.withgoogle.com/
- Verify no console errors on all pages
- Test with different browsers (Chrome, Firefox, Safari)

### 4. Console Cleanup

- Search codebase for remaining console statements
- Verify production build has no console output
- Test logger in dev mode

---

## Rollback Plan

### If CSP breaks functionality:

1. Switch back to `Content-Security-Policy-Report-Only`
2. Investigate violations
3. Fix and redeploy

### If API proxy fails:

1. Revert client-side code to direct API calls
2. Use temporary API key with domain restrictions
3. Fix worker and redeploy

### If dependency updates break:

1. Revert package.json and package-lock.json
2. Run `npm install`
3. Investigate breaking changes

---

## Performance Impact

### API Proxy

- **Latency:** +50-100ms (worker processing)
- **Mitigation:** Edge caching (1 hour TTL)
- **Benefit:** Reduced client-side bundle size

### CSP

- **Latency:** Negligible (<1ms header parsing)
- **Benefit:** Prevents XSS attacks

### Console Cleanup

- **Benefit:** Slightly smaller bundle size
- **Benefit:** Cleaner production logs

---

## Monitoring & Alerts

### Metrics to Track

- npm audit vulnerability count (target: 0)
- CSP violation reports (target: 0)
- API proxy error rate (target: <1%)
- API proxy latency (target: <200ms p95)

### Alerts

- Email on npm audit vulnerabilities
- Slack notification on CSP violations
- PagerDuty on API proxy errors >5%

---

## Documentation Updates

### Files to Update

- `README.md` - Add security section
- `docs/SECURITY.md` - Create new security guide
- `wrangler.toml` - Document worker configuration
- `_headers` - Add CSP comments

### Developer Guide

- How to set up API keys locally
- How to test CSP changes
- How to use logger utility

---

## Success Criteria

✅ All acceptance criteria from requirements.md met
✅ npm audit shows 0 vulnerabilities
✅ No API keys in client-side code
✅ CSP header active with no violations
✅ Console statements cleaned up
✅ All tests passing
✅ Documentation updated
✅ Code reviewed and approved

---

## Next Steps (After This Spec)

1. Build System Modernization (Vite integration)
2. Testing Infrastructure (Vitest setup)
3. Performance Optimizations (Image pipeline)
4. TypeScript Migration (Gradual adoption)
