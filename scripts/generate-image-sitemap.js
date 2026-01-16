// Generates sitemap-images.xml from og-images-meta.json and static page OG meta tags.
// Usage: node scripts/generate-image-sitemap.js
// Behavior: scans pages for canonical + og:image, reads blog posts metadata, and writes sitemap-images.xml

const fs = require('fs/promises');
const path = require('path');

const BASE_URL = 'https://www.abdulkerimsesli.de';
const META_PATH = path.resolve(
    __dirname,
    '../content/assets/img/og/og-images-meta.json',
);
const OUT_PATH = path.resolve(__dirname, '../sitemap-images.xml');
const PROJECT_ROOT = path.resolve(__dirname, '..');

function today() {
    return new Date().toISOString().slice(0, 10);
}

async function readJson(p) {
    try {
        const txt = await fs.readFile(p, 'utf8');
        return JSON.parse(txt);
    } catch (e) {
        console.error('Failed to read JSON', p, e.message);
        return null;
    }
}

async function readFileSilent(p) {
    try {
        return await fs.readFile(p, 'utf8');
    } catch (e) {
        return '';
    }
}

// helper: extract canonical url from an HTML file (if present)
function extractCanonical(html) {
    const m = html.match(
        /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i,
    );
    if (m) return m[1];
    return null;
}

function extractOgImage(html) {
    const m = html.match(
        /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
    );
    if (m) return m[1];
    return null;
}

function extractOgTitle(html) {
    const m = html.match(
        /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
    );
    if (m) return m[1];
    const t = html.match(/<title>([^<]+)</i);
    if (t) return t[1].trim();
    return null;
}

async function gatherPages(_meta) {
    const pagesDir = path.join(PROJECT_ROOT, 'pages');
    const pageFiles = [];
    async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) await walk(p);
            else if (e.isFile() && e.name === 'index.html') pageFiles.push(p);
        }
    }
    await walk(pagesDir);
    // include root index.html
    pageFiles.push(path.join(PROJECT_ROOT, 'index.html'));

    const results = {};

    for (const f of pageFiles) {
        const html = await readFileSilent(f);
        const canonical =
            extractCanonical(html) ||
            (() => {
                // derive from file path
                const rel = path.relative(path.join(PROJECT_ROOT, 'pages'), f);
                if (!rel || rel.startsWith('..')) {
                    // root
                    return BASE_URL + '/';
                }
                const parts = rel.split(path.sep);
                const top = parts[0];
                return `${BASE_URL}/${top}/`;
            })();
        const img = extractOgImage(html);
        const title = extractOgTitle(html) || '';
        if (img) {
            results[canonical] = results[canonical] || { images: [], title };
            results[canonical].images.push({ src: img, title });
        }
    }

    // Extract blog posts from blog-data.js (client-side blog entries)
    const blogData = await readFileSilent(
        path.join(PROJECT_ROOT, 'pages', 'blog', 'blog-data.js'),
    );
    if (blogData) {
        const postMatches = [...blogData.matchAll(/\{([\s\S]*?)\}/g)];
        // crude but effective: parse id and image fields
        for (const m of postMatches) {
            const block = m[1];
            const idMatch = block.match(/id:\s*['"]([^'"]+)['"]/);
            const imageMatch = block.match(/image:\s*['"]([^'"]+)['"]/);
            const titleMatch = block.match(/title:\s*['"]([^'"]+)['"]/);
            if (idMatch && imageMatch) {
                const id = idMatch[1];
                const image = imageMatch[1];
                const title = (titleMatch && titleMatch[1]) || '';
                const url = `${BASE_URL}/blog/#/blog/${id}`;
                results[url] = results[url] || { images: [], title };
                results[url].images.push({ src: image, title });
            }
        }
    }

    return results;
}

function absoluteUrl(src) {
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    return BASE_URL + src;
}

function findMetaForSrc(meta, src) {
    // src might be absolute or relative; normalize to path only
    const rel = src.replace(BASE_URL, '');
    for (const k of Object.keys(meta)) {
        const m = meta[k];
        if (!m) continue;
        // check original, fallback and sources
        if (m.original === rel || m.fallback === rel) return { key: k, meta: m };
        // check sources
        for (const fmt of Object.keys(m.sources || {})) {
            for (const s of m.sources[fmt]) {
                if (s.url === rel) return { key: k, meta: m };
            }
        }
    }
    // try fuzzy match by key in path
    for (const k of Object.keys(meta)) {
        if (rel.includes(k)) return { key: k, meta: meta[k] };
    }
    return null;
}

