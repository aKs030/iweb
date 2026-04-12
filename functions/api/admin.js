import { createLogger } from '../../content/core/logger.js';

const log = createLogger('admin');
/**
 * Admin Dashboard API — POST /api/admin
 * Protected by Bearer token (env.ADMIN_TOKEN).
 * Provides read/write access to D1, KV, R2, and Vectorize resources.
 *
 * Reuses logic from ai-agent-user.js to avoid duplication.
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import { jsonResponse, errorJsonResponse } from './_response.js';
import { getMemoryKV, loadFallbackMemories } from './_ai-agent-memory-store.js';
import {
  updateSingleMemory,
  forgetSingleMemory,
  deleteUserProfile,
  orderMemories,
  buildProfileInfo,
} from './ai-agent-user.js';
import {
  CACHE_CONTROL_NO_STORE,
  mergeHeaders,
} from '../_shared/http-headers.js';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function authenticateAdmin(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!env.ADMIN_TOKEN || !token) return false;
  return token === env.ADMIN_TOKEN;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function adminResponse(corsHeaders, payload, status = 200) {
  return jsonResponse(payload, {
    status,
    headers: mergeHeaders(corsHeaders, {
      'Cache-Control': CACHE_CONTROL_NO_STORE,
    }),
  });
}

function adminError(corsHeaders, message, status = 400) {
  return errorJsonResponse(message, {
    status,
    headers: mergeHeaders(corsHeaders, {
      'Cache-Control': CACHE_CONTROL_NO_STORE,
    }),
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function handleDashboard(env, corsHeaders) {
  const db = env.DB_LIKES;
  const kv = getMemoryKV(env);

  const stats = {
    contactMessages: 0,
    blogComments: 0,
    projectLikes: 0,
    likeEvents: 0,
    userMemories: 0,
    galleryItems: 0,
  };

  if (db) {
    try {
      const [contacts, comments, likes, events] = await Promise.all([
        db
          .prepare('SELECT COUNT(*) as count FROM contact_messages')
          .first()
          .catch(() => null),
        db
          .prepare('SELECT COUNT(*) as count FROM blog_comments')
          .first()
          .catch(() => null),
        db
          .prepare('SELECT COUNT(*) as count FROM project_likes')
          .first()
          .catch(() => null),
        db
          .prepare('SELECT COUNT(*) as count FROM project_like_events')
          .first()
          .catch(() => null),
      ]);
      stats.contactMessages = contacts?.count || 0;
      stats.blogComments = comments?.count || 0;
      stats.projectLikes = likes?.count || 0;
      stats.likeEvents = events?.count || 0;
    } catch {
      /* DB may be unavailable */
    }
  }

  if (kv?.list) {
    try {
      const page = await kv.list({ prefix: 'robot-memory:', limit: 1000 });
      stats.userMemories = Array.isArray(page?.keys) ? page.keys.length : 0;
    } catch {
      /* ignore */
    }
  }

  if (env.GALLERY_BUCKET?.list) {
    try {
      const objects = await env.GALLERY_BUCKET.list({ limit: 1000 });
      stats.galleryItems = Array.isArray(objects?.objects)
        ? objects.objects.length
        : 0;
    } catch {
      /* ignore */
    }
  }

  return adminResponse(corsHeaders, { success: true, stats });
}

async function handleContactMessages(env, corsHeaders, body) {
  const db = env.DB_LIKES;
  if (!db) return adminError(corsHeaders, 'D1 nicht verfügbar', 503);

  const limit = Math.min(100, Math.max(1, Number(body?.limit) || 50));
  const offset = Math.max(0, Number(body?.offset) || 0);

  const { results } = await db
    .prepare(
      'SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT ? OFFSET ?',
    )
    .bind(limit, offset)
    .all();

  const total = await db
    .prepare('SELECT COUNT(*) as count FROM contact_messages')
    .first();

  return adminResponse(corsHeaders, {
    success: true,
    messages: results,
    total: total?.count || 0,
    limit,
    offset,
  });
}

async function handleDeleteContact(env, corsHeaders, body) {
  const db = env.DB_LIKES;
  if (!db) return adminError(corsHeaders, 'D1 nicht verfügbar', 503);

  const id = Number(body?.id);
  if (!id) return adminError(corsHeaders, 'ID fehlt', 400);

  await db.prepare('DELETE FROM contact_messages WHERE id = ?').bind(id).run();
  return adminResponse(corsHeaders, {
    success: true,
    text: `Nachricht #${id} gelöscht.`,
  });
}

