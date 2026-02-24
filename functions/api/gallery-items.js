export async function onRequest(context) {
  const { env } = context;
  const url = new URL(context.request.url);

  const BUCKET = env.GALLERY_BUCKET;
  if (!BUCKET) {
    return new Response(
      JSON.stringify({ error: 'Gallery Bucket not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    const objects = [];
    let cursor;

    do {
      const list = await BUCKET.list({ prefix: 'Gallery/', cursor });
      if (list.objects) {
        objects.push(...list.objects);
      }
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);

    // Base URL for images
    // Use environment variable or default to custom domain
    // During local dev, use relative proxy path
    const isLocal =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const R2_BASE = isLocal ? '/r2-proxy' : 'https://img.abdulkerimsesli.de';

    const items = objects
      .filter((obj) => /\.(jpg|jpeg|png|webp|gif|svg|mp4|webm)$/i.test(obj.key))
      .map((obj) => {
        const key = obj.key;
        const filename = key.split('/').pop();
        const type = /\.(mp4|webm)$/i.test(filename) ? 'video' : 'image';

        // "Gallery/My Image.jpg" -> "My Image"
        const title = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        return {
          id: key, // Unique ID
          type: type,
          url: `${R2_BASE}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
          title: title,
          description: `Taken by Abdulkerim Sesli`, // Default description
          size: obj.size,
          uploaded: obj.uploaded,
        };
      });

    // Sort by upload date (newest first)
    items.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));

    return new Response(JSON.stringify({ items }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600', // Cache 10 minutes
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Gallery API error:', err);
    return new Response(JSON.stringify({ error: 'Gallery request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
