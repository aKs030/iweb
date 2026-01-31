# Projekte - Portfolio Showcase

> Modern React JSX-based project showcase with dynamic GitHub integration

**Version**: 6.0.0  
**Status**: ✅ Production Ready  
**Tech**: React 18 + JSX + Vite

---

## 📁 Projekt-Struktur

```
pages/projekte/
│
├── 📂 components/          # React Components
│   └── ProjectMockup.jsx   # Project preview component
│
├── 📂 config/              # Configuration
│   ├── constants.js        # App constants
│   └── github.config.js    # GitHub API config
│
├── 📂 hooks/               # Custom React Hooks
│   ├── index.js            # Barrel export
│   ├── useToast.js         # Toast notifications
│   ├── useModal.js         # Modal management
│   └── useProjects.js      # Projects data loading
│
├── 📂 services/            # Business Logic
│   ├── github-api.service.js       # GitHub API client
│   └── projects-data.service.js    # Data processing
│
├── 📂 utils/               # Utilities
│   ├── cache.utils.js      # LocalStorage caching
│   └── url.utils.js        # URL helpers
│
├── 📂 styles/              # Stylesheets
│   └── main.css            # Main styles
│
├── 📂 scripts/             # Maintenance Scripts
│   └── update-apps-config.js   # Update apps config
│
├── 📂 types/               # Type Definitions
│   └── index.d.js          # JSDoc type definitions
│
├── 📄 app.jsx              # Main React app (JSX)
├── 📄 loader.js            # App loader/initializer
├── 📄 index.html           # Entry point
├── 📄 apps-config.json     # Fallback project data
└── 📄 README.md            # This file
```

---

## 🚀 Features

### Core Features

- ✅ **Modern JSX** - Native React JSX syntax (no htm)
- ✅ **Dynamic GitHub Loading** - Projects loaded from GitHub API
- ✅ **Smart Caching** - 1-hour cache for API responses
- ✅ **Fallback System** - Local config if GitHub fails
- ✅ **Modal Preview** - In-page project previews
- ✅ **Responsive Design** - Mobile-first approach
- ✅ **SEO Optimized** - JSON-LD structured data

### Modern React Patterns

- ✅ **Custom Hooks** - Reusable logic (useToast, useModal, useProjects)
- ✅ **React.memo** - Performance optimization
- ✅ **PropTypes** - Runtime type checking
- ✅ **useCallback** - Memoized callbacks
- ✅ **Error Boundaries** - Graceful error handling

### UI/UX

- ✅ **Glassmorphism Design** - Modern glass effects
- ✅ **Smooth Animations** - Fade-in, slide-in effects
- ✅ **Loading States** - Skeleton screens & spinners
- ✅ **Toast Notifications** - User feedback
- ✅ **Accessibility** - ARIA labels, semantic HTML

---

## 🛠️ Tech Stack

| Category          | Technology                              |
| ----------------- | --------------------------------------- |
| **Framework**     | React 18                                |
| **Syntax**        | JSX (Native)                            |
| **Styling**       | CSS3 (Custom Properties, Grid, Flexbox) |
| **API**           | GitHub REST API v3                      |
| **Caching**       | LocalStorage                            |
| **Build**         | Vite 6.4.1 + @vitejs/plugin-react       |
| **Icons**         | Lucide React                            |
| **Type Checking** | PropTypes + JSDoc                       |

---

## 📦 Installation & Development

### Prerequisites

```bash
Node.js >= 18.x
npm >= 9.x
```

### Install Dependencies

```bash
npm install
```

### Development Server

```bash
npm run dev
# Opens at http://localhost:8080/pages/projekte/
```

### Production Build

```bash
npm run build
# Output: dist/pages/projekte/
```

### Update Apps Config

```bash
node pages/projekte/scripts/update-apps-config.js
```

---

## 🔧 Configuration

### GitHub API (`config/github.config.js`)

```javascript
export const GITHUB_CONFIG = {
  owner: 'Abdulkader-Safi',
  repo: 'iweb',
  branch: 'main',
  appsPath: 'projekte/apps',
  // ...
};
```

### Constants (`config/constants.js`)

```javascript
export const TOAST_DURATION = 2600; // Toast display time
export const URL_TEST_TIMEOUT = 2500; // URL test timeout
export const CACHE_DURATION = 3600000; // 1 hour cache
```

---

## 🐛 Troubleshooting

### Projects not loading?

1. Check GitHub API rate limit (60 req/hour unauthenticated)
2. Check browser console for errors
3. Clear LocalStorage cache
4. Verify `apps-config.json` exists

### Modal not opening?

1. Check CORS headers
2. Verify URL is accessible
3. Check browser console for errors

### Build fails?

1. Clear `node_modules` and reinstall
2. Check Node.js version (>= 18.x)
3. Run `npm run build` with verbose flag

---

## 📄 License

This project is part of the personal portfolio of Abdulkerim Sesli.

---

## 👤 Author

**Abdulkerim Sesli**

- Website: [abdulkerimsesli.de](https://www.abdulkerimsesli.de)
- GitHub: [@Abdulkader-Safi](https://github.com/Abdulkader-Safi)

---

## 📝 Changelog

### v6.0.0 (2025-01-31)

- 🎉 **Complete migration to JSX** - Removed htm dependency
- ⚛️ Native React JSX syntax with Vite plugin
- ✅ Fixed all React key warnings
- 🔧 Added PropTypes for type safety
- 📝 Updated jsconfig.json for JSX support
- 🧹 Cleaned up old htm-based code

### v5.1.0 (2025-01-31)

- ✨ Improved hero section with stats cards
- 🗂️ Reorganized folder structure
- 📝 Added comprehensive type definitions
- 🎨 Enhanced glassmorphism design
- ♿ Improved accessibility

---

**Last Updated**: 2025-01-31  
**Version**: 6.0.0  
**Status**: ✅ Production Ready
