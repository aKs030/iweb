/*
Inserts a visible list of per-video landing page links into pages/videos/index.html
based on entries found in sitemap-videos.xml. Usage: node scripts/insert-video-links.js
*/
const fs = require('fs/promises');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SITEMAP = path.join(PROJECT_ROOT, 'sitemap-videos.xml');
const PAGE = path.join(PROJECT_ROOT, 'pages', 'videos', 'index.html');

async function parseSitemap() {
    const xml = String(await fs.readFile(SITEMAP, 'utf8'));
    const urlBlocks = xml.split(/<url>/g).slice(1);
    const vids = [];
    for (const b of urlBlocks) {
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
            const content = get('content_loc');
            const title = get('title');
            if (!content) continue;
            const m = content.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{7,})/);
            if (!m) continue;
            const vid = m[1];
            vids.push({ vid, title: title || `Video ${vid}` });
        }
    }
    // dedupe by vid
    const seen = new Set();
    return vids.filter((v) => {
        if (seen.has(v.vid)) return false;
        seen.add(v.vid);
        return true;
    });
}

async function insertLinks(vids) {
    let html = String(await fs.readFile(PAGE, 'utf8'));
    const insertBefore = '<section\n          class="video-grid"';
    const idx = html.indexOf(insertBefore);
    if (idx === -1) {
        console.warn(
            'Could not find insertion point; appending links before </main>',
        );
        const listHtml = buildHtml(vids);
        html = html.replace('</main>', listHtml + '\n</main>');
    } else {
        const insertPos = idx;
        const listHtml = buildHtml(vids);
        html = html.slice(0, insertPos) + listHtml + '\n' + html.slice(insertPos);
    }
    await fs.writeFile(PAGE, html, 'utf8');
    console.log('Inserted video links into', PAGE);
}

function buildHtml(vids) {
    const items = vids
        .map(
            (v) =>
                `            <li><a href="/videos/${v.vid}/">${escapeHtml(
                    v.title,
                )}</a></li>`,
        )
        .join('\n');
    return `        <section class="video-links">
          <h3>Einzelne Video‑Seiten</h3>
          <p class="lead">Jede Aufnahme hat eine eigene, indexierbare Landing‑Page für bessere Auffindbarkeit in der Suche.</p>
          <ul class="video-links-list">
${items}
          </ul>
        </section>`;
}

function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function main() {
    const vids = await parseSitemap();
    if (!vids.length) {
        console.warn('No videos found to insert links for');
        return;
    }
    await insertLinks(vids);
}

if (require.main === module)
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
