#!/usr/bin/env node

import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function checkCssConsolidation() {
  try {
    console.log('🔍 Prüfe CSS Custom Properties Konsolidierung...\n');

    // Find all CSS files except root.css
    const cssFiles = await glob('**/*.css', {
      cwd: projectRoot,
      ignore: [
        'node_modules/**', 
        '.git/**', 
        'content/webentwicklung/root.css'
      ]
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
      console.log('📝 Alle Custom Properties sollten in content/webentwicklung/root.css konsolidiert werden.');
      console.log('💡 Verwende: npm run consolidate:css');
      process.exit(1);
    } else {
      console.log('✅ Alle CSS Custom Properties sind ordnungsgemäß in root.css konsolidiert!');
    }

  } catch (error) {
    console.error('❌ Fehler beim Prüfen der CSS Konsolidierung:', error);
    process.exit(1);
  }
}

checkCssConsolidation();