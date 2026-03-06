/**
 * Admin API to fetch overall stats: Likes and Comments
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Basic security: check for a secret token in the header
  // In a real scenario, the user should set ADMIN_TOKEN in Cloudflare dashboard
  const authHeader = request.headers.get('Authorization');
  const expectedToken = env.ADMIN_TOKEN;

  if (!expectedToken) {
    return new Response(
      JSON.stringify({
        error: 'Admin configuration error: ADMIN_TOKEN is missing',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const db = env.DB_LIKES;

    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not bound' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch project likes
    const likesResult = await db
      .prepare(
        'SELECT project_id, likes FROM project_likes ORDER BY likes DESC',
      )
      .all();

    // 2. Fetch latest comments
    const commentsResult = await db
      .prepare(
        'SELECT id, post_id, author_name, content, created_at FROM blog_comments ORDER BY created_at DESC LIMIT 50',
      )
      .all();

    return new Response(
      JSON.stringify({
        likes: likesResult.results || [],
        comments: commentsResult.results || [],
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('Admin API Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
