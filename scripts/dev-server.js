#!/usr/bin/env node

/**
 * Local development server that respects _redirects file
 * Supports Cloudflare Pages / Netlify redirect syntax
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const PORT = 8080;
const ROOT = path.join(__dirname, '..');

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
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
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Parse _redirects file and convert rules to regex patterns
 * @returns {Array} Array of redirect rules
 */
function parseRedirects() {
  const redirectsPath = path.join(ROOT, '_redirects');
  if (!fs.existsSync(redirectsPath)) return [];

  const content = fs.readFileSync(redirectsPath, 'utf8');
  const rules = [];

  content.split('\n').forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    const parts = line.split(/\s+/);
    if (parts.length < 2) return;

    const [from, to, statusStr] = parts;
    const status = parseInt(statusStr) || 301;

    // Convert wildcards to regex - IMPORTANT: escape dots BEFORE replacing asterisks
    const pattern = from
      .replace(/\//g, '\\/') // Escape slashes first
      .replace(/\./g, '\\.') // Escape dots second
      .replace(/\*/g, '(.*)'); // Replace asterisks with capture groups LAST

    rules.push({
      from,
      to,
      status,
      pattern: new RegExp(`^${pattern}$`),
      hasSplat: from.includes('*') || to.includes(':splat'),
    });
  });

  return rules;
}

/**
 * Apply redirect rules to a URL
 * @param {string} url - The URL to check
 * @param {Array} rules - Array of redirect rules
 * @returns {Object|null} Redirect target and status, or null if no match
 */
function applyRedirects(url, rules) {
  for (const rule of rules) {
    const match = url.match(rule.pattern);
    if (match) {
      let target = rule.to;

      // Handle :splat replacement
      if (rule.hasSplat && match[1] !== undefined) {
        target = target.replace(':splat', match[1]);
      } else if (rule.hasSplat && match[1] === undefined) {
        // For paths like /videos/ without additional parts, :splat should be empty
        target = target.replace(':splat', '');
      }

      return { target, status: rule.status };
    }
  }
  return null;
}

/**
 * Serve a file with appropriate MIME type
 * @param {string} filePath - Path to the file to serve
 * @param {Object} res - HTTP response object
 */
function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  console.log(`  → Trying to serve: ${filePath}`);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content);
    }
  });
}

// Initialize redirects and create server
const redirects = parseRedirects();

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0]; // Remove query string

  console.log(`${new Date().toISOString()} - ${req.method} ${url}`);

  // Apply redirects
  const redirect = applyRedirects(url, redirects);
  if (redirect) {
    if (redirect.status === 200) {
      // Rewrite (serve different file)
      url = redirect.target;
      console.log(`  → Rewrite to: ${url}`);
    } else {
      // Redirect
      console.log(`  → Redirect ${redirect.status} to: ${redirect.target}`);
      res.writeHead(redirect.status, { Location: redirect.target });
      res.end();
      return;
    }
  }

  // Resolve file path
  let filePath = path.join(ROOT, url);

  // Check if directory - serve index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // If no extension and file doesn't exist, try .html
  if (!path.extname(filePath) && !fs.existsSync(filePath)) {
    const htmlPath = filePath + '.html';
    if (fs.existsSync(htmlPath)) {
      filePath = htmlPath;
    }
  }

  // Serve the file
  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log(`\n✓ Development server running at http://localhost:${PORT}/`);
  console.log(`✓ Loaded ${redirects.length} redirect rules from _redirects\n`);
  console.log('Quick Links:');
  console.log(`  • Home:       http://localhost:${PORT}/`);
  console.log(`  • About:      http://localhost:${PORT}/about/`);
  console.log(`  • Blog:       http://localhost:${PORT}/blog/`);
  console.log(`  • Gallery:    http://localhost:${PORT}/gallery/`);
  console.log(`  • Projekte:   http://localhost:${PORT}/projekte/`);
  console.log(`  • Videos:     http://localhost:${PORT}/videos/`);
  console.log(`\n  Press Ctrl+C to stop\n`);

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
      console.error('Could not auto-open browser:', err.message);
    }
  });
});
