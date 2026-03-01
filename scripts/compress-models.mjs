#!/usr/bin/env node
/**
 * compress-models.mjs — GLB/glTF Compression Pipeline
 *
 * Compresses 3D models using Draco (static) and Meshopt (animated).
 * Designed for the no-build architecture: run manually before deployment.
 *
 * Usage:
 *   node scripts/compress-models.mjs                    # compress all in source dir
 *   node scripts/compress-models.mjs --file robot.glb   # compress specific file
 *   node scripts/compress-models.mjs --dry-run           # preview only
 *   node scripts/compress-models.mjs --codec draco       # force codec (draco|meshopt|both)
 *   node scripts/compress-models.mjs --clean              # remove old compressed files first
 *
 * Prerequisites (global installs):
 *   npm install -g gltf-pipeline   # for Draco
 *   npm install -g gltfpack        # for Meshopt (or download binary from GitHub)
 *
 * @version 1.0.0
 */

import { readdir, stat, unlink, mkdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ─── Configuration ───────────────────────────────────────────

/** Source directory for uncompressed models */
const SOURCE_DIR = 'content/assets/models/source';

/** Output directory for compressed models (deployed) */
const OUTPUT_DIR = 'content/assets/models';

/** Draco compression level (1-10, higher = smaller but slower encode) */
const DRACO_LEVEL = 7;

/** Valid input extensions */
const MODEL_EXTENSIONS = new Set(['.glb', '.gltf']);

// ─── CLI Args ────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {
  dryRun: args.includes('--dry-run'),
  clean: args.includes('--clean'),
  file: args.includes('--file') ? args[args.indexOf('--file') + 1] : null,
  codec: args.includes('--codec') ? args[args.indexOf('--codec') + 1] : 'both',
  help: args.includes('--help') || args.includes('-h'),
};

