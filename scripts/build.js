#!/usr/bin/env node
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..');
const out = path.resolve(__dirname, '..', 'dist');
const args = process.argv.slice(2);
const isProd = args.includes('--minify');

function copyRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

(async () => {
  try {
    console.log('Building project with esbuild...');

    // Ensure out dir
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });

    // Static copy (html + assets)
    const staticFiles = ['index.html', 'manifest.json', 'offline.html', 'robots.txt'];
    staticFiles.forEach((f) => {
      const from = path.join(src, f);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(out, f));
    });

    // Copy all content and pages folders (simple approach)
    copyRecursive(path.join(src, 'content'), path.join(out, 'content'));
    copyRecursive(path.join(src, 'pages'), path.join(out, 'pages'));

    // Bundle core scripts (content/main.js and pages/fotos/gallery-app.js)
    await esbuild.build({
      entryPoints: [
        path.join(src, 'content', 'main.js'),
        path.join(src, 'pages', 'fotos', 'gallery-app.js')
      ],
      bundle: true,
      minify: isProd,
      sourcemap: !isProd,
      format: 'esm',
      outdir: path.join(out, 'dist'),
      splitting: true,
      treeShaking: true,
      target: ['es2020']
    });

    console.log('Build completed — dist folder ready');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
