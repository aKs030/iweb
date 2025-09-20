#!/usr/bin/env node

import { HtmlValidate } from 'html-validate';
import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const htmlvalidate = new HtmlValidate({
  extends: ['html-validate:recommended'],
  rules: {
    'void-style': 'off', // Allow self-closing tags
    'no-trailing-whitespace': 'off', // Allow trailing whitespace
    'element-required-attributes': 'off', // Allow missing attributes
    'meta-refresh': 'off', // Allow meta refresh
    'no-inline-style': 'off', // Allow inline styles
    'script-element': 'off', // Allow script elements
  }
});

async function validateSingleFile(file, filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const report = htmlvalidate.validateString(content, filePath);
    
    if (report.valid) {
      console.log(`✅ ${file} - Valide`);
      return { errors: 0, warnings: 0 };
    } else {
      console.log(`❌ ${file} - Fehler gefunden:`);
      
      let fileErrors = 0;
      let fileWarnings = 0;
      
      // Handle both array and single result
      const results = Array.isArray(report.results) ? report.results : [report];
      
      for (const result of results) {
        const messages = result.messages || [];
        for (const message of messages) {
          const severity = message.severity === 2 ? 'ERROR' : 'WARNING';
          const icon = message.severity === 2 ? '🚨' : '⚠️';
          
          console.log(`   ${icon} [${severity}] Zeile ${message.line}:${message.column} - ${message.message} (${message.ruleId})`);
          
          if (message.severity === 2) {
            fileErrors++;
          } else {
            fileWarnings++;
          }
        }
      }
      console.log();
      return { errors: fileErrors, warnings: fileWarnings };
    }
  } catch (error) {
    console.error(`❌ Fehler beim Lesen von ${file}:`, error.message);
    return { errors: 1, warnings: 0 };
  }
}

async function validateHtmlFiles() {
  try {
    // Find all HTML files in the project
    const htmlFiles = await glob('**/*.html', {
      cwd: projectRoot,
      ignore: ['node_modules/**', '.git/**']
    });

    console.log(`\n🔍 HTML Validation für ${htmlFiles.length} Dateien...\n`);

    let totalErrors = 0;
    let totalWarnings = 0;

    for (const file of htmlFiles) {
      const filePath = join(projectRoot, file);
      const result = await validateSingleFile(file, filePath);
      totalErrors += result.errors;
      totalWarnings += result.warnings;
    }

    console.log('\n📊 Zusammenfassung:');
    console.log(`   Dateien geprüft: ${htmlFiles.length}`);
    console.log(`   Fehler: ${totalErrors}`);
    console.log(`   Warnungen: ${totalWarnings}`);

    if (totalErrors > 0) {
      console.log('\n❌ HTML Validation fehlgeschlagen!');
      process.exit(1);
    } else {
      console.log('\n✅ Alle HTML-Dateien sind valide!');
    }

  } catch (error) {
    console.error('❌ Unerwarteter Fehler:', error);
    process.exit(1);
  }
}

validateHtmlFiles();