async function handleBlogComments(env, corsHeaders, body) {
  const db = env.DB_LIKES;
  if (!db) return adminError(corsHeaders, 'D1 nicht verfügbar', 503);

  const limit = Math.min(100, Math.max(1, Number(body?.limit) || 50));
  const offset = Math.max(0, Number(body?.offset) || 0);
  const postId = body?.postId || null;

  let query = 'SELECT * FROM blog_comments';
  const params = [];

  if (postId) {
    query += ' WHERE post_id = ?';
    params.push(postId);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results } = await db
    .prepare(query)
    .bind(...params)
    .all();

  let countQuery = 'SELECT COUNT(*) as count FROM blog_comments';
  const countParams = [];
  if (postId) {
    countQuery += ' WHERE post_id = ?';
    countParams.push(postId);
  }

  const total = await db
    .prepare(countQuery)
    .bind(...countParams)
    .first();

  return adminResponse(corsHeaders, {
    success: true,
    comments: results,
    total: total?.count || 0,
    limit,
    offset,
  });
}

async function handleDeleteComment(env, corsHeaders, body) {
  const db = env.DB_LIKES;
  if (!db) return adminError(corsHeaders, 'D1 nicht verfügbar', 503);

  const id = Number(body?.id);
  if (!id) return adminError(corsHeaders, 'ID fehlt', 400);

  await db.prepare('DELETE FROM blog_comments WHERE id = ?').bind(id).run();
  return adminResponse(corsHeaders, {
    success: true,
    text: `Kommentar #${id} gelöscht.`,
  });
}

async function handleProjectLikes(env, corsHeaders) {
  const db = env.DB_LIKES;
  if (!db) return adminError(corsHeaders, 'D1 nicht verfügbar', 503);

  const { results } = await db
    .prepare('SELECT * FROM project_likes ORDER BY likes DESC')
    .all();

  return adminResponse(corsHeaders, { success: true, likes: results });
}

async function handleLikeEvents(env, corsHeaders, body) {
  const db = env.DB_LIKES;
  if (!db) return adminError(corsHeaders, 'D1 nicht verfügbar', 503);

  const limit = Math.min(200, Math.max(1, Number(body?.limit) || 50));
  const offset = Math.max(0, Number(body?.offset) || 0);
  const projectId = body?.projectId || null;

  let query = 'SELECT * FROM project_like_events';
  const params = [];

  if (projectId) {
    query += ' WHERE project_id = ?';
    params.push(projectId);
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results } = await db
    .prepare(query)
    .bind(...params)
    .all();

  return adminResponse(corsHeaders, {
    success: true,
    events: results,
    limit,
    offset,
  });
}

async function handleUserMemories(env, corsHeaders) {
  const kv = getMemoryKV(env);
  if (!kv?.list)
    return adminError(corsHeaders, 'KV nicht verfügbar', 503);

  const users = [];
  let cursor = undefined;
  let iterations = 0;

  do {
    const page = await kv.list({
      prefix: 'robot-memory:',
      cursor,
      limit: 1000,
    });
    const keys = Array.isArray(page?.keys) ? page.keys : [];

    for (const item of keys) {
      const keyName = String(item?.name || '');
      const userId = keyName.replace('robot-memory:', '');
      if (userId) {
        users.push({
          userId,
          kvKey: keyName,
        });
      }
    }

    const listComplete = !!page?.list_complete;
    cursor = listComplete ? undefined : page?.cursor;
    iterations += 1;
  } while (cursor && iterations < 20);

  return adminResponse(corsHeaders, { success: true, users });
}

async function handleUserMemoryDetail(env, corsHeaders, body) {
  const kv = getMemoryKV(env);
  if (!kv)
    return adminError(corsHeaders, 'KV nicht verfügbar', 503);

  const userId = String(body?.userId || '').trim();
  if (!userId) return adminError(corsHeaders, 'userId fehlt', 400);

  const memories = await loadFallbackMemories(kv, userId, env, {
    persistPruned: true,
  });
  const ordered = orderMemories(memories);
  const profile = buildProfileInfo(userId, ordered);

  return adminResponse(corsHeaders, {
    success: true,
    userId,
    count: ordered.length,
    memories: ordered,
    profile,
  });
}

async function handleUpdateUserMemory(env, corsHeaders, body) {
  const kv = getMemoryKV(env);
  if (!kv)
    return adminError(corsHeaders, 'KV nicht verfügbar', 503);

  const userId = String(body?.userId || '').trim();
  if (!userId) return adminError(corsHeaders, 'userId fehlt', 400);

  const result = await updateSingleMemory(kv, env, userId, body);
  return adminResponse(corsHeaders, {
    success: result.success,
    text: result.text,
    memories: result.memories || [],
    profile: result.profile,
  }, result.status);
}

async function handleDeleteUserMemory(env, corsHeaders, body) {
  const kv = getMemoryKV(env);
  if (!kv)
    return adminError(corsHeaders, 'KV nicht verfügbar', 503);

  const userId = String(body?.userId || '').trim();
  if (!userId) return adminError(corsHeaders, 'userId fehlt', 400);

  const result = await forgetSingleMemory(kv, env, userId, body);
  return adminResponse(corsHeaders, {
    success: result.success,
    text: result.text,
    memories: result.memories || [],
    profile: result.profile,
  }, result.status);
}

