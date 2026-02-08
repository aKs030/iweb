import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

/**
 * Vite Plugin for HTML Template Injection
 * Emulates Cloudflare Pages Middleware / server.js behavior during build
 */
function htmlTemplatesPlugin() {
  return {
    name: 'html-templates',
    transformIndexHtml(html) {
      try {
        const head = fs.readFileSync(
          resolve(__dirname, 'content/templates/base-head.html'),
          'utf-8',
        );
        const loader = fs.readFileSync(
          resolve(__dirname, 'content/templates/base-loader.html'),
          'utf-8',
        );
        return html
          .replace(/<!--\s*INJECT:BASE-HEAD\s*-->/g, head)
          .replace(/<!--\s*INJECT:BASE-LOADER\s*-->/g, loader);
      } catch (e) {
        console.warn('Template injection failed:', e.message);
        return html;
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [htmlTemplatesPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 8080,
    open: true,
  },
  resolve: {
    alias: {
      '/content': resolve(__dirname, 'content'),
      '/pages': resolve(__dirname, 'pages'),
    },
  },
});
