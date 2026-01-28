import { defineConfig } from 'vite';
import { resolve } from 'path';
import { redirectsPlugin, htmlRawPlugin } from './vite-plugin-redirects.js';

export default defineConfig({
  plugins: [htmlRawPlugin(), redirectsPlugin()],
  root: '.',
  publicDir: 'content/assets',

  build: {
    outDir: 'dist',
    emptyOutDir: true,

    // Optimized chunking strategy
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'pages/about/index.html'),
        blog: resolve(__dirname, 'pages/blog/index.html'),
        gallery: resolve(__dirname, 'pages/gallery/index.html'),
        projekte: resolve(__dirname, 'pages/projekte/index.html'),
        videos: resolve(__dirname, 'pages/videos/index.html'),
      },

      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-three': ['three'],

          // Feature chunks
          'three-earth': [
            './content/components/particles/three-earth-system.js',
            './content/components/particles/earth/scene.js',
            './content/components/particles/earth/assets.js',
            './content/components/particles/earth/camera.js',
            './content/components/particles/earth/stars.js',
            './content/components/particles/earth/cards.js',
          ],

          // Shared utilities
          utils: [
            './content/core/dom-utils.js',
            './content/core/intersection-observer.js',
            './content/core/logger.js',
            './content/core/fetch.js',
            './content/core/events.js',
          ],
        },

        // Optimized file naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];

          if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp/i.test(ext)) {
            return `assets/img/[name]-[hash][extname]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },

    // Performance optimizations
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'],
      },
    },

    // Chunk size warnings
    chunkSizeWarningLimit: 500,

    // Source maps for production debugging
    sourcemap: true,
  },

  // Development server
  server: {
    port: 8080,
    open: true,
    cors: true,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  },

  // Preview server (for testing production builds)
  preview: {
    port: 4173,
    open: true,
  },

  // Optimizations
  optimizeDeps: {
    include: ['react', 'react-dom', 'three', 'dompurify'],
  },

  // CSS optimization
  css: {
    devSourcemap: true,
  },
});
