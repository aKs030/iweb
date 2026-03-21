import { normalizeUserId } from '../_user-identity.js';
import {
  buildProfileInfo,
  compactMemoryEntries,
  deleteUserProfile,
  deleteVectorizeMemoriesForUser,
  forgetSingleMemory,
  getMemoryKV,
  loadFallbackMemories,
  orderMemories,
  updateSingleMemory,
  upsertVectorizeMemory,
} from '../ai-agent-user.js';
import {
  deleteAdminNameMapping,
  loadAdminLinkedAliasesFromKv,
  normalizeAdminLookupName,
  purgeArchivedUser,
  purgeExpiredArchivedUsers,
  restoreDeletedUserFromArchive,
  syncAdminUserIndex,
  upsertAdminNameMapping,
} from './_admin-index.js';
import {
  authorizeAdmin,
  getErrorMessage,
  jsonResponse,
  writeAdminAuditLog,
} from './_admin-utils.js';

const FALLBACK_MEMORY_PREFIX = 'robot-memory:';
const USERNAME_LOOKUP_PREFIX = 'username:';
const PURGE_CONFIRM_PREFIX = 'admin:purge-confirm:';
const PURGE_JOB_PREFIX = 'admin:purge-job:';
const PURGE_COOLDOWN_KEY = 'admin:purge-cooldown:next';
const MAX_KV_PURGE_SCAN_PAGES = 500;
const KV_PURGE_BATCH_SIZE = 100;
const PURGE_CONFIRM_TTL_MS = 2 * 60 * 1000;
const PURGE_JOB_TTL_SECONDS = 60 * 60 * 24;
const PURGE_COOLDOWN_MS = 5 * 60 * 1000;
const PURGE_STATUS_POLL_AFTER_MS = 1500;
const PURGE_PREFIXES = [FALLBACK_MEMORY_PREFIX, USERNAME_LOOKUP_PREFIX];
const ADMIN_PROFILE_TABLES = [
  'admin_memory_entries',
  'admin_name_mappings',
  'admin_user_profiles',
  'admin_deleted_profiles',
];
const VECTORIZE_FAST_DELETE_METHODS = [
  'deleteByMetadata',
  'deleteByFilter',
  'deleteByMetadataFilter',
];

function normalizeAction(raw) {
  const value = String(raw || 'list-user')
    .toLowerCase()
    .trim();

  if (value === 'update-memory' || value === 'updatememory') {
    return 'update-memory';
  }
  if (
    value === 'delete-memory' ||
    value === 'deletememory' ||
    value === 'forget-memory' ||
    value === 'forgetmemory'
  ) {
    return 'delete-memory';
  }
  if (
    value === 'bulk-delete-memories' ||
    value === 'bulkdeletememories' ||
    value === 'bulk-delete-memory'
  ) {
    return 'bulk-delete-memories';
  }
  if (value === 'delete-user' || value === 'deleteuser') {
    return 'delete-user';
  }
  if (
    value === 'bulk-delete-users' ||
    value === 'bulkdeleteusers' ||
    value === 'bulk-delete-user'
  ) {
    return 'bulk-delete-users';
  }
  if (value === 'restore-user' || value === 'restoreuser') {
    return 'restore-user';
  }
  if (
    value === 'bulk-restore-users' ||
    value === 'bulkrestoreusers' ||
    value === 'bulk-restore-user'
  ) {
    return 'bulk-restore-users';
  }
  if (
    value === 'purge-user' ||
    value === 'purgeuser' ||
    value === 'hard-delete-user'
  ) {
    return 'purge-user';
  }
  if (
    value === 'bulk-purge-users' ||
    value === 'bulkpurgeusers' ||
    value === 'bulk-purge-user'
  ) {
    return 'bulk-purge-users';
  }
  if (
    value === 'assign-alias' ||
    value === 'assignalias' ||
    value === 'link-alias'
  ) {
    return 'assign-alias';
  }
  if (
    value === 'remove-alias' ||
    value === 'removealias' ||
    value === 'delete-alias'
  ) {
    return 'remove-alias';
  }
  if (
    value === 'merge-users' ||
    value === 'mergeusers' ||
    value === 'merge-user'
  ) {
    return 'merge-users';
  }
  if (
    value === 'purge-expired-archives' ||
    value === 'purgeexpiredarchives' ||
    value === 'purge-expired-archive'
  ) {
    return 'purge-expired-archives';
  }
  if (value === 'purge-everything') {
    return 'purge-everything';
  }
  if (
    value === 'request-purge-everything-confirmation' ||
    value === 'request-purge-confirmation'
  ) {
    return 'request-purge-everything-confirmation';
  }
  if (
    value === 'purge-everything-status' ||
    value === 'purge-status' ||
    value === 'purge-everything-job-status'
  ) {
    return 'purge-everything-status';
  }

  return 'list-user';
}

function normalizeUserIds(rawUserIds) {
  const values = Array.isArray(rawUserIds) ? rawUserIds : [];
  return [
    ...new Set(values.map((value) => normalizeUserId(value)).filter(Boolean)),
  ];
}

