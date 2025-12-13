#!/usr/bin/env node
/* Collect browser JS coverage using Playwright and CDP Profiler

Usage: node scripts/collect-browser-coverage.js

This script starts a local http-server, opens several pages, interacts minimally,
collects precise coverage via CDP Profiler and prints a per-file coverage summary.
*/
const {chromium} = require('playwright');
const {spawn} = require('child_process');
// path not required in this script

const SERVER_PORT = 8081;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

async function startServer() {
  const proc = spawn('npx', ['http-server', './', '-p', String(SERVER_PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd(),
    env: process.env
  });

  return new Promise((resolve, reject) => {
    const onData = data => {
      const s = data.toString();
      if (s.includes('Available on')) {
        proc.stdout.off('data', onData);
        resolve(proc);
      }
    };
    proc.stdout.on('data', onData);
    proc.on('error', reject);
    setTimeout(() => reject(new Error('Server failed to start in time')), 10000);
  });
}

function mergeCoverage(coverageEntries) {
  const map = new Map();
  for (const entry of coverageEntries) {
    if (!entry.url) continue;
    const prev = map.get(entry.url) || {url: entry.url, total: 0, used: 0};
    // each function has ranges with count
    for (const f of entry.functions || []) {
      for (const r of f.ranges || []) {
        const len = r.endOffset - r.startOffset;
        prev.total += len;
        if (r.count && r.count > 0) prev.used += len;
      }
    }
    map.set(entry.url, prev);
  }
  const results = [];
  for (const v of map.values()) {
    results.push({
      url: v.url,
      total: v.total,
      used: v.used,
      pct: v.total ? Math.round((v.used / v.total) * 10000) / 100 : 0
    });
  }
  results.sort((a, b) => a.pct - b.pct);
  return results;
}

(async () => {
  console.warn('Starting local server...');
  const server = await startServer();
  console.warn('Server started. Launching browser...');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Attach CDP session
  const client = await context.newCDPSession(page);
  await client.send('Profiler.enable');
  await client.send('Profiler.startPreciseCoverage', {callCount: true, detailed: true});

  const pagesToVisit = [
    '/',
    '/pages/gallery/gallery.html',
    '/pages/projekte/projekte.html',
    '/pages/fotos/gallery.html',
    '/about/'
  ];
  const coverageEntries = [];

  for (const p of pagesToVisit) {
    const url = new URL(p, SERVER_URL).toString();
    console.warn('Navigating to', url);
    await page.goto(url, {waitUntil: 'load', timeout: 30000}).catch(err => {
      console.warn('Navigation error', err.message);
    });

    // Try some lightweight interactions where applicable
    try {
      // Open robot chat and interact where possible
      await page
        .evaluate(() => {
          const avatar = document.querySelector('.robot-avatar');
          if (avatar && avatar.click) avatar.click();
        })
        .catch(() => {});

      // If chat input exists, send a greeting and trigger some actions/games
      if (await page.$('#robot-chat-input')) {
        await page.fill('#robot-chat-input', 'Hallo');
        await page.click('#robot-chat-send').catch(() => {});
        await page.waitForTimeout(800);

        // start a few game modes via chat actions
        const cmds = ['playGuessNumber', 'playTrivia', 'playTicTacToe'];
        for (const c of cmds) {
          await page.fill('#robot-chat-input', c).catch(() => {});
          await page.click('#robot-chat-send').catch(() => {});
          await page.waitForTimeout(700);
        }

        // Click any option buttons shown by the bot
        const opts = await page.$$('.chat-option-btn');
        for (const o of opts.slice(0, 3)) {
          await o.click().catch(() => {});
          await page.waitForTimeout(400);
        }
      }

      // trigger a generic click to encourage lazy-loaded code to run
      await page
        .evaluate(() => {
          const el = document.querySelector('button, a');
          if (el && el.click) el.click();
        })
        .catch(() => {});
    } catch {
      // ignore
    }

    // wait a bit for dynamic code to run
    await page.waitForTimeout(800);

    const res = await client.send('Profiler.takePreciseCoverage');
    if (res && res.result) coverageEntries.push(...res.result);
  }

  // Stop coverage
  await client.send('Profiler.stopPreciseCoverage');
  await client.send('Profiler.disable');

  // Merge and print
  const summary = mergeCoverage(coverageEntries);
  console.warn('\nCoverage summary (sorted by % used ascending):');
  summary.forEach(s => {
    console.warn(`${s.pct.toFixed(2).padStart(6)}%  ${s.used}/${s.total}  ${s.url}`);
  });

  // Filter coarse candidates: low usage and not vendor
  const candidates = summary.filter(s => s.pct < 20 && !s.url.includes('/content/vendor/') && s.total > 200);
  if (candidates.length) {
    console.warn('\nPotential dead-code candidates (low usage <20% and >200 bytes):');
    candidates.forEach(s => console.warn(`- ${s.url} (${s.pct}% used)`));
  } else {
    console.warn('\nNo obvious dead-code candidates found by coverage heuristic.');
  }

  await browser.close();
  server.kill();
})();
