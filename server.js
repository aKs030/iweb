#!/usr/bin/env node
/**
 * Dev Server — Build-free mit dynamischer Template-Injection
 *
 * Verhält sich wie Cloudflare Pages + functions/_middleware.js:
 * - Ersetzt <!-- INJECT:BASE-HEAD --> und <!-- INJECT:BASE-LOADER -->
 *   in HTML-Responses zur Laufzeit (kein Duplicate, kein Build)
 * - Clean URLs, Redirects, Rewrites
 * - Korrekte MIME-Types
 * - Automatischer Reload bei Template-Änderungen
 *
 * Run: node server.js
 * @version 2.0.0
 */

import { createServer } from 'http';
import { readFileSync, existsSync, statSync, watchFile } from 'fs';
import { resolve, extname } from 'path';

const PORT = process.env.PORT || 8080;
const ROOT = import.meta.dirname;

// ─── MIME Types ──────────────────────────────────────────────
const MIME = {
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
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4',
};

// ─── Template Injection (wie Cloudflare _middleware.js) ──────
const TEMPLATE_PATHS = {
  head: resolve(ROOT, 'content/templates/base-head.html'),
  loader: resolve(ROOT, 'content/templates/base-loader.html'),
};

let templates = { head: '', loader: '' };

function loadTemplates() {
  try {
    templates.head = readFileSync(TEMPLATE_PATHS.head, 'utf-8');
    console.log('  ✓ base-head.html geladen');
  } catch {
    console.warn('  ⚠ base-head.html nicht gefunden');
  }
  try {
    templates.loader = readFileSync(TEMPLATE_PATHS.loader, 'utf-8');
    console.log('  ✓ base-loader.html geladen');
  } catch {
    console.warn('  ⚠ base-loader.html nicht gefunden');
  }
}

loadTemplates();

// Watch templates for changes → auto-reload
for (const tplPath of Object.values(TEMPLATE_PATHS)) {
  if (existsSync(tplPath)) {
    watchFile(tplPath, { interval: 1000 }, () => {
      console.log('\n  🔄 Template geändert — neu geladen');
      loadTemplates();
    });
  }
}

function injectTemplates(html) {
  if (templates.head) {
    html = html.replace(/<!--\s*INJECT:BASE-HEAD\s*-->/g, templates.head);
  }
  if (templates.loader) {
    html = html.replace(/<!--\s*INJECT:BASE-LOADER\s*-->/g, templates.loader);
  }
  return html;
}

// ─── Redirect Rules (dynamisch aus _redirects) ──────────────
let REDIRECTS = [];
let REWRITES = [];

function loadRedirects() {
  try {
    const path = resolve(ROOT, '_redirects');
    if (!existsSync(path)) return;

    const content = readFileSync(path, 'utf-8');
    const lines = content.split('\n');

    REDIRECTS = [];
    REWRITES = [];

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;

      const [from, to, statusStr] = line.split(/\s+/);
      if (!from || !to) continue;

      const status = parseInt(statusStr) || 301;
      if (status === 200) {
        REWRITES.push({ from, to });
      } else {
        REDIRECTS.push({ from, to, status });
      }
    }
    console.log(
      `  ✓ _redirects geladen (${REDIRECTS.length} Redirects, ${REWRITES.length} Rewrites)`,
    );
  } catch (err) {
    console.warn('  ⚠ Fehler beim Laden von _redirects:', err.message);
  }
}

loadRedirects();

// Watch _redirects for changes
if (existsSync(resolve(ROOT, '_redirects'))) {
  watchFile(resolve(ROOT, '_redirects'), { interval: 1000 }, () => {
    console.log('\n  🔄 _redirects geändert — neu geladen');
    loadRedirects();
  });
}

/**
 * Matcht eine URL gegen eine _redirects-Regel (inkl. Wildcards)
 */
function matchRule(url, ruleFrom) {
  // 1. Exakter Match
  if (url === ruleFrom) return { matched: true, splat: '' };

  // 2. Wildcard /* am Ende
  if (ruleFrom.endsWith('/*')) {
    const prefix = ruleFrom.slice(0, -1); // e.g., /gallery/
    if (url.startsWith(prefix)) {
      return { matched: true, splat: url.slice(prefix.length) };
    }
    // Auch den Prefix ohne Slash matchen wenn es genau passt
    if (url === prefix.slice(0, -1)) return { matched: true, splat: '' };
  }

  // 3. Dateiendung-Wildcard /*.html
  if (ruleFrom.startsWith('/*.')) {
    const ext = ruleFrom.slice(1); // e.g., .html
    if (url.endsWith(ext)) {
      return { matched: true, splat: url.slice(1, -ext.length) };
    }
  }

  return { matched: false };
}

/**
 * Wendet Splat auf das Ziel an
 */
function applySplat(to, splat) {
  return to.replace(':splat', splat);
}

