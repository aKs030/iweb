#!/usr/bin/env node
/*
 Simple static-site audit for this repository.
 - Scans HTML/CSS/JS for local references (href/src/srcset/url()/import)
 - Validates that referenced files exist
 - Parses manifest.json icons and sitemap.xml <loc> entries
 - Reports potentially orphaned assets and unlinked pages (heuristic)
*/

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const IGNORE_DIRS = new Set(['.git', '.github', '.vscode', 'node_modules', 'tools']);
const HTML_EXT = new Set(['.html', '.htm']);
const CSS_EXT = new Set(['.css']);
const JS_EXT = new Set(['.js', '.mjs', '.cjs']);
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.ico']);
const FONT_EXT = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot']);

/** @type {Set<string>} */
const allFiles = new Set(); // relative POSIX paths from ROOT
/** @type {Set<string>} */
const referenced = new Set();
/** @type {Array<{from:string, ref:string, note?:string}>} */
const missing = [];

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(ent.name)) continue;
      walk(path.join(dir, ent.name));
    } else if (ent.isFile()) {
      const rel = toPosix(path.relative(ROOT, path.join(dir, ent.name)));
      allFiles.add(rel);
    }
  }
}

function isExternal(url) {
  return /^(https?:)?\/\//i.test(url);
}

function isData(url) {
  return /^data:/i.test(url);
}

function normalizeRef(ref, fromFile) {
  // strip quotes/whitespace
  const original = (ref || '').trim();
  let refWork = original;
  if (!refWork) return null;
  if (isExternal(refWork) || isData(refWork) || refWork.startsWith('mailto:') || refWork.startsWith('tel:')) return null;

  // strip query/hash
  const qIdx = refWork.indexOf('?');
  if (qIdx !== -1) refWork = refWork.slice(0, qIdx);
  const hIdx = refWork.indexOf('#');
  if (hIdx !== -1) refWork = refWork.slice(0, hIdx);
  if (!refWork) return null;

  // absolute site path -> map to repo path
  let startedAbsolute = false;
  if (refWork.startsWith('/')) {
    startedAbsolute = true;
    refWork = refWork.replace(/^\/+/, '');
  }

  // Special case: root '/' should map to index.html
  if (startedAbsolute && (original === '/' || refWork === '')) {
    return 'index.html';
  }

  // resolve relative to fromFile
  let baseDir = fromFile ? path.dirname(fromFile) : '';
  if (startedAbsolute) baseDir = '';
  const abs = path.posix.normalize(toPosix(path.join(baseDir, refWork)));
  return abs;
}

function addRef(ref, fromFile, note) {
  const norm = normalizeRef(ref, fromFile);
  if (!norm) return;
  referenced.add(norm);
  if (!allFiles.has(norm)) {
    // Special case: directory links implying index.html
    if (!path.posix.extname(norm)) {
      const idx = path.posix.join(norm, 'index.html');
      if (allFiles.has(idx)) {
        referenced.add(idx);
        return;
      }
    }
    // Special case: html without extension but likely page path
    if (!path.posix.extname(norm) && allFiles.has(norm + '.html')) {
      referenced.add(norm + '.html');
      return;
    }
    missing.push({ from: fromFile || '(root)', ref: norm, note });
  }
}

