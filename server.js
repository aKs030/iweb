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

const templates = { head: '', loader: '' };

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

// ─── Header Rules (dynamisch aus _headers) ───────────────────
let HEADER_RULES = [];

function loadHeaders() {
  try {
    const path = resolve(ROOT, '_headers');
    if (!existsSync(path)) return;

    const content = readFileSync(path, 'utf-8');
    const lines = content.split('\n');

    HEADER_RULES = [];
    let currentRule = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Check if line starts a new path rule (no leading whitespace)
      if (!line.startsWith(' ') && !line.startsWith('\t')) {
        // Save previous rule if exists
        if (currentRule) {
          HEADER_RULES.push(currentRule);
        }
        // Start new rule
        currentRule = {
          path: trimmed,
          headers: {},
        };
      } else if (currentRule && trimmed.includes(':')) {
        // Parse header line (indented, contains colon)
        const colonIndex = trimmed.indexOf(':');
        const headerName = trimmed.substring(0, colonIndex).trim();
        const headerValue = trimmed.substring(colonIndex + 1).trim();
        if (headerName && headerValue) {
          currentRule.headers[headerName] = headerValue;
        }
      }
    }

    // Don't forget the last rule
    if (currentRule) {
      HEADER_RULES.push(currentRule);
    }

    // Sort rules by specificity (most specific first)
    HEADER_RULES.sort((a, b) => {
      const aSpec =
        a.path.split('/').length + (a.path.includes('*') ? -0.5 : 0);
      const bSpec =
        b.path.split('/').length + (b.path.includes('*') ? -0.5 : 0);
      return bSpec - aSpec;
    });

    console.log(`  ✓ _headers geladen (${HEADER_RULES.length} Regeln)`);
  } catch (err) {
    console.warn('  ⚠ Fehler beim Laden von _headers:', err.message);
  }
}

loadHeaders();

/**
 * Findet passende Header-Regel für eine URL
 */
function getHeadersForPath(url) {
  const headers = {};

  // Apply matching rules (most specific first)
  for (const rule of HEADER_RULES) {
    if (matchPath(url, rule.path)) {
      Object.assign(headers, rule.headers);
    }
  }

  // Remove security headers that force HTTPS for localhost
  if (headers['Content-Security-Policy']) {
    headers['Content-Security-Policy'] = headers['Content-Security-Policy']
      .replace(/upgrade-insecure-requests;?\s*/gi, '')
      .trim();
  }

  // Remove HSTS header for localhost (forces HTTPS)
  delete headers['Strict-Transport-Security'];

  // Remove CORS headers that might interfere
  delete headers['Cross-Origin-Embedder-Policy'];
  delete headers['Cross-Origin-Opener-Policy'];

  return headers;
}

/**
 * Matcht eine URL gegen einen Header-Pfad (mit Wildcards)
 */
function matchPath(url, pattern) {
  // Exact match
  if (url === pattern) return true;

  // Wildcard at end: /path/*
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1);
    return url.startsWith(prefix);
  }

  // Wildcard at start: /*.ext
  if (pattern.startsWith('/*.')) {
    const ext = pattern.slice(2);
    return url.endsWith('.' + ext);
  }

  // Catch-all: /*
  if (pattern === '/*') return true;

  return false;
}

// Watch _redirects for changes
if (existsSync(resolve(ROOT, '_redirects'))) {
  watchFile(resolve(ROOT, '_redirects'), { interval: 1000 }, () => {
    console.log('\n  🔄 _redirects geändert — neu geladen');
    loadRedirects();
  });
}

// Watch _headers for changes
if (existsSync(resolve(ROOT, '_headers'))) {
  watchFile(resolve(ROOT, '_headers'), { interval: 1000 }, () => {
    console.log('\n  🔄 _headers geändert — neu geladen');
    loadHeaders();
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
  '/impressum/': 'pages/impressum/index.html',
  '/datenschutz/': 'pages/datenschutz/index.html',
  '/contact/': 'content/components/contact/index.html',
};

function tryServe(filePath, res, url = '/') {
  if (!existsSync(filePath)) return false;
  const stat = statSync(filePath);
  if (!stat.isFile()) return false;

  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  // Get headers from _headers file
  const customHeaders = getHeadersForPath(url);

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
      ...customHeaders,
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
    ...customHeaders,
  });
  res.end(content);
  return true;
}

// ─── R2 Proxy Handler (Dev-Mode für CORS) ────────────────────
async function handleR2Proxy(req, res, url) {
  // Proxy für img.abdulkerimsesli.de → löst CORS-Probleme auf localhost
  if (!url.startsWith('/r2-proxy/')) return false;

  const imagePath = url.replace('/r2-proxy/', '');
  const r2Url = `https://img.abdulkerimsesli.de/${imagePath}`;

  try {
    const https = await import('https');

    https
      .get(r2Url, (r2Res) => {
        const contentType =
          r2Res.headers['content-type'] || 'application/octet-stream';
        const chunks = [];

        r2Res.on('data', (chunk) => chunks.push(chunk));
        r2Res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': buffer.length,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(buffer);
        });
      })
      .on('error', (error) => {
        console.error('[R2 Proxy] Fetch failed:', error.message);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('R2 Proxy Error');
      });

    return true;
  } catch (error) {
    console.error('[R2 Proxy] Error:', error.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy Error');
    return true;
  }
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

  // YouTube API Mock (GET requests)
  if (url.startsWith('/api/youtube/')) {
    if (req.method !== 'GET') {
      res.writeHead(405, corsHeaders);
      res.end(JSON.stringify({ error: 'Method not allowed', status: 405 }));
      return true;
    }

    res.writeHead(200, corsHeaders);
    res.end(
      JSON.stringify({
        items: [],
        pageInfo: { totalResults: 0, resultsPerPage: 0 },
        error: {
          message:
            'YouTube API ist nur in Production verfügbar. Bitte deployen oder YOUTUBE_API_KEY in .dev.vars setzen und wrangler pages dev verwenden.',
        },
      }),
    );
    return true;
  }

  // Other API endpoints require POST
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
            summary: `Dies ist eine KI-gestützte Zusammenfassung für deine Suche nach "${query}". Ich habe Informationen über Startseite und Projekte gefunden.`,
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

const server = createServer(async (req, res) => {
  const url = req.url?.split('?')[0] || '/';

  // 0. R2 Proxy (löst CORS-Probleme auf localhost)
  if (await handleR2Proxy(req, res, url)) return;

  // 1. API mock endpoints (Dev-Mode → kein Worker nötig)
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
          url,
        )
      )
        return;
    }
  }

  // 3. Clean URLs (Fallback mapping)
  if (CLEAN_URLS[url]) {
    if (tryServe(resolve(ROOT, CLEAN_URLS[url]), res, url)) return;
  }

  // 4. Direct file serving
  const filePath = resolve(ROOT, url.substring(1));
  if (tryServe(filePath, res, url)) return;

  // 5. Try adding index.html for directories
  if (url.endsWith('/')) {
    const indexPath = resolve(ROOT, url.substring(1), 'index.html');
    if (tryServe(indexPath, res, url)) return;
  }

  // 6. Try .html extension
  const htmlPath = resolve(ROOT, url.substring(1) + '.html');
  if (tryServe(htmlPath, res, url)) return;

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