if (flags.help) {
  console.log(`
GLB/glTF Compression Pipeline

Usage:
  node scripts/compress-models.mjs [options]

Options:
  --file <name>     Compress a specific file only
  --codec <type>    Codec: draco, meshopt, or both (default: both)
  --dry-run         Preview operations without writing files
  --clean           Remove existing compressed files before compressing
  --help, -h        Show this help

Directories:
  Source:  ${SOURCE_DIR}/
  Output:  ${OUTPUT_DIR}/
`);
  process.exit(0);
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Check if a CLI tool is available.
 * @param {string} name
 * @returns {Promise<boolean>}
 */
async function toolExists(name) {
  try {
    await execFileAsync('which', [name]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size in a human-readable format.
 * @param {string} filePath
 * @returns {Promise<{bytes: number, display: string}>}
 */
async function fileSize(filePath) {
  try {
    const s = await stat(filePath);
    const kb = s.size / 1024;
    if (kb > 1024)
      return { bytes: s.size, display: `${(kb / 1024).toFixed(1)} MB` };
    return { bytes: s.size, display: `${kb.toFixed(0)} KB` };
  } catch {
    return { bytes: 0, display: '—' };
  }
}

/**
 * Format size reduction as percentage.
 * @param {number} original
 * @param {number} compressed
 * @returns {string}
 */
function reduction(original, compressed) {
  if (original === 0) return '—';
  const pct = ((1 - compressed / original) * 100).toFixed(1);
  return `${pct} %`;
}

// ─── Compression Functions ───────────────────────────────────

/**
 * Compress with Draco via gltf-pipeline.
 * @param {string} inputPath
 * @param {string} outputPath
 * @returns {Promise<boolean>}
 */
async function compressDraco(inputPath, outputPath) {
  try {
    await execFileAsync(
      'gltf-pipeline',
      [
        '-i',
        inputPath,
        '-o',
        outputPath,
        `--draco.compressionLevel`,
        String(DRACO_LEVEL),
      ],
      { timeout: 120_000 },
    );
    return true;
  } catch (err) {
    console.error(`  ✗ Draco compression failed: ${err.message}`);
    return false;
  }
}

/**
 * Compress with Meshopt via gltfpack.
 * @param {string} inputPath
 * @param {string} outputPath
 * @returns {Promise<boolean>}
 */
async function compressMeshopt(inputPath, outputPath) {
  try {
    await execFileAsync('gltfpack', ['-i', inputPath, '-o', outputPath], {
      timeout: 120_000,
    });
    return true;
  } catch (err) {
    console.error(`  ✗ Meshopt compression failed: ${err.message}`);
    return false;
  }
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log('🗜️  GLB/glTF Compression Pipeline\n');

  // Ensure source directory exists
  try {
    await stat(SOURCE_DIR);
  } catch {
    await mkdir(SOURCE_DIR, { recursive: true });
    console.log(`📁 Created source directory: ${SOURCE_DIR}/`);
    console.log(
      '   Place your uncompressed .glb/.gltf files there and re-run.\n',
    );
    process.exit(0);
  }

  // Check tools
  const hasDraco = await toolExists('gltf-pipeline');
  const hasMeshopt = await toolExists('gltfpack');

  if (!hasDraco && !hasMeshopt) {
    console.error('✗ Neither gltf-pipeline nor gltfpack found.');
    console.error('  Install at least one:');
    console.error('    npm install -g gltf-pipeline   # Draco');
    console.error('    npm install -g gltfpack         # Meshopt');
    process.exit(1);
  }

  const wantDraco =
    (flags.codec === 'draco' || flags.codec === 'both') && hasDraco;
  const wantMeshopt =
    (flags.codec === 'meshopt' || flags.codec === 'both') && hasMeshopt;

  if (flags.codec === 'draco' && !hasDraco) {
    console.error(
      '✗ gltf-pipeline not found. Install: npm install -g gltf-pipeline',
    );
    process.exit(1);
  }
  if (flags.codec === 'meshopt' && !hasMeshopt) {
    console.error('✗ gltfpack not found. Install: npm install -g gltfpack');
    process.exit(1);
  }

  console.log(
    `Tools: ${hasDraco ? '✓ gltf-pipeline (Draco)' : '✗ gltf-pipeline'} | ${hasMeshopt ? '✓ gltfpack (Meshopt)' : '✗ gltfpack'}`,
  );
  console.log(`Codec: ${flags.codec}${flags.dryRun ? ' [DRY RUN]' : ''}\n`);

  // Gather source files
  let entries;
  try {
    entries = await readdir(SOURCE_DIR);
  } catch (err) {
    console.error(`✗ Cannot read ${SOURCE_DIR}: ${err.message}`);
    process.exit(1);
  }

  let sourceFiles = entries.filter((f) =>
    MODEL_EXTENSIONS.has(extname(f).toLowerCase()),
  );

  if (flags.file) {
    sourceFiles = sourceFiles.filter((f) => f === flags.file);
    if (sourceFiles.length === 0) {
      console.error(`✗ File "${flags.file}" not found in ${SOURCE_DIR}/`);
      process.exit(1);
    }
  }

  if (sourceFiles.length === 0) {
    console.log(`No model files found in ${SOURCE_DIR}/`);
    console.log('Place .glb or .gltf files there and re-run.');
    process.exit(0);
  }

  console.log(`Found ${sourceFiles.length} model(s) to compress:\n`);

  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Clean old compressed files if requested
  if (flags.clean && !flags.dryRun) {
    const existing = await readdir(OUTPUT_DIR);
    const compressed = existing.filter(
      (f) =>
        f.endsWith('-draco.glb') ||
        f.endsWith('-meshopt.glb') ||
        f.endsWith('-draco.gltf') ||
        f.endsWith('-meshopt.gltf'),
    );
    for (const f of compressed) {
      console.log(`  🗑  Removing old: ${f}`);
      await unlink(join(OUTPUT_DIR, f));
    }
    if (compressed.length) console.log();
  }

  // Process each file
  const results = [];

  for (const file of sourceFiles) {
    const inputPath = join(SOURCE_DIR, file);
    const name = basename(file, extname(file));
    const ext = extname(file);
    const originalSize = await fileSize(inputPath);

    console.log(`── ${file} (${originalSize.display})`);

    // Draco
    if (wantDraco) {
      const outName = `${name}-draco${ext}`;
      const outputPath = join(OUTPUT_DIR, outName);

      if (flags.dryRun) {
        console.log(`  → [dry-run] Would create: ${outName}`);
      } else {
        const ok = await compressDraco(inputPath, outputPath);
        if (ok) {
          const compSize = await fileSize(outputPath);
          console.log(
            `  ✓ Draco:   ${outName} — ${compSize.display} (${reduction(originalSize.bytes, compSize.bytes)} reduction)`,
          );
          results.push({
            file,
            codec: 'draco',
            output: outName,
            original: originalSize,
            compressed: compSize,
          });
        }
      }
    }

    // Meshopt
    if (wantMeshopt) {
      const outName = `${name}-meshopt${ext}`;
      const outputPath = join(OUTPUT_DIR, outName);

      if (flags.dryRun) {
        console.log(`  → [dry-run] Would create: ${outName}`);
      } else {
        const ok = await compressMeshopt(inputPath, outputPath);
        if (ok) {
          const compSize = await fileSize(outputPath);
          console.log(
            `  ✓ Meshopt: ${outName} — ${compSize.display} (${reduction(originalSize.bytes, compSize.bytes)} reduction)`,
          );
          results.push({
            file,
            codec: 'meshopt',
            output: outName,
            original: originalSize,
            compressed: compSize,
          });
        }
      }
    }

    console.log();
  }

  // Summary
  if (results.length > 0) {
    console.log('═══ Summary ═══════════════════════════════════════');
    console.log(`Compressed ${results.length} file(s):\n`);
    for (const r of results) {
      console.log(
        `  ${r.output.padEnd(35)} ${r.compressed.display.padStart(10)}  (−${reduction(r.original.bytes, r.compressed.bytes)})`,
      );
    }
    console.log(`\nOutput: ${OUTPUT_DIR}/`);
    console.log(
      'Deploy only the compressed variants. The model-loader handles decompression.\n',
    );
  } else if (!flags.dryRun) {
    console.log(
      'No files were compressed. Check tool availability and source files.',
    );
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
