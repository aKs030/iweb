import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const IGNORED_DIRS = new Set(['.git', '.wrangler', 'node_modules']);
const ABSOLUTE_LOCAL_PATH_PATTERN = /\/Users\/[^\s`'")]+/g;
const LINK_PATTERN = /\[[^\]]+\]\(([^)]+)\)/g;

function walkMarkdownFiles(dir, markdownFiles = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkMarkdownFiles(entryPath, markdownFiles);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      markdownFiles.push(entryPath);
    }
  }

  return markdownFiles;
}

function getLineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

function validateMarkdownFile(filePath) {
  const issues = [];
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const relativeFilePath = path.relative(ROOT_DIR, filePath);

  for (const match of fileContent.matchAll(ABSOLUTE_LOCAL_PATH_PATTERN)) {
    issues.push({
      filePath: relativeFilePath,
      line: getLineNumber(fileContent, match.index ?? 0),
      message: `Absolute lokaler Pfad gefunden: ${match[0]}`,
    });
  }

  for (const match of fileContent.matchAll(LINK_PATTERN)) {
    const rawLink = match[1].trim();

    if (!rawLink || rawLink.startsWith('#')) {
      continue;
    }

    if (
      rawLink.startsWith('http://') ||
      rawLink.startsWith('https://') ||
      rawLink.startsWith('mailto:')
    ) {
      continue;
    }

    const normalizedLink = rawLink.replace(/^<|>$/g, '');
    const linkPath = normalizedLink.split('#')[0];

    if (!linkPath) {
      continue;
    }

    const resolvedPath = path.resolve(path.dirname(filePath), linkPath);

    if (!fs.existsSync(resolvedPath)) {
      issues.push({
        filePath: relativeFilePath,
        line: getLineNumber(fileContent, match.index ?? 0),
        message: `Ungültiger Link: ${rawLink}`,
      });
    }
  }

  return issues;
}

const markdownFiles = walkMarkdownFiles(ROOT_DIR);
const allIssues = markdownFiles.flatMap(validateMarkdownFile);

if (allIssues.length > 0) {
  console.error('docs-check: Fehler gefunden\n');
  for (const issue of allIssues) {
    console.error(`${issue.filePath}:${issue.line} - ${issue.message}`);
  }
  process.exit(1);
}

console.log(
  `docs-check: OK (${markdownFiles.length} Markdown-Dateien geprüft)`,
);
