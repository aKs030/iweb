import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import { visualizer } from 'rollup-plugin-visualizer';
import viteCompression from 'vite-plugin-compression';

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
        'favicon.ico',
        'favicon.svg',
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

export default defineConfig(({ mode }) => {
  const isAnalyze = mode === 'analyze';

  return {
    base: './',
    plugins: [
      htmlTemplatesPlugin(),
      viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
      }),
      viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
      }),
      isAnalyze &&
        visualizer({
          open: true,
          filename: 'dist/stats.html',
          gzipSize: true,
          brotliSize: true,
        }),
    ].filter(Boolean),
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.debug', 'console.info'],
        },
        format: {
          comments: false,
        },
      },
      rollupOptions: {
        input: {
          main: resolve(process.cwd(), 'index.html'),
        },
        output: {
          manualChunks(id) {
            // Three.js vendor chunk
            if (id.includes('node_modules/three')) {
              return 'three-vendor';
            }
            // Three-earth system
            if (id.includes('three-earth-system')) {
              return 'three-earth';
            }
            // DOMPurify
            if (id.includes('node_modules/dompurify')) {
              return 'dompurify';
            }
            // Core utilities
            if (
              id.includes('content/core') &&
              !id.includes('three-earth-manager')
            ) {
              return 'core';
            }
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      chunkSizeWarningLimit: 500,
      reportCompressedSize: true,
    },
    resolve: {
      alias: {
        '/content': resolve(process.cwd(), 'content'),
        '/pages': resolve(process.cwd(), 'pages'),
      },
    },
    optimizeDeps: {
      include: ['three', 'dompurify'],
    },
  };
});
