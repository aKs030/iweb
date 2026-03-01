# Performance Optimization Guide

Comprehensive guide for performance optimization strategies implemented in this project.

## 📊 Current Performance Metrics

### Bundle Sizes (Estimated Gzipped)

- **Total JS**: ~240 KB
- **Total CSS**: ~6 KB
- **Three.js Vendor**: ~150 KB
- **Three Earth System**: ~220 KB
- **Main Entry**: ~20 KB

### Performance Budgets

- Total JS: 450 KB (gzip)
- Total CSS: 10 KB (gzip)
- First Contentful Paint: < 2s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1

## 🚀 Optimization Strategies

### 1. Build Optimizations

#### Code Splitting

```javascript
// vite.config.js
manualChunks: {
  'three-vendor': ['three'],
  'three-earth': ['/content/components/particles/three-earth-system.js'],
}
```

**Benefits:**

- Separate vendor code from application code
- Better caching (vendor code changes less frequently)
- Parallel loading of chunks

#### Minification

```javascript
minify: 'terser',
terserOptions: {
  compress: {
    drop_console: true,
    drop_debugger: true,
    pure_funcs: ['console.log', 'console.debug', 'console.info'],
  },
}
```

**Benefits:**

- Removes console statements in production
- Smaller bundle sizes
- Faster parsing and execution

### 2. Service Worker Optimizations

#### Conditional Logging

```javascript
if (self.location.hostname === 'localhost') {
  console.log('[SW] Installing service worker...');
}
```

**Benefits:**

- No console noise in production
- Cleaner browser console
- Slightly better performance

#### Caching Strategies

**Cache First** (Images, Fonts):

- Instant loading from cache
- Fallback to network if not cached
- Best for static assets

**Network First** (HTML, API):

- Always fresh content
- Fallback to cache when offline
- Best for dynamic content

**Stale While Revalidate** (JS, CSS):

- Instant loading from cache
- Background update for next visit
- Best balance of speed and freshness

### 3. Lazy Loading

#### Images

```javascript
<img loading="lazy" src="image.webp" alt="Description">
```

#### Components

```javascript
// Load heavy components on demand
const loadThreeEarth = () => import('./three-earth-system.js');
```

### 4. Resource Hints

#### Preload Critical Assets

```html
<link rel="preload" href="/assets/main.js" as="script" />
<link rel="preload" href="/assets/main.css" as="style" />
```

#### Prefetch Next Page

```html
<link rel="prefetch" href="/projekte" />
```

#### DNS Prefetch

```html
<link rel="dns-prefetch" href="https://fonts.googleapis.com" />
```

## 🛠️ Performance Tools

### Bundle Analysis

```bash
# Code quality
npm run qa
```

### Lighthouse CI

```bash
# Run Lighthouse audit
npx lighthouse http://localhost:4173 --view
```

### Performance Monitoring

```javascript
// Core Web Vitals tracking
import { initPerformanceMonitoring } from './core/performance-monitor.js';
initPerformanceMonitoring();
```

## 📈 Optimization Checklist

### Build Time

- [x] Code splitting configured
- [x] Minification enabled
- [x] Tree shaking active
- [x] Console logs removed in production
- [x] Source maps disabled for production

### Runtime

- [x] Service Worker implemented
- [x] Lazy loading for images
- [x] Lazy loading for heavy components
- [x] Resource hints configured
- [x] Performance monitoring active

### Assets

- [x] Images optimized (WebP)
- [x] Fonts optimized
- [x] CSS audit active
- [x] Critical CSS inlined

### Caching

- [x] Service Worker caching
- [x] CDN caching (Cloudflare)
- [x] Browser caching headers
- [x] Cache versioning

## 🎯 Performance Best Practices

### 1. Minimize Main Thread Work

- Use Web Workers for heavy computations
- Defer non-critical JavaScript
- Avoid long tasks (> 50ms)

### 2. Optimize Images

- Use modern formats (WebP, AVIF)
- Implement lazy loading
- Serve responsive images
- Compress images

### 3. Reduce JavaScript

- Code split by route
- Remove unused code
- Minimize third-party scripts
- Use tree shaking

### 4. Optimize CSS

- Remove unused CSS
- Minimize CSS
- Use CSS containment
- Avoid @import

### 5. Improve Loading

- Preload critical resources
- Prefetch next pages
- Use service worker
- Implement HTTP/2 push

## 📊 Monitoring

### Core Web Vitals

**LCP (Largest Contentful Paint)**

- Target: < 2.5s
- Optimize: Images, fonts, critical CSS

**FID (First Input Delay)**

- Target: < 100ms
- Optimize: JavaScript execution, main thread work

**CLS (Cumulative Layout Shift)**

- Target: < 0.1
- Optimize: Image dimensions, font loading, dynamic content

### Custom Metrics

```javascript
// Track custom performance metrics
performance.mark('hero-loaded');
performance.measure('hero-load-time', 'navigationStart', 'hero-loaded');
```

## 🔍 Debugging Performance

### Chrome DevTools

1. Performance tab → Record
2. Analyze flame chart
3. Identify bottlenecks
4. Optimize hot paths

### Lighthouse

1. Run audit
2. Review opportunities
3. Implement suggestions
4. Re-test

### WebPageTest

1. Test from multiple locations
2. Analyze waterfall
3. Check TTFB
4. Optimize critical path

## 📚 Resources

- [Web.dev Performance](https://web.dev/performance/)
- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [Core Web Vitals](https://web.dev/vitals/)
- [Vite Performance](https://vitejs.dev/guide/performance.html)
- [Draco 3D Compression](https://google.github.io/draco/)
- [Meshopt Decoder](https://github.com/zeux/meshoptimizer)
- [glTF Compression Guide](https://meshoptimizer.org/gltf/)

## 🗜️ 3D Model Compression (Draco & Meshopt)

### Overview

For complex 3D meshes (e.g. a robot companion as real geometry instead of particles), Draco and Meshopt compression are essential. In a no-build architecture without automatic asset processing, pre-compressed models are the most effective way to keep download sizes low.

| Codec   | Size Reduction | Decode Speed | Best For            |
| ------- | -------------- | ------------ | ------------------- |
| Draco   | 70-95 %        | Moderate     | Static geometry     |
| Meshopt | 60-80 %        | Very fast    | Animated characters |

### Integration

The project provides a unified model loader at `/content/core/model-loader.js`:

```javascript
import { loadCompressedModel } from '/content/core/model-loader.js';

const gltf = await loadCompressedModel('/content/assets/models/robot.glb');
scene.add(gltf.scene);
```

- **Draco decoder** WASM is loaded from the Three.js CDN on first use
- **Meshopt decoder** is initialised alongside Draco via a single import
- Loader instances are singletons — safe to call from multiple modules
- `disposeModelLoader()` releases decoder resources when 3D is no longer needed

### Compression Workflow

See [`/content/assets/models/README.md`](/content/assets/models/README.md) for CLI commands, file naming conventions, and compression comparison.

---

**Last Updated:** März 2026  
**Status:** ✅ Optimized
