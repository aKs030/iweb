#!/usr/bin/env node

/**
 * Error Handling Migration Script
 * @description Automatically migrates console statements and empty catch blocks
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Configuration
const CONFIG = {
  extensions: ['.js'],
  exclude: [
    'node_modules',
    '.git',
    'dist',
    'build',
    'scripts/dev-server.js', // Keep console in dev server
    'content/components/menu/examples', // Keep console in examples
  ],
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
};

// Statistics
const stats = {
  filesScanned: 0,
  filesModified: 0,
  consoleReplaced: 0,
  catchBlocksFixed: 0,
};

/**
 * Check if file should be processed
 */
function shouldProcess(filePath) {
  const relativePath = path.relative(ROOT, filePath);

  // Check extension
  if (!CONFIG.extensions.some((ext) => filePath.endsWith(ext))) {
    return false;
  }

  // Check exclusions
  if (CONFIG.exclude.some((pattern) => relativePath.includes(pattern))) {
    return false;
  }

  return true;
}

/**
 * Get all JavaScript files
 */
function getJavaScriptFiles(dir) {
  const files = [];

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!CONFIG.exclude.some((pattern) => entry.name === pattern)) {
          walk(fullPath);
        }
      } else if (entry.isFile() && shouldProcess(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Replace console statements
 */
function replaceConsoleStatements(content, filePath) {
  let modified = content;
  let count = 0;

  // Check if file already imports production logger
  const hasProductionLogger = /import.*production-logger/.test(content);

  if (!hasProductionLogger) {
    // Add import at the top
    const importStatement =
      "import { createProductionLogger } from '/content/utils/production-logger.js';\n\n";

    // Find first import or add at top
    const firstImportMatch = content.match(/^import .+;$/m);
    if (firstImportMatch) {
      const insertIndex = content.indexOf(firstImportMatch[0]);
      modified =
        content.slice(0, insertIndex) +
        importStatement +
        content.slice(insertIndex);
    } else {
      modified = importStatement + content;
    }

    // Add logger initialization
    const componentName = path.basename(filePath, '.js');
    const loggerInit = `const log = createProductionLogger('${componentName}');\n\n`;

    // Insert after imports
    const lastImportMatch = [...modified.matchAll(/^import .+;$/gm)].pop();
    if (lastImportMatch) {
      const insertIndex = lastImportMatch.index + lastImportMatch[0].length + 1;
      modified =
        modified.slice(0, insertIndex) +
        '\n' +
        loggerInit +
        modified.slice(insertIndex);
    }
  }

  // Replace console.log -> log.log
  modified = modified.replace(/console\.log\(/g, () => {
    count++;
    return 'log.log(';
  });

  // Replace console.warn -> log.warn
  modified = modified.replace(/console\.warn\(/g, () => {
    count++;
    return 'log.warn(';
  });

  // Replace console.error -> log.error
  modified = modified.replace(/console\.error\(/g, () => {
    count++;
    return 'log.error(';
  });

  // Replace console.info -> log.info
  modified = modified.replace(/console\.info\(/g, () => {
    count++;
    return 'log.info(';
  });

  // Replace console.debug -> log.debug
  modified = modified.replace(/console\.debug\(/g, () => {
    count++;
    return 'log.debug(';
  });

  return { content: modified, count };
}

/**
 * Fix empty catch blocks
 */
function fixEmptyCatchBlocks(content) {
  let modified = content;
  let count = 0;

  // Check if file already imports error handler
  const hasErrorHandler = /import.*error-handler/.test(content);

  if (!hasErrorHandler) {
    // Add import
    const importStatement =
      "import { handleError, ErrorSeverity } from '/content/utils/error-handler.js';\n";

    const firstImportMatch = content.match(/^import .+;$/m);
    if (firstImportMatch) {
      const insertIndex = content.indexOf(firstImportMatch[0]);
      modified =
        content.slice(0, insertIndex) +
        importStatement +
        content.slice(insertIndex);
    } else {
      modified = importStatement + '\n' + content;
    }
  }

  // Find catch blocks with only comments or empty
  const catchRegex =
    /catch\s*\(\s*(\w+)?\s*\)\s*\{[\s\n]*(\/\/[^\n]*|\/\*[\s\S]*?\*\/)?[\s\n]*\}/g;

  modified = modified.replace(catchRegex, (match, errorVar) => {
    count++;
    const varName = errorVar || 'error';

    return `catch (${varName}) {
  handleError(${varName}, {
    component: 'Component',
    action: 'operation',
    severity: ErrorSeverity.LOW,
  });
}`;
  });

  return { content: modified, count };
}

/**
 * Process single file
 */
function processFile(filePath) {
  stats.filesScanned++;

  const content = fs.readFileSync(filePath, 'utf8');
  let modified = content;
  let hasChanges = false;

  // Replace console statements
  const consoleResult = replaceConsoleStatements(modified, filePath);
  if (consoleResult.count > 0) {
    modified = consoleResult.content;
    stats.consoleReplaced += consoleResult.count;
    hasChanges = true;

    if (CONFIG.verbose) {
      console.log(
        `  ✓ Replaced ${consoleResult.count} console statements in ${path.relative(ROOT, filePath)}`,
      );
    }
  }

  // Fix empty catch blocks
  const catchResult = fixEmptyCatchBlocks(modified);
  if (catchResult.count > 0) {
    modified = catchResult.content;
    stats.catchBlocksFixed += catchResult.count;
    hasChanges = true;

    if (CONFIG.verbose) {
      console.log(
        `  ✓ Fixed ${catchResult.count} catch blocks in ${path.relative(ROOT, filePath)}`,
      );
    }
  }

  // Write changes
  if (hasChanges) {
    stats.filesModified++;

    if (!CONFIG.dryRun) {
      fs.writeFileSync(filePath, modified, 'utf8');
    }
  }
}

/**
 * Main migration
 */
function main() {
  console.log('🔄 Error Handling Migration\n');

  if (CONFIG.dryRun) {
    console.log('⚠️  DRY RUN MODE - No files will be modified\n');
  }

  console.log('Scanning files...\n');

  const files = getJavaScriptFiles(path.join(ROOT, 'content'));
  files.push(...getJavaScriptFiles(path.join(ROOT, 'pages')));

  console.log(`Found ${files.length} JavaScript files\n`);

  for (const file of files) {
    processFile(file);
  }

  console.log('\n📊 Migration Statistics:\n');
  console.log(`  Files scanned:       ${stats.filesScanned}`);
  console.log(`  Files modified:      ${stats.filesModified}`);
  console.log(`  Console replaced:    ${stats.consoleReplaced}`);
  console.log(`  Catch blocks fixed:  ${stats.catchBlocksFixed}`);

  if (CONFIG.dryRun) {
    console.log(
      '\n⚠️  This was a dry run. Run without --dry-run to apply changes.',
    );
  } else {
    console.log('\n✅ Migration completed successfully!');
  }
}

// Run migration
main();
