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

    // Fail hard if DB binding is missing so UI can react correctly.
    if (!db) {
      console.warn('DB_LIKES binding is missing. Ensure D1 is configured.');
      return new Response(
        JSON.stringify({ error: 'DB_LIKES binding missing' }),
        {
          status: 503,
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
    } catch {
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
    const sourceIp = String(
      request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For') ||
        '',
    ).trim();
    const userAgent = String(request.headers.get('User-Agent') || '').trim();
    const requestId = String(
      request.headers.get('CF-Ray') || crypto.randomUUID(),
    ).trim();

    if (!db) {
      console.warn('DB_LIKES binding is missing. Ensure D1 is configured.');
      return new Response(
        JSON.stringify({ error: 'DB_LIKES binding missing' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    await db.batch([
      db
        .prepare(
          `
            INSERT INTO project_like_events (
              project_id,
              source_ip,
              user_agent,
              request_id
            ) VALUES (?, ?, ?, ?)
          `,
        )
        .bind(projectId, sourceIp, userAgent, requestId),
      db
        .prepare(
          `
            INSERT INTO project_likes (project_id, likes)
            VALUES (?, 1)
            ON CONFLICT(project_id) DO UPDATE SET likes = likes + 1
          `,
        )
        .bind(projectId),
    ]);

    const result = await db
      .prepare('SELECT likes FROM project_likes WHERE project_id = ?')
      .bind(projectId)
      .first();

    return new Response(JSON.stringify({ likes: Number(result?.likes) || 0 }), {
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
