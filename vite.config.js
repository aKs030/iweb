import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { redirectsPlugin, htmlRawPlugin } from './vite-plugin-redirects.js';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react({
      // Use automatic JSX runtime (React 17+)
      jsxRuntime: 'automatic',
      // Include .jsx files
      include: '**/*.{jsx,tsx,js,ts}',
    }),
    htmlRawPlugin(),
    redirectsPlugin(),

    // Gzip compression
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024, // Only compress files > 1KB
      deleteOriginFile: false,
      filter: /\.(js|mjs|json|css|html|svg)$/i,
    }),

    // Brotli compression - better than gzip
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false,
      filter: /\.(js|mjs|json|css|html|svg)$/i,
    }),
  ],
  root: '.',
  publicDir: 'content/assets',

  build: {
    outDir: 'dist',
    emptyOutDir: true,

    // Support top-level await
    target: 'esnext',

    // Faster builds - disable gzip size reporting
    reportCompressedSize: false,

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
        // Let Vite handle chunking automatically with smart defaults
        // This avoids circular dependency warnings and empty chunks

        // Optimized file naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
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

      // Better tree-shaking
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
    },

    // Performance optimizations
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.info'],
        passes: 2, // Multiple passes for better compression
        unsafe_arrows: true,
        unsafe_methods: true,
      },
      mangle: {
        safari10: true, // Safari 10 compatibility
      },
      format: {
        comments: false, // Remove all comments
      },
    },

    // Chunk size warnings - stricter limit
    chunkSizeWarningLimit: 400,

    // Source maps - hidden for production (only for error reporting)
    sourcemap: 'hidden',

    // CSS code splitting
    cssCodeSplit: true,

    // Minify CSS
    cssMinify: true,
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
    exclude: [],
    esbuildOptions: {
      target: 'esnext',
      treeShaking: true,
      minify: true,
      jsx: 'automatic',
    },
  },

  // Ensure JSX files are handled correctly
  esbuild: {
    jsxInject: `import React from 'react'`,
  },

  // Resolve extensions
  resolve: {
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json'],
  },

  // CSS optimization
  css: {
    devSourcemap: true,
  },
});
