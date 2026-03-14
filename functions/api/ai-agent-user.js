/**
 * Cloudflare Pages Function – POST /api/ai-agent-user
 * Profile and memory operations for the robot companion.
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  deleteAdminNameMapping,
  deleteAdminUserIndex,
  syncAdminUserIndex,
  upsertAdminNameMapping,
} from './admin/_admin-index.js';
import {
  USER_ID_HEADER_NAME,
  appendSetCookie,
  buildUserIdClearCookie,
  buildUserIdCookie,
  normalizeUserId as normalizeSharedUserId,
  readUserIdFromCookieHeader,
} from './_user-identity.js';

const FALLBACK_MEMORY_PREFIX = 'robot-memory:';
const DEFAULT_EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const DEFAULT_MEMORY_RETENTION_DAYS = 180;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MEMORY_KEY_METADATA = {
  name: { category: 'identity', priority: 100 },
  preference: { category: 'preference', priority: 90 },
  occupation: { category: 'profile', priority: 88 },
  company: { category: 'profile', priority: 86 },
  location: { category: 'profile', priority: 84 },
  language: { category: 'profile', priority: 82 },
  interest: { category: 'interest', priority: 80 },
  skill: { category: 'ability', priority: 78 },
  goal: { category: 'goal', priority: 76 },
  project: { category: 'project', priority: 74 },
  birthday: { category: 'identity', priority: 72 },
  dislike: { category: 'preference', priority: 70 },
  availability: { category: 'availability', priority: 68 },
  timezone: { category: 'availability', priority: 66 },
  note: { category: 'note', priority: 40 },
};
const DEFAULT_MEMORY_CATEGORY = 'note';
const DEFAULT_MEMORY_PRIORITY = 20;
const SINGLETON_MEMORY_KEYS = new Set([
  'name',
  'location',
  'occupation',
  'company',
  'language',
  'birthday',
  'timezone',
  'availability',
]);
const USERNAME_LOOKUP_PREFIX = 'username:';
const USERNAME_LOOKUP_CONFLICT = '__conflict__';

function parseInteger(value, fallback, { min = 1, max = 3650 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeUserId(raw) {
  return normalizeSharedUserId(raw);
}

export function getMemoryKV(env) {
  if (env?.JULES_MEMORY_KV?.get && env?.JULES_MEMORY_KV?.delete) {
    return env.JULES_MEMORY_KV;
  }
  if (env?.RATE_LIMIT_KV?.get && env?.RATE_LIMIT_KV?.delete) {
    return env.RATE_LIMIT_KV;
  }
  if (env?.SITEMAP_CACHE_KV?.get && env?.SITEMAP_CACHE_KV?.delete) {
    return env.SITEMAP_CACHE_KV;
  }
  return null;
}

function normalizeMemoryText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMemoryKey(rawKey) {
  return String(rawKey || 'note')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 30);
}

function normalizeLookupName(rawName) {
  return normalizeMemoryText(rawName)
    .replace(/[.,;:!?]+$/g, '')
    .toLowerCase()
    .slice(0, 80);
}

function getUserNameLookupKey(name) {
  const normalized = normalizeLookupName(name);
  return normalized ? `${USERNAME_LOOKUP_PREFIX}${normalized}` : '';
}

function getMemoryRetentionMs(env) {
  const days = parseInteger(
    env?.ROBOT_MEMORY_RETENTION_DAYS,
    DEFAULT_MEMORY_RETENTION_DAYS,
  );
  return days * DAY_IN_MS;
}

function getMemoryKey(userId) {
  return `${FALLBACK_MEMORY_PREFIX}${userId}`;
}

function getLatestMemoryEntry(entries, key) {
  const normalizedKey = normalizeMemoryKey(key);
  let latestEntry = null;

  for (const entry of entries || []) {
    if (normalizeMemoryKey(entry?.key) !== normalizedKey) continue;
    if (
      !latestEntry ||
      entry.timestamp > latestEntry.timestamp ||
      (entry.timestamp === latestEntry.timestamp &&
        entry.priority > latestEntry.priority)
    ) {
      latestEntry = entry;
    }
  }

  return latestEntry;
}

export function buildProfileInfo(userId, memories = []) {
  const name = normalizeMemoryText(
    getLatestMemoryEntry(memories, 'name')?.value,
  );
  return {
    userId: normalizeUserId(userId),
    name,
    status: name ? 'identified' : 'anonymous',
    label: name ? `Profil: ${name}` : 'Profil: neu',
  };
}

function resolveMemoryMetadata(key, category, priority) {
  const normalizedKey = normalizeMemoryKey(key) || 'note';
  const fallback = MEMORY_KEY_METADATA[normalizedKey] || {
    category: DEFAULT_MEMORY_CATEGORY,
    priority: DEFAULT_MEMORY_PRIORITY,
  };
  const normalizedCategory =
    normalizeMemoryText(category || fallback.category).toLowerCase() ||
    fallback.category;
  const numericPriority = Number.parseInt(String(priority ?? ''), 10);
  const normalizedPriority = Number.isFinite(numericPriority)
    ? Math.min(100, Math.max(0, numericPriority))
    : fallback.priority;

  return {
    key: normalizedKey,
    category: normalizedCategory,
    priority: normalizedPriority,
  };
}

function normalizeMemoryEntry(entry, now, retentionMs) {
  const ts = Number(entry?.timestamp);
  const timestamp = Number.isFinite(ts) && ts > 0 ? ts : now;
  const metadata = resolveMemoryMetadata(
    entry?.key,
    entry?.category,
    entry?.priority,
  );

  return {
    ...metadata,
    value: normalizeMemoryText(entry?.value || ''),
    timestamp,
    expiresAt: timestamp + retentionMs,
  };
}

function compactMemories(entries, now, retentionMs) {
  const unique = new Map();
  for (const rawEntry of entries) {
    const entry = normalizeMemoryEntry(rawEntry, now, retentionMs);
    if (!entry.value) continue;
    if (now - entry.timestamp > retentionMs) continue;

    const hash = SINGLETON_MEMORY_KEYS.has(entry.key)
      ? entry.key
      : `${entry.key}:${entry.value.toLowerCase()}`;
    const existing = unique.get(hash);
    if (
      !existing ||
      entry.timestamp > existing.timestamp ||
      (entry.timestamp === existing.timestamp &&
        entry.priority > existing.priority)
    ) {
      unique.set(hash, entry);
    }
  }
  return [...unique.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export function compactMemoryEntries(entries = [], env, now = Date.now()) {
  return compactMemories(entries, now, getMemoryRetentionMs(env));
}

export async function loadFallbackMemories(
  kv,
  userId,
  env,
  { persistPruned = false } = {},
) {
  if (!kv?.get) return [];

  try {
    const raw = await kv.get(getMemoryKey(userId));
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    const retentionMs = getMemoryRetentionMs(env);
    const compacted = compactMemories(parsed, now, retentionMs);

    if (persistPruned && kv?.put) {
      const compactedJson = JSON.stringify(compacted);
      if ((raw || '[]') !== compactedJson) {
        await kv.put(getMemoryKey(userId), compactedJson);
      }
    }

    return compacted;
  } catch {
    return [];
  }
}

async function saveFallbackMemories(kv, userId, memories, env) {
  if (!kv?.put) return false;

  try {
    const now = Date.now();
    const retentionMs = getMemoryRetentionMs(env);
    const compacted = compactMemories(memories, now, retentionMs);
    await kv.put(getMemoryKey(userId), JSON.stringify(compacted));
    return true;
  } catch {
    return false;
  }
}

export async function deleteUserProfile(kv, env, userId) {
  const memoryKey = getMemoryKey(userId);
  await kv.delete(memoryKey);
  const usernameStats = await deleteUsernameMappingsForUser(kv, userId);
  const vectorizeStats = await deleteVectorizeMemoriesForUser(env, userId);
  const indexStats = await deleteAdminUserIndex(env, userId);

  return {
    memoryKey,
    usernameMappings: usernameStats.deleted,
    scannedUsernameMappings: usernameStats.scanned,
    vectorize: vectorizeStats,
    index: indexStats,
  };
}

async function syncUserNameLookup(
  kv,
  env,
  userId,
  nextName = '',
  previousName = '',
) {
  if (!kv?.get || !kv?.put) return { linked: false, conflict: false };

  const normalizedUserId = normalizeUserId(userId);
  const nextKey = getUserNameLookupKey(nextName);
  const previousKey = getUserNameLookupKey(previousName);

  try {
    if (previousKey && previousKey !== nextKey && kv?.delete) {
      const previousMappedUserId = normalizeUserId(await kv.get(previousKey));
      if (previousMappedUserId === normalizedUserId) {
        await kv.delete(previousKey);
        await deleteAdminNameMapping(
          env,
          previousKey.replace(USERNAME_LOOKUP_PREFIX, ''),
        );
      }
    }

    if (!nextKey) {
      return { linked: false, conflict: false };
    }

    const existingValue = String((await kv.get(nextKey)) || '').trim();
    const existingUserId = normalizeUserId(existingValue);
    if (
      existingValue === USERNAME_LOOKUP_CONFLICT ||
      (existingUserId && existingUserId !== normalizedUserId)
    ) {
      await kv.put(nextKey, USERNAME_LOOKUP_CONFLICT);
      await upsertAdminNameMapping(
        env,
        nextKey.replace(USERNAME_LOOKUP_PREFIX, ''),
        USERNAME_LOOKUP_CONFLICT,
      );
      return { linked: false, conflict: true };
    }

    await kv.put(nextKey, normalizedUserId);
    await upsertAdminNameMapping(
      env,
      nextKey.replace(USERNAME_LOOKUP_PREFIX, ''),
      normalizedUserId,
    );
    return { linked: true, conflict: false };
  } catch {
    return { linked: false, conflict: false };
  }
}

export async function upsertVectorizeMemory(env, userId, entry) {
  if (!env?.AI?.run || !env?.JULES_MEMORY?.upsert) return false;

  const embeddingModel = env.ROBOT_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const text = `${entry.key}: ${entry.value}`;

  try {
    const embeddingResult = await env.AI.run(embeddingModel, {
      text: [text],
    });
    const vector = Array.isArray(embeddingResult?.data)
      ? embeddingResult.data[0]
      : null;
    if (!vector) return false;

    await env.JULES_MEMORY.upsert([
      {
        id: `${userId}_${entry.key}_${entry.timestamp}_edit`,
        values: vector,
        metadata: {
          userId,
          key: entry.key,
          value: entry.value,
          category: entry.category,
          priority: entry.priority,
          timestamp: entry.timestamp,
          expiresAt: entry.expiresAt,
          text,
        },
      },
    ]);
    return true;
  } catch {
    return false;
  }
}

async function deleteVectorizeMemoryByMetadata(env, filter) {
  const index = env?.JULES_MEMORY;
  if (!index) return false;

  const metadataDeleteMethods = [
    'deleteByMetadata',
    'deleteByFilter',
    'deleteByMetadataFilter',
  ];

  for (const method of metadataDeleteMethods) {
    if (typeof index[method] !== 'function') continue;
    try {
      await index[method](filter);
      return true;
    } catch {
      /* ignore */
    }
  }

  return false;
}

