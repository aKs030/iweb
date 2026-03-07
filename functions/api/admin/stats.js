/**
 * Admin API to fetch overall stats: Likes and Comments
 */
export async function onRequestGet(context) {
  const { request, env } = context;

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

    // 3. Fetch latest contact messages
    const contactsResult = await db
      .prepare(
        'SELECT id, name, email, subject, message, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 50',
      )
      .all();

    // 4. Fetch Robot Memories (KV)
    // We try to find the memory KV binding
    const memoryKv =
      env.JULES_MEMORY_KV || env.RATE_LIMIT_KV || env.SITEMAP_CACHE_KV;
    const aiMemories = [];
    const nameMappings = [];

    if (memoryKv) {
      try {
        // List user memories
        const memoryList = await memoryKv.list({
          prefix: 'robot-memory:',
          limit: 50,
        });
        for (const key of memoryList.keys) {
          const value = await memoryKv.get(key.name);
          try {
            const parsed = JSON.parse(value);
            aiMemories.push({
              userId: key.name.replace('robot-memory:', ''),
              memories: Array.isArray(parsed) ? parsed : [],
            });
          } catch {
            // Not JSON
          }
        }

        // List name mappings
        const nameList = await memoryKv.list({
          prefix: 'username:',
          limit: 50,
        });
        for (const key of nameList.keys) {
          const userId = await memoryKv.get(key.name);
          nameMappings.push({
            name: key.name.replace('username:', ''),
            userId: userId,
          });
        }
      } catch (kvError) {
        console.error('KV Fetch Error:', kvError);
      }
    }

    return new Response(
      JSON.stringify({
        likes: likesResult.results || [],
        comments: commentsResult.results || [],
        contacts: contactsResult.results || [],
        aiMemories,
        nameMappings,
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
