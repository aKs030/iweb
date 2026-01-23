# Security & Dependencies Fix - Requirements

## Overview

Address critical security vulnerabilities and dependency issues identified in the code review. This spec focuses on the highest priority items that pose immediate security risks and maintenance problems.

## Feature Name

`security-and-dependencies-fix`

## User Stories

### 1. As a developer, I want consistent code formatting across the project

**Acceptance Criteria:**

- Prettier version in package.json matches installed version
- All files format consistently with the same Prettier version
- No version conflicts in package-lock.json

### 2. As a security-conscious developer, I want to eliminate known vulnerabilities

**Acceptance Criteria:**

- No moderate or high severity vulnerabilities in npm audit
- Lodash vulnerability is resolved
- All dependencies are up to date with security patches

### 3. As a site owner, I want to protect my API keys from public exposure

**Acceptance Criteria:**

- YouTube API key is not exposed in client-side code
- API calls are proxied through serverless functions
- API keys are stored in environment variables only
- Domain restrictions are configured for API keys

### 4. As a security engineer, I want proper Content Security Policy headers

**Acceptance Criteria:**

- CSP header is defined in \_headers file
- CSP allows only necessary sources for scripts, styles, images
- CSP blocks inline scripts (or uses nonces)
- CSP is tested and doesn't break existing functionality

### 5. As a developer, I want to remove debug console statements from production

**Acceptance Criteria:**

- All console.log statements are removed or wrapped in logger
- Logger respects environment (debug mode only in dev)
- Production builds have no console output
- Existing logger utility is used consistently

## Technical Requirements

### 1. Dependency Updates

- Update Prettier to version 3.8.1 in package.json
- Run npm audit fix to resolve lodash vulnerability
- Update all devDependencies to latest stable versions
- Verify no breaking changes in updated packages

### 2. API Key Security

- Create Cloudflare Worker endpoint for YouTube API proxy
- Move YOUTUBE_API_KEY to Wrangler secrets
- Update pages/videos/videos.js to call worker endpoint
- Add rate limiting to worker endpoint
- Configure API key domain restrictions in Google Cloud Console

### 3. Content Security Policy

- Define strict CSP in \_headers file
- Allow specific domains for:
  - Scripts: self, cdn.jsdelivr.net, www.googletagmanager.com
  - Styles: self, fonts.googleapis.com
  - Images: self, i.ytimg.com, data:
  - Fonts: fonts.gstatic.com
  - Connect: self, www.googleapis.com, worker endpoints
- Use nonces for inline scripts or move to external files
- Test CSP with browser console and CSP Evaluator

### 4. Console Statement Cleanup

- Audit all console.log/warn/error usage
- Replace with createLogger utility where appropriate
- Remove unnecessary debug statements
- Keep only critical error logging
- Ensure logger respects LOG_LEVEL environment variable

## Out of Scope

- Build system modernization (separate spec)
- Testing infrastructure (separate spec)
- TypeScript migration (separate spec)
- Performance optimizations (separate spec)

## Success Metrics

- npm audit shows 0 vulnerabilities
- No API keys visible in client-side code
- CSP header returns 200 with no console errors
- Lighthouse security score improves
- Code passes ESLint with no console warnings

## Dependencies

- Access to Cloudflare Workers (already configured)
- Access to Google Cloud Console for API key restrictions
- Wrangler CLI for secrets management

## Risks & Mitigations

### Risk: CSP breaks existing functionality

**Mitigation:**

- Test incrementally with report-only mode first
- Document all allowed sources
- Have rollback plan ready

### Risk: API proxy adds latency

**Mitigation:**

- Implement caching in worker
- Use edge caching with stale-while-revalidate
- Monitor response times

### Risk: Breaking changes in dependency updates

**Mitigation:**

- Update one package at a time
- Test thoroughly after each update
- Keep git commits atomic for easy rollback

## Timeline Estimate

- Dependency updates: 2 hours
- API key security: 4 hours
- CSP implementation: 3 hours
- Console cleanup: 2 hours
- Testing & verification: 3 hours

**Total: ~14 hours (2 working days)**

## Notes

- This spec addresses the "HIGH PRIORITY" items from the code review
- All changes should be backward compatible
- Focus on security first, optimization later
- Document all changes in CHANGELOG.md
