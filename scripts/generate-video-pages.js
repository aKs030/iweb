/*
Generates per-video landing pages from sitemap-videos.xml and updates sitemap-videos.xml
Usage: node scripts/generate-video-pages.js

Behavior:
- Reads `sitemap-videos.xml` and extracts video entries
- For each video, writes `pages/videos/<videoId>/index.html` with minimal HTML + VideoObject JSON-LD + canonical
- Ensures `sitemap-videos.xml` contains individual <url> entries for the new pages with their <video:video> block
*/
const fs = require('fs/promises');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SITEMAP = path.join(PROJECT_ROOT, 'sitemap-videos.xml');
const VIDEOS_DIR = path.join(PROJECT_ROOT, 'pages', 'videos');
const PAGES_DIR = path.join(VIDEOS_DIR);

async function readSitemap() {
    const xml = String(await fs.readFile(SITEMAP, 'utf8'));
    return xml;
}

function parseVideos(xml) {
    const urlBlocks = xml.split(/<url>/g).slice(1);
    const entries = [];
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
            const title = get('title');
            const description = get('description');
            const content = get('content_loc');
            const player = get('player_loc');
            const duration = get('duration');
            const pubDate = get('publication_date');
            const view_count = get('view_count');
            // derive id
            let vid = null;
            if (content) {
                const m = content.match(
                    /(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{7,})/,
                );
                if (m) vid = m[1];
            } else if (player) {
                const m = player.match(/embed\/([A-Za-z0-9_-]{7,})/);
                if (m) vid = m[1];
            }
            if (!vid) continue;
            entries.push({
                vid,
                pageUrl,
                content,
                player,
                thumbnail,
                title,
                description,
                duration,
                pubDate,
                view_count,
            });
        }
    }
    return entries;
}

function createLandingHtml(video) {
    const pageUrl = `https://www.abdulkerimsesli.de/videos/${video.vid}/`;
    // Load branding from central config so values remain consistent across site
    const BRAND = require(path.join(PROJECT_ROOT, 'content', 'config', 'brand-data.json'));
    const CREATOR_NAME = BRAND.name || 'Abdulkerim Sesli';
    const CURRENT_YEAR = new Date().getFullYear();
    const LICENSE_PAGE = BRAND.licensePage || 'https://www.abdulkerimsesli.de/#image-license';
    const CREDIT_PREFIX = BRAND.creditPrefix || 'Photo: ';

    const ld = {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: video.title || '',
        description: video.description || '',
        creator: { '@type': 'Person', name: CREATOR_NAME },
        thumbnailUrl: video.thumbnail || undefined,
        thumbnail: video.thumbnail
            ? {
                '@type': 'ImageObject',
                url: video.thumbnail,
                contentUrl: video.thumbnail,
                creator: { '@type': 'Person', name: CREATOR_NAME },
                creditText: `${CREDIT_PREFIX}${CREATOR_NAME}`,
                copyrightNotice: `© ${CURRENT_YEAR} ${BRAND.copyrightHolder || CREATOR_NAME}`,
                acquireLicensePage: LICENSE_PAGE,
            }
            : undefined,
        uploadDate: video.pubDate || undefined,
        contentUrl: video.content || undefined,
        embedUrl: video.player || undefined,
        interactionStatistic: video.view_count
            ? {
                '@type': 'InteractionCounter',
                interactionType: 'http://schema.org/WatchAction',
                userInteractionCount: Number(video.view_count),
            }
            : undefined,
        mainEntityOfPage: pageUrl,
    };
    const body = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(video.title || 'Video')}</title>
  <meta name="description" content="${escapeHtml(video.description || '')}" />
  <link rel="canonical" href="${pageUrl}" />
  <meta property="og:type" content="video.other" />
  <meta property="og:title" content="${escapeHtml(video.title || '')}" />
  <meta property="og:description" content="${escapeHtml(
        video.description || '',
    )}" />
  ${video.thumbnail
            ? `<meta property="og:image" content="${video.thumbnail}" />`
            : ''
        }
  <script type="application/ld+json">${JSON.stringify(ld, null, 2)}</script>
</head>
<body>
  <main>
    <h1>${escapeHtml(video.title || 'Video')}</h1>
    <p>${escapeHtml(video.description || '')}</p>
    <p><a href="${video.content}">Auf YouTube ansehen</a></p>
    <div class="embed">
      <iframe src="${video.player || ''
        }" width="560" height="315" frameborder="0" allowfullscreen="" title="${escapeHtml(
            video.title || '',
        )}"></iframe>
    </div>
    <p><a href="/videos/">Zurück zur Videoseite</a></p>
  </main>
</body>
</html>`;
    return body;
}

function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function ensureSitemapEntries(videos) {
    let xml = String(await fs.readFile(SITEMAP, 'utf8'));
    for (const v of videos) {
        const pageLoc = `https://www.abdulkerimsesli.de/videos/${v.vid}/`;
        if (xml.includes(`<loc>${pageLoc}</loc>`)) continue; // already present

        // Build a <url> block with video data
        const videoBlock = [];
        videoBlock.push('  <url>');
        videoBlock.push(`    <loc>${pageLoc}</loc>`);
        videoBlock.push(
            `    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>`,
        );
        videoBlock.push('    <changefreq>weekly</changefreq>');
        videoBlock.push('    <priority>0.8</priority>');
        videoBlock.push('');
        videoBlock.push('    <video:video>');
        if (v.thumbnail)
            videoBlock.push(
                `      <video:thumbnail_loc>${v.thumbnail}</video:thumbnail_loc>`,
            );
        if (v.title)
            videoBlock.push(`      <video:title>${escapeXml(v.title)}</video:title>`);
        if (v.description)
            videoBlock.push(
                `      <video:description>${escapeXml(
                    v.description,
                )}</video:description>`,
            );
        if (v.content)
            videoBlock.push(
                `      <video:content_loc>${v.content}</video:content_loc>`,
            );
        if (v.player)
            videoBlock.push(`      <video:player_loc>${v.player}</video:player_loc>`);
        if (v.duration)
            videoBlock.push(`      <video:duration>${v.duration}</video:duration>`);
        if (v.pubDate)
            videoBlock.push(
                `      <video:publication_date>${v.pubDate}</video:publication_date>`,
            );
        if (v.view_count)
            videoBlock.push(
                `      <video:view_count>${v.view_count}</video:view_count>`,
            );
        videoBlock.push('      <video:family_friendly>yes</video:family_friendly>');
        videoBlock.push(
            '      <video:requires_subscription>no</video:requires_subscription>',
        );
        videoBlock.push('    </video:video>');
        videoBlock.push('');
        videoBlock.push('  </url>');

        // Insert before closing </urlset>
        xml = xml.replace(/<\/urlset>/, videoBlock.join('\n') + '\n\n</urlset>');
    }
    await fs.writeFile(SITEMAP, xml, 'utf8');
}

function escapeXml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function main() {
    const xml = await readSitemap();
    const videos = parseVideos(xml);
    if (!videos.length) {
        console.log('No videos found in sitemap');
        return;
    }

    for (const v of videos) {
        const dir = path.join(PAGES_DIR, v.vid);
        await fs.mkdir(dir, { recursive: true });
        const page = path.join(dir, 'index.html');
        const html = createLandingHtml(v);
        await fs.writeFile(page, html, 'utf8');
        console.log('Wrote page for', v.vid, '->', page);
    }

    await ensureSitemapEntries(videos);
    console.log('Sitemap updated with per-video pages');
}

if (require.main === module)
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
