# Tech Stack

## Frontend

- **Vanilla JavaScript (ES6+)**: No framework overhead, modern ES modules
- **Three.js**: 3D graphics engine for Earth visualization
- **Web Components**: Custom elements for reusable UI components
- **CSS3**: Modern CSS with custom properties, no preprocessor needed
- **Service Worker**: PWA support with offline capabilities

## Backend

- **Cloudflare Pages Functions**: Serverless API endpoints
- **Cloudflare AI Search Beta**: AI-powered search with automatic crawling (`wispy-pond-1055`)
- **Groq API**: Free LLM for robot chat (`llama-3.3-70b-versatile`)
- **Resend API**: Email service for contact form

## Deployment

- **No Build System**: Source files deployed directly
- **Cloudflare Pages**: Automatic deployment from GitHub
- **CDN Dependencies**: React, Three.js, DOMPurify via Import Maps

## Code Quality Tools

- **ESLint 9+**: Linting with flat config (eslint.config.mjs)
- **Prettier**: Code formatting (single quotes, 2 spaces, trailing commas)
- **Husky**: Git hooks for pre-commit/pre-push checks
- **Knip**: Unused code detection
- **TypeScript**: JSDoc type checking (checkJs: false, strict: false)

## Compression & Optimization

- **Gzip + Brotli**: Dual compression for all assets
- **Code Splitting**: Automatic chunking (Three.js vendor, core utilities)
- **Tree Shaking**: Dead code elimination
- **Bundle Visualizer**: rollup-plugin-visualizer for analysis

## Common Commands

### Development

```bash
npm run dev              # Start dev server (port 8080)
```

### Deployment

```bash
npm run push             # Git add + commit + push (triggers Cloudflare deployment)
```

### Code Quality

```bash
npm run lint             # ESLint with auto-fix
npm run format           # Prettier with auto-fix
npm run check            # Lint + format check (no fix)
npm run fix              # Run both lint and format with fixes
npm run quality          # Full quality check (lint + format + knip)
```

### Analysis

```bash
npm run knip             # Find unused code
npm run size:check       # Check bundle sizes
```

## Node Version

- **Required**: Node.js 18+ (see .nvmrc)
- **Package Manager**: npm (package-lock.json present)

## Environment Variables

**Cloudflare Pages Secrets (via Dashboard or wrangler CLI):**

```bash
GROQ_API_KEY=<your-groq-api-key>
RESEND_API_KEY=<your-resend-api-key>
```

**wrangler.toml (non-secrets):**

```bash
MAX_SEARCH_RESULTS=10
```

**Bindings (automatic from wrangler.toml):**

- `AI` → Cloudflare Workers AI
- `GALLERY_BUCKET` → R2 Bucket `img`

## Performance Targets

- No build time (source files deployed directly)
- Lighthouse score: 95+
- Core Web Vitals optimized
