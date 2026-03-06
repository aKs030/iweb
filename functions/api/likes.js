/**
 * API function to handle rating/likes of portfolio projects using Cloudflare D1
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');

  if (!projectId) {
    return new Response(JSON.stringify({ error: 'Missing project_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const db = env.DB_LIKES;

    // Warn if DB binding is not yet available
    if (!db) {
      console.warn('DB_LIKES binding is missing. Ensure D1 is configured.');
      return new Response(
        JSON.stringify({ likes: 0, _warning: 'DB not bound' }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const result = await db
      .prepare('SELECT likes FROM project_likes WHERE project_id = ?')
      .bind(projectId)
      .first();

    const likes = result ? result.likes : 0;

    return new Response(JSON.stringify({ likes }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching likes:', error);
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

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  let projectId = url.searchParams.get('project_id');

  if (!projectId) {
    try {
      const body = await request.json();
      if (body.project_id) {
        projectId = body.project_id;
      }
    } catch (e) {
      // ignore
    }
  }

  if (!projectId) {
    return new Response(
      JSON.stringify({ error: 'Missing project_id in query or body' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    const db = env.DB_LIKES;

    if (!db) {
      console.warn('DB_LIKES binding is missing. Ensure D1 is configured.');
      return new Response(
        JSON.stringify({ likes: 1, _warning: 'DB not bound, simulated like' }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Insert or update likes
    const result = await db
      .prepare(
        `
        INSERT INTO project_likes (project_id, likes)
        VALUES (?, 1)
        ON CONFLICT(project_id) DO UPDATE SET likes = likes + 1
        RETURNING likes
      `,
      )
      .bind(projectId)
      .first();

    return new Response(JSON.stringify({ likes: result.likes }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error adding like:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
