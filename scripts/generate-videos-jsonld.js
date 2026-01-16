/*
Generates a server-side JSON-LD VideoObject list from sitemap-videos.xml and injects
it into /pages/videos/index.html. This helps Google find and index all videos on the
page without relying on client-side JavaScript execution.

Usage: node scripts/generate-videos-jsonld.js
*/
const fs = require('fs/promises');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SITEMAP = path.join(PROJECT_ROOT, 'sitemap-videos.xml');
const PAGE = path.join(PROJECT_ROOT, 'pages', 'videos', 'index.html');

function secToIsoDuration(sec) {
    // sec may be integer seconds
    if (!sec && sec !== 0) return undefined;
    sec = Number(sec) || 0;
    let s = sec % 60;
    let m = Math.floor((sec % 3600) / 60);
    let h = Math.floor(sec / 3600);
    let out = 'PT';
    if (h) out += h + 'H';
    if (m) out += m + 'M';
    if (s || (!h && !m)) out += s + 'S';
    return out;
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
            const title = get('title');
            const description = get('description');
            const content = get('content_loc');
            const player = get('player_loc');
            const duration = get('duration');
            const pubDate = get('publication_date');
            const view_count = get('view_count');

            // extract video id from content (youtube links)
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

            const obj = {
                '@context': 'https://schema.org',
                '@type': 'VideoObject',
                name: title || '',
                description: description || '',
                thumbnailUrl: thumbnail || undefined,
                uploadDate: pubDate || undefined,
                contentUrl: content || undefined,
                embedUrl: player || undefined,
            };
            const isoDur = duration ? secToIsoDuration(Number(duration)) : undefined;
            if (isoDur) obj.duration = isoDur;
            if (view_count) {
                obj.interactionStatistic = {
                    '@type': 'InteractionCounter',
                    interactionType: 'http://schema.org/WatchAction',
                    userInteractionCount: Number(view_count),
                };
            }
            // Add a stable mainEntityOfPage fragment so search can reference individual videos
            if (vid && pageUrl) obj.mainEntityOfPage = `${pageUrl}#video-${vid}`;

            videos.push(obj);
        }
    }
    return videos;
}

async function injectJsonLd(videos) {
    let html = String(await fs.readFile(PAGE, 'utf8'));
    const marker =
        '<script type="application/ld+json">\n      {\n        "@context": "https://schema.org",\n        "@type": "ImageObject"';
    // We'll insert after the ImageObject script block that currently exists in the head

    const insertAfter = marker;
    const idx = html.indexOf(insertAfter);
    if (idx === -1) {
        console.warn(
            'Could not find insertion anchor in videos/index.html; appending before </head>',
        );
        const jsonld = `\n    <script type="application/ld+json">\n${JSON.stringify(
            { '@context': 'https://schema.org', '@graph': videos },
            null,
            2,
        )}\n    </script>\n`;
        html = html.replace('</head>', jsonld + '\n  </head>');
    } else {
        // find end of the ImageObject script tag (closing </script>)
        const afterIdx = html.indexOf('</script>', idx);
        if (afterIdx === -1) {
            console.warn(
                'Unexpected: could not find closing </script> for marker. Appending before </head>',
            );
            const jsonld = `\n    <script type="application/ld+json">\n${JSON.stringify(
                { '@context': 'https://schema.org', '@graph': videos },
                null,
                2,
            )}\n    </script>\n`;
            html = html.replace('</head>', jsonld + '\n  </head>');
        } else {
            const insertPos = afterIdx + '</script>'.length;
            const jsonld = `\n\n    <script type="application/ld+json">\n${JSON.stringify(
                { '@context': 'https://schema.org', '@graph': videos },
                null,
                2,
            )}\n    </script>`;
            html = html.slice(0, insertPos) + jsonld + html.slice(insertPos);
        }
    }

    await fs.writeFile(PAGE, html, 'utf8');
    console.log('Injected JSON-LD into', PAGE);
}

async function main() {
    const videos = await parseSitemap();
    if (!videos.length) {
        console.warn('No videos found in sitemap');
        return;
    }
    await injectJsonLd(videos);
}

if (require.main === module)
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
