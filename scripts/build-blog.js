const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// Configuration
const POSTS_DIR = path.join(__dirname, '../content/posts');
const OUTPUT_DIR_JSON = path.join(__dirname, '../content/blog');
const PAGES_BLOG_DIR = path.join(__dirname, '../pages/blog');

// Ensure output directories exist
if (!fs.existsSync(OUTPUT_DIR_JSON)) {
  fs.mkdirSync(OUTPUT_DIR_JSON, { recursive: true });
}

// Helpers
function parseFrontmatter(content) {
  const match = content.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const metaRaw = match[1];
  const body = match[2];
  const meta = {};

  metaRaw.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  });

  return { meta, body };
}

function estimateReadTime(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min`;
}

// Helper to escape HTML for JSON strings to avoid invalid JSON if needed,
// though standard JSON.stringify handles this.
// However, we need to ensure the HTML itself is safe if we were accepting user input,
// but here it is our own content.

function generateBlogArtifacts() {
  console.log('🏗️  Starting Blog Build...');

  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`❌ Posts directory not found: ${POSTS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  const posts = [];

  console.log(`📝 Found ${files.length} posts.`);

  files.forEach(file => {
    const id = file.replace('.md', '');
    const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(content);

    // Convert Markdown to HTML for the individual JSON/HTML payload
    const htmlBody = marked.parse(body);

    const post = {
      id,
      title: meta.title || id,
      date: meta.date, // YYYY-MM-DD
      dateDisplay: new Date(meta.date).toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }),
      category: meta.category || 'Allgemein',
      image: meta.image || '',
      excerpt: meta.excerpt || '',
      readTime: estimateReadTime(body),
      content: body, // Keep raw MD for potentially other uses if needed, or remove to save size
      html: htmlBody
    };

    posts.push(post);

    // 1. Generate Static HTML Page (SEO)
    // We will read the generic blog template or the specific existing one and update content.
    // For simplicity and robustness, we use a template string here that mirrors the site structure.
    // In a real SSG this would be more complex, but here we just want to ensure SEO tags are correct.

    const outputDir = path.join(PAGES_BLOG_DIR, id);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Reconstruct the full HTML file
    const htmlContent = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${post.title} — Abdulkerim Sesli</title>
  <meta name="description" content="${post.excerpt.replace(/"/g, '&quot;')}" />
  <link rel="canonical" href="https://www.abdulkerimsesli.de/blog/${id}/" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${post.title}" />
  <meta property="og:description" content="${post.excerpt.replace(/"/g, '&quot;')}" />
  <meta property="og:image" content="https://www.abdulkerimsesli.de${post.image}" />
  <meta property="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${post.title}" />
  <meta name="twitter:description" content="${post.excerpt.replace(/"/g, '&quot;')}" />
  <meta name="twitter:image" content="https://www.abdulkerimsesli.de${post.image}" />
  <script type="application/ld+json">{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://www.abdulkerimsesli.de/blog/${id}/"
  },
  "headline": "${post.title}",
  "description": "${post.excerpt.replace(/"/g, '\\"')}",
  "datePublished": "${new Date(post.date).toISOString()}",
  "dateModified": "${new Date(post.date).toISOString()}",
  "author": {
    "@type": "Person",
    "name": "Abdulkerim Sesli"
  },
  "image": "https://www.abdulkerimsesli.de${post.image}"
}</script>

  <!-- Site styles & blog styles -->
  <link rel="stylesheet" href="/content/styles/root.css" />
  <link rel="stylesheet" href="/content/styles/main.css" />
  <link rel="stylesheet" href="/pages/blog/blog.css" />
  <link rel="stylesheet" href="/content/components/menu/menu.css" />


  <!-- Head scripts (GTM, menu, footer loader et al.) -->
  <script type="module" src="/content/components/head/head-inline.js"></script>
  <script type="module" src="/content/main.js" crossorigin="anonymous"></script>
