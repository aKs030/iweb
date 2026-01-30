# Portfolio Website - Abdulkerim Sesli

Modern portfolio website mit React, Three.js und kostenloser AI-Integration.

## 🚀 Features

- **3D Earth Visualization** - Interaktive Three.js Earth mit WebGL
- **AI Robot Companion** - Groq-powered Chat (100% kostenlos)
- **RAG Search** - Retrieval-Augmented Generation für kontextbezogene Antworten
- **PWA** - Progressive Web App mit Offline-Support
- **Performance** - Optimiert für schnelle Ladezeiten
- **SEO** - Vollständig optimiert für Suchmaschinen

## 📦 Tech Stack

### Frontend

- **Vanilla JavaScript** - Kein Framework-Overhead
- **Three.js** - 3D Graphics
- **Web Components** - Wiederverwendbare Komponenten
- **CSS3 + PostCSS** - Modern styling mit CSS Nesting & Autoprefixer

### Backend (Cloudflare Workers)

- **Groq AI** - Kostenlose AI-Inference (Llama 3.3 70B)
- **YouTube API Proxy** - Caching & Rate Limiting
- **Search API** - Volltextsuche mit Relevanz-Scoring

### Infrastructure

- **Cloudflare Pages** - Hosting & CDN
- **Cloudflare Workers** - Serverless Functions
- **Vite** - Build Tool
- **PostCSS** - CSS Nesting, Autoprefixer, Minification

## 🏗️ Projekt-Struktur

```
.
├── content/                    # Frontend Code
│   ├── components/            # Web Components
│   │   ├── robot-companion/  # AI Chat Bot
│   │   ├── particles/        # Three.js Earth
│   │   ├── menu/             # Navigation
│   │   └── footer/           # Footer
│   ├── core/                 # Core Utilities
│   ├── config/               # Configuration
│   └── styles/               # CSS Architecture
│       ├── components/       # Modular Components (Search, Card)
│       ├── root.css          # CSS Variables & Theme
│       ├── main.css          # Base Styles
│       └── animations.css    # Keyframes
│
├── pages/                     # Page Content
│   ├── home/                 # Homepage
│   ├── projekte/             # Projects
│   ├── gallery/              # Photo Gallery
│   ├── blog/                 # Blog
│   └── videos/               # Video Gallery
│
├── workers/                   # Cloudflare Workers
│   ├── ai-search-proxy/      # AI & Search API
│   └── youtube-api-proxy/    # YouTube Proxy
│
└── docs/                      # Documentation
    ├── GROQ_AI_INTEGRATION.md
    ├── CLOUDFLARE_OPTIMIZATION.md
    └── ARCHITECTURE.md
```

## 🚀 Quick Start

### Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open browser
open http://localhost:5173
```

### Build

```bash
# Production build
npm run build

# Preview build
npm run preview
```

### Deploy

```bash
# Deploy to Cloudflare Pages
git push

# Deploy Workers
./workers/deploy.sh
```

## 🔧 Configuration

### Environment Variables

```bash
# Groq AI (kostenlos!)
GROQ_API_KEY=your_groq_api_key

# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key
```

### Secrets Setup

```bash
# AI Search Proxy
wrangler secret put GROQ_API_KEY

# YouTube Proxy
wrangler secret put YOUTUBE_API_KEY --env youtube
```

## 📡 API Endpoints

### AI Chat

```bash
POST /api/gemini
{
  "prompt": "Deine Frage",
  "options": {"useSearch": true}
}
```

### Search

```bash
POST /api/search
{
  "query": "Suchbegriff",
  "topK": 5
}
```

### YouTube Proxy

```bash
GET /api/youtube/search?part=snippet&q=react&type=video
```

## 🧪 Testing

```bash
# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

## 📊 Performance

- **Lighthouse Score:** 95+
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3s
- **AI Response Time:** ~100-500ms

## 🔒 Security

- ✅ Content Security Policy (CSP)
- ✅ HSTS with Preload
- ✅ API Keys server-side
- ✅ Rate Limiting
- ✅ Input Validation

## 📚 Documentation

- **[Project Status](PROJECT_STATUS.md)** - Current project status & metrics
- **[CSS Guide](docs/CSS_GUIDE.md)** - CSS architecture & best practices
- **[Architecture](docs/ARCHITECTURE.md)** - System design & architecture
- **[Workers README](workers/README.md)** - Cloudflare Workers documentation
- **[AI Search Proxy](workers/ai-search-proxy/README.md)** - Groq AI integration

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file

## 👤 Author

**Abdulkerim Sesli**

- Website: https://www.abdulkerimsesli.de
- GitHub: [@abdulkerimsesli](https://github.com/abdulkerimsesli)

## 🙏 Acknowledgments

- **Groq** - Kostenlose AI-Inference
- **Cloudflare** - Hosting & Workers
- **Three.js** - 3D Graphics
- **Vite** - Build Tool

---

Made with ❤️ in Berlin
