/*
Checks video URLs referenced in sitemap-videos.xml: thumbnail and content URL reachability.
Produces CSV at tmp/video-urls.csv with columns: video_id,page_url,content_url,content_status,content_type,thumbnail_url,thumbnail_status,thumbnail_type
Usage: node scripts/check-video-urls.js
*/
const fs = require('fs/promises');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SITEMAP = path.join(PROJECT_ROOT, 'sitemap-videos.xml');
const OUT = path.join(PROJECT_ROOT, 'tmp');

function head(url, timeout = 10000) {
  return new Promise((resolve) => {
    try {
      const req = https.request(url, { method: 'HEAD', timeout }, (res) => {
        resolve({
          status: res.statusCode,
          type: res.headers['content-type'] || '',
        });
      });
      req.on('error', (e) => resolve({ error: e.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ error: 'timeout' });
      });
      req.end();
    } catch (e) {
      resolve({ error: e.message });
    }
  });
}

async function parseSitemap() {
  const xml = String(await fs.readFile(SITEMAP, 'utf8'));
  const urlBlocks = xml.split(/<url>/g).slice(1);
  const videos = [];
  for (const b of urlBlocks) {
    const pageUrlMatch = b.match(/<loc>([^<]+)<\/loc>/);
    const pageUrl = pageUrlMatch ? pageUrlMatch[1].trim() : null;
    const videoMatches = [
      ...b.matchAll(/<video:video>([\s\S]*?)<\/video:video>/g),
    ];
    for (const vm of videoMatches) {
      const v = vm[1];
      const get = (tag) => {
        const m = v.match(
          new RegExp(`<video:${tag}>([\\s\\S]*?)<\\/${'video:' + tag}>`, 'i'),
        );
        return m ? m[1].trim() : null;
      };
      const thumbnail = get('thumbnail_loc');
      const content = get('content_loc');
      const title = get('title');

      // extract id
      let vid = null;
      if (content) {
        const m = content.match(
          /(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{7,})/,
        );
        if (m) vid = m[1];
      }
      videos.push({ vid, pageUrl, content, thumbnail, title });
    }
  }
  return videos;
}

async function main() {
  const vids = await parseSitemap();
  await fs.mkdir(OUT, { recursive: true });
  const rows = [
    'video_id,page_url,content_url,content_status,content_type,thumbnail_url,thumbnail_status,thumbnail_type,title',
  ];
  for (const v of vids) {
    const c = v.content ? await head(v.content) : { error: 'no-content' };
    const t = v.thumbnail ? await head(v.thumbnail) : { error: 'no-thumb' };
    const line = [
      v.vid || '',
      v.pageUrl || '',
      v.content || '',
      c.status || c.error || '',
      c.type || '',
      v.thumbnail || '',
      t.status || t.error || '',
      t.type || '',
      `"${(v.title || '').replace(/"/g, '""')}"`,
    ];
    rows.push(line.join(','));
  }
  await fs.writeFile(path.join(OUT, 'video-urls.csv'), rows.join('\n'), 'utf8');
  console.log('Wrote', path.join(OUT, 'video-urls.csv'));
}

if (require.main === module)
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
