#!/usr/bin/env node
/**
 * Bundle Size Analyzer für Zero-Build Portfolio
 *
 * Analysiert JavaScript-Module, CSS-Dateien und Assets
 * Generiert Performance-Budget-Report
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, extname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// ===== Performance Budgets (in KB) =====
const BUDGETS = {
  js: {
    critical: 50, // Main entry point
    module: 25, // Einzelne Module
    vendor: 700, // Three.js
  },
  css: {
    critical: 15, // Root + Core Styles
    module: 10, // Component Styles
  },
  image: {
    texture: 200, // Earth Texturen (WebP)
    icon: 50, // Icons/Logos
  },
};

// ===== File Scanner =====
function scanDirectory(
  dir,
  extensions = ['.js', '.css'],
  excludeDirs = ['node_modules', '.git', 'scripts']
) {
  const files = [];

  function scan(currentDir) {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!excludeDirs.includes(entry.name)) {
          scan(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (extensions.includes(ext)) {
          const stats = statSync(fullPath);
          const relativePath = relative(PROJECT_ROOT, fullPath);
          files.push({
            path: relativePath,
            name: entry.name,
            size: stats.size,
            sizeKB: (stats.size / 1024).toFixed(2),
            ext,
          });
        }
      }
    }
  }

  scan(dir);
  return files;
}

// ===== Module Analysis =====
function analyzeModules() {
  console.log('📦 JavaScript Module Analyse\n');
  console.log('═'.repeat(80));

  const jsFiles = scanDirectory(
    PROJECT_ROOT,
    ['.js'],
    ['node_modules', '.git', 'scripts']
  );

  // Kategorisieren
  const categories = {
    core: [],
    components: [],
    pages: [],
    animations: [],
    particles: [],
    vendor: [],
  };

  jsFiles.forEach((file) => {
    if (file.path.includes('lib/three')) {
      categories.vendor.push(file);
    } else if (
      file.path.includes('main.js') ||
      file.path.includes('shared-utilities.js')
    ) {
      categories.core.push(file);
    } else if (file.path.includes('animations/')) {
      categories.animations.push(file);
    } else if (file.path.includes('particles/')) {
      categories.particles.push(file);
    } else if (file.path.includes('pages/')) {
      categories.pages.push(file);
    } else {
      categories.components.push(file);
    }
  });

  // Report pro Kategorie
  let totalSize = 0;
  const warnings = [];

  Object.entries(categories).forEach(([category, files]) => {
    if (files.length === 0) return;

    const categorySize = files.reduce((sum, f) => sum + f.size, 0);
    const categorySizeKB = (categorySize / 1024).toFixed(2);
    totalSize += categorySize;

    console.log(`\n📁 ${category.toUpperCase()}`);
    console.log('─'.repeat(80));

    files
      .sort((a, b) => b.size - a.size)
      .forEach((file) => {
        const budgetKey =
          category === 'vendor'
            ? 'vendor'
            : category === 'core'
              ? 'critical'
              : 'module';
        const budget = BUDGETS.js[budgetKey];
        const overBudget = parseFloat(file.sizeKB) > budget;

        const icon = overBudget ? '⚠️' : '✅';
        const budgetInfo = overBudget ? ` (Budget: ${budget} KB)` : '';

        console.log(
          `${icon} ${file.sizeKB.padStart(8)} KB  ${file.path}${budgetInfo}`
        );

        if (overBudget && category !== 'vendor') {
          warnings.push({
            file: file.path,
            size: file.sizeKB,
            budget,
            category,
          });
        }
      });

    console.log(`   ${'─'.repeat(70)}`);
    console.log(`   Summe: ${categorySizeKB} KB`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log(`📊 GESAMT JavaScript: ${(totalSize / 1024).toFixed(2)} KB`);
  console.log('═'.repeat(80));

  return { totalSize, warnings };
}

// ===== CSS Analysis =====
function analyzeCSS() {
  console.log('\n\n🎨 CSS Dateien Analyse\n');
  console.log('═'.repeat(80));

  const cssFiles = scanDirectory(
    PROJECT_ROOT,
    ['.css'],
    ['node_modules', '.git']
  );

  let totalSize = 0;
  const warnings = [];

  cssFiles
    .sort((a, b) => b.size - a.size)
    .forEach((file) => {
      const isCritical =
        file.path.includes('root.css') || file.path.includes('index.css');
      const budget = isCritical ? BUDGETS.css.critical : BUDGETS.css.module;
      const overBudget = parseFloat(file.sizeKB) > budget;

      const icon = overBudget ? '⚠️' : '✅';
      const type = isCritical ? '[CRITICAL]' : '[MODULE]  ';
      const budgetInfo = overBudget ? ` (Budget: ${budget} KB)` : '';

      console.log(
        `${icon} ${file.sizeKB.padStart(8)} KB  ${type}  ${file.path}${budgetInfo}`
      );

      totalSize += file.size;

      if (overBudget) {
        warnings.push({
          file: file.path,
          size: file.sizeKB,
          budget,
          type: isCritical ? 'critical' : 'module',
        });
      }
    });

  console.log('═'.repeat(80));
  console.log(`📊 GESAMT CSS: ${(totalSize / 1024).toFixed(2)} KB`);
  console.log('═'.repeat(80));

  return { totalSize, warnings };
}

// ===== Asset Analysis =====
function analyzeAssets() {
  console.log('\n\n🖼️  Asset Analyse (WebP Texturen)\n');
  console.log('═'.repeat(80));

  const assetFiles = scanDirectory(join(PROJECT_ROOT, 'content/img'), [
    '.webp',
    '.jpg',
    '.png',
    '.svg',
  ]);

  let totalSize = 0;

  assetFiles
    .sort((a, b) => b.size - a.size)
    .slice(0, 15) // Top 15
    .forEach((file) => {
      const isTexture = file.path.includes('earth/textures');
      const budget = isTexture ? BUDGETS.image.texture : BUDGETS.image.icon;
      const overBudget = parseFloat(file.sizeKB) > budget;

      const icon = overBudget ? '⚠️' : '✅';
      const type = isTexture ? '[TEXTURE]' : '[IMAGE]  ';

      console.log(
        `${icon} ${file.sizeKB.padStart(8)} KB  ${type}  ${file.path}`
      );
      totalSize += file.size;
    });

  console.log('═'.repeat(80));
  console.log(`📊 GESAMT Assets (Top 15): ${(totalSize / 1024).toFixed(2)} KB`);
  console.log('═'.repeat(80));
}

// ===== Import Dependency Analysis =====
function analyzeImports() {
  console.log('\n\n🔗 Import-Abhängigkeiten\n');
  console.log('═'.repeat(80));

  const jsFiles = scanDirectory(
    PROJECT_ROOT,
    ['.js'],
    ['node_modules', '.git', 'scripts']
  );

  const importCount = {};
  const mostImported = {};

  jsFiles.forEach((file) => {
    try {
      const content = readFileSync(join(PROJECT_ROOT, file.path), 'utf-8');
      const imports = content.match(/import\s+.*?from\s+['"](.+?)['"]/g) || [];

      importCount[file.path] = imports.length;

      imports.forEach((imp) => {
        const match = imp.match(/from\s+['"](.+?)['"]/);
        if (match) {
          const importPath = match[1];
          mostImported[importPath] = (mostImported[importPath] || 0) + 1;
        }
      });
    } catch {
      // Ignore read errors
    }
  });

  console.log('\n📥 Meistgenutzte Module (Top 10):');
  console.log('─'.repeat(80));

  Object.entries(mostImported)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([path, count]) => {
      const isSharedUtilities = path.includes('shared-utilities');
      const icon = isSharedUtilities ? '⭐' : '  ';
      console.log(`${icon} ${count.toString().padStart(3)}x  ${path}`);
    });

  console.log('\n📤 Module mit meisten Imports (Top 10):');
  console.log('─'.repeat(80));

  Object.entries(importCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([path, count]) => {
      console.log(`   ${count.toString().padStart(3)} imports  ${path}`);
    });
}

// ===== Performance Summary =====
function generateSummary(jsAnalysis, cssAnalysis) {
  console.log('\n\n' + '═'.repeat(80));
  console.log('📊 PERFORMANCE BUDGET SUMMARY');
  console.log('═'.repeat(80));

  const allWarnings = [...jsAnalysis.warnings, ...cssAnalysis.warnings];

  if (allWarnings.length === 0) {
    console.log('\n✅ Alle Dateien innerhalb des Performance-Budgets!');
  } else {
    console.log(`\n⚠️  ${allWarnings.length} Datei(en) über Budget:\n`);

    allWarnings.forEach((w) => {
      console.log(`   ${w.file}`);
      console.log(
        `   Größe: ${w.size} KB | Budget: ${w.budget} KB | Überschreitung: ${(w.size - w.budget).toFixed(2)} KB`
      );
      console.log();
    });
  }

  // Zero-Build Benefits
  console.log('\n💡 Zero-Build Vorteile:');
  console.log('─'.repeat(80));
  console.log('   ✅ Keine Build-Zeit');
  console.log('   ✅ Native ES6 Modules (Browser-Caching)');
  console.log('   ✅ HTTP/2 Multiplexing-optimiert');
  console.log('   ✅ Selective Loading (nur geladene Sections)');
  console.log('   ✅ Service Worker Caching aktiv');

  // Total Transfer
  const totalKB = (
    (jsAnalysis.totalSize + cssAnalysis.totalSize) /
    1024
  ).toFixed(2);
  console.log(`\n📦 Initial Page Load (ohne Three.js): ~${totalKB} KB`);
  console.log('   (Three.js: 635 KB - lazy loaded bei Bedarf)');

  console.log('\n' + '═'.repeat(80));
}

// ===== Main Execution =====
async function main() {
  console.log('🚀 Bundle Size Analyzer - Zero-Build Portfolio\n');

  const jsAnalysis = analyzeModules();
  const cssAnalysis = analyzeCSS();
  analyzeAssets();
  analyzeImports();
  generateSummary(jsAnalysis, cssAnalysis);

  console.log('\n✨ Analyse abgeschlossen!\n');

  // Exit code basierend auf Warnings
  const hasWarnings =
    jsAnalysis.warnings.length > 0 || cssAnalysis.warnings.length > 0;
  process.exit(hasWarnings ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ Fehler bei der Analyse:', error);
  process.exit(1);
});
