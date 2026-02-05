import { defineConfig } from 'vite';
import { redirectsPlugin, htmlRawPlugin } from './vite-plugin-redirects.js';

export default defineConfig({
  plugins: [htmlRawPlugin(), redirectsPlugin()],
  root: '.',
  publicDir: 'content/assets',

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
      // AI Search Proxy (Search + Gemini)
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {
            console.log(
              'AI/Search Worker Proxy Error - Make sure worker is running on port 8787',
            );
            console.log(
              'Start with: npm run dev:search-worker',
            );
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

  // Resolve extensions
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.json'],
  },
});
