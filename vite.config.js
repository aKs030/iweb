import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { redirectsPlugin, htmlRawPlugin } from './vite-plugin-redirects.js';

export default defineConfig({
  plugins: [
    htmlRawPlugin(),
    redirectsPlugin(),
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // sunburst, treemap, network
    }),
  ],
  root: '.',
  publicDir: 'content/assets',

  // Development server only (no build)
  server: {
    port: 8080,
    open: true,
    cors: true,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
    fs: {
      strict: false,
    },
  },

  // Preview server
  preview: {
    port: 4173,
    open: true,
  },

  // Build optimizations
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    minify: 'terser',
    modulePreload: {
      // Only preload critical chunks, not lazy-loaded features
      polyfill: true,
      resolveDependencies: (filename, deps, { hostId, hostType }) => {
        // Filter out lazy-loaded feature chunks from preload
        return deps.filter((dep) => {
          const shouldPreload =
            !dep.includes('feature-robot') &&
            !dep.includes('feature-earth') &&
            !dep.includes('vendor-three');
          return shouldPreload;
        });
      },
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'],
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-three': ['three'],
          'vendor-react': ['react', 'react-dom'],
          'vendor-utils': ['dompurify'],

          // Feature chunks
          'feature-earth': [
            '/content/components/particles/three-earth-system.js',
            '/content/components/particles/shared-particle-system.js',
          ],
          'feature-robot': [
            '/content/components/robot-companion/robot-companion.js',
            '/content/components/robot-companion/gemini-service.js',
          ],
          'feature-search': ['/content/components/search/search.js'],

          // Core utilities
          'core-utils': [
            '/content/core/utils.js',
            '/content/core/logger.js',
            '/content/core/events.js',
            '/content/core/cache.js',
          ],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 500,
  },

  // Optimizations for dev
  optimizeDeps: {
    include: ['react', 'react-dom', 'three', 'dompurify'],
  },

  // Resolve extensions
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.json'],
  },
});
