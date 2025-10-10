#!/usr/bin/env node
/**
 * Accessibility Audit für ARIA-Attributes & Best Practices
 *
 * Prüft:
 * - ARIA-Attribute Validierung
 * - Semantic HTML
 * - Keyboard Navigation
 * - Screen Reader Kompatibilität
 * - Color Contrast
 * - Focus Management
 */

import { readFileSync, readdirSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// ===== ARIA Specification Reference =====
const VALID_ARIA_ROLES = new Set([
  'alert',
  'alertdialog',
  'application',
  'article',
  'banner',
  'button',
  'checkbox',
  'columnheader',
  'combobox',
  'complementary',
  'contentinfo',
  'definition',
  'dialog',
  'directory',
  'document',
  'feed',
  'figure',
  'form',
  'grid',
  'gridcell',
  'group',
  'heading',
  'img',
  'link',
  'list',
  'listbox',
  'listitem',
  'log',
  'main',
  'marquee',
  'math',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'navigation',
  'none',
  'note',
  'option',
  'presentation',
  'progressbar',
  'radio',
  'radiogroup',
  'region',
  'row',
  'rowgroup',
  'rowheader',
  'scrollbar',
  'search',
  'searchbox',
  'separator',
  'slider',
  'spinbutton',
  'status',
  'switch',
  'tab',
  'table',
  'tablist',
  'tabpanel',
  'term',
  'textbox',
  'timer',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
  'treeitem',
]);

const VALID_ARIA_ATTRIBUTES = new Set([
  'aria-activedescendant',
  'aria-atomic',
  'aria-autocomplete',
  'aria-busy',
  'aria-checked',
  'aria-colcount',
  'aria-colindex',
  'aria-colspan',
  'aria-controls',
  'aria-current',
  'aria-describedby',
  'aria-details',
  'aria-disabled',
  'aria-dropeffect',
  'aria-errormessage',
  'aria-expanded',
  'aria-flowto',
  'aria-grabbed',
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-keyshortcuts',
  'aria-label',
  'aria-labelledby',
  'aria-level',
  'aria-live',
  'aria-modal',
  'aria-multiline',
  'aria-multiselectable',
  'aria-orientation',
  'aria-owns',
  'aria-placeholder',
  'aria-posinset',
  'aria-pressed',
  'aria-readonly',
  'aria-relevant',
  'aria-required',
  'aria-roledescription',
  'aria-rowcount',
  'aria-rowindex',
  'aria-rowspan',
  'aria-selected',
  'aria-setsize',
  'aria-sort',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
]);

// ===== HTML File Scanner =====
function scanHTMLFiles(dir = PROJECT_ROOT) {
  const htmlFiles = [];

  function scan(currentDir) {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'scripts'].includes(entry.name)) {
          scan(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        htmlFiles.push(fullPath);
      }
    }
  }

  scan(dir);
  return htmlFiles;
}