function extractFromHTML(relPath) {
  const text = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  // link href
  for (const m of text.matchAll(/<link[^>]+href\s*=\s*"([^"]+)"/gi)) addRef(m[1], relPath, 'link[href]');
  // script src
  for (const m of text.matchAll(/<script[^>]+src\s*=\s*"([^"]+)"/gi)) addRef(m[1], relPath, 'script[src]');
  // img src
  for (const m of text.matchAll(/<img[^>]+src\s*=\s*"([^"]+)"/gi)) addRef(m[1], relPath, 'img[src]');
  // img/srcset or source/srcset
  for (const m of text.matchAll(/\s(?:srcset|data-srcset)\s*=\s*"([^"]+)"/gi)) {
    const parts = m[1].split(',');
    for (const p of parts) {
      const file = p.trim().split(/\s+/)[0];
      addRef(file, relPath, 'srcset');
    }
  }
  // data-*-src patterns (e.g., data-section-src, data-footer-src)
  for (const m of text.matchAll(/\sdata-[a-z0-9_-]*src\s*=\s*"([^"]+)"/gi)) {
    addRef(m[1], relPath, 'data-*-src');
  }
  // a href (only local files we recognize)
  for (const m of text.matchAll(/<a[^>]+href\s*=\s*"([^"]+)"/gi)) {
    const href = m[1];
    if (isExternal(href) || href.startsWith('#') || href.startsWith('mailto:')) continue;
    if (/\.(html?|css|js|png|jpe?g|svg|webp|gif)$/i.test(href) || href.endsWith('/') || !path.posix.extname(href)) {
      addRef(href, relPath, 'a[href]');
    }
  }
}

function extractFromCSS(relPath) {
  const text = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  // url("...")
  for (const m of text.matchAll(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/gi)) {
    const url = m[1];
    if (!url) continue;
    // ignore absolute or data
    addRef(url, relPath, 'css url()');
  }
  // @import "..."
  for (const m of text.matchAll(/@import\s+['"]([^'"]+)['"]/gi)) addRef(m[1], relPath, 'css @import');
}

function extractFromJS(relPath) {
  const text = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  // import ... from '...'
  for (const m of text.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) addRef(m[1], relPath, 'js import');
  // bare import '...'
  for (const m of text.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) addRef(m[1], relPath, 'js import bare');
  // import('...')
  for (const m of text.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) addRef(m[1], relPath, 'js dynamic import');
  // Heuristic: direct string resource references like "/content/..." or "/pages/..."
  for (const m of text.matchAll(/['"](\/(?:content|pages)\/[^'"\s]+)['"]/g)) addRef(m[1], relPath, 'js string ref');
  // Heuristic: local module strings like "./Foo.js"
  for (const m of text.matchAll(/['"](\.\/[A-Za-z0-9_\-\/\.]+\.js)['"]/g)) addRef(m[1], relPath, 'js module string');
}

function maybeCheckManifest() {
  const mfPath = 'manifest.json';
  if (!allFiles.has(mfPath)) return null;
  try {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, mfPath), 'utf8'));
    const manifestIssues = [];
    if (Array.isArray(json.icons)) {
      for (const icon of json.icons) {
        if (icon && icon.src) addRef(icon.src, mfPath, 'manifest icon');
      }
    }
    if (json.start_url && typeof json.start_url === 'string') {
      // start_url may include query/hash; normalize for existence only if it looks like local path
      const n = normalizeRef(json.start_url, 'index.html');
      if (n && !allFiles.has(n)) {
        // tolerate index.html default
        if (!(n.endsWith('index.html') && allFiles.has(n))) {
          manifestIssues.push({ from: mfPath, ref: n, note: 'manifest start_url (existence check heuristic)' });
        }
      }
    }
    return { manifestIssues };
  } catch (e) {
    return { manifestIssues: [{ from: mfPath, ref: mfPath, note: 'invalid JSON: ' + e.message }] };
  }
}

