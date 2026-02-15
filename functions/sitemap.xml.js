export async function onRequest(context) {
  const url = new URL(context.request.url);
  const origin = url.origin; // e.g. https://www.abdulkerimsesli.de
  const today = new Date().toISOString().split('T')[0];

  // List of main pages
  const pages = [
    { loc: '/', priority: 1.0, freq: 'weekly' },
    { loc: '/gallery/', priority: 0.8, freq: 'weekly' },
    { loc: '/videos/', priority: 0.8, freq: 'weekly' },
    { loc: '/projekte/', priority: 0.7, freq: 'monthly' },
    { loc: '/blog/', priority: 0.7, freq: 'monthly' },
    { loc: '/about/', priority: 0.6, freq: 'yearly' },
    { loc: '/impressum/', priority: 0.1, freq: 'yearly' },
    { loc: '/datenschutz/', priority: 0.1, freq: 'yearly' },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // 1. Add static pages
  for (const page of pages) {
    xml += `
  <url>
    <loc>${origin}${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.freq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  }

  // 2. Add video sitemap reference is handled via robots.txt,
  // BUT: Some search engines prefer a sitemap index if multiple files exist.
  // However, `sitemap.xml` is usually just a list of URLs.
  // If we want a sitemap index, this file should be named sitemap_index.xml or similar.
  // Given the user request, we keep sitemap.xml as a simple URL list + link to special sitemaps in robots.txt.
  // The plan was to make sitemap.xml dynamic to include all pages.

  xml += `
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'noindex',
    },
  });
}
