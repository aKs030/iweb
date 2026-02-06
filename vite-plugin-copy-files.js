/**
 * Vite Plugin: Copy Additional Files
 * Copies content/ and pages/ directories to dist during build
 * Ensures all HTML partials and components are available in production
 *
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';

/**
 * Recursively copy directory
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @param {Set<string>} [skipPaths] - Set of relative paths to skip (Vite entry points)
 * @param {string} [baseDir] - Base directory for computing relative paths
 */
function copyDir(src, dest, skipPaths = new Set(), baseDir = src) {
  mkdirSync(dest, { recursive: true });

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, skipPaths, baseDir);
    } else {
      // Copy HTML and CSS files, skip JS (handled by Vite)
      const ext = entry.name.split('.').pop()?.toLowerCase();
      if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) continue;

      // Skip HTML files that are Vite entry points (already processed by Vite)
      const relPath = relative(join(baseDir, '..'), srcPath);
      if (ext === 'html' && skipPaths.has(relPath)) {
        console.log(`[copy-files] ⊘ Skipped ${relPath} (Vite entry point)`);
        continue;
      }

      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Vite plugin to copy additional files to dist
 */
export default function copyFilesPlugin(options = {}) {
  const {
    dirs = ['content', 'pages'],
    exclude = ['node_modules', '.git', 'dist'],
  } = options;

  /** @type {Set<string>} Vite entry point paths to skip during copy */
  let entryPaths = new Set();

  return {
    name: 'vite-plugin-copy-files',

    configResolved(config) {
      // Collect Vite entry points so we don't overwrite processed HTML files
      const input = config.build?.rollupOptions?.input;
      if (input && typeof input === 'object') {
        for (const val of Object.values(input)) {
          entryPaths.add(String(val));
        }
      }
    },

    closeBundle() {
      console.log('[copy-files] Copying additional files to dist...');

      for (const dir of dirs) {
        try {
          const src = join(process.cwd(), dir);
          const dest = join(process.cwd(), 'dist', dir);

          if (statSync(src).isDirectory()) {
            copyDir(src, dest, entryPaths, src);
            console.log(`[copy-files] ✓ Copied ${dir}/ to dist/${dir}/`);
          }
        } catch (error) {
          console.warn(`[copy-files] ⚠ Could not copy ${dir}:`, error.message);
        }
      }

      // Copy root files
      const rootFiles = [
        'manifest.json',
        'sw.js',
        'sitemap.xml',
        '_headers',
        '_redirects',
      ];
      for (const file of rootFiles) {
        try {
          const src = join(process.cwd(), file);
          const dest = join(process.cwd(), 'dist', file);

          if (statSync(src).isFile()) {
            copyFileSync(src, dest);
            console.log(`[copy-files] ✓ Copied ${file}`);
          }
        } catch {
          // File doesn't exist, skip
        }
      }

      console.log('[copy-files] ✓ All files copied successfully');
    },
  };
}
