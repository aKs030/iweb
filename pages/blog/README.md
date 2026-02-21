# Blog Application

Modern blog with 3D particle system, React components, and SEO optimization.

## Structure

```
blog/
├── blog-app.js              # Main React application
├── utils/                   # Utility modules
│   ├── ParticleSystem.js   # 3D canvas animation
│   ├── blog-utils.js       # Text & URL utilities
│   ├── data-loader.js      # Async post loading
│   └── seo-manager.js      # SEO & Schema.org
└── components/              # React components
    └── BlogComponents.js   # UI components
```

## Modules

### Core Application

**`blog-app.js`** (499 lines)

- Main React app with routing
- Post filtering and search
- Mobile-responsive filters
- Article detail view

### Utilities

**`ParticleSystem.js`** (195 lines)

- 3D particle animation system
- Mouse interaction
- Spatial partitioning for performance
- Responsive particle count

**`blog-utils.js`** (105 lines)

- Text processing (stripMarkdown, estimateReadTime)
- URL handling (buildPostCanonical, toAbsoluteBlogUrl)
- Post normalization
- Keyword management

**`data-loader.js`** (88 lines)

- Async post loading with progress
- Frontmatter parsing
- Post merging and sorting
- Error handling

**`seo-manager.js`** (215 lines)

- Meta tag management
- Schema.org JSON-LD generation
- Canonical URL handling
- OpenGraph & Twitter Cards

### Components

**`BlogComponents.js`** (89 lines)

- `ProgressiveImage` - Lazy loading images
- `ScrollToTop` - Scroll button
- `ReadingProgress` - Progress bar

## Usage

The blog is a self-contained React application that:

1. Loads posts from `/pages/blog/posts/index.json`
2. Renders 3D particle background
3. Provides filtering and search
4. Handles routing for individual posts
5. Manages SEO metadata dynamically

## Features

- ✅ 3D particle system background
- ✅ Progressive image loading
- ✅ Reading progress indicator
- ✅ Mobile-responsive filters
- ✅ SEO-optimized with Schema.org
- ✅ Client-side routing
- ✅ Search functionality