async function handleDeleteUserProfile(env, corsHeaders, body) {
  const kv = getMemoryKV(env);
  if (!kv)
    return adminError(corsHeaders, 'KV nicht verfügbar', 503);

  const userId = String(body?.userId || '').trim();
  if (!userId) return adminError(corsHeaders, 'userId fehlt', 400);

  const deleted = await deleteUserProfile(kv, env, userId);
  return adminResponse(corsHeaders, {
    success: true,
    text: `Profil ${userId} vollständig gelöscht.`,
    deleted,
  });
}

async function handleGalleryList(env, corsHeaders) {
  const bucket = env.GALLERY_BUCKET;
  if (!bucket?.list)
    return adminError(corsHeaders, 'R2 Bucket nicht verfügbar', 503);

  const objects = await bucket.list({ limit: 1000 });
  const items = (objects?.objects || []).map((obj) => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded,
    etag: obj.etag,
    httpMetadata: obj.httpMetadata || {},
    customMetadata: obj.customMetadata || {},
  }));

  return adminResponse(corsHeaders, {
    success: true,
    items,
    total: items.length,
  });
}

async function handleKvOverview(env, corsHeaders, body) {
  const namespace = body?.namespace || 'memory';
  let kv = null;
  let prefix = '';

  switch (namespace) {
    case 'memory':
      kv = env.JULES_MEMORY_KV;
      prefix = body?.prefix || '';
      break;
    case 'ratelimit':
      kv = env.RATE_LIMIT_KV;
      prefix = body?.prefix || 'rl:';
      break;
    case 'cache':
      kv = env.SITEMAP_CACHE_KV;
      prefix = body?.prefix || '';
      break;
    default:
      return adminError(corsHeaders, 'Unbekannter Namespace', 400);
  }

  if (!kv?.list)
    return adminError(corsHeaders, 'KV nicht verfügbar', 503);

  const page = await kv.list({ prefix, limit: 200 });
  const keys = (page?.keys || []).map((k) => ({
    name: k.name,
    expiration: k.expiration || null,
    metadata: k.metadata || null,
  }));

  return adminResponse(corsHeaders, {
    success: true,
    namespace,
    keys,
    total: keys.length,
    listComplete: !!page?.list_complete,
  });
}

async function handleClearCache(env, corsHeaders) {
  const kv = env.SITEMAP_CACHE_KV;
  if (!kv?.list || !kv?.delete)
    return adminError(corsHeaders, 'Cache-KV nicht verfügbar', 503);

  let deleted = 0;
  let cursor = undefined;
  let iterations = 0;

  do {
    const page = await kv.list({ cursor, limit: 500 });
    const keys = Array.isArray(page?.keys) ? page.keys : [];

    for (const item of keys) {
      try {
        await kv.delete(item.name);
        deleted += 1;
      } catch {
        /* ignore */
      }
    }

    const listComplete = !!page?.list_complete;
    cursor = listComplete ? undefined : page?.cursor;
    iterations += 1;
  } while (cursor && iterations < 20);

  return adminResponse(corsHeaders, {
    success: true,
    text: `${deleted} Cache-Einträge gelöscht.`,
    deleted,
  });
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

export async function onRequestPost({ request, env }) {
  const corsHeaders = getCorsHeaders(request, env);

  if (!authenticateAdmin(request, env)) {
    return adminError(corsHeaders, 'Nicht autorisiert', 401);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    switch (action) {
      case 'dashboard':
        return handleDashboard(env, corsHeaders);
      case 'contact-messages':
        return handleContactMessages(env, corsHeaders, body);
      case 'delete-contact':
        return handleDeleteContact(env, corsHeaders, body);
      case 'blog-comments':
        return handleBlogComments(env, corsHeaders, body);
      case 'delete-comment':
        return handleDeleteComment(env, corsHeaders, body);
      case 'project-likes':
        return handleProjectLikes(env, corsHeaders);
      case 'like-events':
        return handleLikeEvents(env, corsHeaders, body);
      case 'user-memories':
        return handleUserMemories(env, corsHeaders);
      case 'user-memory-detail':
        return handleUserMemoryDetail(env, corsHeaders, body);
      case 'update-user-memory':
        return handleUpdateUserMemory(env, corsHeaders, body);
      case 'delete-user-memory':
        return handleDeleteUserMemory(env, corsHeaders, body);
      case 'delete-user-profile':
        return handleDeleteUserProfile(env, corsHeaders, body);
      case 'gallery-list':
        return handleGalleryList(env, corsHeaders);
      case 'kv-overview':
        return handleKvOverview(env, corsHeaders, body);
      case 'clear-cache':
        return handleClearCache(env, corsHeaders);
      default:
        return adminError(
          corsHeaders,
          `Unbekannte Action: "${action}"`,
          400,
        );
    }
  } catch (error) {
    log.error('[admin] Error:', error?.message || error);
    return adminError(corsHeaders, 'Interner Server-Fehler', 500);
  }
}

export const onRequestOptions = handleOptions;
