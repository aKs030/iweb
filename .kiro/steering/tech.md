# Tech Stack

## Frontend

- **Vanilla JavaScript (ES6+)**: No framework overhead, modern ES modules
- **Three.js**: 3D graphics engine for Earth visualization
- **Web Components**: Custom elements for reusable UI components
- **CSS3**: Modern CSS with custom properties, no preprocessor needed
- **Service Worker**: PWA support with offline capabilities

## Backend

- **Cloudflare Pages Functions**: Serverless API endpoints
- **Cloudflare AI**: AI-powered search with RAG
- **Service Bindings**: Secure inter-service communication

## Build System

- **Vite 5.4+**: Fast build tool and dev server
- **Terser**: JavaScript minification with console removal in production
- **Rollup**: Module bundling with code splitting
- **PostCSS**: CSS processing (implicit via Vite)

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

### Build & Deploy

```bash
npm run build            # Production build
npm run preview          # Preview production build
npm run deploy           # Deploy to Cloudflare Pages
npm run build:analyze    # Build with bundle visualizer
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

Required in `wrangler.toml`:

```bash
MAX_SEARCH_RESULTS=10
```

For Cloudflare Pages secrets (via Dashboard):

```bash
GROQ_API_KEY=<your-groq-api-key>
```

## Performance Targets

- Bundle size: ~240 kB (gzip)
- CSS size: ~6 kB (gzip)
- Build time: ~3-4 seconds
- Lighthouse score: 95+
