export async function onRequest(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const origin = url.origin;

  // Configuration
  const CHANNEL_ID = env.YOUTUBE_CHANNEL_ID;
  const API_KEY = env.YOUTUBE_API_KEY;
  const MAX_RESULTS = 50; // Google recommends limit per sitemap

  if (!CHANNEL_ID || !API_KEY) {
    return new Response(
      'Missing configuration (YOUTUBE_CHANNEL_ID or YOUTUBE_API_KEY)',
      { status: 500 },
    );
  }

  try {
    // 1. Get "Uploads" playlist ID
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?id=${CHANNEL_ID}&key=${API_KEY}&part=contentDetails`;
    const channelRes = await fetch(channelUrl);

    if (!channelRes.ok) {
      throw new Error(`YouTube API Error: ${channelRes.status}`);
    }

    const channelData = await channelRes.json();
    if (!channelData.items || channelData.items.length === 0) {
      return new Response('YouTube Channel not found', { status: 404 });
    }

    const uploadsPlaylistId =
      channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // 2. Fetch videos from the uploads playlist
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${uploadsPlaylistId}&key=${API_KEY}&part=snippet&maxResults=${MAX_RESULTS}`;
    const playlistRes = await fetch(playlistUrl);

    if (!playlistRes.ok) {
      throw new Error(`YouTube Playlist API Error: ${playlistRes.status}`);
    }

    const playlistData = await playlistRes.json();
    const items = playlistData.items || [];

    // 3. Generate XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
`;

    for (const item of items) {
      const snippet = item.snippet;
      const videoId = snippet.resourceId.videoId;
      const title = escapeXml(snippet.title);
      // Fallback description if empty
      const description = escapeXml(snippet.description || title);
      const thumbnail =
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        '';
      const pubDate = snippet.publishedAt; // ISO 8601 format is required by Google

      // The page where the video is embedded (Landing Page)
      // Using the dedicated video page route if available, or anchor on videos page
      const loc = `${origin}/videos/${videoId}/`;

      // The player URL (embed)
      const playerLoc = `https://www.youtube.com/embed/${videoId}`;

      // Basic validation: ensure we have critical fields
      if (videoId && title && thumbnail) {
        xml += `
  <url>
    <loc>${loc}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumbnail)}</video:thumbnail_loc>
      <video:title>${title}</video:title>
      <video:description>${description}</video:description>
      <video:player_loc autoplay="ap=1">${playerLoc}</video:player_loc>
      <video:publication_date>${pubDate}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:requires_subscription>no</video:requires_subscription>
      <video:uploader info="https://www.youtube.com/channel/${CHANNEL_ID}">${escapeXml(snippet.channelTitle)}</video:uploader>
      <video:live>no</video:live>
    </video:video>
  </url>`;
      }
    }

    xml += `
</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour at edge
        'X-Robots-Tag': 'noindex', // Sitemap itself shouldn't be indexed as a page
      },
    });
  } catch (error) {
    return new Response(`Error generating sitemap: ${error.message}`, {
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