// ─── Clean URL mapping (Fallback wenn _redirects fehlt) ─────
const CLEAN_URLS = {
  '/': 'index.html',
  '/about/': 'pages/about/index.html',
  '/blog/': 'pages/blog/index.html',
  '/gallery/': 'pages/gallery/index.html',
  '/projekte/': 'pages/projekte/index.html',
  '/videos/': 'pages/videos/index.html',
  '/impressum/': 'impressum/index.html',
  '/datenschutz/': 'datenschutz/index.html',
};

function tryServe(filePath, res) {
  if (!existsSync(filePath)) return false;
  const stat = statSync(filePath);
  if (!stat.isFile()) return false;

  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  // HTML → dynamische Template-Injection
  if (ext === '.html') {
    let html = readFileSync(filePath, 'utf-8');
    html = injectTemplates(html);
    const buf = Buffer.from(html, 'utf-8');
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': buf.length,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(buf);
    return true;
  }

  const content = readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': content.length,
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(content);
  return true;
}

// ─── API Mock Handlers (Dev-Mode) ────────────────────────────
function handleAPIMock(req, res, url) {
  // Only handle API routes
  if (!url.startsWith('/api/')) return false;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return true;
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (req.method !== 'POST') {
    res.writeHead(405, corsHeaders);
    res.end(JSON.stringify({ error: 'Method not allowed', status: 405 }));
    return true;
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    try {
      const data = JSON.parse(body || '{}');

      if (url === '/api/ai') {
        const prompt = data.prompt || data.message || '';
        res.writeHead(200, corsHeaders);
        res.end(
          JSON.stringify({
            text: `(Dev-Mode) Mock-Antwort für: "${prompt.slice(0, 80)}". Die Cloudflare AI ist nur in Produktion verfügbar.`,
            sources: [],
            usedRAG: false,
            model: 'mock-dev',
          }),
        );
      } else if (url === '/api/search') {
        const query = data.query || '';
        res.writeHead(200, corsHeaders);
        res.end(
          JSON.stringify({
            results: [
              {
                title: 'Startseite',
                url: '/',
                category: 'Home',
                description: 'Willkommen auf meiner Webseite.',
              },
              {
                title: `Suche nach "${query}"`,
                url: '/search',
                category: 'Seite',
                description: `Ergebnisse für ${query} werden hier simuliert.`,
              },
            ],
            query,
            count: 2,
          }),
        );
      } else {
        res.writeHead(404, corsHeaders);
        res.end(JSON.stringify({ error: 'Not found', status: 404 }));
      }
    } catch {
      res.writeHead(400, corsHeaders);
      res.end(JSON.stringify({ error: 'Invalid JSON', status: 400 }));
    }
  });
  return true;
}

const server = createServer((req, res) => {
  let url = req.url?.split('?')[0] || '/';

  // 0. API mock endpoints (Dev-Mode → kein Worker nötig)
  if (handleAPIMock(req, res, url)) return;

  // 1. Check redirects (from _redirects)
  for (const rule of REDIRECTS) {
    const { matched, splat } = matchRule(url, rule.from);
    if (matched) {
      const target = applySplat(rule.to, splat);
      res.writeHead(rule.status, { Location: target });
      res.end();
      return;
    }
  }

  // 2. Check rewrites (from _redirects)
  for (const rule of REWRITES) {
    const { matched, splat } = matchRule(url, rule.from);
    if (matched) {
      const target = applySplat(rule.to, splat);
      if (
        tryServe(
          resolve(ROOT, target.startsWith('/') ? target.slice(1) : target),
          res,
        )
      )
        return;
    }
  }

  // 3. Clean URLs (Fallback mapping)
  if (CLEAN_URLS[url]) {
    if (tryServe(resolve(ROOT, CLEAN_URLS[url]), res)) return;
  }

  // 4. Direct file serving
  const filePath = resolve(ROOT, url.substring(1));
  if (tryServe(filePath, res)) return;

  // 5. Try adding index.html for directories
  if (url.endsWith('/')) {
    const indexPath = resolve(ROOT, url.substring(1), 'index.html');
    if (tryServe(indexPath, res)) return;
  }

  // 6. Try .html extension
  const htmlPath = resolve(ROOT, url.substring(1) + '.html');
  if (tryServe(htmlPath, res)) return;

  // 404
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    `<!DOCTYPE html><html><body><h1>404</h1><p>${url} nicht gefunden</p></body></html>`,
  );
});

server.listen(PORT, () => {
  console.log(`\n  🚀 Dev-Server: http://localhost:${PORT}`);
  console.log(
    '  📄 Templates werden dynamisch injiziert (kein Build, kein Duplicate)',
  );
  console.log('  👀 Template-Änderungen werden automatisch erkannt');
  console.log('  Strg+C zum Beenden\n');
});