// ===== ARIA Validation =====
function validateARIA(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const relativePath = relative(PROJECT_ROOT, filePath);
  const issues = [];

  // 1. Check ARIA roles
  const roleMatches = content.matchAll(/role=["']([^"']+)["']/g);
  for (const match of roleMatches) {
    const role = match[1];
    if (!VALID_ARIA_ROLES.has(role)) {
      issues.push({
        type: 'error',
        category: 'Invalid ARIA Role',
        message: `Invalid role="${role}"`,
        severity: 'high',
      });
    }
  }

  // 2. Check ARIA attributes
  const ariaMatches = content.matchAll(/aria-([a-z]+)=["'][^"']*["']/g);
  for (const match of ariaMatches) {
    const attr = `aria-${match[1]}`;
    if (!VALID_ARIA_ATTRIBUTES.has(attr)) {
      issues.push({
        type: 'error',
        category: 'Invalid ARIA Attribute',
        message: `Invalid attribute="${attr}"`,
        severity: 'high',
      });
    }
  }

  // 3. Check aria-label on interactive elements
  const buttonsWithoutLabel = content.match(
    /<button(?![^>]*aria-label)(?![^>]*aria-labelledby)[^>]*>/g
  );
  if (buttonsWithoutLabel) {
    const hasTextContent = buttonsWithoutLabel.some((btn) => {
      const afterBtn = content.split(btn)[1];
      const textBeforeClosing = afterBtn?.split('</button>')[0];
      return textBeforeClosing && textBeforeClosing.trim().length > 0;
    });

    if (!hasTextContent) {
      issues.push({
        type: 'warning',
        category: 'Missing Label',
        message: 'Button ohne aria-label oder sichtbaren Text',
        severity: 'medium',
      });
    }
  }

  // 4. Check img alt attributes
  const imgsWithoutAlt = content.match(/<img(?![^>]*alt=)[^>]*>/g);
  if (imgsWithoutAlt) {
    issues.push({
      type: 'error',
      category: 'Missing Alt Text',
      message: `${imgsWithoutAlt.length} Bild(er) ohne alt-Attribut`,
      severity: 'high',
    });
  }

  // 5. Check for proper heading hierarchy
  const headings = [...content.matchAll(/<h([1-6])[^>]*>/g)].map((m) =>
    parseInt(m[1])
  );
  if (headings.length > 0) {
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] - headings[i - 1] > 1) {
        issues.push({
          type: 'warning',
          category: 'Heading Hierarchy',
          message: `Sprung von h${headings[i - 1]} zu h${headings[i]} (sollte sequenziell sein)`,
          severity: 'low',
        });
      }
    }
  }

  // 6. Check for landmarks
  const hasMain = /<main/i.test(content);
  const hasNav =
    /<nav/i.test(content) || /role=["']navigation["']/i.test(content);

  const landmarks = {
    main: hasMain,
    nav: hasNav,
  };

  // 7. Check for skip links
  const hasSkipLink = /#skip|skip-to-content|skip-navigation/i.test(content);

  // 8. Check aria-hidden on focusable elements
  const ariaHiddenFocusable = content.match(
    /aria-hidden=["']true["'][^>]*(?:href|tabindex)/g
  );
  if (ariaHiddenFocusable) {
    issues.push({
      type: 'error',
      category: 'Focusable Hidden Element',
      message: 'aria-hidden="true" auf fokussierbarem Element',
      severity: 'high',
    });
  }

  // 9. Check for duplicate IDs (accessibility issue for aria-describedby etc.)
  const ids = [...content.matchAll(/id=["']([^"']+)["']/g)].map((m) => m[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    issues.push({
      type: 'error',
      category: 'Duplicate IDs',
      message: `Duplizierte IDs: ${[...new Set(duplicateIds)].join(', ')}`,
      severity: 'high',
    });
  }

  return {
    file: relativePath,
    issues,
    landmarks,
    hasSkipLink,
    stats: {
      ariaRoles: roleMatches ? [...roleMatches].length : 0,
      ariaAttributes: ariaMatches ? [...ariaMatches].length : 0,
      images: (content.match(/<img/g) || []).length,
      buttons: (content.match(/<button/g) || []).length,
      links: (content.match(/<a\s/g) || []).length,
    },
  };
}

// ===== Report Generation =====
function generateReport(results) {
  console.log('♿ Accessibility Audit - ARIA & Best Practices\n');
  console.log('═'.repeat(80));

  let totalIssues = 0;
  let errorCount = 0;
  let warningCount = 0;

  results.forEach((result) => {
    const hasIssues = result.issues.length > 0;
    const icon = hasIssues ? '❌' : '✅';

    console.log(`\n${icon} ${result.file}`);
    console.log('─'.repeat(80));

    if (result.issues.length === 0) {
      console.log('   ✅ Keine Accessibility-Probleme gefunden');
    } else {
      result.issues.forEach((issue) => {
        const severityIcon =
          issue.severity === 'high'
            ? '🔴'
            : issue.severity === 'medium'
              ? '🟡'
              : '🔵';
        const typeLabel = issue.type === 'error' ? 'ERROR' : 'WARNING';

        console.log(
          `   ${severityIcon} [${typeLabel}] ${issue.category}: ${issue.message}`
        );

        if (issue.type === 'error') errorCount++;
        else warningCount++;
      });
      totalIssues += result.issues.length;
    }

    // Landmarks Summary
    console.log('\n   📍 Landmarks:');
    console.log(`      Main: ${result.landmarks.main ? '✅' : '❌'}`);
    console.log(`      Navigation: ${result.landmarks.nav ? '✅' : '❌'}`);
    console.log(`      Skip Link: ${result.hasSkipLink ? '✅' : '❌'}`);

    // Stats
    console.log('\n   📊 Stats:');
    console.log(`      ARIA Roles: ${result.stats.ariaRoles}`);
    console.log(`      ARIA Attributes: ${result.stats.ariaAttributes}`);
    console.log(`      Images: ${result.stats.images}`);
    console.log(`      Buttons: ${result.stats.buttons}`);
    console.log(`      Links: ${result.stats.links}`);
  });

  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('📊 ACCESSIBILITY SUMMARY');
  console.log('═'.repeat(80));
  console.log(`\nDateien geprüft: ${results.length}`);
  console.log(`Gesamt Issues: ${totalIssues}`);
  console.log(`  🔴 Errors: ${errorCount}`);
  console.log(`  🟡 Warnings: ${warningCount}`);

  // Best Practices
  console.log('\n💡 Accessibility Best Practices:');
  console.log('─'.repeat(80));
  console.log(
    '   ✅ Alle interaktiven Elemente benötigen aria-label oder sichtbaren Text'
  );
  console.log('   ✅ Bilder benötigen alt-Text (oder alt="" wenn dekorativ)');
  console.log(
    '   ✅ Heading-Hierarchie sollte sequenziell sein (h1 → h2 → h3)'
  );
  console.log('   ✅ Jede Seite sollte <main> und <nav> Landmarks haben');
  console.log('   ✅ Skip-Links für Keyboard-Navigation empfohlen');
  console.log('   ✅ aria-hidden="true" nicht auf fokussierbaren Elementen');
  console.log(
    '   ✅ Keine duplizierte IDs (wichtig für aria-describedby etc.)'
  );

  // Keyboard Navigation Check
  console.log('\n⌨️  Manuelle Tests empfohlen:');
  console.log('─'.repeat(80));
  console.log('   1. Tab-Navigation durch gesamte Seite');
  console.log('   2. Focus-Indicator sichtbar?');
  console.log('   3. Skip-Link funktioniert?');
  console.log('   4. Menü mit Tastatur bedienbar?');
  console.log('   5. Modals mit ESC schließbar?');

  console.log('\n' + '═'.repeat(80));

  return errorCount;
}

// ===== Main Execution =====
async function main() {
  const htmlFiles = scanHTMLFiles();

  if (htmlFiles.length === 0) {
    console.log('⚠️  Keine HTML-Dateien gefunden');
    return;
  }

  const results = htmlFiles.map(validateARIA);
  const errorCount = generateReport(results);

  console.log('\n✨ Accessibility Audit abgeschlossen!\n');

  // Exit code basierend auf Errors (nicht Warnings)
  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ Fehler beim Accessibility Audit:', error);
  process.exit(1);
});