function rankMemoryKey(key) {
  const value = String(key || '').toLowerCase();
  if (value === 'name') return 0;
  if (value === 'preference') return 1;
  if (value === 'occupation') return 2;
  if (value === 'company') return 3;
  if (value === 'location') return 4;
  if (value === 'language') return 5;
  if (value === 'interest') return 6;
  if (value === 'skill') return 7;
  if (value === 'goal') return 8;
  if (value === 'project') return 9;
  if (value === 'birthday') return 10;
  if (value === 'dislike') return 11;
  if (value === 'availability') return 12;
  if (value === 'timezone') return 13;
  if (value === 'note') return 14;
  return 99;
}

export function orderMemories(memories = []) {
  return [...memories].sort((a, b) => {
    const priorityDiff = (b.priority || 0) - (a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    const rankDiff = rankMemoryKey(a.key) - rankMemoryKey(b.key);
    if (rankDiff !== 0) return rankDiff;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
}

function normalizeAction(raw) {
  const value = String(raw || 'delete')
    .toLowerCase()
    .trim();
  if (value === 'list') return 'list';
  if (value === 'activate') return 'activate';
  if (value === 'disconnect') return 'disconnect';
  if (value === 'update-memory' || value === 'updatememory') {
    return 'update-memory';
  }
  if (value === 'forget-memory' || value === 'forgetmemory') {
    return 'forget-memory';
  }
  return 'delete';
}

export async function deleteUsernameMappingsForUser(kv, userId) {
  // Remove all name lookup bindings that still point to this profile.
  if (!kv?.list || !kv?.get || !kv?.delete) {
    return { scanned: 0, deleted: 0 };
  }

  let cursor = undefined;
  let scanned = 0;
  let deleted = 0;
  let iterations = 0;

  do {
    const page = await kv.list({
      prefix: 'username:',
      cursor,
      limit: 1000,
    });

    const keys = Array.isArray(page?.keys) ? page.keys : [];
    for (const item of keys) {
      const key = String(item?.name || '').trim();
      if (!key) continue;

      scanned += 1;

      let mappedUserId;
      try {
        mappedUserId = normalizeUserId(await kv.get(key));
      } catch {
        continue;
      }

      if (mappedUserId !== userId) continue;

      try {
        await kv.delete(key);
        deleted += 1;
      } catch {
        /* ignore */
      }
    }

    const listComplete = !!page?.list_complete;
    cursor = listComplete ? undefined : page?.cursor;
    iterations += 1;
  } while (cursor && iterations < 100);

  return { scanned, deleted };
}

export async function deleteVectorizeMemoriesForUser(env, userId) {
  const index = env?.JULES_MEMORY;
  if (!index) {
    return {
      available: false,
      attempted: false,
      deleted: 0,
      mode: 'not-configured',
    };
  }

  const metadataDeleteMethods = [
    'deleteByMetadata',
    'deleteByFilter',
    'deleteByMetadataFilter',
  ];

  for (const method of metadataDeleteMethods) {
    if (typeof index[method] !== 'function') continue;
    try {
      await index[method]({ userId });
      return {
        available: true,
        attempted: true,
        deleted: null,
        mode: method,
      };
    } catch (error) {
      console.warn(
        `[ai-agent-user] Vectorize ${method} failed:`,
        error?.message || error,
      );
    }
  }

  const idDeleteMethod =
    typeof index.deleteByIds === 'function'
      ? 'deleteByIds'
      : typeof index.delete === 'function'
        ? 'delete'
        : typeof index.remove === 'function'
          ? 'remove'
          : '';

  if (!idDeleteMethod || typeof index.query !== 'function' || !env?.AI?.run) {
    return {
      available: true,
      attempted: false,
      deleted: 0,
      mode: 'unsupported',
    };
  }

  const embeddingModel = env.ROBOT_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const probeTerms = ['name', 'interest', 'preference', 'user info', 'profil'];
  const ids = new Set();

  for (const term of probeTerms) {
    try {
      const embeddingResult = await env.AI.run(embeddingModel, {
        text: [term],
      });
      const vector = Array.isArray(embeddingResult?.data)
        ? embeddingResult.data[0]
        : null;
      if (!vector) continue;

      const queryResult = await index.query(vector, {
        topK: 100,
        filter: { userId },
        returnMetadata: 'all',
      });

      const matches = Array.isArray(queryResult?.matches)
        ? queryResult.matches
        : [];
      for (const match of matches) {
        const id = String(match?.id || '').trim();
        if (id) ids.add(id);
      }
    } catch {
      /* ignore probe failures */
    }
  }

  if (ids.size === 0) {
    return {
      available: true,
      attempted: true,
      deleted: 0,
      mode: `${idDeleteMethod}-by-id`,
    };
  }

  try {
    await index[idDeleteMethod]([...ids]);
    return {
      available: true,
      attempted: true,
      deleted: ids.size,
      mode: `${idDeleteMethod}-by-id`,
    };
  } catch (error) {
    console.warn(
      `[ai-agent-user] Vectorize ${idDeleteMethod} failed:`,
      error?.message || error,
    );
    return {
      available: true,
      attempted: true,
      deleted: 0,
      mode: `${idDeleteMethod}-failed`,
    };
  }
}

export async function updateSingleMemory(kv, env, userId, body) {
  const key = normalizeMemoryKey(body?.key);
  const value = normalizeMemoryText(body?.value || '');
  const previousValue = normalizeMemoryText(body?.previousValue || '');

  if (!key) {
    return { success: false, status: 400, text: 'Memory-Key fehlt.' };
  }
  if (!value) {
    return { success: false, status: 400, text: 'Neuer Memory-Wert fehlt.' };
  }
  if (key === 'name' && value.toLowerCase() === 'jules') {
    return {
      success: false,
      status: 400,
      text: 'Der Assistentenname kann nicht als Nutzername gespeichert werden.',
    };
  }

  const existing = await loadFallbackMemories(kv, userId, env, {
    persistPruned: true,
  });
  const previousName = normalizeMemoryText(
    getLatestMemoryEntry(existing, 'name')?.value,
  );
  const metadata = resolveMemoryMetadata(key);
  const now = Date.now();
  const nextEntry = {
    ...metadata,
    value,
    timestamp: now,
    expiresAt: now + getMemoryRetentionMs(env),
  };

  const filtered = existing.filter((entry) => {
    if (entry.key !== key) return true;
    if (SINGLETON_MEMORY_KEYS.has(key)) return false;
    if (!previousValue) return false;
    return entry.value.toLowerCase() !== previousValue.toLowerCase();
  });
  filtered.push(nextEntry);

  const saved = await saveFallbackMemories(kv, userId, filtered, env);
  if (!saved) {
    return {
      success: false,
      status: 500,
      text: 'Erinnerung konnte nicht aktualisiert werden.',
    };
  }

  if (key === 'name') {
    await syncUserNameLookup(kv, env, userId, value, previousName);
  }

  if (SINGLETON_MEMORY_KEYS.has(key)) {
    await deleteVectorizeMemoryByMetadata(env, { userId, key });
  } else if (previousValue) {
    await deleteVectorizeMemoryByMetadata(env, {
      userId,
      key,
      value: previousValue,
    });
  }
  await upsertVectorizeMemory(env, userId, nextEntry);

  const memories = await loadFallbackMemories(kv, userId, env, {
    persistPruned: true,
  });
  await syncAdminUserIndex(env, kv, userId, memories);

  return {
    success: true,
    status: 200,
    text: `**${key}** wurde aktualisiert.`,
    memories: orderMemories(memories),
    profile: buildProfileInfo(userId, memories),
  };
}

export async function forgetSingleMemory(kv, env, userId, body) {
  const key = normalizeMemoryKey(body?.key);
  const value = normalizeMemoryText(body?.value || '');
  if (!key) {
    return { success: false, status: 400, text: 'Memory-Key fehlt.' };
  }

  const existing = await loadFallbackMemories(kv, userId, env, {
    persistPruned: true,
  });
  const previousName = normalizeMemoryText(
    getLatestMemoryEntry(existing, 'name')?.value,
  );
  const filtered = existing.filter((entry) => {
    if (entry.key !== key) return true;
    if (SINGLETON_MEMORY_KEYS.has(key)) return false;
    if (!value) return false;
    return entry.value.toLowerCase() !== value.toLowerCase();
  });

  const saved = await saveFallbackMemories(kv, userId, filtered, env);
  if (!saved) {
    return {
      success: false,
      status: 500,
      text: 'Erinnerung konnte nicht entfernt werden.',
    };
  }

  if (key === 'name') {
    await syncUserNameLookup(kv, env, userId, '', previousName);
  }

  if (SINGLETON_MEMORY_KEYS.has(key)) {
    await deleteVectorizeMemoryByMetadata(env, { userId, key });
  } else if (value) {
    await deleteVectorizeMemoryByMetadata(env, { userId, key, value });
  }

  const memories = await loadFallbackMemories(kv, userId, env, {
    persistPruned: true,
  });
  await syncAdminUserIndex(env, kv, userId, memories);

  return {
    success: true,
    status: 200,
    text: `**${key}** wurde entfernt.`,
    memories: orderMemories(memories),
    profile: buildProfileInfo(userId, memories),
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const baseHeaders = new Headers(getCorsHeaders(request, env));

  try {
    const body = await request.json().catch(() => ({}));
    const action = normalizeAction(body?.action);
    const headerUserId = normalizeUserId(
      request.headers.get(USER_ID_HEADER_NAME),
    );
    const cookieUserId = readUserIdFromCookieHeader(
      request.headers.get('Cookie'),
    );
    const bodyUserId = normalizeUserId(body?.userId);
    const userId =
      action === 'disconnect'
        ? headerUserId || cookieUserId || bodyUserId
        : headerUserId || cookieUserId;

    const kv = getMemoryKV(env);
    if (!kv) {
      return Response.json(
        {
          success: false,
          text: 'Cloudflare KV für Memory ist nicht verfügbar.',
        },
        { status: 503, headers: baseHeaders },
      );
    }

    const responseHeaders = new Headers(baseHeaders);

    if (action === 'disconnect') {
      appendSetCookie(responseHeaders, buildUserIdClearCookie(request));
      return Response.json(
        {
          success: true,
          userId: '',
          profile: {
            userId: '',
            name: '',
            status: 'disconnected',
            label: 'Kein aktives Profil',
          },
          text: 'Dieses Gerät ist nicht mehr mit einem Profil verbunden.',
        },
        { headers: responseHeaders },
      );
    }

    if (!userId) {
      return Response.json(
        {
          success: false,
          text: 'Keine aktive User-ID im Request vorhanden.',
        },
        { status: 401, headers: baseHeaders },
      );
    }

    if (bodyUserId && bodyUserId !== userId) {
      return Response.json(
        {
          success: false,
          text: 'User-ID-Mismatch: Zugriff nur auf die angemeldete ID erlaubt.',
        },
        { status: 403, headers: baseHeaders },
      );
    }
    if (action === 'delete') {
      appendSetCookie(responseHeaders, buildUserIdClearCookie(request));
    } else {
      appendSetCookie(responseHeaders, buildUserIdCookie(request, userId));
    }

    if (action === 'list') {
      const memories = await loadFallbackMemories(kv, userId, env, {
        persistPruned: true,
      });
      const retentionDays = parseInteger(
        env?.ROBOT_MEMORY_RETENTION_DAYS,
        DEFAULT_MEMORY_RETENTION_DAYS,
      );
      const ordered = orderMemories(memories);

      return Response.json(
        {
          success: true,
          userId,
          count: ordered.length,
          retentionDays,
          memories: ordered,
          profile: buildProfileInfo(userId, ordered),
          text:
            ordered.length > 0
              ? 'Gespeicherte Erinnerungen erfolgreich geladen.'
              : 'Keine Erinnerungen gespeichert.',
        },
        { headers: responseHeaders },
      );
    }

    if (action === 'update-memory') {
      const result = await updateSingleMemory(kv, env, userId, body);
      return Response.json(
        {
          success: result.success,
          userId,
          memories: result.memories || [],
          profile:
            result.profile || buildProfileInfo(userId, result.memories || []),
          text: result.text,
        },
        {
          status: result.status,
          headers: responseHeaders,
        },
      );
    }

    if (action === 'forget-memory') {
      const result = await forgetSingleMemory(kv, env, userId, body);
      return Response.json(
        {
          success: result.success,
          userId,
          memories: result.memories || [],
          profile:
            result.profile || buildProfileInfo(userId, result.memories || []),
          text: result.text,
        },
        {
          status: result.status,
          headers: responseHeaders,
        },
      );
    }

    const deleted = await deleteUserProfile(kv, env, userId);

    return Response.json(
      {
        success: true,
        userId,
        deleted,
        text: 'User-ID und verknüpfte Erinnerungen wurden aus Cloudflare gelöscht. Neue User-ID wird beim nächsten Chat automatisch verwendet.',
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    console.error('[ai-agent-user] Delete failed:', error?.message || error);
    return Response.json(
      {
        success: false,
        text: 'Cloudflare-Löschung fehlgeschlagen.',
      },
      { status: 500, headers: baseHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
