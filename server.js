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
import { readFileSync, existsSync, statSync, watch } from 'fs';
import { resolve, extname, relative } from 'path';
import os from 'os';
import { onRequestPost as onSearchRequestPost } from './functions/api/search.js';

const PORT = process.env.PORT || 8080;
const ROOT = import.meta.dirname;
const START_TIME = Date.now();

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

function isSubPath(parent, child) {
  const rel = relative(parent, child);
  return (
    rel &&
    !rel.startsWith('..') &&
    !rel.includes(`..${process.platform === 'win32' ? '\\' : '/'}`)
  );
}

function resolveInsideRoot(...parts) {
  const resolvedPath = resolve(ROOT, ...parts);
  return isSubPath(ROOT, resolvedPath) || resolvedPath === ROOT
    ? resolvedPath
    : null;
}

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

// Watch templates for changes → auto-reload (uses native OS events via fs.watch)
for (const tplPath of Object.values(TEMPLATE_PATHS)) {
  if (existsSync(tplPath)) {
    let debounce = null;
    watch(tplPath, () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        console.log('\n  🔄 Template geändert — neu geladen');
        loadTemplates();
      }, 100);
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

const DEFAULT_VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1, viewport-fit=cover';

function mergeViewportContent(content = '') {
  let merged = content.trim();

  const ensureToken = (regex, token) => {
    if (!regex.test(merged)) {
      merged = merged ? `${merged}, ${token}` : token;
    }
  };

  ensureToken(
    /(^|,)\s*width\s*=\s*device-width\s*(,|$)/i,
    'width=device-width',
  );
  ensureToken(
    /(^|,)\s*initial-scale\s*=\s*1(?:\.0+)?\s*(,|$)/i,
    'initial-scale=1',
  );
  ensureToken(
    /(^|,)\s*viewport-fit\s*=\s*cover\s*(,|$)/i,
    'viewport-fit=cover',
  );

  return merged || DEFAULT_VIEWPORT_CONTENT;
}

function ensureViewportMeta(html) {
  const viewportRegex = /<meta\s+[^>]*name=["']viewport["'][^>]*>/i;
  const viewportMatch = html.match(viewportRegex);

  if (viewportMatch) {
    const contentMatch = viewportMatch[0].match(/content\s*=\s*(["'])(.*?)\1/i);
    const optimizedContent = mergeViewportContent(contentMatch?.[2] || '');

    return html.replace(
      viewportRegex,
      `<meta name="viewport" content="${optimizedContent}" />`,
    );
  }

  const viewportTag = `<meta name="viewport" content="${DEFAULT_VIEWPORT_CONTENT}" />`;

  if (/<meta\s+charset=[^>]*>/i.test(html)) {
    return html.replace(
      /<meta\s+charset=[^>]*>/i,
      (charsetTag) => `${charsetTag}\n    ${viewportTag}`,
    );
  }

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(
      /<head[^>]*>/i,
      (headTag) => `${headTag}\n    ${viewportTag}`,
    );
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

// Dev helper: show uncaught exceptions and unhandled rejections prominently
if (process.env.NODE_ENV !== 'production') {
  process.on('uncaughtException', (err) => {
    console.error(
      '\n[uncaughtException] ' + (err && err.stack ? err.stack : err),
    );
  });
  process.on('unhandledRejection', (reason) => {
    console.error('\n[unhandledRejection] ', reason);
  });
}

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
      // Remove hashes and nonces as they disable 'unsafe-inline'
      .replace(/'sha256-[^']*'/gi, '')
      .replace(/'nonce-[^']*'/gi, '')
      // Ensure unsafe-inline and unsafe-eval are present for dev
      .replace(/(script-src[^;]*)/i, (match) => {
        let updated = match;
        if (!updated.includes("'unsafe-inline'")) updated += " 'unsafe-inline'";
        if (!updated.includes("'unsafe-eval'")) updated += " 'unsafe-eval'";
        return updated;
      })
      .replace(/\s{2,}/g, ' ')
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

// Watch _redirects for changes (native OS events)
if (existsSync(resolve(ROOT, '_redirects'))) {
  let debounce = null;
  watch(resolve(ROOT, '_redirects'), () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log('\n  🔄 _redirects geändert — neu geladen');
      loadRedirects();
    }, 100);
  });
}

// Watch _headers for changes (native OS events)
if (existsSync(resolve(ROOT, '_headers'))) {
  let debounce = null;
  watch(resolve(ROOT, '_headers'), () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log('\n  🔄 _headers geändert — neu geladen');
      loadHeaders();
    }, 100);
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
  if (!filePath) return false;
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
    html = ensureViewportMeta(html);

    // Dev-only: inject a small client logger that forwards console errors to the server
    if (process.env.NODE_ENV !== 'production') {
      const clientLogSnippet = `\n<script>(function(){if(window.__DEV_CLIENT_LOGGER__)return;window.__DEV_CLIENT_LOGGER__=1;function s(l,a){try{var m=a.map(function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ');var p={level:l,message:m,url:location.href,userAgent:navigator.userAgent,timestamp:Date.now()};var b=JSON.stringify(p);if(navigator.sendBeacon){try{navigator.sendBeacon('/__client-log',b)}catch(e){}}else{try{fetch('/__client-log',{method:'POST',headers:{'Content-Type':'application/json'},body:b}).catch(function(){})}catch(e){}}}catch(e){}}var L=['error','warn','info','log','debug'];L.forEach(function(l){var o=console[l]||console.log;console[l]=function(){s(l,Array.prototype.slice.call(arguments));try{o.apply(console,arguments)}catch(e){}}});window.addEventListener('error',function(e){s('error',[e.message,e.filename+':'+e.lineno+':'+e.colno,e.error&&e.error.stack])});window.addEventListener('unhandledrejection',function(e){s('error',[e.reason&&(e.reason.stack||e.reason)])});})();</script>\n`;
      html += clientLogSnippet;
    }

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

// ─── API Dev Handlers ─────────────────────────────────────────
function handleAPIMock(req, res, url) {
  const normalizedUrl = url.length > 1 ? url.replace(/\/+$/, '') || '/' : url;

  // Only handle API routes
  if (!normalizedUrl.startsWith('/api/')) return false;

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
  if (normalizedUrl.startsWith('/api/youtube/')) {
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

  // Gallery items mock (GET request)
  // Returns empty dynamic list so frontend falls back to static gallery config.
  if (normalizedUrl === '/api/gallery-items') {
    if (req.method !== 'GET') {
      res.writeHead(405, corsHeaders);
      res.end(JSON.stringify({ error: 'Method not allowed', status: 405 }));
      return true;
    }

    res.writeHead(200, corsHeaders);
    res.end(
      JSON.stringify({
        items: [],
        source: 'dev-mock',
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
  req.on('end', async () => {
    let data = {};

    try {
      data = JSON.parse(body || '{}');
    } catch {
      res.writeHead(400, corsHeaders);
      res.end(JSON.stringify({ error: 'Invalid JSON', status: 400 }));
      return;
    }

    try {
      if (normalizedUrl === '/api/ai') {
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
      } else if (normalizedUrl === '/api/search') {
        const host = req.headers.host || `localhost:${PORT}`;
        const origin = req.headers.origin || `http://${host}`;
        const requestUrl = new URL(normalizedUrl, origin).toString();

        const request = new Request(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: origin,
          },
          body: JSON.stringify(data),
        });

        // Keep env minimal: search.js handles local fallback when AI binding is absent.
        const env = {
          MAX_SEARCH_RESULTS: process.env.MAX_SEARCH_RESULTS || '10',
          RAG_ID: process.env.RAG_ID || 'wispy-pond-1055',
          ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || origin,
        };

        const functionResponse = await onSearchRequestPost({ request, env });
        const responseBody = await functionResponse.text();
        const functionHeaders = Object.fromEntries(
          functionResponse.headers.entries(),
        );

        res.writeHead(functionResponse.status, {
          ...corsHeaders,
          ...functionHeaders,
          'Access-Control-Allow-Origin': '*',
        });
        res.end(responseBody);
      } else {
        res.writeHead(404, corsHeaders);
        res.end(JSON.stringify({ error: 'Not found', status: 404 }));
      }
    } catch (error) {
      console.error('[API Dev] handler failed:', error?.message || error);
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ error: 'Internal server error', status: 500 }));
    }
  });
  return true;
}

const server = createServer(async (req, res) => {
  const url = req.url?.split('?')[0] || '/';

  // Dev-only: receive client-side console logs forwarded from the browser
  if (
    process.env.NODE_ENV !== 'production' &&
    url === '/__client-log' &&
    req.method === 'POST'
  ) {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const level = (payload.level || 'log').toLowerCase();
        const prefix = `[client:${level}] ${payload.url || ''} • ${payload.userAgent || ''}`;
        const msg = payload.message || '';
        if (level === 'error') console.error(prefix, msg, payload.stack || '');
        else if (level === 'warn') console.warn(prefix, msg);
        else console.log(prefix, msg);
      } catch {
        console.error('[client-log] invalid payload', body);
      }
      res.writeHead(204, { 'Content-Type': 'text/plain' });
      res.end();
    });
    return;
  }

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
          resolveInsideRoot(target.startsWith('/') ? target.slice(1) : target),
          res,
          url,
        )
      )
        return;
    }
  }

  // 3. Clean URLs (Fallback mapping)
  if (CLEAN_URLS[url]) {
    if (tryServe(resolveInsideRoot(CLEAN_URLS[url]), res, url)) return;
  }

  // 4. Direct file serving
  const filePath = resolveInsideRoot(url.substring(1));
  if (tryServe(filePath, res, url)) return;

  // 5. Try adding index.html for directories
  if (url.endsWith('/')) {
    const indexPath = resolveInsideRoot(url.substring(1), 'index.html');
    if (tryServe(indexPath, res, url)) return;
  }

  // 6. Try .html extension
  const htmlPath = resolveInsideRoot(url.substring(1) + '.html');
  if (tryServe(htmlPath, res, url)) return;

  // 404
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    `<!DOCTYPE html><html><body><h1>404</h1><p>${url} nicht gefunden</p></body></html>`,
  );
});

