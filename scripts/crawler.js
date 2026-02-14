/**
 * Website Crawler for Vectorize Indexing
 * Crawls website content and generates embeddings for semantic search
 * @version 1.0.0
 */

import { JSDOM } from 'jsdom';
import { writeFileSync } from 'fs';

const BASE_URL = 'https://abdulkerimsesli.de';
const OUTPUT_FILE = 'scripts/crawled-content.json';

// Pages to crawl
const PAGES = [
  '/',
  '/projekte',
  '/blog',
  '/gallery',
  '/videos',
  '/about',
  '/contact',
  // Blog posts
  '/blog/css-container-queries',
  '/blog/javascript-performance-patterns',
  '/blog/modern-ui-design',
  '/blog/progressive-web-apps-2026',
  '/blog/react-no-build',
  '/blog/seo-technische-optimierung',
  '/blog/threejs-performance',
  '/blog/typescript-advanced-patterns',
  '/blog/visual-storytelling',
  '/blog/web-components-zukunft',
];

/**
 * Extract clean text content from HTML
 */
function extractContent(html, url) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Remove unwanted elements
  const unwanted = doc.querySelectorAll(
    'script, style, nav, header, footer, .menu, .search, .robot-companion',
  );
  unwanted.forEach((el) => el.remove());

  // Get main content
  const main = doc.querySelector('main') || doc.body;
  let text = main.textContent || '';

  // Clean up text
  text = text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\n+/g, '\n') // Normalize newlines
    .trim();

  // Extract metadata
  const title =
    doc.querySelector('title')?.textContent ||
    doc.querySelector('h1')?.textContent ||
    '';
  const description =
    doc.querySelector('meta[name="description"]')?.content || '';

  // Determine category
  let category = 'Seite';
  if (url.includes('/projekte')) category = 'Projekte';
  else if (url.includes('/blog')) category = 'Blog';
  else if (url.includes('/gallery')) category = 'Gallery';
  else if (url.includes('/videos')) category = 'Videos';
  else if (url.includes('/about')) category = 'About';
  else if (url.includes('/contact')) category = 'Contact';
  else if (url === '/') category = 'Home';

  return {
    url,
    title: title.trim(),
    description: description.trim(),
    category,
    content: text.substring(0, 2000), // Limit content length
    timestamp: new Date().toISOString(),
  };
}

/**
 * Crawl all pages
 */
async function crawl() {
  console.log('🕷️  Starting crawler...\n');

  const results = [];

  for (const path of PAGES) {
    const url = `${BASE_URL}${path}`;
    console.log(`Crawling: ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`  ❌ Failed: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const content = extractContent(html, path);

      results.push(content);
      console.log(`  ✅ Extracted: ${content.title}`);
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  // Save results
  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n✅ Crawled ${results.length} pages`);
  console.log(`📄 Saved to: ${OUTPUT_FILE}`);
  console.log('\nNext: Run indexer to upload to Vectorize');
}

crawl().catch(console.error);
