/* eslint-env node */
/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function listFilesRecursively(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(listFilesRecursively(filePath));
    } else {
      results.push(filePath);
    }
  });
  return results;
}

function gitGrep(pattern) {
  try {
    const out = execSync(`git grep --line-number -E "${pattern}" || true`, {
      cwd: path.resolve(__dirname, '..')
    });
    return out.toString().trim().split('\n').filter(Boolean);
  } catch (e) {
    return [];
  }
}

function findUsage(filePath) {
  // heuristics: path reference, basename, basename without extension, partial name
  const rel = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/');
  const base = path.basename(filePath);
  const nameNoExt = base.replace(/\.[^.]+$/, '');
  const escapedRel = rel.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const escapedBase = base.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const escapedName = nameNoExt.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&');

  // 1. exact path occurrences
  const out1 = gitGrep(escapedRel);
  if (out1.length) return out1;

  // 2. basename occurrences (links, srcset, CSS url)
  const out2 = gitGrep(escapedBase);
  if (out2.length) return out2;

  // 3. partial filename (e.g., used without extension or hashed name references)
  const out3 = gitGrep(escapedName);
  if (out3.length) return out3;

  // 4. search for URL(encoded) patterns
  const out4 = gitGrep(escapedRel.replace(/\//g, '\\/'));
  if (out4.length) return out4;

  return [];
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const imgDir = path.join(repoRoot, 'content', 'img');
  const fontsDir = path.join(repoRoot, 'content', 'webentwicklung', 'fonts');

  const images = fs.existsSync(imgDir)
    ? listFilesRecursively(imgDir).filter((f) => !f.endsWith('.DS_Store'))
    : [];
  const fonts = fs.existsSync(fontsDir) ? listFilesRecursively(fontsDir) : [];

  console.log('Advanced scan for asset usage...');

  const unused = [];

  // scan images
  images.forEach((img) => {
    const usage = findUsage(img);
    if (!usage.length)
      unused.push({
        path: path.relative(repoRoot, img),
        reason: 'not found by advanced heuristics'
      });
  });

  // scan fonts
  fonts.forEach((font) => {
    const usage = findUsage(font);
    if (!usage.length)
      unused.push({
        path: path.relative(repoRoot, font),
        reason: 'not found by advanced heuristics'
      });
  });

  if (unused.length === 0) {
    console.log('No unused assets found by advanced heuristics.');
    process.exit(0);
  }

  console.log('Assets that appear unused:');
  unused.forEach((u) => console.log(' -', u.path, '=>', u.reason));

  console.log(
    '\nYou can inspect if those assets are truly unused. To delete them programmatically, run:'
  );
  console.log('node scripts/find-unused-assets.js --delete');
}

main();