function buildSuccessPayload(userId, result, audit = null) {
  const ordered = orderMemories(result.memories || []);
  return {
    success: result.success !== false,
    userId,
    memories: ordered,
    count: ordered.length,
    profile: result.profile || buildProfileInfo(userId, ordered),
    aliases: Array.isArray(result.aliases) ? result.aliases : [],
    deleted: result.deleted || null,
    archived: result.archived || null,
    restoredFromArchive: !!result.restoredFromArchive,
    text: result.text || '',
    audit,
  };
}

function createMemoryKey(userId) {
  return `${FALLBACK_MEMORY_PREFIX}${userId}`;
}

function createUsernameLookupKey(name) {
  const normalizedAlias = normalizeAdminLookupName(name);
  return normalizedAlias ? `${USERNAME_LOOKUP_PREFIX}${normalizedAlias}` : '';
}

function nowIso() {
  return new Date().toISOString();
}

function normalizePurgeJobId(rawJobId) {
  return String(rawJobId || '')
    .trim()
    .replace(/[^a-z0-9_-]/gi, '')
    .slice(0, 80);
}

function createPurgeJobId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `purge_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }
  return `purge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createPurgeToken() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `pc_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

function createPurgeConfirmKey(token) {
  return `${PURGE_CONFIRM_PREFIX}${token}`;
}

function createPurgeJobKey(jobId) {
  return `${PURGE_JOB_PREFIX}${jobId}`;
}

function createInitialPurgeJob(jobId, auth) {
  return {
    jobId,
    status: 'queued',
    phase: 'queued',
    actor: auth?.actor || 'admin',
    sourceIp: auth?.sourceIp || '',
    text: 'Purge-Job wurde gestartet und wartet auf Ausführung.',
    progress: {
      prefixesTotal: PURGE_PREFIXES.length,
      prefixesDone: 0,
      scannedKvKeys: 0,
      deletedKvKeys: 0,
      vectorizeUsersTotal: 0,
      vectorizeUsersProcessed: 0,
    },
    result: null,
    error: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    startedAt: '',
    finishedAt: '',
  };
}

async function readJsonFromKv(kv, key, fallback = null) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonToKv(kv, key, payload, ttlSeconds = null) {
  const value = JSON.stringify(payload);
  if (ttlSeconds && Number(ttlSeconds) > 0) {
    await kv.put(key, value, {
      expirationTtl: Math.max(1, Math.floor(Number(ttlSeconds))),
    });
    return;
  }
  await kv.put(key, value);
}

async function readPurgeJob(kv, jobId) {
  const normalizedJobId = normalizePurgeJobId(jobId);
  if (!normalizedJobId) return null;
  return readJsonFromKv(kv, createPurgeJobKey(normalizedJobId), null);
}

async function writePurgeJob(kv, job) {
  if (!job?.jobId) return;
  job.updatedAt = nowIso();
  await writeJsonToKv(
    kv,
    createPurgeJobKey(job.jobId),
    job,
    PURGE_JOB_TTL_SECONDS,
  );
}

async function updatePurgeJob(kv, jobId, updater) {
  const current = await readPurgeJob(kv, jobId);
  if (!current) return null;
  const next =
    typeof updater === 'function'
      ? updater(current) || current
      : { ...current, ...updater };
  await writePurgeJob(kv, next);
  return next;
}

async function createPurgeConfirmationToken(kv, auth) {
  const token = createPurgeToken();
  const expiresAtMs = Date.now() + PURGE_CONFIRM_TTL_MS;
  const payload = {
    actor: auth?.actor || 'admin',
    sourceIp: auth?.sourceIp || '',
    createdAt: nowIso(),
    expiresAtMs,
  };
  await writeJsonToKv(
    kv,
    createPurgeConfirmKey(token),
    payload,
    Math.ceil(PURGE_CONFIRM_TTL_MS / 1000),
  );
  return {
    token,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

async function consumePurgeConfirmationToken(kv, token, auth) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    return {
      ok: false,
      status: 400,
      text: 'Bestaetigungstoken fehlt.',
    };
  }

  const key = createPurgeConfirmKey(normalizedToken);
  const payload = await readJsonFromKv(kv, key, null);
  if (!payload) {
    return {
      ok: false,
      status: 400,
      text: 'Bestaetigungstoken ungueltig oder bereits verwendet.',
    };
  }

  await kv.delete(key);

  if (payload.actor && payload.actor !== auth?.actor) {
    return {
      ok: false,
      status: 403,
      text: 'Bestaetigungstoken gehoert zu einer anderen Session.',
    };
  }

  const expiresAtMs = Number(payload.expiresAtMs) || 0;
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
    return {
      ok: false,
      status: 400,
      text: 'Bestaetigungstoken ist abgelaufen.',
    };
  }

  return {
    ok: true,
  };
}

async function enforcePurgeCooldown(kv) {
  const now = Date.now();
  const nextAllowedRaw = await kv.get(PURGE_COOLDOWN_KEY);
  const nextAllowedAt = Number.parseInt(String(nextAllowedRaw || ''), 10);

  if (Number.isFinite(nextAllowedAt) && nextAllowedAt > now) {
    return {
      ok: false,
      retryAfterMs: nextAllowedAt - now,
    };
  }

  const next = now + PURGE_COOLDOWN_MS;
  await kv.put(PURGE_COOLDOWN_KEY, String(next), {
    expirationTtl: Math.ceil(PURGE_COOLDOWN_MS / 1000) + 60,
  });

  return {
    ok: true,
    nextAllowedAt: next,
  };
}

async function listKvKeysByPrefix(kv, prefix) {
  const keyNames = [];
  let cursor = undefined;
  let pages = 0;

  do {
    const page = await kv.list({
      prefix,
      cursor,
      limit: 1000,
    });
    const keys = Array.isArray(page?.keys) ? page.keys : [];
    for (const key of keys) {
      const keyName = String(key?.name || '').trim();
      if (keyName) keyNames.push(keyName);
    }

    const listComplete = page?.list_complete === true || !page?.cursor;
    cursor = listComplete ? undefined : page.cursor;
    pages += 1;
  } while (cursor && pages < MAX_KV_PURGE_SCAN_PAGES);

  return keyNames;
}

async function clearAdminProfileTables(env) {
  const db = env?.DB_LIKES?.prepare ? env.DB_LIKES : null;
  if (!db) {
    return {
      available: false,
      cleared: {},
    };
  }

  const cleared = {};
  for (const table of ADMIN_PROFILE_TABLES) {
    try {
      const result = await db.prepare(`DELETE FROM ${table}`).run();
      const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
      cleared[table] = Number.isFinite(changes) ? changes : 0;
    } catch (error) {
      if (/no such table/i.test(getErrorMessage(error))) {
        cleared[table] = null;
        continue;
      }
      throw error;
    }
  }

  return {
    available: true,
    cleared,
  };
}

function hasFastVectorizeDeleteMethod(env) {
  const index = env?.JULES_MEMORY;
  if (!index) return false;
  return VECTORIZE_FAST_DELETE_METHODS.some(
    (method) => typeof index[method] === 'function',
  );
}

async function purgeVectorizeForUsers(
  env,
  rawUserIds = [],
  { onProgress = null } = {},
) {
  const userIds = [
    ...new Set(
      rawUserIds.map((userId) => normalizeUserId(userId)).filter(Boolean),
    ),
  ];

  const configured = !!env?.JULES_MEMORY;
  const fastDeleteAvailable = hasFastVectorizeDeleteMethod(env);
  if (userIds.length === 0) {
    return {
      users: 0,
      configured,
      fastDeleteAvailable,
      attempted: 0,
      skipped: true,
      reason: 'no-users',
    };
  }

  if (!configured || !fastDeleteAvailable) {
    return {
      users: userIds.length,
      configured,
      fastDeleteAvailable,
      attempted: 0,
      skipped: true,
      reason: configured ? 'no-fast-delete-method' : 'not-configured',
    };
  }

  const modeCounts = {};
  let attempted = 0;
  let processed = 0;

  for (const userId of userIds) {
    const result = await deleteVectorizeMemoriesForUser(env, userId);
    processed += 1;
    if (result?.attempted) attempted += 1;
    const mode = String(result?.mode || 'unknown');
    modeCounts[mode] = (modeCounts[mode] || 0) + 1;
    const progressResult = onProgress?.({
      userId,
      processed,
      total: userIds.length,
      mode,
      attempted: !!result?.attempted,
    });
    if (
      progressResult &&
      typeof progressResult === 'object' &&
      typeof progressResult.then === 'function'
    ) {
      await progressResult;
    }
  }

  return {
    users: userIds.length,
    configured,
    fastDeleteAvailable,
    attempted,
    skipped: false,
    modes: modeCounts,
  };
}

async function loadUserAliases(kv, userId) {
  const aliases = await loadAdminLinkedAliasesFromKv(kv, userId);
  return aliases.map((entry) => entry.name).filter(Boolean);
}

async function assignAliasToUser(kv, env, userId, alias) {
  const normalizedAlias = normalizeAdminLookupName(alias);
  const lookupKey = createUsernameLookupKey(normalizedAlias);
  if (!lookupKey) {
    return {
      success: false,
      status: 400,
      text: 'Alias fehlt oder ist ungueltig.',
    };
  }

  const previousRawValue = String((await kv.get(lookupKey)) || '').trim();
  const previousUserId = normalizeUserId(previousRawValue);

  await kv.put(lookupKey, userId);
  await upsertAdminNameMapping(env, normalizedAlias, userId);

  const memories = await loadFallbackMemories(kv, userId, env, {
    persistPruned: true,
  });
  await syncAdminUserIndex(env, kv, userId, memories);

  return {
    success: true,
    status: 200,
    text: `Alias "${normalizedAlias}" wurde ${userId} zugewiesen.`,
    userId,
    alias: normalizedAlias,
    previousUserId,
    memories: orderMemories(memories),
    profile: buildProfileInfo(userId, memories),
    aliases: await loadUserAliases(kv, userId),
  };
}

async function removeAliasFromUser(kv, env, alias, fallbackUserId = '') {
  const normalizedAlias = normalizeAdminLookupName(alias);
  const lookupKey = createUsernameLookupKey(normalizedAlias);
  if (!lookupKey) {
    return {
      success: false,
      status: 400,
      text: 'Alias fehlt oder ist ungueltig.',
    };
  }

  const previousRawValue = String((await kv.get(lookupKey)) || '').trim();
  const previousUserId = normalizeUserId(previousRawValue);
  const targetUserId = previousUserId || normalizeUserId(fallbackUserId);

  if (kv?.delete) {
    await kv.delete(lookupKey);
  }
  await deleteAdminNameMapping(env, normalizedAlias);

  const memories = targetUserId
    ? await loadFallbackMemories(kv, targetUserId, env, {
        persistPruned: true,
      })
    : [];

  if (targetUserId) {
    await syncAdminUserIndex(env, kv, targetUserId, memories);
  }

  return {
    success: true,
    status: 200,
    text: `Alias "${normalizedAlias}" wurde entfernt.`,
    userId: targetUserId,
    alias: normalizedAlias,
    previousUserId,
    memories: orderMemories(memories),
    profile: targetUserId ? buildProfileInfo(targetUserId, memories) : null,
    aliases: targetUserId ? await loadUserAliases(kv, targetUserId) : [],
  };
}

async function mergeUserProfiles(kv, env, sourceUserId, targetUserId) {
  const sourceMemories = await loadFallbackMemories(kv, sourceUserId, env, {
    persistPruned: true,
  });
  const targetMemories = await loadFallbackMemories(kv, targetUserId, env, {
    persistPruned: true,
  });
  const mergedMemories = orderMemories(
    compactMemoryEntries([...targetMemories, ...sourceMemories], env),
  );
  const sourceAliases = await loadAdminLinkedAliasesFromKv(kv, sourceUserId);

  await kv.put(createMemoryKey(targetUserId), JSON.stringify(mergedMemories));

  for (const alias of sourceAliases) {
    const lookupKey = createUsernameLookupKey(alias.name);
    if (!lookupKey) continue;
    await kv.put(lookupKey, targetUserId);
    await upsertAdminNameMapping(env, alias.name, targetUserId);
  }

  await deleteVectorizeMemoriesForUser(env, targetUserId);
  for (const memory of mergedMemories) {
    await upsertVectorizeMemory(env, targetUserId, memory);
  }

  await syncAdminUserIndex(env, kv, targetUserId, mergedMemories);
  const deleted = await deleteUserProfile(kv, env, sourceUserId);

  return {
    success: true,
    status: 200,
    text: `${sourceUserId} wurde in ${targetUserId} zusammengefuehrt.`,
    userId: targetUserId,
    sourceUserId,
    targetUserId,
    transferredAliases: sourceAliases
      .map((entry) => entry.name)
      .filter(Boolean),
    deleted,
    memories: mergedMemories,
    profile: buildProfileInfo(targetUserId, mergedMemories),
    aliases: await loadUserAliases(kv, targetUserId),
  };
}

async function auditAction(env, auth, entry) {
  return writeAdminAuditLog(env, {
    actor: auth.actor,
    sourceIp: auth.sourceIp,
    ...entry,
  });
}

async function restoreUserProfile(kv, env, userId) {
  return restoreDeletedUserFromArchive(env, kv, userId, {
    putMemory: async (targetUserId, memories) => {
      await kv.put(createMemoryKey(targetUserId), JSON.stringify(memories));
    },
    putNameMapping: async (name, targetUserId) => {
      await kv.put(createUsernameLookupKey(name), targetUserId);
    },
    upsertVectorMemory: async (targetUserId, memory) => {
      await upsertVectorizeMemory(env, targetUserId, memory);
    },
  });
}

async function deleteUserDirectly(kv, env, userId, auth, reason = '') {
  const memories = await loadFallbackMemories(kv, userId, env, {
    persistPruned: true,
  });
  const aliases = await loadUserAliases(kv, userId);
  const profile = buildProfileInfo(userId, memories);
  const deleted = await deleteUserProfile(kv, env, userId);

  return {
    success: true,
    userId,
    deleted,
    archived: null,
    memories: [],
    count: 0,
    profile: {
      userId,
      name: profile.name || '',
      status: 'deleted',
      label: 'Profil geloescht',
    },
    text: 'Benutzerprofil wurde endgueltig geloescht.',
    before: {
      userId,
      profile,
      aliases,
      memories: orderMemories(memories),
      deletedBy: auth.actor,
      deleteReason: String(reason || ''),
    },
  };
}

async function bulkDeleteUsers(kv, env, userIds, auth, reason = '') {
  const results = [];
  for (const userId of userIds) {
    results.push(await deleteUserDirectly(kv, env, userId, auth, reason));
  }
  return results;
}

async function bulkRestoreUsers(kv, env, userIds) {
  const results = [];
  for (const userId of userIds) {
    results.push(await restoreUserProfile(kv, env, userId));
  }
  return results;
}

async function bulkPurgeUsers(env, userIds) {
  const results = [];
  for (const userId of userIds) {
    results.push(await purgeArchivedUser(env, userId));
  }
  return results;
}

async function runPurgeEverythingJob(kv, env, jobId, auth) {
  const existingJob = await readPurgeJob(kv, jobId);
  if (!existingJob) return;

  await updatePurgeJob(kv, jobId, (job) => ({
    ...job,
    status: 'running',
    phase: 'scanning',
    startedAt: job.startedAt || nowIso(),
    text: 'Scanne KV nach Nutzer- und Alias-Eintraegen…',
  }));

  try {
    const kvKeysByPrefix = {};
    const uniqueKvKeys = new Set();
    const memoryUserIds = [];
    let prefixesDone = 0;

    for (const prefix of PURGE_PREFIXES) {
      const keys = await listKvKeysByPrefix(kv, prefix);
      kvKeysByPrefix[prefix] = keys.length;
      prefixesDone += 1;

      for (const key of keys) {
        uniqueKvKeys.add(key);
        if (prefix === FALLBACK_MEMORY_PREFIX) {
          const maybeUserId = normalizeUserId(
            key.slice(FALLBACK_MEMORY_PREFIX.length),
          );
          if (maybeUserId) memoryUserIds.push(maybeUserId);
        }
      }

      await updatePurgeJob(kv, jobId, (job) => ({
        ...job,
        phase: 'scanning',
        text: 'Scanne KV nach Nutzer- und Alias-Eintraegen…',
        progress: {
          ...job.progress,
          prefixesDone,
          scannedKvKeys: uniqueKvKeys.size,
        },
      }));
    }

    const vectorizeUserIds = [
      ...new Set(
        memoryUserIds.map((item) => normalizeUserId(item)).filter(Boolean),
      ),
    ];

    await updatePurgeJob(kv, jobId, (job) => ({
      ...job,
      phase: 'vectorize',
      text: 'Bereinige Vectorize-Index…',
      progress: {
        ...job.progress,
        vectorizeUsersTotal: vectorizeUserIds.length,
        vectorizeUsersProcessed: 0,
      },
    }));

    const vectorizeCleanup = await purgeVectorizeForUsers(
      env,
      vectorizeUserIds,
      {
        onProgress: ({ processed, total }) => {
          return updatePurgeJob(kv, jobId, (job) => ({
            ...job,
            phase: 'vectorize',
            text: 'Bereinige Vectorize-Index…',
            progress: {
              ...job.progress,
              vectorizeUsersTotal: total,
              vectorizeUsersProcessed: processed,
            },
          }));
        },
      },
    );

    const kvKeys = [...uniqueKvKeys];
    let deletedKvKeys = 0;

    await updatePurgeJob(kv, jobId, (job) => ({
      ...job,
      phase: 'deleting',
      text: 'Loesche KV-Eintraege…',
      progress: {
        ...job.progress,
        scannedKvKeys: kvKeys.length,
        deletedKvKeys: 0,
      },
    }));

    for (let index = 0; index < kvKeys.length; index += KV_PURGE_BATCH_SIZE) {
      const batch = kvKeys.slice(index, index + KV_PURGE_BATCH_SIZE);
      await Promise.all(batch.map((keyName) => kv.delete(keyName)));
      deletedKvKeys += batch.length;

      await updatePurgeJob(kv, jobId, (job) => ({
        ...job,
        phase: 'deleting',
        text: `Loesche KV-Eintraege… (${deletedKvKeys}/${kvKeys.length})`,
        progress: {
          ...job.progress,
          deletedKvKeys,
        },
      }));
    }

    await updatePurgeJob(kv, jobId, (job) => ({
      ...job,
      phase: 'cleaning-indexes',
      text: 'Bereinige Admin-Indizes…',
      progress: {
        ...job.progress,
        deletedKvKeys,
      },
    }));

    const d1Cleanup = await clearAdminProfileTables(env);

    const audit = await auditAction(env, auth, {
      action: 'purge-everything',
      targetUserId: 'ALL',
      status: 'success',
      summary: `${deletedKvKeys} KV-Eintraege und Admin-Profile bereinigt.`,
      details: {
        deletedKvKeys,
        kvKeysByPrefix,
        vectorizeCleanup,
        d1Cleanup,
        jobId,
      },
    });

    await updatePurgeJob(kv, jobId, (job) => ({
      ...job,
      status: 'completed',
      phase: 'completed',
      finishedAt: nowIso(),
      text: `Purge abgeschlossen: ${deletedKvKeys} KV-Eintraege geloescht.`,
      error: '',
      result: {
        deletedKvKeys,
        kvKeysByPrefix,
        vectorizeCleanup,
        d1Cleanup,
        audit,
      },
      progress: {
        ...job.progress,
        prefixesDone: PURGE_PREFIXES.length,
        scannedKvKeys: kvKeys.length,
        deletedKvKeys,
        vectorizeUsersTotal: vectorizeCleanup.users || 0,
        vectorizeUsersProcessed: vectorizeCleanup.users || 0,
      },
    }));
  } catch (error) {
    const errorText = getErrorMessage(error) || 'purge_everything_failed';
    console.error('[admin-users] purge job failed:', errorText);

    try {
      await auditAction(env, auth, {
        action: 'purge-everything',
        targetUserId: 'ALL',
        status: 'error',
        summary: 'Purge-Job fehlgeschlagen.',
        details: {
          jobId,
          error: errorText,
        },
      });
    } catch (auditError) {
      console.warn(
        '[admin-users] purge error audit failed:',
        getErrorMessage(auditError),
      );
    }

    await updatePurgeJob(kv, jobId, (job) => ({
      ...job,
      status: 'failed',
      phase: 'failed',
      finishedAt: nowIso(),
      text: 'Purge-Job fehlgeschlagen.',
      error: errorText,
    }));
  }
}

export async function onRequestPost(context) {
  const auth = await authorizeAdmin(context.request, context.env);
  if (!auth.ok) return auth.response;

  try {
    const body = await context.request.json().catch(() => ({}));
    const action = normalizeAction(body?.action);
    const userId = normalizeUserId(body?.userId);
    const kv = getMemoryKV(context.env);

    if (!kv) {
      return jsonResponse(
        {
          success: false,
          text: 'Cloudflare KV fuer Memory ist nicht verfuegbar.',
        },
        503,
      );
    }

    if (action === 'request-purge-everything-confirmation') {
      const confirmation = await createPurgeConfirmationToken(kv, auth);
      return jsonResponse({
        success: true,
        confirmToken: confirmation.token,
        expiresAt: confirmation.expiresAt,
        text: 'Bestaetigungstoken erstellt. Bitte purge-everything sofort ausfuehren.',
      });
    }

    if (action === 'purge-everything-status') {
      const jobId = normalizePurgeJobId(body?.jobId);
      if (!jobId) {
        return jsonResponse(
          {
            success: false,
            text: 'Job-ID fehlt.',
          },
          400,
        );
      }

      const job = await readPurgeJob(kv, jobId);
      if (!job) {
        return jsonResponse(
          {
            success: false,
            text: 'Purge-Job nicht gefunden oder bereits abgelaufen.',
          },
          404,
        );
      }

      return jsonResponse({
        success: true,
        job,
        pollAfterMs: PURGE_STATUS_POLL_AFTER_MS,
      });
    }

    if (action === 'purge-everything') {
      const confirmationResult = await consumePurgeConfirmationToken(
        kv,
        body?.confirmToken,
        auth,
      );
      if (!confirmationResult.ok) {
        return jsonResponse(
          {
            success: false,
            text: confirmationResult.text,
          },
          confirmationResult.status || 400,
        );
      }

      const cooldown = await enforcePurgeCooldown(kv);
      if (!cooldown.ok) {
        const retryAfterSec = Math.max(
          1,
          Math.ceil((cooldown.retryAfterMs || PURGE_COOLDOWN_MS) / 1000),
        );
        const headers = new Headers();
        headers.set('Retry-After', String(retryAfterSec));
        return jsonResponse(
          {
            success: false,
            text: `Purge ist aktuell gesperrt. Bitte in ${retryAfterSec}s erneut versuchen.`,
          },
          429,
          headers,
        );
      }

      const jobId = createPurgeJobId();
      const job = createInitialPurgeJob(jobId, auth);
      await writePurgeJob(kv, job);

      const backgroundTask = runPurgeEverythingJob(
        kv,
        context.env,
        jobId,
        auth,
      );
      if (typeof context.waitUntil === 'function') {
        context.waitUntil(backgroundTask);
      } else {
        await backgroundTask;
      }

      return jsonResponse({
        success: true,
        jobId,
        status: 'queued',
        pollAfterMs: PURGE_STATUS_POLL_AFTER_MS,
        text: 'Purge-Job wurde gestartet.',
      });
    }

    if (action === 'bulk-delete-users') {
      const userIds = normalizeUserIds(body?.userIds);
      if (userIds.length === 0) {
        return jsonResponse(
          {
            success: false,
            text: 'Keine gueltigen User-IDs fuer Bulk-Loeschung uebergeben.',
          },
          400,
        );
      }

      const results = await bulkDeleteUsers(
        kv,
        context.env,
        userIds,
        auth,
        String(body?.reason || ''),
      );
      const audit = await auditAction(context.env, auth, {
        action: 'bulk-delete-users',
        targetUserId: userIds.join(','),
        status: 'success',
        summary: `${userIds.length} Benutzerprofile geloescht.`,
        details: {
          userIds,
        },
        before: {
          count: userIds.length,
        },
        after: {
          deleted: results.length,
        },
      });

      return jsonResponse({
        success: true,
        results,
        count: results.length,
        text: `${results.length} Benutzerprofile wurden geloescht.`,
        audit,
      });
    }

    if (action === 'bulk-restore-users') {
      const userIds = normalizeUserIds(body?.userIds);
      if (userIds.length === 0) {
        return jsonResponse(
          {
            success: false,
            text: 'Keine gueltigen User-IDs fuer Bulk-Wiederherstellung uebergeben.',
          },
          400,
        );
      }

      const results = await bulkRestoreUsers(kv, context.env, userIds);
      const restored = results.filter((result) => result.success !== false);
      const audit = await auditAction(context.env, auth, {
        action: 'bulk-restore-users',
        targetUserId: userIds.join(','),
        status: 'success',
        summary: `${restored.length} archivierte Benutzerprofile wiederhergestellt.`,
        details: {
          userIds,
        },
        after: {
          restored: restored.length,
        },
      });

      return jsonResponse({
        success: true,
        results,
        count: restored.length,
        text: `${restored.length} archivierte Profile wurden wiederhergestellt.`,
        audit,
      });
    }

    if (action === 'bulk-purge-users') {
      const userIds = normalizeUserIds(body?.userIds);
      if (userIds.length === 0) {
        return jsonResponse(
          {
            success: false,
            text: 'Keine gueltigen User-IDs fuer Bulk-Purge uebergeben.',
          },
          400,
        );
      }

      const results = await bulkPurgeUsers(context.env, userIds);
      const purged = results.filter((result) => result.ok);
      const audit = await auditAction(context.env, auth, {
        action: 'bulk-purge-users',
        targetUserId: userIds.join(','),
        status: 'success',
        summary: `${purged.length} archivierte Profile endgueltig markiert.`,
        details: {
          userIds,
        },
        after: {
          purged: purged.length,
        },
      });

      return jsonResponse({
        success: true,
        results,
        count: purged.length,
        text: `${purged.length} archivierte Profile wurden endgueltig entfernt.`,
        audit,
      });
    }

    if (action === 'purge-expired-archives') {
      const limit = Math.max(1, Math.min(500, Number(body?.limit) || 100));
      const result = await purgeExpiredArchivedUsers(context.env, { limit });
      const audit = await auditAction(context.env, auth, {
        action: 'purge-expired-archives',
        targetUserId: result.userIds.join(','),
        status: result.ok ? 'success' : 'error',
        summary:
          result.count > 0
            ? `${result.count} abgelaufene Archivprofile wurden bereinigt.`
            : 'Keine abgelaufenen Archivprofile gefunden.',
        details: {
          limit,
          userIds: result.userIds,
          attempted: result.attempted || 0,
        },
        after: {
          purged: result.count,
        },
      });

      return jsonResponse({
        success: result.ok,
        count: result.count,
        userIds: result.userIds,
        results: result.users,
        text:
          result.count > 0
            ? `${result.count} abgelaufene Archivprofile wurden bereinigt.`
            : 'Keine abgelaufenen Archivprofile vorhanden.',
        audit,
      });
    }

    if (action === 'remove-alias') {
      const alias = String(body?.alias || body?.name || '').trim();
      const result = await removeAliasFromUser(
        kv,
        context.env,
        alias,
        body?.userId,
      );
      const responseUserId =
        result.userId || normalizeUserId(body?.userId) || '';
      const audit = await auditAction(context.env, auth, {
        action: 'remove-alias',
        targetUserId: responseUserId,
        status: result.success ? 'success' : 'error',
        summary: result.text || 'Alias entfernt.',
        details: {
          alias: result.alias || alias,
          previousUserId: result.previousUserId || '',
        },
      });

      return jsonResponse(
        buildSuccessPayload(responseUserId, result, audit),
        result.status || 200,
      );
    }

    if (!userId) {
      return jsonResponse(
        {
          success: false,
          text: 'Gueltige User-ID fehlt.',
        },
        400,
      );
    }

    if (action === 'list-user') {
      const memories = await loadFallbackMemories(kv, userId, context.env, {
        persistPruned: true,
      });
      const ordered = orderMemories(memories);
      const aliases = await loadUserAliases(kv, userId);

      return jsonResponse({
        success: true,
        userId,
        memories: ordered,
        count: ordered.length,
        aliases,
        profile: buildProfileInfo(userId, ordered),
        text:
          ordered.length > 0
            ? 'Profil erfolgreich geladen.'
            : 'Keine Erinnerungen gespeichert.',
      });
    }

    if (action === 'assign-alias') {
      const alias = String(body?.alias || body?.name || '').trim();
      const result = await assignAliasToUser(kv, context.env, userId, alias);
      const audit = await auditAction(context.env, auth, {
        action: 'assign-alias',
        targetUserId: userId,
        status: result.success ? 'success' : 'error',
        summary: result.text || 'Alias zugewiesen.',
        details: {
          alias: result.alias || alias,
          previousUserId: result.previousUserId || '',
        },
        after: {
          aliases: result.aliases || [],
        },
      });

      return jsonResponse(
        buildSuccessPayload(userId, result, audit),
        result.status || 200,
      );
    }

    if (action === 'merge-users') {
      const sourceUserId = normalizeUserId(body?.sourceUserId);
      if (!sourceUserId) {
        return jsonResponse(
          {
            success: false,
            text: 'Gueltige Quell-User-ID fuer den Merge fehlt.',
          },
          400,
        );
      }
      if (sourceUserId === userId) {
        return jsonResponse(
          {
            success: false,
            text: 'Quell- und Zielprofil muessen unterschiedlich sein.',
          },
          400,
        );
      }

      const sourceBefore = await loadFallbackMemories(
        kv,
        sourceUserId,
        context.env,
        {
          persistPruned: true,
        },
      );
      const targetBefore = await loadFallbackMemories(kv, userId, context.env, {
        persistPruned: true,
      });
      const sourceAliases = await loadUserAliases(kv, sourceUserId);
      const result = await mergeUserProfiles(
        kv,
        context.env,
        sourceUserId,
        userId,
      );
      const audit = await auditAction(context.env, auth, {
        action: 'merge-users',
        targetUserId: userId,
        status: result.success ? 'success' : 'error',
        summary: result.text || 'Profile zusammengefuehrt.',
        details: {
          sourceUserId,
          targetUserId: userId,
          transferredAliases: result.transferredAliases || [],
        },
        before: {
          sourceCount: sourceBefore.length,
          targetCount: targetBefore.length,
          sourceAliases,
        },
        after: {
          count: result.count ?? result.memories?.length ?? 0,
          aliases: result.aliases || [],
        },
      });

      return jsonResponse(
        {
          ...buildSuccessPayload(userId, result, audit),
          sourceUserId,
          transferredAliases: result.transferredAliases || [],
        },
        result.status || 200,
      );
    }

    if (action === 'update-memory') {
      const before = await loadFallbackMemories(kv, userId, context.env, {
        persistPruned: true,
      });
      const result = await updateSingleMemory(kv, context.env, userId, body);
      const audit = await auditAction(context.env, auth, {
        action: 'update-memory',
        targetUserId: userId,
        memoryKey: body?.key,
        status: result.success ? 'success' : 'error',
        summary: result.text || 'Memory aktualisiert.',
        details: {
          nextValue: body?.value || '',
          previousValue: body?.previousValue || '',
        },
        before: {
          count: before.length,
          profile: buildProfileInfo(userId, before),
        },
        after: {
          count: result.count ?? result.memories?.length ?? 0,
          profile: result.profile || null,
        },
      });
      return jsonResponse(
        buildSuccessPayload(userId, result, audit),
        result.status || 200,
      );
    }

    if (action === 'delete-memory') {
      const before = await loadFallbackMemories(kv, userId, context.env, {
        persistPruned: true,
      });
      const result = await forgetSingleMemory(kv, context.env, userId, body);
      const audit = await auditAction(context.env, auth, {
        action: 'delete-memory',
        targetUserId: userId,
        memoryKey: body?.key,
        status: result.success ? 'success' : 'error',
        summary: result.text || 'Memory entfernt.',
        details: {
          value: body?.value || '',
        },
        before: {
          count: before.length,
        },
        after: {
          count: result.count ?? result.memories?.length ?? 0,
        },
      });
      return jsonResponse(
        buildSuccessPayload(userId, result, audit),
        result.status || 200,
      );
    }

    if (action === 'bulk-delete-memories') {
      const entries = Array.isArray(body?.entries) ? body.entries : [];
      if (entries.length === 0) {
        return jsonResponse(
          {
            success: false,
            text: 'Keine Memory-Eintraege fuer Bulk-Loeschung uebergeben.',
          },
          400,
        );
      }

      const results = [];
      for (const entry of entries) {
        results.push(
          await forgetSingleMemory(kv, context.env, userId, {
            key: entry?.key,
            value: entry?.value,
          }),
        );
      }

      const finalResult = results.at(-1) || {
        success: true,
        memories: [],
        count: 0,
        profile: buildProfileInfo(userId, []),
      };
      const audit = await auditAction(context.env, auth, {
        action: 'bulk-delete-memories',
        targetUserId: userId,
        status: 'success',
        summary: `${entries.length} Memory-Eintraege entfernt.`,
        details: {
          entries,
        },
        after: {
          count: finalResult.count ?? finalResult.memories?.length ?? 0,
        },
      });

      return jsonResponse({
        ...buildSuccessPayload(userId, finalResult, audit),
        results,
        text: `${entries.length} Memory-Eintraege wurden entfernt.`,
      });
    }

    if (action === 'restore-user') {
      const result = await restoreUserProfile(kv, context.env, userId);
      const audit = await auditAction(context.env, auth, {
        action: 'restore-user',
        targetUserId: userId,
        status: result.success ? 'success' : 'error',
        summary: result.text || 'Archiviertes Profil wiederhergestellt.',
        after: {
          count: result.count ?? result.memories?.length ?? 0,
          restored: result.restoredFromArchive || false,
        },
      });
      return jsonResponse(
        buildSuccessPayload(userId, result, audit),
        result.status || 200,
      );
    }

    if (action === 'purge-user') {
      const purge = await purgeArchivedUser(context.env, userId);
      const audit = await auditAction(context.env, auth, {
        action: 'purge-user',
        targetUserId: userId,
        status: purge.ok ? 'success' : 'error',
        summary: 'Archiviertes Profil endgueltig markiert.',
        after: {
          purged: purge.ok,
        },
      });

      return jsonResponse({
        success: purge.ok,
        userId,
        text: purge.ok
          ? 'Archiviertes Profil wurde endgueltig entfernt.'
          : 'Archiviertes Profil konnte nicht endgueltig entfernt werden.',
        audit,
      });
    }

    const confirmUserId = String(body?.confirmUserId || '').trim();
    if (confirmUserId !== userId) {
      return jsonResponse(
        {
          success: false,
          text: 'Loeschbestaetigung fehlt oder stimmt nicht mit der User-ID ueberein.',
        },
        400,
      );
    }

    const result = await deleteUserDirectly(
      kv,
      context.env,
      userId,
      auth,
      String(body?.reason || ''),
    );
    const audit = await auditAction(context.env, auth, {
      action: 'delete-user',
      targetUserId: userId,
      memoryKey: '',
      status: 'success',
      summary: 'Benutzerprofil wurde direkt geloescht.',
      details: result.deleted,
      before: result.before,
      after: {
        deleted: true,
      },
    });

    return jsonResponse(buildSuccessPayload(userId, result, audit));
  } catch (error) {
    console.error('[admin-users] request failed:', error);
    return jsonResponse(
      {
        success: false,
        error: getErrorMessage(error) || 'admin_user_action_failed',
      },
      500,
    );
  }
}
