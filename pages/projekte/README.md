# Projects Page - 3D Gallery

> Modern React-based 3D project gallery using Three.js for immersive project browsing

**Version**: 7.0.0 - Cleaned up  
**Status**: ✅ Production Ready  
**Tech**: React 19 + Three.js + 3D Scroll Navigation

---

## 📁 Project Structure

```
pages/projekte/
│
├── 📂 components/          # React Components
│   ├── ProjectGallery.js   # 3D project objects management
│   └── ThreeScene.js       # Main Three.js scene component
│
├── 📂 config/              # Configuration
│   ├── constants.js        # App constants & theme colors
│   └── github.config.js    # GitHub API & project categories
│
├── 📂 hooks/               # Custom React Hooks
│   ├── index.js            # Hook exports
│   ├── useProjects.js      # Project data loading
│   └── useScrollCamera.js  # Scroll-based camera control
│
├── 📂 services/            # Data Services
│   ├── github-api.service.js       # GitHub API client
│   └── projects-data.service.js    # Project data processing
│
├── 📂 styles/              # Stylesheets
│   └── main.css            # 3D gallery styles
│
├── 📂 utils/               # Utilities
│   └── cache.utils.js      # Memory + LocalStorage caching
│
├── 📄 app.js               # Main React app
├── 📄 loader.js            # Page initialization
├── 📄 index.html           # Entry point
├── 📄 apps-config.json     # Fallback project data
└── 📄 README.md            # This file
```

---

## 🚀 Features

### 3D Experience

- ✅ **3D Scroll Navigation** - Fly through projects in 3D space
- ✅ **Three.js Integration** - WebGL-powered 3D rendering
- ✅ **Smooth Camera Movement** - Responsive scroll-based camera
- ✅ **Starfield Background** - Immersive space environment
- ✅ **Project Positioning** - Smart 3D object placement

### Data & Performance

- ✅ **Dynamic GitHub Loading** - Projects loaded from GitHub API
- ✅ **Smart Caching** - Memory + LocalStorage dual caching
- ✅ **Fallback System** - Local config if GitHub fails
- ✅ **Error Handling** - Graceful degradation
- ✅ **Performance Optimized** - Efficient rendering & caching

### UI/UX

- ✅ **HUD Overlay** - Project information display
- ✅ **Responsive Design** - Works on desktop and mobile
- ✅ **Loading States** - Space-themed loading screen
- ✅ **Scroll Hints** - Visual guidance for navigation
- ✅ **Glassmorphism** - Modern glass effect panels

---

## 🛠️ Tech Stack

| Category          | Technology                        |
| ----------------- | --------------------------------- |
| **Framework**     | React 19                          |
| **3D Graphics**   | Three.js                          |
| **Styling**       | CSS3 (Custom Properties, Flexbox) |
| **API**           | GitHub REST API v3                |
| **Caching**       | Memory + LocalStorage             |
| **Icons**         | Custom SVG icon system            |
| **Type Checking** | JSDoc                             |

---

## 🎮 How It Works

### 3D Navigation

1. **Scroll to Explore** - Use mouse wheel or touch scroll
2. **Camera Movement** - Smooth flight through 3D space
3. **Project Focus** - Active project updates based on camera position
4. **HUD Updates** - Project information displays in overlay

### Data Flow

1. **GitHub API** - Fetch project directories
2. **Metadata Loading** - Load package.json for each project
3. **3D Positioning** - Calculate positions in 3D space
4. **Rendering** - Display projects as 3D objects
5. **Interaction** - Handle scroll events and camera updates

---

## 🔧 Configuration

### GitHub API (`config/github.config.js`)

```javascript
export const GITHUB_CONFIG = {
  owner: 'aKs030',
  repo: 'Webgame',
  branch: 'main',
  appsPath: 'apps',
  requestDelay: 100, // ms between requests
};
```

### Theme Colors (`config/constants.js`)

```javascript
export const THEME_COLORS = {
  purple: { icon: '#c084fc', gradient: [...] },
  green: { icon: '#34d399', gradient: [...] },
  // ... more themes
};
```

---

## 🐛 Troubleshooting

### 3D Scene not loading?

1. Check WebGL support in browser
2. Check browser console for Three.js errors
3. Verify projects data is loading

### Scrolling not working?

1. Check document height (should be 500vh)
2. Verify scroll event listeners are attached
3. Check camera position updates

### Projects not loading?

1. Check GitHub API rate limit
2. Verify apps-config.json fallback
3. Check network requests in DevTools

---

## 📄 License

This project is part of the personal portfolio of Abdulkerim Sesli.

---

## 👤 Author

**Abdulkerim Sesli**

- Website: [abdulkerimsesli.de](https://www.abdulkerimsesli.de)
- GitHub: [@aKs030](https://github.com/aKs030)

---

## 📝 Changelog

### v7.0.0 (2026-02-02) - Cleanup

- 🧹 **Removed unused hooks** - useAppManager, useToast
- 🔧 **Simplified loader** - Removed unused Three.js Earth integration
- ⚡ **Performance improvements** - Better scroll handling
- 📝 **Code cleanup** - Removed debug code and comments
- 🎯 **Focused functionality** - Streamlined to core 3D gallery features

### v6.0.0 (Previous)

- 🎉 Complete 3D gallery implementation
- ⚛️ React + Three.js integration
- 🎮 Scroll-based navigation
- 🌟 Starfield background

---

**Last Updated**: 2026-02-02  
**Version**: 7.0.0  
**Status**: ✅ Production Ready
