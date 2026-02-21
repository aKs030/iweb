# Middleware Utilities

Modular utilities for Cloudflare Pages Middleware.

## Modules

### Security

**`csp-manager.js`** - Content Security Policy management

- `generateNonce()` - Generate cryptographic nonce
- `injectNonce()` - Add nonce to inline scripts/styles
- `applyNonceToCSP()` - Update CSP header with nonce

### Templates

**`template-injector.js`** - HTML template injection

- `injectTemplates()` - Inject head/loader templates
- `loadTemplateFromURL()` - Fetch template content
- `SectionInjector` - HTMLRewriter handler for ESI

### HTML Processing

**`viewport-manager.js`** - Viewport meta tag management

- `mergeViewportContent()` - Merge viewport settings
- `ensureViewportMeta()` - Ensure optimized viewport tag

### Development

**`dev-utils.js`** - Development environment utilities

- `isLocalhost()` - Check if running locally
- `normalizeLocalDevHeaders()` - Adjust headers for localhost

## Usage

```javascript
import { generateNonce, injectNonce } from './_middleware-utils/csp-manager.js';
import { injectTemplates } from './_middleware-utils/template-injector.js';

// Generate and inject CSP nonce
const nonce = generateNonce();
html = injectNonce(html, nonce);

// Inject templates
html = injectTemplates(html, { head, loader });
```

## Architecture

Each module has a single responsibility:

- **CSP Manager** → Security
- **Template Injector** → Content
- **Viewport Manager** → Meta tags
- **Dev Utils** → Development

This separation makes testing and maintenance easier.
