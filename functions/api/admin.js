import { createLogger } from "../../content/core/logger.js";

const log = createLogger("admin");
/**
 * Admin Dashboard API — POST /api/admin
 * Protected by Bearer token (env.ADMIN_TOKEN).
 * Provides read/write access to D1, KV, R2, and Vectorize resources.
 *
 * Reuses logic from ai-agent-user.js to avoid duplication.
 */

import { getCorsHeaders, handleOptions } from "./_cors.js";
import { ensureAppD1Schema } from "./_d1-schema.js";
import { jsonResponse, errorJsonResponse } from "./_response.js";
import { createWindowRateLimiter } from "./_rate-limit.js";
import { getRequestClientIp } from "./_request-utils.js";
import { getMemoryKV, loadFallbackMemories } from "./_ai-agent-memory-store.js";
import {
  updateSingleMemory,
  forgetSingleMemory,
  deleteUserProfile,
  orderMemories,
  buildProfileInfo,
} from "./ai-agent-user.js";
import { CACHE_CONTROL_NO_STORE, mergeHeaders } from "../_shared/http-headers.js";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Constant-time string equality check to prevent timing-oracle attacks.
 * Falls back to false if the lengths differ (short-circuit is safe here
 * because length is not secret — the attacker already knows the expected
 * token length from the format).
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const aBytes = enc.encode(String(a));
  const bBytes = enc.encode(String(b));

  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

const MAX_AUTH_FAILURES = 5;
const AUTH_WINDOW_SECONDS = 60;
const adminAuthFailureLimiter = createWindowRateLimiter({
  keyNamespace: "admin_auth_fail:v1",
  maxEntries: 1000,
});

async function authFailureReason(ip, env, reason) {
  const result = await adminAuthFailureLimiter.check(ip, {
    kv: env?.RATE_LIMIT_KV,
    limit: MAX_AUTH_FAILURES,
    windowSeconds: AUTH_WINDOW_SECONDS,
  });
  return result.allowed ? reason : "rate-limited";
}

/**
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<{ ok: boolean; reason?: string }>}
 */
