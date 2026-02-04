import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Vite plugin to serve HTML files as raw content (not as entry points)
 * @returns {import('vite').Plugin}
 */
export function htmlRawPlugin() {
  // Entry point HTML files that Vite should process normally
  const entryPoints = [
    '/index.html',
    '/pages/about/index.html',
    '/pages/blog/index.html',
    '/pages/gallery/index.html',
    '/pages/projekte/index.html',
    '/pages/videos/index.html',
  ];

  /** @type {import('vite').Plugin} */
  const plugin = {
    name: 'vite-plugin-html-raw',
    enforce: 'pre',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const url = req.url.split('?')[0];

        // Skip static file extensions - let Vite handle them
        if (
          url.match(
            /\.(css|js|mjs|json|png|jpg|jpeg|webp|svg|ico|woff|woff2|ttf|eot|map)$/i,
          )
        ) {
          next();
          return;
        }

        // Skip entry point HTML files - let Vite handle them
        if (entryPoints.some((entry) => url === entry || url.endsWith(entry))) {
          next();
          return;
        }

        // Only serve .html files as raw - let Vite handle everything else (including .jsx)
        if (url.match(/\/(pages|content\/components)\/.*\.html$/)) {
          try {
            const filePath = resolve(process.cwd(), url.substring(1));
            const content = readFileSync(filePath, 'utf-8');

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.end(content);
            return;
          } catch {
            // File not found, continue to next middleware
          }
        }

        next();
      });
    },
  };

  return plugin;
}

/**
 * Vite plugin to handle _redirects file (Netlify/Cloudflare Pages format)
 * Supports 301 redirects and 200 rewrites
 * @returns {import('vite').Plugin}
 */
export function redirectsPlugin() {
  let redirectRules = [];

  /** @type {import('vite').Plugin} */
  const plugin = {
    name: 'vite-plugin-redirects',

    configResolved() {
      // Parse _redirects file
      try {
        const redirectsPath = resolve(process.cwd(), '_redirects');
        const content = readFileSync(redirectsPath, 'utf-8');

        redirectRules = content
          .split('\n')
          .filter((line) => line.trim() && !line.trim().startsWith('#'))
          .map((line) => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
              return {
                from: parts[0],
                to: parts[1],
                status: parts[2] ? parseInt(parts[2]) : 301,
              };
            }
            return null;
          })
          .filter(Boolean);

        console.log(
          `✓ Loaded ${redirectRules.length} redirect rules from _redirects`,
        );
      } catch {
        console.warn('⚠ Could not load _redirects file');
      }
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const url = req.url.split('?')[0]; // Remove query params

        // Skip static file extensions entirely - let Vite handle them
        if (
          url.match(
            /\.(css|js|mjs|json|png|jpg|jpeg|webp|svg|ico|woff|woff2|ttf|eot|map)$/i,
          )
        ) {
          next();
          return;
        }

        // Serve HTML files from pages/ and content/components/ as raw files
        if (url.match(/\/(pages|content\/components)\/.*\.html$/)) {
          // Let Vite handle it as a static file
          next();
          return;
        }

        // Find matching redirect rule
        for (const rule of redirectRules) {
          let match = false;
          let targetUrl = rule.to;

          // Handle exact matches
          if (rule.from === url) {
            match = true;
          }
          // Handle splat patterns (e.g., /pages/* -> /pages/:splat)
          else if (rule.from.includes('*')) {
            const pattern = rule.from.replace(/\*/g, '(.*)');
            const regex = new RegExp(`^${pattern}$`);
            const matches = url.match(regex);

            if (matches) {
              match = true;
              // Replace :splat with captured group
              targetUrl = rule.to.replace(':splat', matches[1] || '');
            }
          }

          if (match) {
            if (rule.status === 200) {
              // Rewrite (internal)
              req.url = targetUrl;
              break;
            } else {
              // Redirect (301/302)
              res.writeHead(rule.status, { Location: targetUrl });
              res.end();
              return;
            }
          }
        }

        next();
      });
    },
  };

  return plugin;
}