server.listen(PORT, () => {
  const now = Date.now();
  const elapsed = ((now - START_TIME) / 1000).toFixed(2);

  const useColors = process.stdout.isTTY;
  const C = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
  };
  const colorize = (text, code) =>
    useColors && code ? `${code}${text}${C.reset}` : text;
  const ts = () => new Date().toTimeString().split(' ')[0];
  const log = (label, msg, colorName = 'cyan') => {
    const timePrefix = useColors ? `${C.dim}${ts()}${C.reset}` : ts();
    const coloredLabel = colorize(label, C[colorName] || '');
    console.log(`${timePrefix} ${coloredLabel} ${msg}`);
  };

  // Sammle alle nicht-internen Adressen (IPv4 + IPv6), filtere unbrauchbare Interfaces
  const nets = os.networkInterfaces();
  const BLACKLIST = [
    /^awdl/i,
    /^utun/i,
    /^llw/i,
    /^gif/i,
    /^stf/i,
    /^bridge/i,
    /^p2p/i,
  ];
  const isBlacklisted = (name) => BLACKLIST.some((rx) => rx.test(name));

  let addrs = [];
  for (const [name, list] of Object.entries(nets)) {
    if (isBlacklisted(name)) continue; // reduce noise (awdl*, utun* ...)
    for (const net of list) {
      if (net.internal) continue;
      addrs.push({ name, address: net.address, family: net.family });
    }
  }

  // Deduplicate identical addresses
  const seen = new Set();
  addrs = addrs.filter((a) => {
    if (seen.has(a.address)) return false;
    seen.add(a.address);
    return true;
  });

  const isPrivateIPv4 = (ip) =>
    /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);
  // Sort: prefer private IPv4 → IPv4 → IPv6 global → IPv6 ULA → IPv6 link-local
  addrs.sort((a, b) => {
    const score = (x) => {
      if (x.family === 'IPv4') return isPrivateIPv4(x.address) ? 0 : 1;
      if (x.family === 'IPv6') {
        if (x.address.startsWith('fe80:')) return 4; // link-local
        if (x.address.startsWith('fc') || x.address.startsWith('fd')) return 3; // ULA
        return 2; // global
      }
      return 5;
    };
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.address.localeCompare(b.address);
  });

  console.log('');
  log(
    '🚀 Dev‑Server',
    `gestartet — ${colorize(`http://localhost:${PORT}`, C.green)}`,
  );

  // Kompakte LAN‑Anzeige: nur die primäre Adresse (erste private IPv4 / erste IPv4 / erste Adresse)
  const primary =
    addrs.find((a) => a.family === 'IPv4' && isPrivateIPv4(a.address)) ||
    addrs.find((a) => a.family === 'IPv4') ||
    addrs[0];

  if (primary) {
    const url =
      primary.family === 'IPv6'
        ? `http://[${primary.address}]:${PORT}`
        : `http://${primary.address}:${PORT}`;
    const scopeNote =
      primary.family === 'IPv6' && primary.address.startsWith('fe80:')
        ? colorize('(link-local)', C.dim)
        : '';
    console.log(`  🌐 LAN: ${colorize(url, C.green)} ${scopeNote}`);
  }

  console.log('');

  console.log('');
  log(
    '✨',
    'Templates: dynamische Injektion — kein Build, kein Duplicate',
    'magenta',
  );
  log('🔁', 'Auto‑Reload: Template‑Änderungen aktiv', 'magenta');
  log('⌃C', `zum Beenden  •  Startup ${elapsed}s`, 'dim');
  console.log('');
});
