#!/usr/bin/env node
import { PurgeCSS } from 'purgecss';

const cssGlobs = [
  'content/styles/**/*.css',
  'content/components/**/*.css',
  'pages/**/*.css',
];

const contentGlobs = [
  'pages/**/*.html',
  'content/**/*.js',
  'content/**/*.mjs',
  'content/components/**/*.js',
];

const purge = new PurgeCSS();
const results = await purge.purge({
  css: cssGlobs,
  content: contentGlobs,
  rejected: true,
});

const totalRejected = results.reduce((sum, entry) => {
  const rejected = Array.isArray(entry.rejected) ? entry.rejected.length : 0;
  return sum + rejected;
}, 0);

console.log(
  `audit: scanned ${results.length} CSS bundle(s), rejected selectors: ${totalRejected}`,
);
console.log('audit: no build artifact written.');
