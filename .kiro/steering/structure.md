# Project Structure

## Directory Organization

```
.
├── content/              # Frontend application code
│   ├── components/      # Web Components (Menu, Footer, Search, etc.)
│   ├── core/            # Core utilities (i18n, routing, cache, etc.)
│   ├── config/          # Configuration files
│   ├── styles/          # CSS architecture
│   ├── templates/       # HTML templates (base-head, base-loader)
│   ├── assets/          # Static assets
│   └── main.js          # Main entry point
│
├── pages/               # Page-specific code and content
│   ├── home/           # Homepage with 3D Earth
│   ├── projekte/       # Projects showcase
│   ├── blog/           # Blog articles
│   ├── gallery/        # Photo gallery
│   ├── videos/         # Video portfolio
│   ├── about/          # About page
│   └── contact/        # Contact page
│
├── functions/           # Cloudflare Pages Functions (API)
│   ├── api/            # API endpoints
│   │   ├── search.js   # AI-powered search
│   │   └── ai.js       # AI chat endpoint
│   └── _middleware.js  # Request middleware & template injection
│
├── docs/                # Technical documentation
│   ├── ARCHITECTURE.md
│   ├── CSS_GUIDE.md
│   ├── PERFORMANCE_OPTIMIZATION.md
│   └── BUNDLE_OPTIMIZATION.md
│
├── .github/             # CI/CD workflows
│   └── workflows/
│       ├── ci.yml
│       └── performance.yml
│
├── .kiro/               # Kiro AI assistant configuration
│   └── steering/        # Steering rules for AI
│
└── dist/                # Build output (generated)
```

## Key Files

- `index.html`: Main HTML entry point
- `sw.js`: Service Worker for PWA
- `server.js`: Local development server (Node.js)
- `vite.config.js`: Vite build configuration
- `eslint.config.mjs`: ESLint flat config
- `tsconfig.json`: TypeScript/JSDoc type checking
- `.prettierrc.json`: Prettier formatting rules
- `manifest.json`: PWA manifest
- `robots.txt`, `sitemap.xml`: SEO files
- `_headers`, `_redirects`: Cloudflare Pages config

## Architecture Patterns

### Frontend Architecture

- **No Framework**: Pure vanilla JavaScript with ES6+ modules
- **Web Components**: Custom elements for reusable UI (e.g., `<search-component>`)
- **Module Pattern**: Each component/utility is a separate ES module
- **Event-Driven**: Custom events for component communication
- **Lazy Loading**: Dynamic imports for code splitting

### Component Structure

Components follow this pattern:

```
content/components/[component-name]/
├── [component-name].js    # Component logic
└── [component-name].css   # Component styles
```

### Page Structure

Pages are organized by route:

```
pages/[page-name]/
├── [page-name].html       # Page HTML
├── [page-name]-app.js     # Page logic
└── [page-name].css        # Page styles
```

### Core Utilities Location

- `content/core/i18n.js`: Internationalization
- `content/core/router.js`: Client-side routing
- `content/core/cache.js`: IndexedDB caching
- `content/core/error-tracker.js`: Error tracking
- `content/core/loader-manager.js`: Loading states (v3.0.0)
- `content/core/types.js`: TypeScript type definitions

### API Structure

Cloudflare Pages Functions follow this pattern:

```
functions/api/[endpoint].js
```

Each exports an `onRequest` or `onRequestPost` handler.

## Naming Conventions

- **Files**: kebab-case (e.g., `search-component.js`)
- **Classes**: PascalCase (e.g., `SearchComponent`)
- **Functions**: camelCase (e.g., `handleSearch`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RESULTS`)
- **CSS Classes**: kebab-case with BEM-like structure

## Import Paths

Vite aliases configured:

- `/content/*` → `content/*`
- `/pages/*` → `pages/*`

Example:

```javascript
import { i18n } from '/content/core/i18n.js';
import { router } from '/content/core/router.js';
```

## Build Output

The `dist/` directory mirrors the source structure:

```
dist/
├── assets/              # Hashed JS/CSS bundles
├── content/             # Copied content directory
├── pages/               # Copied pages directory
├── functions/           # Cloudflare Functions (not bundled)
├── index.html           # Processed HTML
└── [static files]       # sw.js, manifest.json, etc.
```

## Code Organization Principles

1. **Separation of Concerns**: Content, logic, and styles are separated
2. **Modularity**: Each component/utility is self-contained
3. **Reusability**: Shared utilities in `content/core/`
4. **Lazy Loading**: Heavy dependencies (Three.js) loaded on demand
5. **Progressive Enhancement**: Core functionality works without JS
