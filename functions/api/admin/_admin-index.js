import { normalizeUserId } from '../_user-identity.js';
import { getErrorMessage } from './_admin-utils.js';

const FALLBACK_MEMORY_PREFIX = 'robot-memory:';
const USERNAME_LOOKUP_PREFIX = 'username:';
const USERNAME_LOOKUP_CONFLICT = '__conflict__';
const DEFAULT_MEMORY_RETENTION_DAYS = 180;
const DEFAULT_SOFT_DELETE_RETENTION_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_KV_SCAN_PAGES = 100;
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

function parseInteger(value, fallback, { min = 1, max = 3650 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
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

export function normalizeAdminLookupName(rawName) {
  return normalizeLookupName(rawName);
}

function normalizeTimestamp(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;

  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getMemoryRetentionMs(env) {
  const days = parseInteger(
    env?.ROBOT_MEMORY_RETENTION_DAYS,
    DEFAULT_MEMORY_RETENTION_DAYS,
  );
  return days * DAY_IN_MS;
}

function getSoftDeleteRetentionDays(env) {
  return parseInteger(
    env?.ADMIN_SOFT_DELETE_RETENTION_DAYS,
    DEFAULT_SOFT_DELETE_RETENTION_DAYS,
  );
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

function normalizeMemoryEntry(entry, retentionMs) {
  const metadata = resolveMemoryMetadata(
    entry?.key,
    entry?.category,
    entry?.priority,
  );
  const value = normalizeMemoryText(entry?.value || '');
  const timestamp = normalizeTimestamp(entry?.timestamp);
  const expiresAt =
    normalizeTimestamp(entry?.expiresAt) ||
    (timestamp ? timestamp + retentionMs : 0);

  if (!value) return null;

  return {
    ...metadata,
    value,
    timestamp: timestamp || null,
    expiresAt: expiresAt || null,
  };
}

function orderMemories(memories = []) {
  return [...memories].sort((a, b) => {
    const priorityDiff = (b.priority || 0) - (a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
}

function buildProfileInfo(userId, memories = []) {
  const nameMemory = memories.find(
    (memory) => normalizeMemoryKey(memory?.key) === 'name',
  );
  const name = normalizeMemoryText(nameMemory?.value || '');

  return {
    userId: normalizeUserId(userId),
    name,
    status: name ? 'identified' : 'anonymous',
    label: name ? `Profil: ${name}` : 'Profil: neu',
  };
}

function getAdminDb(env) {
  return env?.DB_LIKES?.prepare ? env.DB_LIKES : null;
}

function bindStatement(db, query, bindings = []) {
  const statement = db.prepare(query);
  return bindings.length > 0 ? statement.bind(...bindings) : statement;
}

async function runStatement(db, query, bindings = []) {
  return bindStatement(db, query, bindings).run();
}

async function allStatement(db, query, bindings = []) {
  const result = await bindStatement(db, query, bindings).all();
  return result?.results || [];
}

async function firstStatement(db, query, bindings = []) {
  return bindStatement(db, query, bindings).first();
}

async function listAllKvKeys(kv, prefix) {
  if (!kv?.list) return [];

  const keys = [];
  let cursor = undefined;
  let pages = 0;

  do {
    const page = await kv.list({
      prefix,
      cursor,
      limit: 1000,
    });
    if (Array.isArray(page?.keys)) {
      keys.push(...page.keys);
    }

    const listComplete = page?.list_complete === true || !page?.cursor;
    cursor = listComplete ? undefined : page.cursor;
    pages += 1;
  } while (cursor && pages < MAX_KV_SCAN_PAGES);

  return keys;
}

export async function loadAdminLinkedAliasesFromKv(kv, userId) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId || !kv?.list || !kv?.get) return [];

  const aliases = [];
  const nameKeys = await listAllKvKeys(kv, USERNAME_LOOKUP_PREFIX);

  for (const key of nameKeys) {
    const rawKeyName = String(key?.name || '');
    if (!rawKeyName) continue;

    const rawValue = String((await kv.get(rawKeyName)) || '').trim();
    if (normalizeUserId(rawValue) !== normalizedUserId) continue;

    const name = normalizeLookupName(
      rawKeyName.slice(USERNAME_LOOKUP_PREFIX.length),
    );
    if (!name) continue;

    aliases.push({
      name,
      userId: normalizedUserId,
      rawValue,
      status: 'linked',
    });
  }

  return aliases.sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'de', {
      sensitivity: 'base',
    }),
  );
}

export async function upsertAdminNameMapping(env, name, rawValue) {
  const db = getAdminDb(env);
  const normalizedName = normalizeLookupName(name);
  if (!db || !normalizedName) return { ok: false, skipped: true };

  const cleanRawValue = String(rawValue || '').trim();
  const mappedUserId =
    cleanRawValue === USERNAME_LOOKUP_CONFLICT
      ? ''
      : normalizeUserId(cleanRawValue);
  const status =
    cleanRawValue === USERNAME_LOOKUP_CONFLICT
      ? 'conflict'
      : mappedUserId
        ? 'linked'
        : 'orphan';

  try {
    await runStatement(
      db,
      `
        INSERT INTO admin_name_mappings (name, user_id, raw_value, status, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(name) DO UPDATE SET
          user_id = excluded.user_id,
          raw_value = excluded.raw_value,
          status = excluded.status,
          updated_at = CURRENT_TIMESTAMP
      `,
      [normalizedName, mappedUserId || '', cleanRawValue, status],
    );

    return { ok: true, skipped: false };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      code: /no such table/i.test(getErrorMessage(error))
        ? 'missing_table'
        : 'write_failed',
      error,
    };
  }
}

export async function deleteAdminNameMapping(env, name) {
  const db = getAdminDb(env);
  const normalizedName = normalizeLookupName(name);
  if (!db || !normalizedName) return { ok: false, skipped: true };

  try {
    await runStatement(db, `DELETE FROM admin_name_mappings WHERE name = ?`, [
      normalizedName,
    ]);
    return { ok: true, skipped: false };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      code: /no such table/i.test(getErrorMessage(error))
        ? 'missing_table'
        : 'delete_failed',
      error,
    };
  }
}

export async function deleteAdminUserIndex(env, userId) {
  const db = getAdminDb(env);
  const normalizedUserId = normalizeUserId(userId);
  if (!db || !normalizedUserId) return { ok: false, skipped: true };

  try {
    await runStatement(
      db,
      `DELETE FROM admin_memory_entries WHERE user_id = ?`,
      [normalizedUserId],
    );
    await runStatement(
      db,
      `DELETE FROM admin_name_mappings WHERE user_id = ?`,
      [normalizedUserId],
    );
    await runStatement(
      db,
      `DELETE FROM admin_user_profiles WHERE user_id = ?`,
      [normalizedUserId],
    );
    return { ok: true, skipped: false };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      code: /no such table/i.test(getErrorMessage(error))
        ? 'missing_table'
        : 'delete_failed',
      error,
    };
  }
}

