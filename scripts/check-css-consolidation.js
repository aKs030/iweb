#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { glob } from 'glob';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function checkCssConsolidation() {
  try {
    console.log('🔍 Prüfe CSS Custom Properties Konsolidierung...\n');

    // Find all CSS files except root.css and dynamic-menu-tokens.css
    const cssFiles = await glob('**/*.css', {
      cwd: projectRoot,
      ignore: [
        'node_modules/**',
        '.git/**',
        'content/webentwicklung/root.css',
        'content/webentwicklung/menu/dynamic-menu-tokens.css',
      ],
    });

    let foundProperties = false;
    const customPropertyRegex = /--[\w-]+\s*:/g;

    for (const file of cssFiles) {
      const filePath = join(projectRoot, file);
      const content = await readFile(filePath, 'utf8');
      const matches = content.match(customPropertyRegex);

      if (matches && matches.length > 0) {
        foundProperties = true;
        console.log(`❌ ${file}:`);

        for (const match of matches) {
          const property = match.replace(':', '').trim();
          console.log(`   ${property}`);
        }
        console.log();
      }
    }

    if (foundProperties) {
      console.log('❌ CSS Custom Properties außerhalb von root.css gefunden!');
      console.log(
        '📝 Alle Custom Properties sollten in content/webentwicklung/root.css konsolidiert werden.'
      );
      console.log('💡 Verwende: npm run consolidate:css');
      process.exit(1);
    } else {
      console.log(
        '✅ Alle CSS Custom Properties sind ordnungsgemäß in root.css konsolidiert!'
      );
    }
  } catch (error) {
    console.error('❌ Fehler beim Prüfen der CSS Konsolidierung:', error);
    process.exit(1);
  }
}

checkCssConsolidation();
