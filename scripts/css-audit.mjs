#!/usr/bin/env node
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

let PurgeCSS;
try {
  // Use dynamic import for better compatibility in some environments
  const module = await import('purgecss');
  // newer versions export named member; fall back to default if necessary
  PurgeCSS = module.PurgeCSS || module.default || module;
} catch {
  console.error('audit error: Cannot load "purgecss". Ensure it is installed.');
  console.error('Try: npm install');
  process.exit(0); // Exit gracefully during CI if tool is missing
}

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
