#!/usr/bin/env node
/* Run bundler treeshake analysis using esbuild metafile

Outputs a list of JS/TS files under `content/` and `pages/` that are NOT
included in an esbuild bundle created from common entry points.

Usage: node scripts/run-treeshake.js
*/
const esbuild = require('esbuild');
const glob = require('glob');
const path = require('path');

(async () => {
  try {
    const root = process.cwd();

    // Find all candidate source files
    const allFiles = glob.sync('**/*.{js,ts,jsx,tsx}', {
      cwd: root,
      absolute: true,
      ignore: ['**/node_modules/**', '**/content/vendor/**', '**/tests/**', '**/.git/**']
    });

    // Define entry points: typical app entry scripts and main loader
    const entryCandidates = [
      'content/main.js',
      'content/components/head/head-complete.js',
      'content/components/footer/footer-complete.js',
      'content/components/robot-companion/robot-companion.js',
      'pages/gallery/gallery-app.js',
      'pages/fotos/gallery-app.js',
      'pages/projekte/projekte-app.js',
      'pages/home/hero-manager.js'
    ]
      .map(p => path.join(root, p))
      .filter(p => require('fs').existsSync(p));

    if (entryCandidates.length === 0) {
      console.error('No entry points found. Aborting');
      process.exit(1);
    }

    console.warn('Using entry points:');
    entryCandidates.forEach(e => console.warn(' -', path.relative(root, e)));

    // Build with esbuild, write=false to avoid disk output, request metafile
    // esbuild requires an outdir when multiple entryPoints are used in this mode
    const result = await esbuild.build({
      entryPoints: entryCandidates,
      bundle: true,
      outdir: 'tmp/esbuild-out',
      write: false,
      platform: 'browser',
      format: 'esm',
      metafile: true,
      sourcemap: false,
      treeShaking: true,
      logLevel: 'silent'
    });

    const includedInputs = new Set(Object.keys(result.metafile.inputs).map(p => path.resolve(p)));

    // Map allFiles to relative paths for nice output and pick those under content/pages
    const candidates = allFiles
      .filter(f => f.includes(path.sep + 'content' + path.sep) || f.includes(path.sep + 'pages' + path.sep))
      .filter(f => !f.includes(path.sep + 'content' + path.sep + 'vendor' + path.sep))
      .map(f => path.resolve(f))
      .filter(f => !includedInputs.has(f));

    // But exclude obvious assets/test helpers (heuristics)
    const heuristicsExcluded = candidates.filter(f => {
      const rel = path.relative(root, f);
      // Skip files named '*-spec*' or 'test' or snapshot-ish
      if (/\.spec\.|__tests__|\.test\.|\btest\b/.test(rel)) return true;
      // Skip small helper/glue files that are intentionally standalone (e.g., content/components/robot-companion/robot-companion-texts.js)
      if (rel.includes('robot-companion-texts.js') || rel.includes('assets') || rel.includes('vendor')) return true;
      return false;
    });

    const filtered = candidates.filter(f => !heuristicsExcluded.includes(f));

    console.warn('\nPotential treeshake candidates (files not included in the bundle):');
    if (filtered.length === 0) {
      console.warn(' - None: bundler includes all JS under content/pages for the selected entry points.');
    } else {
      filtered.forEach(f => console.warn(' -', path.relative(root, f)));
    }

    // Write short JSON for inspection
    const out = {
      entries: entryCandidates.map(p => path.relative(root, p)),
      excluded: filtered.map(f => path.relative(root, f))
    };
    const fs = require('fs');
    const tmpDir = path.join(root, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, {recursive: true});
    fs.writeFileSync(path.join(tmpDir, 'treeshake-report.json'), JSON.stringify(out, null, 2));
    console.warn('\nWrote tmp/treeshake-report.json');

    // Cleanup esbuild result
    if (typeof result.stop === 'function') await result.stop();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
})();
