/**
 * API function to handle blog comments using Cloudflare D1
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const postId = url.searchParams.get('post_id');

  if (!postId) {
    return new Response(JSON.stringify({ error: 'Missing post_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const db = env.DB_LIKES; // Sharing the same DB binding for simplicity, or use a separate if configured

    if (!db) {
      return new Response(
        JSON.stringify({ comments: [], _warning: 'DB not bound' }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const { results } = await db
      .prepare(
        'SELECT id, author_name, content, created_at FROM blog_comments WHERE post_id = ? ORDER BY created_at DESC',
      )
      .bind(postId)
      .all();

    return new Response(JSON.stringify({ comments: results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { post_id, author_name, content } = body;

    if (!post_id || !author_name || !content) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Basic spam protection: simple length check
    if (content.length > 1000 || author_name.length > 50) {
      return new Response(JSON.stringify({ error: 'Content too long' }), {
        status: 400,
      });
    }

    const db = env.DB_LIKES;

    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not available' }), {
        status: 500,
      });
    }

    const result = await db
      .prepare(
        'INSERT INTO blog_comments (post_id, author_name, content) VALUES (?, ?, ?) RETURNING id, created_at',
      )
      .bind(post_id, author_name, content)
      .first();

    return new Response(
      JSON.stringify({
        success: true,
        comment: {
          id: result.id,
          post_id,
          author_name,
          content,
          created_at: result.created_at,
        },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error adding comment:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
