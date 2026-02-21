/**
 * RSS Feed Generator
 * GET /api/feed.xml
 * Generates an RSS 2.0 feed from blog post index
 */

import { escapeXml } from './_xml-utils.js';

const SITE_URL = 'https://abdulkerimsesli.de';
const FEED_TITLE = 'Abdulkerim Sesli — Blog';
const FEED_DESCRIPTION =
  'Praxisnahe Tipps zu Webdesign, SEO, Performance und Online-Marketing.';

export async function onRequestGet({ request }) {
  try {
    const origin = new URL(request.url).origin;
    const indexUrl = `${origin}/pages/blog/posts/index.json`;

    const response = await fetch(indexUrl);
    if (!response.ok) {
      return new Response('Blog index not available', { status: 502 });
    }

    const posts = await response.json();

    // Sort by date descending
    const sorted = [...posts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const lastBuildDate = sorted.length
      ? new Date(sorted[0].date).toUTCString()
      : new Date().toUTCString();

    const items = sorted
      .map((post) => {
        const link = `${SITE_URL}/blog/${post.id}`;
        const pubDate = new Date(post.date).toUTCString();
        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(post.excerpt || post.seoDescription)}</description>
      <category>${escapeXml(post.category)}</category>
    </item>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${SITE_URL}/blog/</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>de</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/api/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('RSS feed error:', err);
    return new Response('Feed generation failed', { status: 500 });
  }
}