function maybeCheckSitemap() {
  const sp = 'sitemap.xml';
  if (!allFiles.has(sp)) return null;
  const xml = fs.readFileSync(path.join(ROOT, sp), 'utf8');
  const urls = [];
  for (const m of xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
    urls.push(m[1].trim());
  }
  /** @type {Array<{url:string, path:string, exists:boolean}>} */
  const checks = [];
  for (const u of urls) {
    try {
      const urlObj = new URL(u);
      let p = urlObj.pathname;
      if (p.startsWith('/')) p = p.slice(1);
      if (!p) p = 'index.html';
      if (p.endsWith('/')) p += 'index.html';
      const exists = allFiles.has(toPosix(p));
      checks.push({ url: u, path: toPosix(p), exists });
      if (!exists) missing.push({ from: 'sitemap.xml', ref: toPosix(p), note: 'sitemap <loc> file missing' });
    } catch {
      // Not a valid URL, try to treat as path
      let p = u.replace(/^https?:\/\/[^/]+\//i, '');
      if (p.startsWith('/')) p = p.slice(1);
      if (!p) p = 'index.html';
      if (p.endsWith('/')) p += 'index.html';
      const exists = allFiles.has(toPosix(p));
      checks.push({ url: u, path: toPosix(p), exists });
      if (!exists) missing.push({ from: 'sitemap.xml', ref: toPosix(p), note: 'sitemap <loc> file missing' });
    }
  }
  return { sitemap: checks };
}

function run() {
  walk(ROOT);

  // Parse source files and extract references
  for (const rel of allFiles) {
    const ext = path.posix.extname(rel).toLowerCase();
    try {
      if (HTML_EXT.has(ext)) extractFromHTML(rel);
      else if (CSS_EXT.has(ext)) extractFromCSS(rel);
      else if (JS_EXT.has(ext)) extractFromJS(rel);
    } catch (e) {
      console.error(`Failed to parse ${rel}: ${e.message}`);
    }
  }

  const manifestInfo = maybeCheckManifest();
  const sitemapInfo = maybeCheckSitemap();

  // Compute orphan-like files
  const orphanAssets = [];
  const unlinkedPages = [];
  for (const rel of allFiles) {
    if (rel.startsWith('tools/')) continue; // ignore self
    const ext = path.posix.extname(rel).toLowerCase();
    if (referenced.has(rel)) continue;
    if (HTML_EXT.has(ext)) {
      // Allow top-level index.html to be unreferenced (entry point)
      if (rel === 'index.html') continue;
      unlinkedPages.push(rel);
    } else if (CSS_EXT.has(ext) || JS_EXT.has(ext) || IMG_EXT.has(ext) || FONT_EXT.has(ext)) {
      orphanAssets.push(rel);
    }
  }

  // Missing references (dedup)
  const missingDedup = [];
  const seen = new Set();
  for (const m of missing) {
    const key = `${m.from} -> ${m.ref}`;
    if (!seen.has(key)) {
      seen.add(key);
      missingDedup.push(m);
    }
  }

  const result = {
    summary: {
      totalFiles: allFiles.size,
      referencedFiles: referenced.size,
      missingRefs: missingDedup.length,
      orphanAssets: orphanAssets.length,
      unlinkedPages: unlinkedPages.length,
    },
    missing: missingDedup,
    orphanAssets,
    unlinkedPages,
    ...(manifestInfo || {}),
    ...(sitemapInfo || {}),
  };

  // Pretty print
  console.log('=== Static Audit Report ===');
  console.log(JSON.stringify(result.summary, null, 2));
  if (result.missing.length) {
    console.log('\nMissing references:');
    for (const m of result.missing) {
      console.log(`- ${m.from} -> ${m.ref}${m.note ? ' (' + m.note + ')' : ''}`);
    }
  }
  if (result.unlinkedPages.length) {
    console.log('\nUnlinked pages (heuristic):');
    for (const p of result.unlinkedPages) console.log('- ' + p);
  }
  if (result.orphanAssets.length) {
    console.log('\nPotentially orphaned assets:');
    for (const p of result.orphanAssets) console.log('- ' + p);
  }
  if (result.manifestIssues && result.manifestIssues.length) {
    console.log('\nManifest issues:');
    for (const it of result.manifestIssues) console.log(`- ${it.note}`);
  }
  if (result.sitemap && result.sitemap.length) {
    const missingS = result.sitemap.filter(x => !x.exists);
    if (missingS.length) {
      console.log('\nSitemap entries with missing files:');
      for (const it of missingS) console.log(`- ${it.url} (expected ${it.path})`);
    }
  }

  // Exit code: 0 even if missing, to not break flows; adjust if needed
}

run();
