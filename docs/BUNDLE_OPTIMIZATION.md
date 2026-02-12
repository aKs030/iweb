# Bundle Optimization Guide

Complete guide for optimizing bundle sizes and improving load times.

## 📦 Current Bundle Strategy

### Code Splitting

The project uses manual code splitting to separate vendor code from application code:

```javascript
manualChunks: {
  'three-vendor': ['three'],
  'three-earth': ['/content/components/particles/three-earth-system.js'],
}
```

**Benefits:**

- **Better Caching**: Vendor code changes less frequently
- **Parallel Loading**: Browser can load chunks simultaneously
- **Faster Updates**: Only changed chunks need to be re-downloaded

### Bundle Structure

```
dist/assets/
├── index-[hash].js          (~20 KB)   Main entry point
├── three-vendor-[hash].js   (~150 KB)  Three.js library
├── three-earth-[hash].js    (~220 KB)  Earth visualization
├── main-[hash].css          (~2 KB)    Main styles
└── [page]-[hash].css        (~1 KB)    Page-specific styles
```

## 🎯 Optimization Techniques

### 1. Tree Shaking

Vite automatically removes unused code:

```javascript
// ✅ Good - Named imports enable tree shaking
import { Vector3, Mesh } from 'three';

// ❌ Bad - Imports entire library
import * as THREE from 'three';
```

### 2. Dynamic Imports

Load heavy components on demand:

```javascript
// Load Three.js only when needed
const loadThreeEarth = async () => {
  const module = await import('./three-earth-system.js');
  return module.ThreeEarthSystem;
};
```

### 3. Minification

Production builds use Terser for aggressive minification:

```javascript
terserOptions: {
  compress: {
    drop_console: true,      // Remove console.log
    drop_debugger: true,     // Remove debugger statements
    pure_funcs: ['console.log', 'console.debug'],
  },
  format: {
    comments: false,         // Remove all comments
  },
}
```

### 4. Compression

Automatic gzip and brotli compression:

```javascript
(viteCompression({
  algorithm: 'gzip',
  ext: '.gz',
}),
  viteCompression({
    algorithm: 'brotliCompress',
    ext: '.br',
  }));
```

**Compression Ratios:**

- Gzip: ~70-75% reduction
- Brotli: ~75-80% reduction

## 📊 Bundle Analysis

### Visualize Bundle

```bash
# Build with visualization
npm run build:analyze

# Opens interactive treemap in browser
```

### Check Bundle Sizes

```bash
# Quick size check
npm run size:check
```

## 🚀 Performance Impact

### Before Optimization

- Total JS: ~300 KB (uncompressed)
- Total CSS: ~15 KB (uncompressed)
- Load Time: ~3-4s (3G)

### After Optimization

- Total JS: ~240 KB (gzipped)
- Total CSS: ~6 KB (gzipped)
- Load Time: ~1.5-2s (3G)

**Improvements:**

- 📦 Bundle size: -20%
- ⚡ Load time: -40%
- 🎯 First Paint: -30%

## 🛠️ Tools & Commands

### Development

```bash
# Start dev server (no optimization)
npm run dev

# Build for production (optimized)
npm run build

# Preview production build
npm run preview
```

### Analysis

```bash
# Analyze bundle composition
npm run build:analyze

# Check bundle sizes
npm run size:check
```

## 📈 Optimization Checklist

### Build Configuration

- [x] Code splitting enabled
- [x] Tree shaking active
- [x] Minification configured
- [x] Compression enabled (gzip + brotli)
- [x] Source maps disabled for production
- [x] Console logs removed

### Code Organization

- [x] Named imports for tree shaking
- [x] Dynamic imports for heavy components
- [x] Vendor code separated
- [x] CSS code splitting

### Monitoring

- [x] Bundle visualization available
- [x] Performance metrics tracked

## 🎯 Best Practices

### 1. Import Optimization

```javascript
// ✅ Good - Specific imports
import { Vector3 } from 'three';

// ❌ Bad - Barrel imports
import * as THREE from 'three';
```

### 2. Lazy Loading

```javascript
// ✅ Good - Load on demand
const Gallery = lazy(() => import('./Gallery.js'));

// ❌ Bad - Load everything upfront
import Gallery from './Gallery.js';
```

### 3. Code Splitting

```javascript
// ✅ Good - Split by route
const routes = {
  '/projekte': () => import('./pages/projekte/app.js'),
  '/blog': () => import('./pages/blog/blog-app.js'),
};

// ❌ Bad - Single bundle
import './pages/projekte/app.js';
import './pages/blog/blog-app.js';
```

### 4. Asset Optimization

```javascript
// ✅ Good - Modern formats
<img src="image.webp" alt="Description">

// ❌ Bad - Legacy formats
<img src="image.jpg" alt="Description">
```

## 🔍 Debugging Bundle Issues

### Large Bundle Size

1. Run bundle analyzer: `npm run build:analyze`
2. Identify large dependencies
3. Check for duplicate code
4. Verify tree shaking is working

### Slow Load Times

1. Check bundle sizes: `npm run size:check`
2. Verify compression is enabled
3. Check network waterfall in DevTools
4. Optimize critical path

### Performance Issues

1. Check bundle sizes: `npm run size:check`
2. Analyze bundle composition: `npm run build:analyze`
3. Optimize or split large chunks
4. Remove unused dependencies

## 📚 Resources

- [Vite Build Optimization](https://vitejs.dev/guide/build.html)
- [Rollup Code Splitting](https://rollupjs.org/guide/en/#code-splitting)
- [Web.dev Bundle Size](https://web.dev/reduce-javascript-payloads-with-code-splitting/)
- [Bundle Analyzer](https://github.com/btd/rollup-plugin-visualizer)

---

**Last Updated:** February 2026  
**Status:** ✅ Optimized
