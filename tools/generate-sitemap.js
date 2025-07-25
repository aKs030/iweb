const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const BASE_URL = 'https://www.abdulkerimsesli.de';

function getHtmlFiles(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html'))
    .map(f => path.join(dir, f));
}

function buildUrl(loc) {
  // index.html → /
  if (loc === 'index.html') return '/';
  return '/' + loc;
}

function generate() {
  const files = getHtmlFiles(DOCS_DIR);
  const urls = files.map(fp => {
    const file = path.basename(fp);
    return `<url><loc>${BASE_URL}${buildUrl(file)}</loc><priority>0.8</priority></url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
              `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
              urls.join('\n') +
              `\n</urlset>`;

  fs.writeFileSync(path.join(DOCS_DIR, 'sitemap.xml'), xml, 'utf8');
  console.log(`🗺️  sitemap.xml generiert mit ${urls.length} URLs`);
}

generate();
