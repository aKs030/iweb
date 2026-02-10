import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

/**
 * Vite Plugin for HTML Template Injection
 * Emuliert das Verhalten von Cloudflare Pages Middleware während des Builds
 */
function htmlTemplatesPlugin() {
  return {
    name: 'html-templates',
    transformIndexHtml(html) {
      const root = process.cwd();
      try {
        const headPath = resolve(root, 'content/templates/base-head.html');
        const loaderPath = resolve(root, 'content/templates/base-loader.html');

        let head = '';
        let loader = '';

        if (fs.existsSync(headPath)) {
          head = fs.readFileSync(headPath, 'utf-8');
        }
        if (fs.existsSync(loaderPath)) {
          loader = fs.readFileSync(loaderPath, 'utf-8');
        }

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
        main: resolve(process.cwd(), 'index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '/content': resolve(process.cwd(), 'content'),
      '/pages': resolve(process.cwd(), 'pages'),
    },
  },
});
