# 🎨 Abdulkerim Sesli — Portfolio

[![LinkedIn](https://img.shields.io/badge/LinkedIn-abdulkerim--sesli-0077B5?logo=linkedin)](https://linkedin.com/in/abdulkerim-s) [![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC) [![Status](https://img.shields.io/badge/Status-Production--Ready-success)](https://www.abdulkerimsesli.de)

**Portfolio website of Abdulkerim Sesli — Web Developer & Photographer in Berlin.**  
PWA-ready, accessible, and featuring interactive Three.js visualizations.

---

## ✨ Features

- 🎨 **Modern Design** - Clean, responsive UI
- ⚡ **No Build Tools** - Pure ES6 modules
- 🌍 **3D Earth** - Interactive Three.js visualization
- ♿ **Accessible** - WCAG 2.1 AA compliant
- 📱 **PWA** - Offline-capable with Service Worker
- 🔍 **SEO-Optimized** - Schema.org structured data
- 🚀 **Fast** - Optimized loading & caching

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → Opens http://localhost:8080

# Format code
npm run format

# Lint code
npm run lint
```

---

## 📊 Project Status

**Bewertung:** 🟢 **A+** (Exzellent)

```
Code-Qualität    ████████████████████ 100%
Performance      ███████████████████░  95%
Sicherheit       ████████████████████ 100%
SEO              ████████████████████ 100%
```

**Details:** Siehe `PROJEKT-STATUS.md`

---

## 🛠️ Tech Stack

### Frontend

- **JavaScript** - ES6+ Modules
- **React** - 18.2.0 (via ESM)
- **Three.js** - 3D Graphics
- **HTML5/CSS3** - Semantic markup

### Tools

- **Node.js** - Dev server
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Sharp** - Image optimization

### Deployment

- **Cloudflare Pages** - Hosting
- **Service Worker** - Offline support
- **PWA** - Progressive Web App

---

## 📁 Structure

```
iweb/
├── content/          # Core application
│   ├── assets/       # Images, icons, fonts
│   ├── components/   # Reusable components
│   ├── config/       # Configuration
│   ├── styles/       # Global styles
│   └── utils/        # Utilities
├── pages/            # Page-specific code
├── scripts/          # Build & dev scripts
└── workers/          # Cloudflare Workers
```

---

## 🎯 Key Features

### 🌍 Interactive 3D Earth

Real-time Earth visualization with:

- Day/night textures
- Cloud layer
- Bump mapping
- Atmospheric glow
- Camera controls

### ♿ Accessibility

- ARIA labels & roles
- Keyboard navigation
- Screen reader support
- Focus management
- Skip links

### 🔍 SEO

- Schema.org JSON-LD
- Open Graph tags
- Twitter Cards
- Sitemap.xml
- robots.txt

### 📱 PWA

- Service Worker caching
- Offline support
- Install prompt
- App shortcuts
- Background sync

---

## 🚀 Development

### Dev Server

```bash
npm run dev
```

**Features:**

- ⚡ Async I/O
- 🛡️ Error handling
- 📦 25 MIME types
- 💾 Cache headers
- 🎨 Custom 404
- 📊 Request timing

### Scripts

```bash
npm run format           # Format code
npm run lint             # Lint code
npm run cleanup:check    # Check code quality
npm run images:build     # Generate images
npm run videos:schema    # Generate video schema
npm run blog:pages       # Generate blog pages
```

### Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

**Test Coverage:**

- ✅ **134 tests** (114 passing)
- ✅ **60%+ coverage** (lines, functions, branches, statements)
- ✅ **14 property-based tests** for correctness validation
- ✅ **Unit tests** for specific examples and edge cases

**Property-Based Testing:**

This project uses [fast-check](https://github.com/dubzzz/fast-check) for property-based testing. Each property test runs with **100 iterations** to validate universal correctness properties.

**Test Organization:**

```
content/utils/
  shared-utilities.js
  shared-utilities.test.js        # Unit tests
  shared-utilities.properties.js  # Property tests
```

**Coverage Thresholds:**

- Lines: 60%
- Functions: 60%
- Branches: 60%
- Statements: 60%

**See:** `docs/TESTING.md` for detailed testing guide (coming soon)

---

## 🌐 URLs

```
Development:  http://localhost:8080
Production:   https://www.abdulkerimsesli.de
```

---

## 📚 Documentation

| Document                            | Description          |
| ----------------------------------- | -------------------- |
| `docs/PROJEKT-STATUS.md`            | Compact overview     |
| `docs/QUICK-REFERENCE.md`           | Commands & structure |
| `docs/OPTIMIERUNGEN.md`             | Optimization guide   |
| `docs/MAINTENANCE.md`               | Maintenance guide    |
| `docs/ANALYTICS.md`                 | Analytics setup      |
| `docs/SEO-OPTIMIERUNG.md`           | SEO optimization     |
| `docs/SECURITY.md`                  | Security guide       |
| `docs/SECURITY-CSP.md`              | CSP implementation   |
| `docs/SCHEMA-VALIDATOR-GUIDE.md`    | Schema validation    |
| `docs/VALIDATOR-QUICK-REFERENCE.md` | Validator reference  |

---

## 🎨 Design Philosophy

- **No Build Tools** - Direct ES6 modules
- **Progressive Enhancement** - Works without JS
- **Mobile First** - Responsive design
- **Performance** - Optimized loading
- **Accessibility** - Inclusive design

---

## 📊 Performance

- **Lighthouse Score:** 95+
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3.5s
- **Total Bundle Size:** ~2 MB (with assets)

---

## 🔒 Security

- ✅ **HTTPS enforced** - Strict Transport Security enabled
- ✅ **Content Security Policy** - Report-only mode active
- ✅ **API Key Protection** - Cloudflare Worker proxy for YouTube API
- ✅ **XSS Protection** - DOMPurify sanitization
- ✅ **Security Headers** - X-Frame-Options, X-Content-Type-Options, etc.
- ✅ **Production Logging** - No sensitive data in console
- ✅ **0 Vulnerabilities** - All dependencies audited

**See:** `docs/SECURITY.md` for detailed security documentation

---

## 📝 License

**ISC License** - See LICENSE file

---

## 👤 Author

**Abdulkerim Sesli**

- Website: [abdulkerimsesli.de](https://www.abdulkerimsesli.de)
- LinkedIn: [abdulkerim-s](https://linkedin.com/in/abdulkerim-s)
- GitHub: [@aKs030](https://github.com/aKs030)

---

## 🙏 Acknowledgments

- Three.js community
- React team
- Cloudflare Pages
- Open source contributors

---

**Status:** 🟢 Production-Ready • **Version:** 1.0.0 • **Updated:** Jan 2026
