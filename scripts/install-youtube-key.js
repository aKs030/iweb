#!/usr/bin/env node
const fs = require('fs');
const { error, info } = require('./log');
(async () => {
  const key = process.env.YT_KEY;
  if (!key) {
    error('ERROR: Please pass the key via YT_KEY env var');
    process.exit(2);
  }

  const half = Math.floor(key.length / 2);
  const a = key.slice(0, half);
  const b = key.slice(half);
  const partA = Buffer.from(a, 'utf8').toString('base64');
  const partB = Buffer.from(b, 'utf8').toString('base64');

  fs.writeFileSync('content/config/videos-part-a.js', `export default "${partA}";\n`, 'utf8');
  fs.writeFileSync('content/config/videos-part-b.js', `export default "${partB}";\n`, 'utf8');

  const recon =
    Buffer.from(partA, 'base64').toString('utf8') + Buffer.from(partB, 'base64').toString('utf8');
  if (recon !== key) {
    error('ERROR: Reconstruction mismatch');
    process.exit(3);
  }
  info('Reconstructed key matches original (not displayed)');

  // Quick YouTube API check
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=UCTGRherjM4iuIn86xxubuPg&key=${recon}`;
    const res = await fetch(url);
    info('YouTube API HTTP status: ' + res.status);
    const json = await res.json();
    if (res.ok) {
      info('YouTube response: items: ' + (json.items || []).length);
    } else {
      error('YouTube API error: ' + JSON.stringify(json).slice(0, 800));
    }
  } catch (e) {
    error('Fetch failed: ' + (e && e.message ? e.message : String(e)));
    process.exit(4);
  }
})();
