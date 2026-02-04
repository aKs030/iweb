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
    // Proxy YouTube API requests to local worker (if running)
    proxy: {
      '/api/youtube': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {
            console.log(
              'YouTube Worker Proxy Error - Make sure worker is running on port 8788',
            );
            console.log(
              'Start with: cd workers/youtube-api-proxy && wrangler dev --env youtube --port 8788',
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
