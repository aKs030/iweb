/**
 * YouTube Data API v3 Proxy
 * Catch-all route for YouTube API endpoints
 * @version 1.0.0
 */

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Handle CORS preflight requests
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Handle GET requests to YouTube API
 * @param {Object} context
 * @returns {Promise<Response>}
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Extract path after /api/youtube/
  const pathMatch = url.pathname.match(/^\/api\/youtube\/(.+)$/);
  if (!pathMatch) {
    return new Response(JSON.stringify({ error: 'Invalid YouTube API path' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const endpoint = pathMatch[1];
  const apiKey = env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'YouTube API key not configured',
        hint: 'Set YOUTUBE_API_KEY in Cloudflare Pages settings',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }

  try {
    // Build YouTube API URL with all query parameters
    const youtubeUrl = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);

    // Copy all query parameters from original request
    url.searchParams.forEach((value, key) => {
      youtubeUrl.searchParams.set(key, value);
    });

    // Add API key
    youtubeUrl.searchParams.set('key', apiKey);

    // Forward request to YouTube API
    const response = await fetch(youtubeUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await response.json();

    // Return response with CORS headers
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
      },
    });
  } catch (error) {
    console.error('YouTube API proxy error:', error);

    return new Response(
      JSON.stringify({
        error: 'YouTube API request failed',
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
}