async function authenticateAdmin(request, env) {
  const ip = getRequestClientIp(request);
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!env.ADMIN_TOKEN || !token) {
    return { ok: false, reason: await authFailureReason(ip, env, "missing-token") };
  }

  const valid = timingSafeEqual(token, env.ADMIN_TOKEN);
  if (!valid) {
    return { ok: false, reason: await authFailureReason(ip, env, "invalid-token") };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function adminResponse(corsHeaders, payload, status = 200) {
  return jsonResponse(payload, {
    status,
    headers: mergeHeaders(corsHeaders, {
      "Cache-Control": CACHE_CONTROL_NO_STORE,
    }),
  });
}

function adminError(corsHeaders, message, status = 400) {
  return errorJsonResponse(message, {
    status,
    headers: mergeHeaders(corsHeaders, {
      "Cache-Control": CACHE_CONTROL_NO_STORE,
    }),
  });
}

function paginationFromBody(body, defaultLimit = 50, maxLimit = 100) {
  return {
    limit: Math.min(maxLimit, Math.max(1, Number(body?.limit) || defaultLimit)),
    offset: Math.max(0, Number(body?.offset) || 0),
  };
}

const SNAPSHOT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS project_likes (
  project_id TEXT PRIMARY KEY,
  likes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS blog_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON blog_comments(post_id);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_created_at ON contact_messages(created_at);

CREATE TABLE IF NOT EXISTS project_like_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  source_ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  request_id TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_like_events_project_id_created_at
ON project_like_events (project_id, created_at DESC);
`;

function escapeSqlString(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${escapeSqlString(value)}'`;
}

function chunk(values, size) {
  const groups = [];
  for (let index = 0; index < values.length; index += size) {
    groups.push(values.slice(index, index + size));
  }
  return groups;
}

function buildInsertSql(table, columns, rows, chunkSize = 100) {
  if (!rows.length) return [];

  return chunk(rows, chunkSize).map(group => {
    const values = group
      .map(row => `(${columns.map(column => sqlValue(row[column])).join(", ")})`)
      .join(",\n  ");
    return `INSERT INTO ${table} (${columns.join(", ")})\nVALUES\n  ${values};`;
  });
}

async function buildSnapshotSqlFromDb(db) {
  await ensureAppD1Schema(db);

  const [projectLikes, blogComments, contactMessages, likeEvents] = await Promise.all([
    db
      .prepare("SELECT project_id, likes FROM project_likes ORDER BY project_id ASC")
      .all()
      .then(result => result?.results || []),
    db
      .prepare(
        "SELECT id, post_id, author_name, content, created_at FROM blog_comments ORDER BY id ASC"
      )
      .all()
      .then(result => result?.results || []),
    db
      .prepare(
        "SELECT id, name, email, subject, message, created_at FROM contact_messages ORDER BY id ASC"
      )
      .all()
      .then(result => result?.results || []),
    db
      .prepare(
        "SELECT id, project_id, source_ip, user_agent, request_id, created_at FROM project_like_events ORDER BY id ASC"
      )
      .all()
      .then(result => result?.results || []),
  ]);

  const statements = [
    SNAPSHOT_SCHEMA_SQL.trim(),
    "BEGIN TRANSACTION;",
    "DELETE FROM project_likes;",
    "DELETE FROM blog_comments;",
    "DELETE FROM contact_messages;",
    "DELETE FROM project_like_events;",
    ...buildInsertSql("project_likes", ["project_id", "likes"], projectLikes, 100),
    ...buildInsertSql(
      "blog_comments",
      ["id", "post_id", "author_name", "content", "created_at"],
      blogComments,
      50
    ),
    ...buildInsertSql(
      "contact_messages",
      ["id", "name", "email", "subject", "message", "created_at"],
      contactMessages,
      50
    ),
    ...buildInsertSql(
      "project_like_events",
      ["id", "project_id", "source_ip", "user_agent", "request_id", "created_at"],
      likeEvents,
      50
    ),
    "COMMIT;",
  ];

  return `${statements.join("\n\n")}\n`;
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
      await ensureAppD1Schema(db);
      const [contacts, comments, likes, events] = await Promise.all([
        db
          .prepare("SELECT COUNT(*) as count FROM contact_messages")
          .first()
          .catch(() => null),
        db
          .prepare("SELECT COUNT(*) as count FROM blog_comments")
          .first()
          .catch(() => null),
        db
          .prepare("SELECT COUNT(*) as count FROM project_likes")
          .first()
          .catch(() => null),
        db
          .prepare("SELECT COUNT(*) as count FROM project_like_events")
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
      const page = await kv.list({ prefix: "robot-memory:", limit: 1000 });
      stats.userMemories = Array.isArray(page?.keys) ? page.keys.length : 0;
    } catch {
      /* ignore */
    }
  }

  if (env.GALLERY_BUCKET?.list) {
    try {
      const objects = await env.GALLERY_BUCKET.list({ limit: 1000 });
      stats.galleryItems = Array.isArray(objects?.objects) ? objects.objects.length : 0;
    } catch {
      /* ignore */
    }
  }

  return adminResponse(corsHeaders, { success: true, stats });
}

async function handleContactMessages(env, corsHeaders, body) {
  const db = env.DB_LIKES;
  if (!db) return adminError(corsHeaders, "D1 nicht verfügbar", 503);
  await ensureAppD1Schema(db);

  const { limit, offset } = paginationFromBody(body);

  const { results } = await db
    .prepare("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .bind(limit, offset)
    .all();

  const total = await db.prepare("SELECT COUNT(*) as count FROM contact_messages").first();

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
  if (!db) return adminError(corsHeaders, "D1 nicht verfügbar", 503);
  await ensureAppD1Schema(db);

  const id = Number(body?.id);
  if (!id) return adminError(corsHeaders, "ID fehlt", 400);

  await db.prepare("DELETE FROM contact_messages WHERE id = ?").bind(id).run();
  return adminResponse(corsHeaders, {
    success: true,
    text: `Nachricht #${id} gelöscht.`,
  });
}

async function handleBlogComments(env, corsHeaders, body) {
  const db = env.DB_LIKES;
  if (!db) return adminError(corsHeaders, "D1 nicht verfügbar", 503);
  await ensureAppD1Schema(db);

  const { limit, offset } = paginationFromBody(body);
  const postId = body?.postId || null;

  let query = "SELECT * FROM blog_comments";
  const params = [];

  if (postId) {
    query += " WHERE post_id = ?";
    params.push(postId);
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const { results } = await db
    .prepare(query)
    .bind(...params)
    .all();

  let countQuery = "SELECT COUNT(*) as count FROM blog_comments";
  const countParams = [];
  if (postId) {
    countQuery += " WHERE post_id = ?";
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
  if (!db) return adminError(corsHeaders, "D1 nicht verfügbar", 503);
  await ensureAppD1Schema(db);

  const id = Number(body?.id);
  if (!id) return adminError(corsHeaders, "ID fehlt", 400);

  await db.prepare("DELETE FROM blog_comments WHERE id = ?").bind(id).run();
  return adminResponse(corsHeaders, {
    success: true,
    text: `Kommentar #${id} gelöscht.`,
  });
}

async function handleProjectLikes(env, corsHeaders) {
  const db = env.DB_LIKES;
  if (!db) return adminError(corsHeaders, "D1 nicht verfügbar", 503);
  await ensureAppD1Schema(db);

  const { results } = await db.prepare("SELECT * FROM project_likes ORDER BY likes DESC").all();

  return adminResponse(corsHeaders, { success: true, likes: results });
}

async function handleLikeEvents(env, corsHeaders, body) {
  const db = env.DB_LIKES;
  if (!db) return adminError(corsHeaders, "D1 nicht verfügbar", 503);
  await ensureAppD1Schema(db);

  const { limit, offset } = paginationFromBody(body, 50, 200);
  const projectId = body?.projectId || null;

  let query = "SELECT * FROM project_like_events";
  const params = [];

  if (projectId) {
    query += " WHERE project_id = ?";
    params.push(projectId);
  }
  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
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
  if (!kv?.list) return adminError(corsHeaders, "KV nicht verfügbar", 503);

  const users = [];
  let cursor = undefined;
  let iterations = 0;

  do {
    const page = await kv.list({
      prefix: "robot-memory:",
      cursor,
      limit: 1000,
    });
    const keys = Array.isArray(page?.keys) ? page.keys : [];

    for (const item of keys) {
      const keyName = String(item?.name || "");
      const userId = keyName.replace("robot-memory:", "");
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
  if (!kv) return adminError(corsHeaders, "KV nicht verfügbar", 503);

  const userId = String(body?.userId || "").trim();
  if (!userId) return adminError(corsHeaders, "userId fehlt", 400);

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
  if (!kv) return adminError(corsHeaders, "KV nicht verfügbar", 503);

  const userId = String(body?.userId || "").trim();
  if (!userId) return adminError(corsHeaders, "userId fehlt", 400);

  const result = await updateSingleMemory(kv, env, userId, body);
  return adminResponse(
    corsHeaders,
    {
      success: result.success,
      text: result.text,
      memories: result.memories || [],
      profile: result.profile,
    },
    result.status
  );
}

async function handleDeleteUserMemory(env, corsHeaders, body) {
  const kv = getMemoryKV(env);
  if (!kv) return adminError(corsHeaders, "KV nicht verfügbar", 503);

  const userId = String(body?.userId || "").trim();
  if (!userId) return adminError(corsHeaders, "userId fehlt", 400);

  const result = await forgetSingleMemory(kv, env, userId, body);
  return adminResponse(
    corsHeaders,
    {
      success: result.success,
      text: result.text,
      memories: result.memories || [],
      profile: result.profile,
    },
    result.status
  );
}

async function handleDeleteUserProfile(env, corsHeaders, body) {
  const kv = getMemoryKV(env);
  if (!kv) return adminError(corsHeaders, "KV nicht verfügbar", 503);

  const userId = String(body?.userId || "").trim();
  if (!userId) return adminError(corsHeaders, "userId fehlt", 400);

  const deleted = await deleteUserProfile(kv, env, userId);
  return adminResponse(corsHeaders, {
    success: true,
    text: `Profil ${userId} vollständig gelöscht.`,
    deleted,
  });
}

async function handleGalleryList(env, corsHeaders) {
  const bucket = env.GALLERY_BUCKET;
  if (!bucket?.list) return adminError(corsHeaders, "R2 Bucket nicht verfügbar", 503);

  const objects = await bucket.list({ limit: 1000 });
  const items = (objects?.objects || []).map(obj => ({
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
  const namespace = String(body?.namespace || "memory");
  const config = KV_NAMESPACES[namespace]?.(env, body);
  if (!config) return adminError(corsHeaders, "Unbekannter Namespace", 400);

  const { kv, prefix } = config;

  if (!kv?.list) return adminError(corsHeaders, "KV nicht verfügbar", 503);

  const page = await kv.list({ prefix, limit: 200 });
  const keys = (page?.keys || []).map(k => ({
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
  if (!kv?.list || !kv?.delete) return adminError(corsHeaders, "Cache-KV nicht verfügbar", 503);

  let deleted = 0;
  let cursor = undefined;
  let iterations = 0;

  do {
    const page = await kv.list({ cursor, limit: 500 });
    const keys = Array.isArray(page?.keys) ? page.keys : [];

    // Process chunks of 50 in parallel to prevent high latency or limits
    const chunks = [];
    for (let i = 0; i < keys.length; i += 50) {
      chunks.push(keys.slice(i, i + 50));
    }

    for (const chunk of chunks) {
      const deletePromises = chunk.map(item => kv.delete(item.name));
      const results = await Promise.allSettled(deletePromises);
      deleted += results.filter(r => r.status === "fulfilled").length;
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

async function handleExportSnapshot(env, corsHeaders, body) {
  const db = env.DB_LIKES;
  if (!db) return adminError(corsHeaders, "D1 nicht verfügbar", 503);

  const format = String(body?.format || "sql").toLowerCase();
  const sql = await buildSnapshotSqlFromDb(db);

  if (format === "json") {
    return adminResponse(corsHeaders, {
      success: true,
      sql,
      bytes: sql.length,
    });
  }

  return new Response(sql, {
    status: 200,
    headers: mergeHeaders(corsHeaders, {
      "Cache-Control": CACHE_CONTROL_NO_STORE,
      "Content-Type": "application/sql; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    }),
  });
}

const KV_NAMESPACES = {
  memory: (env, body) => ({ kv: env.JULES_MEMORY_KV, prefix: body?.prefix || "" }),
  ratelimit: (env, body) => ({ kv: env.RATE_LIMIT_KV, prefix: body?.prefix || "rl:" }),
  cache: (env, body) => ({ kv: env.SITEMAP_CACHE_KV, prefix: body?.prefix || "" }),
};

const ADMIN_ACTIONS = {
  dashboard: handleDashboard,
  "contact-messages": handleContactMessages,
  "delete-contact": handleDeleteContact,
  "blog-comments": handleBlogComments,
  "delete-comment": handleDeleteComment,
  "project-likes": handleProjectLikes,
  "like-events": handleLikeEvents,
  "user-memories": handleUserMemories,
  "user-memory-detail": handleUserMemoryDetail,
  "update-user-memory": handleUpdateUserMemory,
  "delete-user-memory": handleDeleteUserMemory,
  "delete-user-profile": handleDeleteUserProfile,
  "gallery-list": handleGalleryList,
  "kv-overview": handleKvOverview,
  "clear-cache": handleClearCache,
  "export-snapshot": handleExportSnapshot,
};

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

export async function onRequestPost({ request, env }) {
  const corsHeaders = getCorsHeaders(request, env);

  const authResult = await authenticateAdmin(request, env);
  if (!authResult.ok) {
    const status = authResult.reason === "rate-limited" ? 429 : 401;
    const message =
      authResult.reason === "rate-limited"
        ? "Zu viele fehlgeschlagene Versuche. Bitte warte eine Minute."
        : "Nicht autorisiert";
    return adminError(corsHeaders, message, status);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").trim();
    const handler = ADMIN_ACTIONS[action];

    if (!handler) return adminError(corsHeaders, `Unbekannte Action: "${action}"`, 400);
    return handler(env, corsHeaders, body);
  } catch (error) {
    log.error("[admin] Error:", error?.message || error);
    return adminError(corsHeaders, "Interner Server-Fehler", 500);
  }
}

export const onRequestOptions = handleOptions;
