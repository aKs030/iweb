export async function onRequest(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const origin = url.origin;

  // Cloudflare R2 Binding
  const BUCKET = env.GALLERY_BUCKET;
  if (!BUCKET) {
    return new Response('Missing GALLERY_BUCKET binding', { status: 500 });
  }

  try {
    // List objects in the bucket
    // Prefix "Gallery/" ensures we only get gallery images
    const list = await BUCKET.list({ prefix: 'Gallery/' });
    const objects = list.objects || [];

    // Base URL for images (can be custom domain or proxy)
    // Production should use the custom domain if configured
    const R2_DOMAIN = 'https://img.abdulkerimsesli.de'; // Hardcoded for production based on config
    // Fallback: `${origin}/content/assets/img/gallery/` if needed

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

    // The gallery page itself is the location for all these images
    const loc = `${origin}/gallery/`;

    // Grouping all images under the single gallery URL is standard for image sitemaps
    // unless they appear on different pages. Here, we assume a SPA gallery.
    xml += `
  <url>
    <loc>${loc}</loc>
`;

    for (const obj of objects) {
      // Filter for image types based on extension
      if (!/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(obj.key)) continue;

      const key = obj.key;
      // Encode key for URL safety (spaces etc.)
      const encodedKey = encodeURIComponent(key).replace(/%2F/g, '/'); // Keep slashes
      const imgUrl = `${R2_DOMAIN}/${encodedKey}`;

      // Attempt to extract a title from filename
      // "Gallery/My Image.jpg" -> "My Image"
      const filename = key.split('/').pop();
      const title = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      xml += `
    <image:image>
      <image:loc>${imgUrl}</image:loc>
      <image:title>${escapeXml(title)}</image:title>
      <image:caption>${escapeXml(title)} - Abdulkerim Sesli Photography</image:caption>
      <image:license>https://abdulkerimsesli.de/#image-license</image:license>
    </image:image>`;
    }

    xml += `
  </url>
</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // 1 hour cache
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (error) {
    return new Response(`Error generating image sitemap: ${error.message}`, {
      status: 500,
    });
  }
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
    }
  });
}
