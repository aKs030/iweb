/* eslint-env node */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function grepCount(file, root = '.') {
  try {
    const escaped = file.replace(/([\\$`"'\\])/g, '\\$1');
    const out = execSync(`git grep --name-only -F "${escaped}" || true`, { cwd: root });
    const text = out.toString().trim();
    return text ? text.split('\n').length : 0;
  } catch (e) {
    return 0;
  }
}

function main() {
  const imgDir = path.resolve('./content/img');
  const fontsDir = path.resolve('./content/webentwicklung/fonts');

  const images = listFilesRecursively(imgDir).filter((f) => !f.endsWith('.DS_Store'));
  const fonts = fs.existsSync(fontsDir) ? listFilesRecursively(fontsDir) : [];

  console.log('Scanning assets for usage. This may take a moment...');

  const unused = [];

  images.forEach((img) => {
    const rel = path.relative(process.cwd(), img).replace('\\\\', '/');
    const count = grepCount(rel);
    if (count === 0) unused.push(rel);
  });

  fonts.forEach((font) => {
    const rel = path.relative(process.cwd(), font).replace('\\\\', '/');
    const count = grepCount(rel);
    if (count === 0) unused.push(rel);
  });

  if (unused.length === 0) {
    console.log('No unused assets found.');
    process.exit(0);
  }

  console.log('Unused assets:');
  unused.forEach((u) => console.log(' -', u));
  console.log('\nTo remove them: run node scripts/find-unused-assets.js --delete');
}

if (process.argv.includes('--delete')) {
  const imgDir = path.resolve('./content/img');
  const fontsDir = path.resolve('./content/webentwicklung/fonts');
  const images = listFilesRecursively(imgDir).filter((f) => !f.endsWith('.DS_Store'));
  const fonts = fs.existsSync(fontsDir) ? listFilesRecursively(fontsDir) : [];
  const all = [...images, ...fonts];
  const deletable = [];
  all.forEach((f) => {
    const rel = path.relative(process.cwd(), f).replace('\\\\', '/');
    try {
      const out = execSync(`git grep --name-only -F "${rel}" || true`);
      if (!out.toString().trim()) deletable.push(f);
    } catch (e) {
      deletable.push(f);
    }
  });
  if (deletable.length === 0) {
    console.log('No assets to delete.');
    process.exit(0);
  }
  deletable.forEach((f) => {
    fs.unlinkSync(f);
    console.log('Deleted', f);
  });
  console.log('Deleted assets. Consider committing the changes.');
  process.exit(0);
} else {
  main();
}
