/**
 * Vite Plugin: Serve Static Files with Correct MIME Types
 * Ensures CSS, JS, and HTML files are served with correct Content-Type headers
 *
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, extname } from 'path';

/**
 * MIME type mapping
 */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/**
 * Get MIME type for file extension
 */
function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Vite plugin to serve static files with correct MIME types
 */
export default function serveStaticPlugin() {
  return {
    name: 'vite-plugin-serve-static',
    enforce: 'pre',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const url = req.url.split('?')[0];

        // Only handle specific file types
        if (!url.match(/\.(css|html|js|mjs)$/)) {
          next();
          return;
        }

        // Skip Vite's own files
        if (url.startsWith('/@') || url.startsWith('/node_modules/')) {
          next();
          return;
        }

        // Try to serve from content/ or pages/ directories
        const possiblePaths = [
          resolve(process.cwd(), url.substring(1)),
          resolve(process.cwd(), 'dist', url.substring(1)),
        ];

        for (const filePath of possiblePaths) {
          if (existsSync(filePath)) {
            try {
              const content = readFileSync(filePath, 'utf-8');
              const mimeType = getMimeType(filePath);

              res.setHeader('Content-Type', mimeType);
              res.setHeader('Cache-Control', 'no-cache');
              res.end(content);
              return;
            } catch (error) {
              console.error(`[serve-static] Error reading ${filePath}:`, error);
            }
          }
        }

        next();
      });
    },

    configurePreviewServer(server) {
      // Same logic for preview server
      server.middlewares.use((req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const url = req.url.split('?')[0];

        // Only handle specific file types
        if (!url.match(/\.(css|html|js|mjs)$/)) {
          next();
          return;
        }

        // Skip Vite's own files
        if (url.startsWith('/@') || url.startsWith('/node_modules/')) {
          next();
          return;
        }

        // Serve from dist directory
        const filePath = resolve(process.cwd(), 'dist', url.substring(1));

        if (existsSync(filePath)) {
          try {
            const content = readFileSync(filePath, 'utf-8');
            const mimeType = getMimeType(filePath);

            res.setHeader('Content-Type', mimeType);
            res.setHeader('Cache-Control', 'no-cache');
            res.end(content);
            return;
          } catch (error) {
            console.error(`[serve-static] Error reading ${filePath}:`, error);
          }
        }

        next();
      });
    },
  };
}
