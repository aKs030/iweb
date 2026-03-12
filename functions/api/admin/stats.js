const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  return String(error || 'Unknown error');
}

function buildWarning(section, error, code = 'query_failed') {
  const detail = getErrorMessage(error);
  const isMissingTable = /no such table/i.test(detail);

  return {
    section,
    code: isMissingTable ? 'missing_table' : code,
    message: isMissingTable
      ? `Der Bereich "${section}" ist noch nicht migriert.`
      : `Der Bereich "${section}" konnte nicht geladen werden.`,
    detail,
  };
}

async function queryResults(db, query, section, warnings) {
  try {
    const result = await db.prepare(query).all();
    return result.results || [];
  } catch (error) {
    console.error(`Admin stats query failed for ${section}:`, error);
    warnings.push(buildWarning(section, error));
    return [];
  }
}

async function loadMemoryData(env, warnings) {
  const memoryKv =
    env.JULES_MEMORY_KV || env.RATE_LIMIT_KV || env.SITEMAP_CACHE_KV;

  if (!memoryKv?.list || !memoryKv?.get) {
    return { aiMemories: [], nameMappings: [] };
  }

  const aiMemories = [];
  const nameMappings = [];

  try {
    const memoryList = await memoryKv.list({
      prefix: 'robot-memory:',
      limit: 50,
    });

    for (const key of memoryList.keys || []) {
      const value = await memoryKv.get(key.name);

      try {
        const parsed = JSON.parse(value);
        aiMemories.push({
          userId: key.name.replace('robot-memory:', ''),
          memories: Array.isArray(parsed) ? parsed : [],
        });
      } catch {
        // Ignore malformed KV entries instead of failing the dashboard.
      }
    }

    const nameList = await memoryKv.list({
      prefix: 'username:',
      limit: 50,
    });

    for (const key of nameList.keys || []) {
      const userId = await memoryKv.get(key.name);
      nameMappings.push({
        name: key.name.replace('username:', ''),
        userId: userId || '',
      });
    }
  } catch (error) {
    console.error('Admin stats KV fetch failed:', error);
    warnings.push(buildWarning('kv', error, 'kv_failed'));
  }

  return { aiMemories, nameMappings };
}

/**
 * Admin API to fetch overall stats: Likes and Comments
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization');
  const expectedToken = String(env?.ADMIN_TOKEN || '').trim();

  if (!expectedToken) {
    return jsonResponse(
      {
        error: 'Admin configuration error: ADMIN_TOKEN is missing',
        code: 'admin_token_missing',
      },
      500,
    );
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return jsonResponse(
      {
        error: 'Unauthorized',
        code: 'unauthorized',
      },
      401,
    );
  }

  try {
    const warnings = [];
    const db = env.DB_LIKES;

    let likes = [];
    let comments = [];
    let contacts = [];

    if (db?.prepare) {
      likes = await queryResults(
        db,
        'SELECT project_id, likes FROM project_likes ORDER BY likes DESC',
        'likes',
        warnings,
      );
      comments = await queryResults(
        db,
        'SELECT id, post_id, author_name, content, created_at FROM blog_comments ORDER BY created_at DESC LIMIT 50',
        'comments',
        warnings,
      );
      contacts = await queryResults(
        db,
        'SELECT id, name, email, subject, message, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 50',
        'contacts',
        warnings,
      );
    } else {
      warnings.push({
        section: 'database',
        code: 'missing_binding',
        message: 'Die D1-Bindung DB_LIKES ist nicht verfügbar.',
        detail: 'Missing DB_LIKES binding',
      });
    }

    const { aiMemories, nameMappings } = await loadMemoryData(env, warnings);

    return jsonResponse({
      likes,
      comments,
      contacts,
      aiMemories,
      nameMappings,
      warnings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin API Error:', error);
    return jsonResponse(
      {
        error: 'Internal Server Error',
        details: getErrorMessage(error),
      },
      500,
    );
  }
}
