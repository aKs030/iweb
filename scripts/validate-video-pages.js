/*
Validate per-video pages for presence of VideoObject JSON-LD and required fields.
Usage: node scripts/validate-video-pages.js
Outputs a short report to stdout and a CSV to tmp/video-jsonld-check.csv
*/
const fs = require('fs/promises');
const path = require('path');
const { existsSync } = require('fs');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SITEMAP = path.join(PROJECT_ROOT, 'sitemap-videos.xml');
const OUTDIR = path.join(PROJECT_ROOT, 'tmp');

function head(url, timeout = 10000) {
    return new Promise((resolve) => {
        try {
            const req = https.request(url, { method: 'HEAD', timeout }, (res) => {
                resolve({ status: res.statusCode, type: res.headers['content-type'] || '' });
            });
            req.on('error', (e) => resolve({ error: e.message }));
            req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
            req.end();
        } catch (e) { resolve({ error: e.message }); }
    });
}

async function parseSitemap() {
    const xml = String(await fs.readFile(SITEMAP, 'utf8'));
    const urlBlocks = xml.split(/<url>/g).slice(1);
    const videos = [];
    for (const b of urlBlocks) {
        const pageUrlMatch = b.match(/<loc>([^<]+)<\/loc>/);
        const pageUrl = pageUrlMatch ? pageUrlMatch[1].trim() : null;
        const videoMatches = [...b.matchAll(/<video:video>([\s\S]*?)<\/video:video>/g)];
        for (const vm of videoMatches) {
            const v = vm[1];
            const get = (tag) => {
                const m = v.match(new RegExp(`<video:${tag}>([\\s\\S]*?)<\\/${'video:' + tag}>`, 'i'));
                return m ? m[1].trim() : null;
            };
            const thumbnail = get('thumbnail_loc');
            const content = get('content_loc');
            const title = get('title');
            let vid = null;
            if (content) {
                const m = content.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{7,})/);
                if (m) vid = m[1];
            }
            videos.push({ vid, pageUrl, content, thumbnail, title });
        }
    }
    return videos;
}

async function extractJsonLdFromFile(filePath) {
    const html = String(await fs.readFile(filePath, 'utf8'));
    const scripts = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    const jsons = [];
    for (const s of scripts) {
        const txt = s[1].trim();
        try {
            const parsed = JSON.parse(txt);
            jsons.push(parsed);
        } catch (e) {
            // ignore parse errors
        }
    }
    return jsons;
}

function findVideoObject(jsonld) {
    // jsonld may be an object or an array or @graph
    if (!jsonld) return null;
    const objs = [];
    if (Array.isArray(jsonld)) objs.push(...jsonld);
    else objs.push(jsonld);
    for (const obj of objs) {
        if (obj['@graph']) {
            for (const g of obj['@graph']) if (g['@type'] === 'VideoObject' || (Array.isArray(g['@type']) && g['@type'].includes('VideoObject'))) return g;
        }
        if (obj['@type'] === 'VideoObject' || (Array.isArray(obj['@type']) && obj['@type'].includes('VideoObject'))) return obj;
        // search nested
        for (const k of Object.keys(obj || {})) {
            const v = obj[k];
            if (v && typeof v === 'object') {
                const found = findVideoObject(v);
                if (found) return found;
            }
        }
    }
    return null;
}

async function main() {
    const vids = await parseSitemap();
    await fs.mkdir(OUTDIR, { recursive: true });
    const rows = ['video_id,page_url,page_file,videoobject_present,name,thumbnailUrl,thumbnail_status,thumbnail_type,contentUrl,content_status,content_type,notes'];
    for (const v of vids) {
        const vid = v.vid || '';
        const pageUrl = v.pageUrl || '';
        const pagePath = (() => {
            // Map web path to local file under pages/
            // Examples:
            //  - https://.../ -> index.html
            //  - https://.../videos/ -> pages/videos/index.html
            //  - https://.../videos/<id>/ -> pages/videos/<id>/index.html
            try {
                const u = new URL(pageUrl);
                const rel = u.pathname.replace(/^\//, '');
                if (!rel || rel === '') return path.join(PROJECT_ROOT, 'index.html');
                const parts = rel.split('/').filter(Boolean);
                // if top-level folder exists under pages, map to pages/<top>/... otherwise fallback to project root
                const top = parts[0];
                const rest = parts.slice(1);
                const pagesDirCandidate = path.join(PROJECT_ROOT, 'pages', top);
                if (existsSync(pagesDirCandidate)) {
                    return path.join(pagesDirCandidate, ...rest, 'index.html');
                }
                // fallback: try project-relative
                return path.join(PROJECT_ROOT, rel, 'index.html');
            } catch (e) {
                return null;
            }
        })();
        let videoPresent = false;
        let name = '';
        let thumbnailUrl = v.thumbnail || '';
        let thumbnailStatus = '';
        let thumbnailType = '';
        let contentUrl = v.content || '';
        let contentStatus = '';
        let contentType = '';
        let notes = [];

        if (pagePath && existsSync(pagePath)) {
            try {
                const jsons = await extractJsonLdFromFile(pagePath);
                let vo = null;
                for (const j of jsons) {
                    const found = findVideoObject(j);
                    if (found) { vo = found; break; }
                }
                if (vo) {
                    videoPresent = true;
                    name = (vo.name || '').replace(/\n/g, ' ').substring(0, 200);
                    // optional checks
                    if (!vo.thumbnailUrl) notes.push('missing thumbnailUrl in VideoObject');
                    if (!vo.contentUrl && !vo.embedUrl) notes.push('missing contentUrl/embedUrl in VideoObject');
                    if (!vo.uploadDate) notes.push('missing uploadDate');
                } else {
                    notes.push('no VideoObject JSON-LD found');
                }
            } catch (e) {
                notes.push('failed to read/parse page: ' + e.message);
            }
        } else {
            notes.push('page file not found locally');
        }

        if (thumbnailUrl) {
            const t = await head(thumbnailUrl).catch((e) => ({ error: e.message }));
            thumbnailStatus = t.status || t.error || '';
            thumbnailType = t.type || '';
            if (thumbnailStatus && (thumbnailStatus < 200 || thumbnailStatus >= 400)) notes.push('thumbnail not OK: ' + thumbnailStatus);
        } else notes.push('no thumbnail url');

        if (contentUrl) {
            const c = await head(contentUrl).catch((e) => ({ error: e.message }));
            contentStatus = c.status || c.error || '';
            contentType = c.type || '';
            if (contentStatus && (contentStatus < 200 || contentStatus >= 400)) notes.push('content not OK: ' + contentStatus);
        } else notes.push('no content url');

        rows.push([vid, pageUrl, pagePath ? path.relative(PROJECT_ROOT, pagePath) : '', videoPresent ? 'yes' : 'no', `"${name.replace(/"/g, '""')}"`, thumbnailUrl, thumbnailStatus, thumbnailType, contentUrl, contentStatus, contentType, `"${notes.join('; ')}"`].join(','));
    }
    await fs.writeFile(path.join(OUTDIR, 'video-jsonld-check.csv'), rows.join('\n'), 'utf8');
    console.log('Wrote tmp/video-jsonld-check.csv');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });