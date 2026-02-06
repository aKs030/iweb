/**
 * Vite Configuration
 * @version 1.0.0
 */

import { defineConfig } from 'vite';
import htmlTemplatesPlugin from './vite-plugin-html-templates.js';
import { htmlRawPlugin, redirectsPlugin } from './vite-plugin-redirects.js';
import serveStaticPlugin from './vite-plugin-serve-static.js';
import copyFilesPlugin from './vite-plugin-copy-files.js';

export default defineConfig({
  root: '.',
  publicDir: false,

  plugins: [
    serveStaticPlugin(),
    htmlRawPlugin(),
    redirectsPlugin(),
    htmlTemplatesPlugin(),
    copyFilesPlugin(),
  ],

  server: {
    port: 8080,
    open: true,
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        about: 'pages/about/index.html',
        blog: 'pages/blog/index.html',
        gallery: 'pages/gallery/index.html',
        projekte: 'pages/projekte/index.html',
        videos: 'pages/videos/index.html',
      },
    },
  },
});
