/*
Mirror YouTube thumbnails locally and update sitemap & per-video pages.
Usage: node scripts/mirror-video-thumbnails.js
*/
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { existsSync } = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SITEMAP = path.join(PROJECT_ROOT, 'sitemap-videos.xml');
const VIDEOS_DIR = path.join(PROJECT_ROOT, 'content', 'assets', 'img', 'videos');
const PAGES_VIDEOS = path.join(PROJECT_ROOT, 'pages', 'videos');
const BASE_URL = 'https://www.abdulkerimsesli.de';

async function ensureDir(d) {
    try {
        await fs.mkdir(d, { recursive: true });
    } catch (e) {
        // ignore
    }
}

function extractVideoIdFromThumb(url) {
    // typical: https://i.ytimg.com/vi/<id>/hqdefault.jpg
    const m = url.match(/vi\/([A-Za-z0-9_-]{7,})\//);
    return m ? m[1] : null;
}

async function downloadBuffer(url) {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

async function main() {
    await ensureDir(VIDEOS_DIR);
    let xml = String(await fs.readFile(SITEMAP, 'utf8'));
    const thumbMatches = [...xml.matchAll(/<video:thumbnail_loc>([^<]+)<\/video:thumbnail_loc>/g)];
    const unique = new Map();
    for (const m of thumbMatches) {
        const url = m[1].trim();
        if (unique.has(url)) continue;
        unique.set(url, null);
    }

    let changed = false;

    for (const url of unique.keys()) {
        const vid = extractVideoIdFromThumb(url);
        if (!vid) {
            console.warn('Could not extract video id from thumbnail url:', url);
            continue;
        }
        const outName = `${vid}.webp`;
        const outPath = path.join(VIDEOS_DIR, outName);
        const outUrl = `${BASE_URL}/content/assets/img/videos/${outName}`;

        if (!existsSync(outPath)) {
            try {
                console.log('Downloading thumbnail for', vid);
                const buf = await downloadBuffer(url);
                await sharp(buf).webp({ quality: 80 }).toFile(outPath);
                console.log('Saved', outPath);
                changed = true;
            } catch (e) {
                console.warn('Failed to download/convert', url, e.message);
                continue;
            }
        } else {
            // already exists
        }

        // replace occurrences in sitemap xml
        if (xml.includes(url) && !xml.includes(outUrl)) {
            xml = xml.split(url).join(outUrl);
            changed = true;
        }

        // update per-video page if present
        const pagePath = path.join(PAGES_VIDEOS, vid, 'index.html');
        if (existsSync(pagePath)) {
            try {
                let html = String(await fs.readFile(pagePath, 'utf8'));
                if (html.includes(url)) {
                    html = html.split(url).join(outUrl);
                    await fs.writeFile(pagePath, html, 'utf8');
                    console.log('Updated page', pagePath);
                    changed = true;
                }
            } catch (e) {
                console.warn('Failed to update page', pagePath, e.message);
            }
        }
    }

    if (changed) {
        try {
            await fs.writeFile(SITEMAP, xml, 'utf8');
            console.log('Updated sitemap', SITEMAP);
        } catch (e) {
            console.error('Failed to write sitemap', e.message);
        }
    } else {
        console.log('No changes necessary');
    }
}

if (require.main === module) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
