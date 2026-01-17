const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '../pages/blog');
const OUTPUT_FILE = path.join(BLOG_DIR, 'blog-index.json');

const CATEGORY_OVERRIDES = {
  'threejs-performance': 'Performance',
  'react-no-build': 'Webdesign',
  'modern-ui-design': 'Webdesign',
  'visual-storytelling': 'Online-Marketing',
};

function parseDate(isoString) {
    if (!isoString) return '';
    return isoString.split('T')[0];
}

// Function to format date for display (e.g. "15. Dezember 2025")
function formatDateDisplay(isoString) {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    } catch (e) {
        return isoString;
    }
}

function extractMetadata(html, id) {
    // 1. Try to extract JSON-LD
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    let ldData = {};
    if (jsonLdMatch && jsonLdMatch[1]) {
        try {
            ldData = JSON.parse(jsonLdMatch[1]);
        } catch (e) {
            console.error(`Failed to parse JSON-LD for ${id}`, e);
        }
    }

    // 2. Fallbacks using Regex
    const titleMatch = html.match(/<title>(.*?)<\/title>/) || html.match(/<h1>(.*?)<\/h1>/);
    const descMatch = html.match(/<meta name="description" content="(.*?)"/);
    const imgMatch = html.match(/<meta property="og:image" content="(.*?)"/);

    // Normalize Data
    const title = ldData.headline || (titleMatch ? titleMatch[1].split('—')[0].trim() : id);
    const excerpt = ldData.description || (descMatch ? descMatch[1] : '');
    const date = parseDate(ldData.datePublished);
    const dateDisplay = formatDateDisplay(ldData.datePublished);
    const image = ldData.image || (imgMatch ? imgMatch[1] : '');
    const category = CATEGORY_OVERRIDES[id] || 'Artikel';

    // Calculate Read Time (simple word count)
    // Strip tags
    const cleanText = html.replace(/<[^>]*>/g, ' ');
    const wordCount = cleanText.split(/\s+/).length;
    const readTime = `${Math.max(1, Math.round(wordCount / 200))} min`;

    return {
        id,
        title,
        excerpt,
        date,
        dateDisplay,
        category,
        image,
        readTime
    };
}

async function main() {
    console.log('Generating blog index...');

    const entries = fs.readdirSync(BLOG_DIR, { withFileTypes: true });
    const posts = [];

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const id = entry.name;
            const indexHtmlPath = path.join(BLOG_DIR, id, 'index.html');

            if (fs.existsSync(indexHtmlPath)) {
                console.log(`Processing ${id}...`);
                const html = fs.readFileSync(indexHtmlPath, 'utf-8');
                const postData = extractMetadata(html, id);
                posts.push(postData);
            }
        }
    }

    // Sort by date descending
    posts.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date) - new Date(a.date);
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(posts, null, 2));
    console.log(`Successfully generated index with ${posts.length} posts at ${OUTPUT_FILE}`);
}

main().catch(console.error);
