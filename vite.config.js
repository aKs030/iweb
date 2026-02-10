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
    closeBundle() {
      const root = process.cwd();
      const dist = resolve(root, 'dist');
      const dirs = ['content', 'pages', 'impressum', 'datenschutz'];
      const files = [
        '_redirects',
        '_headers',
        'robots.txt',
        'sitemap.xml',
        'sitemap-images.xml',
        'sitemap-videos.xml',
        'manifest.json',
        'sw.js',
      ];

      dirs.forEach((dir) => {
        const src = resolve(root, dir);
        const dest = resolve(dist, dir);
        if (fs.existsSync(src)) {
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
          }
          fs.cpSync(src, dest, { recursive: true });
        }
      });

      files.forEach((file) => {
        const src = resolve(root, file);
        const dest = resolve(dist, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      });
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
