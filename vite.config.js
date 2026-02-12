import { defineConfig } from 'vite';
import { resolve, relative, extname } from 'path';
import fs from 'fs';
import fg from 'fast-glob';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/**
 * Vite Plugin for HTML Template Injection
 * Inject base-head and base-loader into all HTML entry points at build time.
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

// Dynamically find all HTML entry points
const root = process.cwd();
const htmlFiles = fg.sync([
  'index.html',
  'pages/**/*.html',
  'impressum/**/*.html',
  'datenschutz/**/*.html'
], { cwd: root });

const input = htmlFiles.reduce((acc, file) => {
  // Use relative path without extension as entry name to preserve structure
  // e.g. 'pages/blog/index.html' -> 'pages/blog/index'
  const name = relative(root, file).slice(0, -extname(file).length).replace(/\\/g, '/');
  acc[name] = resolve(root, file);
  return acc;
}, {});

export default defineConfig({
  base: './', // Keep relative paths for flexibility
  plugins: [
    htmlTemplatesPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: 'content/config/locales',
          dest: 'content/config'
        },
        {
          src: 'content/assets',
          dest: 'content'
        },
        {
          src: 'pages/blog/posts',
          dest: 'pages/blog'
        }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input, // Use dynamic input
    },
  },
  resolve: {
    alias: {
      '/content': resolve(root, 'content'),
      '/pages': resolve(root, 'pages'),
    },
  },
  publicDir: 'public', // Ensure public assets are copied
});
