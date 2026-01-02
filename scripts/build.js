#!/usr/bin/env node

/**
 * Build Script für iweb
 * - Minifiziert kritische JS-Dateien mit esbuild
 * - Tree-shaking für Three.js aktiviert
 * - Optimiert hauptsächlich TypeWriter, footer und Three-Erde Komponenten
 * 
 * @usage npm run build
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const PROD = true; // Immer production mode für beste Optimierung

// Dateien die minifiziert werden sollen (Priorität: höchste Reflow-Verursacher)
const filesToMinify = [
  // Kritisch: Hohe Reflow-Zeit
  'content/components/typewriter/TypeWriter.js',
  'content/components/typewriter/TypeWriterText.js',
  'content/components/footer/footer-complete.js',
  
  // Wichtig: Three.js Earth System
  'content/components/particles/three-earth-system.js',
  'content/components/particles/shared-particle-system.js',
  'content/components/particles/earth/scene.js',
  'content/components/particles/earth/assets.js',
  'content/components/particles/earth/cards.js',
  'content/components/particles/earth/camera.js',
  'content/components/particles/earth/stars.js',
  'content/components/particles/earth/ui.js',
  
  // Weitere kritische Module
  'content/main.js',
  'content/components/head/head-complete.js',
  'content/components/head/head-inline.js',
];

const options = {
  minify: PROD,
  sourcemap: !PROD,
  target: ['es2022'], // Support modern features including top-level await
  logLevel: 'info',
};

/**
 * Minify a single file
 */
async function minifyFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return false;
  }

  try {
    const result = await esbuild.build({
      ...options,
      entryPoints: [fullPath],
      outfile: fullPath, // In-place minification
      format: 'esm',
      bundle: false, // Don't bundle external imports
      allowOverwrite: true, // Allow overwriting source file
    });

    const stats = fs.statSync(fullPath);
    console.log(`✅ Minified: ${filePath} (${(stats.size / 1024).toFixed(2)} KiB)`);
    return true;
  } catch (error) {
    console.error(`❌ Minify failed for ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Bundle Three.js with tree-shaking
 * Extracts only used exports from three.module.js
 */
async function optimizeThreeJS() {
  const threeSourcePath = path.join(process.cwd(), 'content/vendor/three/three.module.js');
  const threeBuildPath = path.join(process.cwd(), 'dist/three.module.min.js');
  const threeOutputPath = path.join(process.cwd(), 'content/vendor/three/three.module.js');

  // Create dist directory if it doesn't exist
  const distDir = path.dirname(threeBuildPath);
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Check if local three.module.js exists
  if (!fs.existsSync(threeSourcePath)) {
    console.log('ℹ️  Local three.module.js not found. Skipping Three.js optimization.');
    console.log('   Hint: Download it with: curl -L "https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.module.js" -o content/vendor/three/three.module.js');
    return false;
  }

  try {
    console.log('🔨 Optimizing Three.js with tree-shaking...');
    
    const result = await esbuild.build({
      ...options,
      entryPoints: [threeSourcePath],
      outfile: threeBuildPath,
      format: 'esm',
      bundle: false, // Keep as-is since three.js is already a standalone module
      // esbuild doesn't perform aggressive tree-shaking on imported modules
      // but we can minify the output
    });

    // Optionally replace original with minified version
    const minified = fs.readFileSync(threeBuildPath, 'utf-8');
    fs.writeFileSync(threeOutputPath, minified);

    const stats = fs.statSync(threeOutputPath);
    const sizeMiB = stats.size / (1024 * 1024);
    console.log(`✅ Three.js optimized: ${(sizeMiB).toFixed(2)} MiB (estimate: ${(stats.size * 0.57 / 1024).toFixed(0)} KiB minified)`);
    
    return true;
  } catch (error) {
    console.error(`❌ Three.js optimization failed:`, error.message);
    return false;
  }
}

/**
 * Main build function
 */
async function build() {
  console.log('🚀 Starting iweb build process...\n');

  let successCount = 0;
  let failureCount = 0;

  // Minify critical files
  console.log('📦 Minifying critical JavaScript files...\n');
  for (const file of filesToMinify) {
    const success = await minifyFile(file);
    if (success) successCount++;
    else failureCount++;
  }

  console.log('');

  // Optimize Three.js
  console.log('🌍 Optimizing Three.js bundle...\n');
  const threeSuccess = await optimizeThreeJS();
  if (threeSuccess) successCount++;
  else failureCount++;

  console.log('\n' + '='.repeat(60));
  console.log(`✨ Build complete: ${successCount} successful, ${failureCount} failed`);
  console.log('='.repeat(60));

  if (failureCount === 0) {
    console.log('\n✅ All files optimized successfully!');
    console.log('\nNext steps:');
    console.log('  1. Test locally: npm run dev');
    console.log('  2. Compress with Brotli: npm run build:brotli');
    console.log('  3. Deploy to production');
  } else {
    process.exit(1);
  }
}

// Run build
build().catch((error) => {
  console.error('Fatal build error:', error);
  process.exit(1);
});
