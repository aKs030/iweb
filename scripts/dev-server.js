#!/usr/bin/env node

/**
 * Optimized Local Development Server
 * Version: 2.0.0
 *
 * Improvements:
 * - Async file operations
 * - Better error handling
 * - Extended MIME types
 * - Request timing
 * - Graceful shutdown
 */

const http = require('http');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const PORT = 8080;
const ROOT = path.join(__dirname, '..');

// Extended MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
};

/**
 * Parse _redirects file with error handling
 */
function parseRedirects() {
  try {
    const redirectsPath = path.join(ROOT, '_redirects');
    if (!fsSync.existsSync(redirectsPath)) {
      console.warn('⚠️  No _redirects file found');
      return [];
    }

    const content = fsSync.readFileSync(redirectsPath, 'utf8');
    const rules = [];

    content.split('\n').forEach((line, index) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;

      const parts = line.split(/\s+/);
      if (parts.length < 2) {
        console.warn(`⚠️  Invalid redirect rule at line ${index + 1}: ${line}`);
        return;
      }

      const [from, to, statusStr] = parts;
      const status = parseInt(statusStr) || 301;

      try {
        const pattern = from
          .replace(/\//g, '\\/')
          .replace(/\./g, '\\.')
          .replace(/\*/g, '(.*)');

        rules.push({
          from,
          to,
          status,
          pattern: new RegExp(`^${pattern}$`),
          hasSplat: from.includes('*') || to.includes(':splat'),
        });
      } catch (err) {
        console.error(
          `❌ Error parsing redirect rule at line ${index + 1}:`,
          err.message,
        );
      }
    });

    return rules;
  } catch (error) {
    console.error('❌ Error reading _redirects file:', error.message);
    return [];
  }
}

/**
 * Apply redirect rules to a URL
 */
function applyRedirects(url, rules) {
  for (const rule of rules) {
    const match = url.match(rule.pattern);
    if (match) {
      let target = rule.to;

      if (rule.hasSplat && match[1] !== undefined) {
        target = target.replace(':splat', match[1]);
      } else if (rule.hasSplat && match[1] === undefined) {
        target = target.replace(':splat', '');
      }

      return { target, status: rule.status };
    }
  }
  return null;
}

/**
 * Get cache headers based on file type
 * DEVELOPMENT MODE: All files served without cache for live updates
 */
function getCacheHeaders(_filePath) {
  // Disable all caching in development for instant updates
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
}

/**
 * Serve a file asynchronously
 */
async function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = await fs.readFile(filePath);
    const cacheHeaders = getCacheHeaders(filePath);

    res.writeHead(200, {
      'Content-Type': mimeType,
      ...cacheHeaders,
    });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>404 Not Found</title>
            <style>
              body { font-family: system-ui; max-width: 600px; margin: 100px auto; padding: 20px; }
              h1 { color: #e74c3c; }
              code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
            </style>
          </head>
          <body>
            <h1>404 Not Found</h1>
            <p>The requested file <code>${filePath.replace(ROOT, '')}</code> was not found.</p>
            <p><a href="/">← Back to Home</a></p>
          </body>
        </html>
      `);
    } else {
      console.error('❌ Error serving file:', err);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>500 Internal Server Error</h1>');
    }
  }
}

/**
 * Check if path is a directory (async)
 */
async function isDirectory(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if file exists (async)
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Initialize redirects
const redirects = parseRedirects();

// Create server
const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  let url = req.url.split('?')[0]; // Remove query string

  // Apply redirects
  const redirect = applyRedirects(url, redirects);
  if (redirect) {
    if (redirect.status === 200) {
      // Rewrite (serve different file)
      url = redirect.target;
      console.log(`  ↪️  Rewrite: ${req.url} → ${url}`);
    } else {
      // Redirect
      const duration = Date.now() - startTime;
      console.log(
        `  ↗️  Redirect ${redirect.status}: ${req.url} → ${redirect.target} (${duration}ms)`,
      );
      res.writeHead(redirect.status, { Location: redirect.target });
      res.end();
      return;
    }
  }

  // Resolve file path
  let filePath = path.join(ROOT, url);

  // Check if directory - serve index.html
  if (await isDirectory(filePath)) {
    filePath = path.join(filePath, 'index.html');
  }

  // If no extension and file doesn't exist, try .html
  if (!path.extname(filePath) && !(await fileExists(filePath))) {
    const htmlPath = filePath + '.html';
    if (await fileExists(htmlPath)) {
      filePath = htmlPath;
    }
  }

  // Serve the file
  await serveFile(filePath, res);

  const duration = Date.now() - startTime;
  const statusColor = res.statusCode < 400 ? '\x1b[32m' : '\x1b[31m';
  console.log(
    `${new Date().toISOString()} ${statusColor}${res.statusCode}\x1b[0m ${req.method} ${req.url} (${duration}ms)`,
  );
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down server...');
  server.close(() => {
    console.log('✓ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down server...');
  server.close(() => {
    console.log('✓ Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Optimized Development Server v2.0.0');
  console.log('='.repeat(60));
  console.log(`\n✓ Server running at http://localhost:${PORT}/`);
  console.log(`✓ Loaded ${redirects.length} redirect rules from _redirects`);
  console.log(`✓ Serving files from: ${ROOT}`);
  console.log('\nQuick Links:');
  console.log(`  • Home:       http://localhost:${PORT}/`);
  console.log(`  • About:      http://localhost:${PORT}/about/`);
  console.log(`  • Blog:       http://localhost:${PORT}/blog/`);
  console.log(`  • Gallery:    http://localhost:${PORT}/gallery/`);
  console.log(`  • Projekte:   http://localhost:${PORT}/projekte/`);
  console.log(`  • Videos:     http://localhost:${PORT}/videos/`);
  console.log('\n' + '='.repeat(60));
  console.log('Press Ctrl+C to stop');
  console.log('='.repeat(60) + '\n');

  // Auto-open browser
  const url = `http://localhost:${PORT}`;
  const openCommand =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';

  exec(`${openCommand} ${url}`, (err) => {
    if (err) {
      console.error('⚠️  Could not auto-open browser:', err.message);
    }
  });
});

// Error handling
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `❌ Port ${PORT} is already in use. Please close the other server or use a different port.`,
    );
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});
