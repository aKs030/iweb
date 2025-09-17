#!/usr/bin/env node
/*
  Security Scan Script
  Prüft Projektdateien auf sicherheitsrelevante Verstöße gegen definierte Policies.

  Checks:
  1. Inline Event Handler (onclick=, onload=, etc.) → verboten
  2. Verbotene Meta Security Header im HTML (<meta http-equiv="Content-Security-Policy"> etc.)
  3. Externe Font / Icon CDNs (fonts.googleapis.com, use.fontawesome.com, cdnjs, unpkg, jsdelivr)
  4. Unsichere inline <script> Blöcke (nicht JSON-LD) → script ohne src und nicht rein JSON-LD erlaubt
  5. @import in CSS (verhindern externe Einbindung)
  6. style="..." Inline-Styles in HTML (optional warnend) – aktuell nur Warnung

  Exit Code:
   0 = Alles ok oder nur Warnungen
   1 = Funde bei harten Verstößen

  Erweiterung: Weitere Patterns in patterns.strict erweitern.
*/

import { readFileSync, readdirSync } from 'fs';
import * as fs from 'fs';
import path from 'path';

// Node Globals (Lint: allow explicit reference)
const projectRoot = globalThis.process ? globalThis.process.cwd() : '';

function walk(dir, out = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue; // skip hidden
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const allFiles = walk(projectRoot || '.');
const htmlFiles = allFiles.filter(f => f.endsWith('.html'));
const cssFiles = allFiles.filter(f => f.endsWith('.css'));
const jsFiles = allFiles.filter(f => f.endsWith('.js'));

const violations = [];
const warnings = [];

// CLI Flags
const args = globalThis.process?.argv ? globalThis.process.argv.slice(2) : [];
const outputJson = args.includes('--json');
const assetCheck = true; // aktiviert Basis Asset-Existenzprüfung

// Patterns
// Inline Events: generische Erkennung (vereinfacht für Lint-Rules)
const inlineEventAttr = / on[a-z]+=/gi;
const metaSecurity = /<meta[^>]+http-equiv\s*=\s*"(?:Content-Security-Policy|X-Frame-Options|X-Content-Type-Options|X-XSS-Protection)"/gi;
const externalFontCdn = /(fonts\.googleapis\.com|use\.fontawesome\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)/gi;
const cssImport = /@import\s+url\(/gi;
const inlineStyleAttr = / style="[^"]+"/gi;

function rel(file) { return path.relative(projectRoot, file); }

// Helper to push violation
function add(type, file, line, message) {
  violations.push({ type, file: rel(file), line, message });
}
function warn(type, file, line, message) {
  warnings.push({ type, file: rel(file), line, message });
}

function scanLines(file, content, handlers) {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    handlers.forEach(fn => fn(lines[i], i + 1));
  }
}

function scanContent(file, content, filetype) {
  const htmlHandlers = [
    (text, line) => { if (inlineEventAttr.test(text)) { add('INLINE_EVENT', file, line, 'Inline Event Handler gefunden'); inlineEventAttr.lastIndex = 0; } },
    (text, line) => { if (metaSecurity.test(text)) { add('META_SECURITY', file, line, 'Verbotener Meta Security Header – muss per HTTP gesetzt werden'); metaSecurity.lastIndex = 0; } },
    (text, line) => { if (externalFontCdn.test(text)) { add('EXTERNAL_CDN', file, line, 'Externe CDN Ressource (Font/Icon) gefunden'); externalFontCdn.lastIndex = 0; } },
    (text, line) => { if (inlineStyleAttr.test(text)) { warn('INLINE_STYLE', file, line, 'Inline style Attribut gefunden (empfohlen: vermeiden)'); inlineStyleAttr.lastIndex = 0; } }
  ];
  const cssHandlers = [
    (text, line) => { if (cssImport.test(text)) { add('CSS_IMPORT', file, line, '@import in CSS vermeiden'); cssImport.lastIndex = 0; } },
    (text, line) => { if (externalFontCdn.test(text)) { add('EXTERNAL_CDN', file, line, 'Externe CDN Referenz in CSS'); externalFontCdn.lastIndex = 0; } }
  ];
  const jsHandlers = [
    (text, line) => { if (/\beval\s*\(/.test(text)) add('EVAL', file, line, 'Verwendung von eval vermeiden'); }
  ];

  if (filetype === 'html') scanLines(file, content, htmlHandlers);
  else if (filetype === 'css') scanLines(file, content, cssHandlers);
  else if (filetype === 'js') scanLines(file, content, jsHandlers);

  if (filetype === 'html') {
    const scriptTagRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = scriptTagRegex.exec(content))) {
      const before = content.slice(0, m.index);
      const line = before.split(/\r?\n/).length;
      const tag = m[0];
      if (/type="application\/(ld\+json|json)"/i.test(tag)) continue;
      const inner = m[1].trim();
      if (inner.length === 0) continue;
      add('INLINE_SCRIPT', file, line, 'Inline <script> Block gefunden – vermeiden für strikte CSP');
    }
  }
}

// Scan HTML
for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf8');
  scanContent(file, content, 'html');
}
// Scan CSS
for (const file of cssFiles) {
  const content = readFileSync(file, 'utf8');
  scanContent(file, content, 'css');
}
// Scan JS (light)
for (const file of jsFiles) {
  const content = readFileSync(file, 'utf8');
  scanContent(file, content, 'js');
}

function formatList(list, label) {
  if (list.length === 0) return `${label}: keine`;
  const rows = list.map(v => `  - [${v.type}] ${v.file}:${v.line} -> ${v.message}`);
  return `${label}:\n${rows.join('\n')}`;
}

// Asset Existenz Prüfung (HTML referenzen)
if (assetCheck) {
  const assetRegex = /<(?:link|script|img)\b[^>]+(?:href|src)="([^"]+)"/gi;
  for (const file of htmlFiles) {
    const content = readFileSync(file, 'utf8');
    let m;
    while ((m = assetRegex.exec(content))) {
      const ref = m[1];
      if (/^https?:/i.test(ref) || ref.startsWith('data:') || ref.startsWith('#')) continue; // extern / data / fragment
      const fsPath = path.join(projectRoot, ref.replace(/^\//, ''));
      if (!fs.existsSync(fsPath)) {
        add('MISSING_ASSET', file, content.slice(0, m.index).split(/\r?\n/).length, `Referenzierte Ressource fehlt: ${ref}`);
      }
    }
  }
}

const hardViolations = violations.filter(v => !['INLINE_STYLE'].includes(v.type));

if (outputJson) {
  const result = {
    summary: {
      violations: violations.length,
      warnings: warnings.length,
      hardViolations: hardViolations.length
    },
    violations,
    warnings
  };
  console.error(JSON.stringify(result, null, 2));
  if (hardViolations.length > 0 && globalThis.process) globalThis.process.exit(1);
  if (globalThis.process) globalThis.process.exit(0);
}

console.error('Security Scan Bericht');
console.error('=====================');
console.error(formatList(violations, 'Verstöße'));
console.error('\n' + formatList(warnings, 'Warnungen'));
console.error(`\nGesamt: ${violations.length} Verstöße, ${warnings.length} Warnungen.`);

if (hardViolations.length > 0) {
  console.error(`\nAbbruch: ${hardViolations.length} harte Verstöße gefunden.`);
  if (globalThis.process) globalThis.process.exit(1);
} else {
  console.error('\nOK: Keine harten Verstöße gefunden.');
}
