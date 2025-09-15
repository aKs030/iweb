#!/usr/bin/env node
/**
 * fetch-inter.js
 * Lädt die Inter Variable Font (WOFF2) + optional statisches Regular Fallback.
 * Quelle: https://github.com/rsms/inter (offizielle Distribution) oder CDN Mirror.
 *
 * - Variable Font Datei: InterVariable.woff2 (Axes: wght, slnt)
 * - Fallback Regular: Inter-Regular.woff2 (optional)
 *
 * Nutzung:
 *   node scripts/fetch-inter.js
 * oder via npm script: npm run fonts:inter
 */
import fs from 'fs';
import path from 'path';
import https from 'https';

const TARGET_DIR = path.resolve('content/webentwicklung/fonts');
const FILES = [
  {
    url: 'https://rsms.me/inter/font-files/InterVariable.woff2?v=4.1',
    name: 'InterVariable.woff2'
  },
  {
    url: 'https://rsms.me/inter/font-files/Inter-Regular.woff2?v=4.1',
    name: 'Inter-Regular.woff2'
  }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', err => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  ensureDir(TARGET_DIR);
  for (const f of FILES) {
    const target = path.join(TARGET_DIR, f.name);
    if (fs.existsSync(target)) {
      console.error('✔ Bereits vorhanden:', f.name);
      continue;
    }
    console.error('↓ Lade', f.url);
    try {
      await download(f.url, target);
      console.error('✓ Gespeichert:', f.name);
    } catch (e) {
      console.error('Fehler beim Laden', f.url, e.message);
    }
  }
  console.error('Fertig.');
}

run();