export async function syncAdminUserIndex(env, kv, userId, memories = []) {
  const db = getAdminDb(env);
  const normalizedUserId = normalizeUserId(userId);
  if (!db || !normalizedUserId) return { ok: false, skipped: true };

  try {
    const orderedMemories = orderMemories(memories);

    await runStatement(
      db,
      `DELETE FROM admin_memory_entries WHERE user_id = ?`,
      [normalizedUserId],
    );

    if (orderedMemories.length === 0) {
      await deleteAdminUserIndex(env, normalizedUserId);
      return { ok: true, skipped: false, empty: true };
    }

    for (const memory of orderedMemories) {
      await runStatement(
        db,
        `
          INSERT INTO admin_memory_entries (
            user_id,
            memory_key,
            memory_value,
            category,
            priority,
            timestamp,
            expires_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, memory_key, memory_value) DO UPDATE SET
            category = excluded.category,
            priority = excluded.priority,
            timestamp = excluded.timestamp,
            expires_at = excluded.expires_at,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          normalizedUserId,
          normalizeMemoryKey(memory?.key),
          normalizeMemoryText(memory?.value || ''),
          normalizeMemoryText(memory?.category || DEFAULT_MEMORY_CATEGORY),
          Number(memory?.priority) || DEFAULT_MEMORY_PRIORITY,
          Number(memory?.timestamp) || 0,
          Number(memory?.expiresAt) || null,
        ],
      );
    }

    const profile = buildProfileInfo(normalizedUserId, orderedMemories);
    const latestMemoryAt =
      orderedMemories.reduce(
        (latest, memory) => Math.max(latest, Number(memory?.timestamp) || 0),
        0,
      ) || null;

    await runStatement(
      db,
      `
        INSERT INTO admin_user_profiles (
          user_id,
          display_name,
          status,
          memory_count,
          latest_memory_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          display_name = excluded.display_name,
          status = excluded.status,
          memory_count = excluded.memory_count,
          latest_memory_at = excluded.latest_memory_at,
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        normalizedUserId,
        profile.name || '',
        profile.status,
        orderedMemories.length,
        latestMemoryAt,
      ],
    );

    await runStatement(
      db,
      `DELETE FROM admin_name_mappings WHERE user_id = ?`,
      [normalizedUserId],
    );

    const aliases = await loadAdminLinkedAliasesFromKv(kv, normalizedUserId);
    for (const alias of aliases) {
      await upsertAdminNameMapping(env, alias.name, alias.rawValue);
    }

    return {
      ok: true,
      skipped: false,
      profile,
      aliases,
      memoryCount: orderedMemories.length,
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      code: /no such table/i.test(getErrorMessage(error))
        ? 'missing_table'
        : 'sync_failed',
      error,
    };
  }
}

export async function buildDeletedUserSnapshot(
  env,
  kv,
  userId,
  memories = [],
  { actor = 'admin', reason = '' } = {},
) {
  const normalizedUserId = normalizeUserId(userId);
  const profile = buildProfileInfo(normalizedUserId, memories);
  const aliases = await loadAdminLinkedAliasesFromKv(kv, normalizedUserId);
  const deletedAt = new Date().toISOString();
  const restoreUntil = new Date(
    Date.now() + getSoftDeleteRetentionDays(env) * DAY_IN_MS,
  ).toISOString();

  return {
    userId: normalizedUserId,
    profile,
    aliases,
    memories: orderMemories(memories),
    deletedAt,
    restoreUntil,
    deletedBy: actor,
    deleteReason: String(reason || ''),
  };
}

export async function archiveDeletedUser(env, snapshot) {
  const db = getAdminDb(env);
  if (!db || !snapshot?.userId) return { ok: false, skipped: true };

  try {
    await runStatement(
      db,
      `
        INSERT INTO admin_deleted_profiles (
          user_id,
          display_name,
          snapshot_json,
          deleted_at,
          restore_until,
          deleted_by,
          delete_reason,
          restored_at,
          purged_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          display_name = excluded.display_name,
          snapshot_json = excluded.snapshot_json,
          deleted_at = excluded.deleted_at,
          restore_until = excluded.restore_until,
          deleted_by = excluded.deleted_by,
          delete_reason = excluded.delete_reason,
          restored_at = NULL,
          purged_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        snapshot.userId,
        snapshot.profile?.name || '',
        JSON.stringify(snapshot),
        snapshot.deletedAt || new Date().toISOString(),
        snapshot.restoreUntil || null,
        snapshot.deletedBy || 'admin',
        snapshot.deleteReason || '',
      ],
    );

    return { ok: true, skipped: false };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      code: /no such table/i.test(getErrorMessage(error))
        ? 'missing_table'
        : 'write_failed',
      error,
    };
  }
}

export async function loadArchivedDeletedUser(env, userId) {
  const db = getAdminDb(env);
  const normalizedUserId = normalizeUserId(userId);
  if (!db || !normalizedUserId) return null;

  try {
    const row = await firstStatement(
      db,
      `
        SELECT snapshot_json, deleted_at, restore_until, deleted_by, delete_reason
        FROM admin_deleted_profiles
        WHERE user_id = ?
          AND restored_at IS NULL
          AND purged_at IS NULL
      `,
      [normalizedUserId],
    );

    if (!row?.snapshot_json) return null;

    const snapshot = JSON.parse(row.snapshot_json);
    return {
      ...snapshot,
      deletedAt: row.deleted_at || snapshot.deletedAt || '',
      restoreUntil: row.restore_until || snapshot.restoreUntil || '',
      deletedBy: row.deleted_by || snapshot.deletedBy || 'admin',
      deleteReason: row.delete_reason || snapshot.deleteReason || '',
    };
  } catch {
    return null;
  }
}

export async function markArchivedUserRestored(env, userId) {
  const db = getAdminDb(env);
  const normalizedUserId = normalizeUserId(userId);
  if (!db || !normalizedUserId) return { ok: false, skipped: true };

  try {
    await runStatement(
      db,
      `
        UPDATE admin_deleted_profiles
        SET restored_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `,
      [normalizedUserId],
    );
    return { ok: true, skipped: false };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      code: /no such table/i.test(getErrorMessage(error))
        ? 'missing_table'
        : 'update_failed',
      error,
    };
  }
}

export async function purgeArchivedUser(env, userId) {
  const db = getAdminDb(env);
  const normalizedUserId = normalizeUserId(userId);
  if (!db || !normalizedUserId) return { ok: false, skipped: true };

  try {
    await runStatement(
      db,
      `
        UPDATE admin_deleted_profiles
        SET purged_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `,
      [normalizedUserId],
    );
    return { ok: true, skipped: false };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      code: /no such table/i.test(getErrorMessage(error))
        ? 'missing_table'
        : 'update_failed',
      error,
    };
  }
}

export async function loadExpiredArchivedUsers(
  env,
  { now = Date.now(), limit = 100 } = {},
) {
  const db = getAdminDb(env);
  if (!db) return [];

  try {
    const rows = await allStatement(
      db,
      `
        SELECT user_id, display_name, restore_until
        FROM admin_deleted_profiles
        WHERE restored_at IS NULL
          AND purged_at IS NULL
          AND restore_until IS NOT NULL
          AND restore_until <= ?
        ORDER BY restore_until ASC, deleted_at ASC
        LIMIT ?
      `,
      [new Date(now).toISOString(), Math.max(1, Number(limit) || 100)],
    );

    return rows
      .map((row) => ({
        userId: normalizeUserId(row?.user_id),
        displayName: normalizeMemoryText(row?.display_name || ''),
        restoreUntil: String(row?.restore_until || ''),
      }))
      .filter((row) => row.userId);
  } catch {
    return [];
  }
}

export async function purgeExpiredArchivedUsers(
  env,
  { now = Date.now(), limit = 100 } = {},
) {
  const expiredUsers = await loadExpiredArchivedUsers(env, { now, limit });
  if (expiredUsers.length === 0) {
    return {
      ok: true,
      skipped: false,
      count: 0,
      userIds: [],
      users: [],
    };
  }

  const results = [];
  for (const user of expiredUsers) {
    results.push({
      ...user,
      ...(await purgeArchivedUser(env, user.userId)),
    });
  }

  const purged = results.filter((result) => result.ok);
  return {
    ok: purged.length === results.length,
    skipped: false,
    count: purged.length,
    userIds: purged.map((entry) => entry.userId),
    users: purged,
    attempted: results.length,
  };
}

/**
 * @param {any} env
 * @param {any} kv
 * @param {string} userId
 * @param {{
 *   putMemory?: (userId: string, memories: any[]) => Promise<void>,
 *   putNameMapping?: (name: string, userId: string) => Promise<void>,
 *   upsertVectorMemory?: (userId: string, memory: any) => Promise<void>,
 * }} [operations]
 */
export async function restoreDeletedUserFromArchive(
  env,
  kv,
  userId,
  operations = {},
) {
  const { putMemory, putNameMapping, upsertVectorMemory } = operations;
  const snapshot = await loadArchivedDeletedUser(env, userId);
  const normalizedUserId = normalizeUserId(userId);
  if (!snapshot || !normalizedUserId || typeof putMemory !== 'function') {
    return {
      success: false,
      status: 404,
      text: 'Kein archiviertes Profil fuer diese User-ID gefunden.',
    };
  }

  try {
    const orderedMemories = orderMemories(snapshot.memories || []);
    await putMemory(normalizedUserId, orderedMemories);

    if (typeof putNameMapping === 'function') {
      for (const alias of snapshot.aliases || []) {
        if (!alias?.name) continue;
        await putNameMapping(alias.name, normalizedUserId);
        await upsertAdminNameMapping(env, alias.name, normalizedUserId);
      }
    }

    if (typeof upsertVectorMemory === 'function') {
      for (const memory of orderedMemories) {
        await upsertVectorMemory(normalizedUserId, memory);
      }
    }

    await syncAdminUserIndex(env, kv, normalizedUserId, orderedMemories);
    await markArchivedUserRestored(env, normalizedUserId);

    return {
      success: true,
      status: 200,
      text: 'Archiviertes Profil wurde wiederhergestellt.',
      userId: normalizedUserId,
      memories: orderedMemories,
      count: orderedMemories.length,
      profile: buildProfileInfo(normalizedUserId, orderedMemories),
      restoredFromArchive: true,
      archive: {
        deletedAt: snapshot.deletedAt || '',
        restoreUntil: snapshot.restoreUntil || '',
      },
    };
  } catch (error) {
    return {
      success: false,
      status: 500,
      text:
        getErrorMessage(error) ||
        'Archiviertes Profil konnte nicht wiederhergestellt werden.',
    };
  }
}

export async function backfillAdminIndexesFromKv(env, { force = false } = {}) {
  const db = getAdminDb(env);
  const kv =
    env?.JULES_MEMORY_KV || env?.RATE_LIMIT_KV || env?.SITEMAP_CACHE_KV;
  if (!db || !kv?.list || !kv?.get) {
    return {
      ok: false,
      skipped: true,
      users: 0,
      memories: 0,
      mappings: 0,
    };
  }

  try {
    const userCountRow = await firstStatement(
      db,
      `SELECT COUNT(*) AS total FROM admin_user_profiles`,
    );
    if (!force && Number(userCountRow?.total) > 0) {
      return {
        ok: true,
        skipped: true,
        users: Number(userCountRow?.total) || 0,
        memories: 0,
        mappings: 0,
      };
    }

    await runStatement(db, `DELETE FROM admin_memory_entries`);
    await runStatement(db, `DELETE FROM admin_name_mappings`);
    await runStatement(db, `DELETE FROM admin_user_profiles`);

    const retentionMs = getMemoryRetentionMs(env);
    const memoryKeys = await listAllKvKeys(kv, FALLBACK_MEMORY_PREFIX);
    const userIds = [];
    let memoryCount = 0;

    for (const key of memoryKeys) {
      const rawKeyName = String(key?.name || '');
      const rawUserId = rawKeyName.slice(FALLBACK_MEMORY_PREFIX.length);
      const userId = normalizeUserId(rawUserId);
      if (!userId) continue;

      const rawValue = await kv.get(rawKeyName);
      let parsed = [];
      try {
        const value = JSON.parse(rawValue || '[]');
        parsed = Array.isArray(value)
          ? value
              .map((entry) => normalizeMemoryEntry(entry, retentionMs))
              .filter(Boolean)
          : [];
      } catch {
        parsed = [];
      }

      await syncAdminUserIndex(env, kv, userId, parsed);
      userIds.push(userId);
      memoryCount += parsed.length;
    }

    const mappingKeys = await listAllKvKeys(kv, USERNAME_LOOKUP_PREFIX);
    for (const key of mappingKeys) {
      const rawKeyName = String(key?.name || '');
      const name = rawKeyName.slice(USERNAME_LOOKUP_PREFIX.length);
      const rawValue = await kv.get(rawKeyName);
      await upsertAdminNameMapping(env, name, rawValue);
    }

    return {
      ok: true,
      skipped: false,
      users: userIds.length,
      memories: memoryCount,
      mappings: mappingKeys.length,
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      code: /no such table/i.test(getErrorMessage(error))
        ? 'missing_table'
        : 'backfill_failed',
      error,
      users: 0,
      memories: 0,
      mappings: 0,
    };
  }
}

export async function loadIndexedUsers(db, userIds = []) {
  if (!db || !Array.isArray(userIds) || userIds.length === 0) return [];

  const placeholders = userIds.map(() => '?').join(', ');
  const rows = await allStatement(
    db,
    `
      SELECT user_id, memory_key, memory_value, category, priority, timestamp, expires_at
      FROM admin_memory_entries
      WHERE user_id IN (${placeholders})
      ORDER BY timestamp DESC
    `,
    userIds,
  );
  const aliases = await allStatement(
    db,
    `
      SELECT name, user_id
      FROM admin_name_mappings
      WHERE user_id IN (${placeholders})
      ORDER BY name ASC
    `,
    userIds,
  );

  const memoriesByUser = new Map();
  const aliasesByUser = new Map();

  for (const row of rows) {
    const userId = normalizeUserId(row?.user_id);
    if (!userId) continue;
    if (!memoriesByUser.has(userId)) memoriesByUser.set(userId, []);
    memoriesByUser.get(userId).push({
      key: row?.memory_key || '',
      category: row?.category || DEFAULT_MEMORY_CATEGORY,
      priority: Number(row?.priority) || DEFAULT_MEMORY_PRIORITY,
      value: row?.memory_value || '',
      timestamp: Number(row?.timestamp) || null,
      expiresAt: Number(row?.expires_at) || null,
    });
  }

  for (const row of aliases) {
    const userId = normalizeUserId(row?.user_id);
    if (!userId) continue;
    if (!aliasesByUser.has(userId)) aliasesByUser.set(userId, []);
    aliasesByUser.get(userId).push(String(row?.name || ''));
  }

  return userIds.map((userId) => {
    const memories = orderMemories(memoriesByUser.get(userId) || []);
    return {
      userId,
      aliases: aliasesByUser.get(userId) || [],
      memoryKeys: [...new Set(memories.map((memory) => memory.key))].sort(
        (a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }),
      ),
      memories,
    };
  });
}