</head>
<body>
  <!-- Static header (for No-JS & better SEO/first-paint) -->
  <header class="site-header">
    <!-- SVG sprite (inlined for icons when JS is disabled) -->
    <svg aria-hidden="true" style="position: absolute; width: 0; height: 0; overflow: hidden" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <symbol id="icon-house" viewBox="0 0 576 512"><path fill="currentColor" d="M541 229.16 512 205.26V64a32 32 0 0 0-32-32h-64a32 32 0 0 0-32 32v24.6L314.52 43a35.93 35.93 0 0 0-45 0L35 229.16a16 16 0 0 0-2 22.59l21.4 25.76a16 16 0 0 0 22.59 2L96 264.86V456a32 32 0 0 0 32 32h128V344a16 16 0 0 1 16-16h64a16 16 0 0 1 16 16v144h128a32 32 0 0 0 32-32V264.86l19 14.65a16 16 0 0 0 22.59-2l21.4-25.76a16 16 0 0 0-2-22.59Z"/></symbol>
        <symbol id="icon-images" viewBox="0 0 576 512"><path fill="currentColor" d="M480 416V80a48 48 0 0 0-48-48H80a48 48 0 0 0-48 48v336H16a16 16 0 0 0 0 32h448a16 16 0 0 0 0-32ZM64 416V80a16 16 0 0 1 16-16h352a16 16 0 0 1 16 16v336Zm96-80 64-80 48 64 64-80 80 96H160Zm48-144a40 40 0 1 1-40-40 40 40 0 0 1 40 40Zm368-96v304a16 16 0 0 1-16 16h-16v-32h16V96H496V64h16a16 16 0 0 1 16 16Z"/></symbol>
        <symbol id="icon-user" viewBox="0 0 448 512"><path fill="currentColor" d="M224 256A128 128 0 1 0 96 128a128 128 0 0 0 128 128Zm89.6 32h-11.7a174.64 174.64 0 0 1-155.8 0h-11.7A134.4 134.4 0 0 0 0 422.4 57.6 57.6 0 0 0 57.6 480h332.8A57.6 57.6 0 0 0 448 422.4 134.4 134.4 0 0 0 313.6 288Z"/></symbol>
        <symbol id="icon-mail" viewBox="0 0 512 512"><path fill="currentColor" d="M48 64C21.5 64 0 85.5 0 112v288c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zM48 96h416c8.8 0 16 7.2 16 16v41.4L288 264.4c-11.3 8.5-26.7 8.5-38 0L32 153.4V112c0-8.8 7.2-16 16-16zm0 320v-222l176 132c22.5 16.9 53.5 16.9 76 0l176-132v222c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16z"/></symbol>
      </defs>
    </svg>

    <div class="skip-links">
      <a href="#main-content" class="skip-link">Zum Hauptinhalt springen</a>
      <a href="#navigation" class="skip-link">Zur Navigation springen</a>
    </div>

    <a href="/" class="site-logo-link" title="Abdulkerim Sesli">
      <span class="site-logo__container u-inline-center">
        <!-- Inline SVG logo: AKS monogram for crisp LCP and scalability -->
        <svg class="site-logo-svg" width="40" height="40" viewBox="0 0 100 100" role="img" aria-label="Abdulkerim Sesli logo" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="48" fill="#0B74DE" />
          <text x="50" y="60" text-anchor="middle" font-family="var(--font-primary, system-ui, sans-serif)" font-size="42" fill="#fff" font-weight="700">AKS</text>
        </svg>
        <span class="site-logo elegant-logo" id="site-title"><span class="visually-hidden">Startseite</span></span>
        <span class="site-subtitle" id="site-subtitle"></span>
      </span>
    </a>

    <main id="main-content" class="container-article">
      <article class="blog-article">
      <header class="article-header">
        <h1>${post.title}</h1>
        <p class="article-meta"><em>${post.dateDisplay}</em></p>
      </header>

      <div class="article-body">
        ${htmlBody}
      </div>

      <p><a href="/blog/">Zurück zum Blog</a></p>
    </article>
  </main>

  <!-- Footer container (loaded lazily by footer loader) -->
  <div id="footer-container" data-footer-src="/content/components/footer/footer"></div>
</body>
</html>`;

    fs.writeFileSync(path.join(outputDir, 'index.html'), htmlContent);
    console.log(`✅ Generated HTML: pages/blog/${id}/index.html`);
  });

  // 2. Generate Global Blog Index JSON (Lightweight for list view)
  const indexPayload = posts
    .sort((a, b) => new Date(b.date) - new Date(a.date)) // Newest first
    .map(p => ({
      id: p.id,
      title: p.title,
      date: p.date,
      dateDisplay: p.dateDisplay,
      category: p.category,
      image: p.image,
      excerpt: p.excerpt,
      readTime: p.readTime,
      html: p.html // Include HTML here for the SPA to be instant.
                   // If blog grows > 50 posts, we should split this.
                   // For now (4 posts), bundling content is the fastest UX.
    }));

  const indexPath = path.join(OUTPUT_DIR_JSON, 'blog-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(indexPayload, null, 2));
  console.log(`✅ Generated Index: content/blog/blog-index.json (${files.length} items)`);
}

generateBlogArtifacts();
