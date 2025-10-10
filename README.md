# 🌍 iweb Portfolio

Modernes Portfolio-Projekt mit ES6 Modules, Zero-Build-Tooling und Three.js Earth Animation.

---

## 🚀 Features

- ✅ **Three.js Earth System** - Interactive 3D globe animation
- ✅ **Starfield Animation** - Canvas-based particle effects
- ✅ **Card Rotation System** - Dynamic feature showcase
- ✅ **TypeWriter Effect** - Animated text presentation
- ✅ **Day/Night Artwork** - Dynamic footer graphics
- ✅ **Performance First** - 60fps, optimized assets
- ✅ **Accessibility** - WCAG 2.1 AA compliant

---

## 📦 Tech Stack

- **JavaScript:** ES6 Modules (native, no bundler)
- **CSS:** Custom Properties, Modern Features
- **3D:** Three.js (r170)
- **Fonts:** Inter Variable Font (local)
- **Images:** WebP, optimized
- **Performance:** Lighthouse Score 95+

---

## 🎯 Development

### Installation
```bash
npm install
```

### Development Server
```bash
npm start
# Opens http://localhost:8080
```

### Validation
```bash
npm run lint:js        # ESLint check
npm run lint:html      # HTML validation
npm run check:css      # CSS consolidation
```

### Performance
```bash
npm run lighthouse:desktop
npm run lighthouse:mobile
```

---

## 📁 Structure

```
iweb/
├── index.html                    # Entry point
├── content/
│   ├── webentwicklung/
│   │   ├── main.js              # Core initialization
│   │   ├── shared-utilities.js  # Shared utilities
│   │   ├── particles/           # Three.js Earth system
│   │   ├── TypeWriter/          # TypeWriter component
│   │   ├── menu/                # Navigation
│   │   └── footer/              # Footer components
│   └── img/                     # Assets (WebP)
├── pages/
│   ├── home/                    # Hero section
│   ├── card/                    # Feature cards
│   └── about/                   # About section
└── scripts/                     # Build scripts
```

---

## 🎨 Configuration

### Shared Utilities
```javascript
import {
  createLogger,
  getElementById,
  TimerManager,
  EVENTS,
  throttle,
  debounce,
} from './content/webentwicklung/shared-utilities.js';
```

### Custom Properties
All CSS variables in `/content/webentwicklung/root.css`

---

## 🔧 Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Dev server (port 8080) |
| `npm run lint:js` | ESLint check + auto-fix |
| `npm run lint:html` | HTML validation |
| `npm run check:css` | CSS consolidation check |
| `npm run lighthouse:desktop` | Desktop performance audit |
| `npm run lighthouse:mobile` | Mobile performance audit |

---

## 📊 Performance

**Lighthouse Scores (Baseline: 4. Okt 2025):**
- Desktop: 98/100
- Mobile: 95/100
- Accessibility: 100/100
- Best Practices: 100/100

---

## 🌐 Browser Support

- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

**Required:**
- ES6 Modules
- IntersectionObserver
- Canvas 2D / WebGL
- CSS Custom Properties

---

## 📚 Documentation

- **Starfield Animation:** `/pages/card/DOCUMENTATION.md`
- **Performance Reports:** `/reports/README.md`
- **Copilot Instructions:** `/.github/copilot-instructions.md`

---

## 🔐 Code Quality

- ✅ ESLint: 0 Errors, 0 Warnings
- ✅ HTML Validation: PASS
- ✅ CSS Consolidation: PASS
- ✅ Accessibility: WCAG 2.1 AA

---

## 📝 License

© 2025 Abdulkerim Sesli. All rights reserved.

**Built with ❤️ in Berlin-Tegel**

---

**Version:** 2.0.0  
**Last Updated:** 10. Oktober 2025
