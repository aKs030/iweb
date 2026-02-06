import { defineConfig } from 'vite';
import { redirectsPlugin, htmlRawPlugin } from './vite-plugin-redirects.js';
import htmlTemplatesPlugin from './vite-plugin-html-templates.js';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    htmlTemplatesPlugin(), // Auto-inject shared HTML templates
    htmlRawPlugin(),
    redirectsPlugin(),
  ],
  // Use relative base path to ensure assets load correctly in any deployment context
  base: './',
  root: '.',
  publicDir: 'content/assets',

  // Multi-page app configuration
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        blog: resolve(__dirname, 'pages/blog/index.html'),
        projekte: resolve(__dirname, 'pages/projekte/index.html'),
        videos: resolve(__dirname, 'pages/videos/index.html'),
        gallery: resolve(__dirname, 'pages/gallery/index.html'),
        about: resolve(__dirname, 'pages/about/index.html'),
      },
    },
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
    fs: {
      strict: false,
    },
    // Proxy API requests to local workers
    proxy: {
      // YouTube Proxy
      '/api/youtube': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {
            console.log(
              'YouTube Worker Proxy Error - Make sure worker is running on port 8788',
            );
          });
        },
      },
      // AI Search Proxy (Search + AI)
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {
            console.log(
              'AI/Search Worker Proxy Error - Make sure worker is running on port 8787',
            );
            console.log('Start with: npm run dev:search-worker');
          });
        },
      },
    },
  },

  // Preview server
  preview: {
    port: 4173,
    open: true,
  },

  // Optimizations for dev
  optimizeDeps: {
    include: ['react', 'react-dom', 'three', 'dompurify'],
  },

  // Test configuration
  test: {
    environment: 'jsdom',
    globals: true,
  },

  // Resolve extensions
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.json'],
  },
});