function buildImageTag(m, _fallbackOnly = false) {
    // prefer meta.fallback (which is typically jpg or webp depending on generation)
    const images = [];
    if (!m) return images;
    const metaSources = m.sources || {};
    // include fallback first
    if (m.fallback)
        images.push({ loc: absoluteUrl(m.fallback), caption: '', title: '' });
    // include a webp if present
    if (metaSources.webp) {
        // pick the largest
        const largest = metaSources.webp.reduce(
            (acc, cur) => (cur.width > acc.width ? cur : acc),
            metaSources.webp[0],
        );
        images.push({ loc: absoluteUrl(largest.url), caption: '', title: '' });
    }
    // include jpg if present and not same as fallback
    if (metaSources.jpg) {
        const largestJ = metaSources.jpg.reduce(
            (acc, cur) => (cur.width > acc.width ? cur : acc),
            metaSources.jpg[0],
        );
        if (!images.find((i) => i.loc === absoluteUrl(largestJ.url)))
            images.push({ loc: absoluteUrl(largestJ.url), caption: '', title: '' });
    }
    return images;
}

async function readExistingExternalImages() {
    const existing = await readFileSilent(OUT_PATH);
    const externalEntries = [];
    if (!existing) return externalEntries;
    // naive parse: find url elements with image:loc that are external and keep their parent loc
    const urlBlocks = existing.split(/<url>/g).slice(1);
    for (const b of urlBlocks) {
        const images = [...b.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map(
            (m) => m[1],
        );
        const external = images.filter(
            (u) => u.startsWith('http') && !u.includes('www.abdulkerimsesli.de'),
        );
        if (external.length) {
            externalEntries.push(b); // keep whole block
        }
    }
    return externalEntries;
}

async function generate() {
    const meta = (await readJson(META_PATH)) || {};
    const pages = await gatherPages(meta);

    const externalBlocks = await readExistingExternalImages();

    const header = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n\n  <!-- Autogenerated from og-images-meta.json -->\n`;

    let body = '';
    const writtenPages = new Set();

    for (const [pageUrl, data] of Object.entries(pages)) {
        const imagesForPage = [];
        for (const img of data.images) {
            const found = findMetaForSrc(meta, img.src);
            if (found) {
                const imgs = buildImageTag(found.meta);
                imgs.forEach((i) => imagesForPage.push(i));
            } else {
                // include the image as-is
                imagesForPage.push({
                    loc: img.src.startsWith('http') ? img.src : absoluteUrl(img.src),
                    caption: '',
                    title: '',
                });
            }
        }
        // dedupe
        const dedup = Array.from(
            new Map(imagesForPage.map((i) => [i.loc, i])).values(),
        );
        if (!dedup.length) continue;
        writtenPages.add(pageUrl);

        body += `  <url>\n    <loc>${pageUrl}</loc>\n    <lastmod>${today()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n`;
        for (const img of dedup) {
            body += `    <image:image>\n      <image:loc>${img.loc
                }</image:loc>\n      <image:caption>${(data.title || '').replace(
                    /&/g,
                    '&amp;',
                )}</image:caption>\n      <image:title>${(data.title || '').replace(
                    /&/g,
                    '&amp;',
                )}</image:title>\n      <image:license>${BASE_URL}/#image-license</image:license>\n    </image:image>\n`;
        }
        body += `  </url>\n\n`;
    }

    // Optionally include a homepage entry if not found
    if (!writtenPages.has(BASE_URL + '/')) {
        const homeKeyCandidates = Object.keys(meta).filter((k) =>
            k.startsWith('og-home'),
        );
        if (homeKeyCandidates.length) {
            const hk = meta[homeKeyCandidates[0]];
            const imgs = buildImageTag(hk);
            if (imgs.length) {
                body += `  <url>\n    <loc>${BASE_URL}/</loc>\n    <lastmod>${today()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n`;
                for (const img of imgs) {
                    body += `    <image:image>\n      <image:loc>${img.loc}</image:loc>\n      <image:caption>Home</image:caption>\n      <image:title>Home</image:title>\n      <image:license>${BASE_URL}/#image-license</image:license>\n    </image:image>\n`;
                }
                body += `  </url>\n\n`;
            }
        }
    }

    // append external blocks unchanged
    if (externalBlocks.length) {
        body += `  <!-- Preserved external image blocks (e.g., Unsplash) -->\n`;
        for (const b of externalBlocks)
            body += `  <url>${b.split('</url>')[0]}  </url>\n\n`;
    }

    const footer = `</urlset>`;

    const out = header + body + footer;
    await fs.writeFile(OUT_PATH, out, 'utf8');
    console.log('Wrote', OUT_PATH);
}

if (require.main === module) {
    generate().catch((err) => {
        console.error('Failed to generate sitemap', err);
        process.exit(1);
    });
}
