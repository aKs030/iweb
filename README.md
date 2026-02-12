# 🌐 Portfolio Website - Abdulkerim Sesli

Modernes Portfolio mit 3D Earth Visualisierung, AI-gestützter Suche und Progressive Web App Features.

## ✨ Features

- 🌍 **Interactive 3D Earth** - Three.js powered globe visualization
- 🤖 **AI Search** - Cloudflare AI-powered search with RAG
- 📱 **Progressive Web App** - Offline support with Service Worker
- 🎨 **Modern Design** - Responsive, accessible, dark mode support
- ⚡ **Performance** - Optimized bundle (~240 kB gzip), fast loading
- 🔍 **SEO Optimized** - Meta tags, structured data, sitemap
- 🌐 **i18n Ready** - German/English language support

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (see `.nvmrc`)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### Build

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
.
├── content/              # Frontend code
│   ├── components/      # Web Components (Menu, Footer, Search, etc.)
│   ├── core/            # Core utilities (i18n, routing, etc.)
│   └── styles/          # CSS architecture
├── pages/               # Page-specific code
│   ├── home/           # Homepage with 3D Earth
│   ├── projekte/       # Projects showcase
│   ├── blog/           # Blog with articles
│   ├── gallery/        # Photo gallery
│   └── videos/         # Video portfolio
├── functions/           # Cloudflare Pages Functions (API)
│   ├── api/            # API endpoints (search, ai)
│   └── _middleware.js  # Request middleware
├── docs/                # Documentation
└── .github/             # CI/CD workflows
```

## 🛠️ Tech Stack

### Frontend

- **Vanilla JavaScript** (ES6+) - No framework overhead
- **Three.js** - 3D graphics and Earth visualization
- **Web Components** - Reusable custom elements
- **CSS3** - Modern CSS with custom properties

### Backend

- **Cloudflare Pages Functions** - Serverless API endpoints
- **Cloudflare AI** - AI-powered search with RAG
- **Service Bindings** - Inter-service communication

### Build & Tools

- **Vite** - Fast build tool and dev server
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Husky** - Git hooks

## 📜 Available Scripts

### Development

```bash
npm run dev              # Start dev server (port 8080)
```

### Build & Deploy

```bash
npm run build            # Production build
npm run preview          # Preview production build
npm run deploy           # Deploy to Cloudflare Pages
```

### Code Quality

```bash
npm run lint             # ESLint with auto-fix
npm run format           # Prettier with auto-fix
npm run check            # Lint + Format check
npm run quality          # All quality checks (knip, duplicates, etc.)
```

### Analysis

```bash
npm run knip             # Find unused code
npm run css:check        # CSS statistics
npm run size:check       # Bundle sizes
npm run perf:budget      # Check performance budget
npm run build:analyze    # Visual bundle analysis
```

## 🌍 Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Cloudflare AI Search (Service Binding)
AI_SEARCH_INDEX=suche
RAG_ID=suche
MAX_SEARCH_RESULTS=10
```

For Cloudflare secrets:

```bash
wrangler secret put GROQ_API_KEY
```

## 🚢 Deployment

### Cloudflare Pages

The project is configured for Cloudflare Pages with automatic deployments:

1. **Push to main branch** - Automatic production deployment
2. **Pull requests** - Preview deployments

Build settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 18+

### Manual Deployment

```bash
npm run build
npm run deploy
```

## 📚 Documentation

- [DEVELOPMENT.md](DEVELOPMENT.md) - Development guide
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - Current project status
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contributing guidelines
- [SECURITY.md](SECURITY.md) - Security policy

### Technical Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [docs/CSS_GUIDE.md](docs/CSS_GUIDE.md) - CSS architecture
- [docs/PERFORMANCE_OPTIMIZATION.md](docs/PERFORMANCE_OPTIMIZATION.md) - Performance guide
- [docs/BUNDLE_OPTIMIZATION.md](docs/BUNDLE_OPTIMIZATION.md) - Bundle optimization
- [functions/README.md](functions/README.md) - API documentation

## 🧪 Code Quality

The project maintains high code quality standards:

- ✅ ESLint: 0 errors, 0 warnings
- ✅ Prettier: Consistent formatting
- ✅ TypeScript: JSDoc type checking
- ✅ Bundle size: ~240 kB (gzip)
- ✅ Performance: Optimized loading

Run quality checks:

```bash
npm run quality
```

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/xyz`
3. Make your changes
4. Run quality checks: `npm run quality`
5. Commit: `git commit -m "feat: xyz"`
6. Push: `git push origin feature/xyz`
7. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Abdulkerim Sesli**

- Website: [abdulkerimsesli.de](https://abdulkerimsesli.de)

## 🙏 Acknowledgments

- Three.js community for 3D graphics
- Cloudflare for hosting and AI services
- Open source community

---

**Status:** ✅ Production Ready  
**Version:** 1.0.0  
**Last Updated:** February 2026
