import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Vite plugin to serve HTML files as raw content (not as entry points)
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

  return {
    name: 'vite-plugin-html-raw',
    enforce: 'pre',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Skip if it's a ?raw import request - let Vite handle it
        if (req.url.includes('?raw')) {
          console.log(`[htmlRawPlugin] Skipping ?raw request: ${req.url}`);
          next();
          return;
        }

        const url = req.url.split('?')[0];

        // Skip entry point HTML files - let Vite handle them
        if (entryPoints.some((entry) => url === entry || url.endsWith(entry))) {
          next();
          return;
        }

        // Serve other HTML files from pages/ as raw HTML
        // content/components are now bundled via ?raw import, so let Vite handle them
        if (url.match(/\/pages\/.*\.html$/)) {
          console.log(`[htmlRawPlugin] Intercepting HTML: ${url}`);
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
}

/**
 * Vite plugin to handle _redirects file (Netlify/Cloudflare Pages format)
 * Supports 301 redirects and 200 rewrites
 */
export function redirectsPlugin() {
  let redirectRules = [];

  return {
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
        const url = req.url.split('?')[0]; // Remove query params

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
}
