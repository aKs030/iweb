# Security Documentation

This document describes the security measures implemented in this project.

## Overview

This project implements multiple layers of security to protect sensitive data and ensure safe operation in production environments.

## 1. Content Security Policy (CSP)

### Current Status: Report-Only Mode

The site currently runs CSP in **report-only mode** to monitor violations without blocking content.

### CSP Configuration

Location: `_headers` file

```
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' https://i.ytimg.com https://i9.ytimg.com https://www.youtube.com https://www.google-analytics.com data: blob:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://www.googleapis.com https://www.google-analytics.com;
  frame-src https://www.youtube-nocookie.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests
```

### Allowed Sources

- **Scripts**: Self, inline (temporary), jsDelivr CDN, Google Tag Manager, Google Analytics
- **Styles**: Self, inline (temporary), Google Fonts
- **Images**: Self, YouTube thumbnails, Google Analytics, data URIs, blobs
- **Fonts**: Self, Google Fonts
- **Connections**: Self, Google APIs, Google Analytics
- **Frames**: YouTube (privacy-enhanced mode only)

### Roadmap to Enforcement

1. **Phase 1** (Current): Report-only mode - collect violations
2. **Phase 2** (Planned): Fix violations - move inline scripts, add nonces
3. **Phase 3** (Planned): Enforce mode - block violating content

### Monitoring CSP Violations

Check browser console for CSP violation reports. Common violations to watch for:

- Inline scripts without nonces
- External resources from non-whitelisted domains
- Eval usage in third-party libraries

## 2. API Key Security

### YouTube Data API v3

**Problem**: API keys exposed in client-side code can be stolen and abused.

**Solution**: Cloudflare Worker proxy

#### Architecture

```
Client → /api/youtube/* → Cloudflare Worker → YouTube API
                          (injects API key)
```

#### Implementation

- **Worker Location**: `workers/youtube-api-proxy/`
- **Routes**: `/api/youtube/*` on `abdulkerimsesli.de`
- **API Key Storage**: Environment variable `YOUTUBE_API_KEY` (server-side only)
- **Caching**: 1 hour TTL to reduce API quota usage
- **Error Handling**: Graceful fallbacks with user-friendly messages

#### Deployment

```bash
cd workers/youtube-api-proxy
wrangler secret put YOUTUBE_API_KEY
wrangler deploy
```

#### Testing

```bash
# Test the proxy endpoint
curl "https://www.abdulkerimsesli.de/api/youtube/search?part=snippet&type=channel&q=aks.030&maxResults=1"
```

#### Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Select your YouTube Data API v3 key
4. Under "Application restrictions" → "HTTP referrers", add:
   - `abdulkerimsesli.de/*`
   - `www.abdulkerimsesli.de/*`
   - `localhost:8080/*` (for local development)

## 3. Production Logging

### Logger System

Location: `content/utils/shared-utilities.js`

#### Features

- **Environment Detection**: Automatically detects production vs development
- **Production Mode**: Only errors are logged (no warnings or info)
- **Development Mode**: All log levels enabled
- **Debug Mode**: Enable via `?debug=true` URL parameter or `localStorage.setItem('iweb-debug', 'true')`

#### Usage

```javascript
import { createLogger } from '/content/utils/shared-utilities.js';

const log = createLogger('ModuleName');

log.error('Critical error', error); // Always shown
log.warn('Warning message'); // Only in development
log.info('Info message'); // Only in development
log.debug('Debug details'); // Only when debug mode enabled
```

#### Production Detection

The logger considers the environment as production when:

- Hostname is NOT `localhost` or `127.0.0.1`
- Hostname is NOT a private IP (192.168._, 10._)
- Protocol is NOT `file://`

## 4. Dependency Management

### Current Status

- ✅ **0 vulnerabilities** (verified with `npm audit`)
- ✅ All dependencies up to date
- ✅ Prettier 3.8.1
- ✅ Marked 17.0.1

### Update Process

```bash
# Check for vulnerabilities
npm audit

# Auto-fix vulnerabilities
npm audit fix

# Update specific package
npm install package-name@latest

# Verify no vulnerabilities remain
npm audit
```

### Regular Maintenance

- Run `npm audit` weekly
- Update dependencies monthly
- Test thoroughly after updates
- Keep `package-lock.json` in version control

## 5. Security Headers

Location: `_headers` file

### Implemented Headers

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
```

### Header Explanations

- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Referrer-Policy**: Controls referrer information sent with requests
- **HSTS**: Forces HTTPS connections
- **X-Frame-Options**: Prevents clickjacking attacks
- **Permissions-Policy**: Restricts browser features

## 6. Best Practices

### For Developers

1. **Never commit API keys** - Use environment variables
2. **Use the logger** - Don't use `console.log` in production code
3. **Test CSP changes** - Always test in report-only mode first
4. **Keep dependencies updated** - Run `npm audit` regularly
5. **Review security headers** - Ensure they match your requirements

### For Deployment

1. **Set environment variables** - Configure API keys in Cloudflare
2. **Enable HTTPS** - Always use HTTPS in production
3. **Monitor logs** - Check for CSP violations and errors
4. **Test thoroughly** - Verify all features work after security updates

### For Maintenance

1. **Weekly**: Check `npm audit` for vulnerabilities
2. **Monthly**: Update dependencies
3. **Quarterly**: Review and update CSP policy
4. **Annually**: Rotate API keys

## 7. Incident Response

### If API Key is Compromised

1. Immediately revoke the key in Google Cloud Console
2. Generate a new API key
3. Update the worker secret: `wrangler secret put YOUTUBE_API_KEY`
4. Deploy the worker: `wrangler deploy`
5. Monitor usage for unusual activity

### If CSP Violation Detected

1. Check browser console for violation details
2. Identify the source (inline script, external resource, etc.)
3. Either:
   - Add the source to CSP whitelist (if trusted)
   - Remove/refactor the violating code
   - Add nonce to inline scripts
4. Test in report-only mode before enforcing

## 8. Security Checklist

- [x] API keys not exposed in client code
- [x] CSP header configured (report-only mode)
- [x] Security headers enabled (HSTS, X-Frame-Options, etc.)
- [x] Logger respects production environment
- [x] No console statements in production
- [x] Dependencies have 0 vulnerabilities
- [ ] CSP violations monitored and fixed (in progress)
- [ ] CSP enforcement mode enabled (planned)
- [ ] Regular security audits scheduled

## 9. Resources

- [Content Security Policy Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [YouTube Data API Documentation](https://developers.google.com/youtube/v3)

## 10. Contact

For security concerns or to report vulnerabilities, please contact the project maintainer.

---

**Last Updated**: January 23, 2025  
**Version**: 1.0.0
