import { normalizeUserId } from '../_user-identity.js';
import { deleteVectorizeMemoriesForUser } from '../ai-agent-user.js';
import { getErrorMessage } from './_admin-utils.js';
import { auditAction } from './_admin-user-operations.js';
import {
  nowIso,
  readPurgeJob,
  updatePurgeJob,
} from './_admin-user-purge-store.js';

const FALLBACK_MEMORY_PREFIX = 'robot-memory:';
const USERNAME_LOOKUP_PREFIX = 'username:';
const MAX_KV_PURGE_SCAN_PAGES = 500;
const KV_PURGE_BATCH_SIZE = 100;
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

function createNoDbCleanupResult() {
  return {
    available: false,
    cleared: {},
  };
}

async function deleteAdminProfileTable(db, table) {
  try {
    const result = await db.prepare(`DELETE FROM ${table}`).run();
    const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
    return {
      table,
      cleared: Number.isFinite(changes) ? changes : 0,
    };
  } catch (error) {
    if (/no such table/i.test(getErrorMessage(error))) {
      return {
        table,
        cleared: null,
      };
    }
    throw error;
  }
}

async function clearAdminProfileTables(env) {
  const db = env?.DB_LIKES?.prepare ? env.DB_LIKES : null;
  if (!db) return createNoDbCleanupResult();

  const entries = await Promise.all(
    ADMIN_PROFILE_TABLES.map((table) => deleteAdminProfileTable(db, table)),
  );

  return {
    available: true,
    cleared: Object.fromEntries(
      entries.map((entry) => [entry.table, entry.cleared]),
    ),
  };
}

function hasFastVectorizeDeleteMethod(env) {
  const index = env?.JULES_MEMORY;
  if (!index) return false;
  return VECTORIZE_FAST_DELETE_METHODS.some(
    (method) => typeof index[method] === 'function',
  );
}

function normalizeUniqueUserIds(rawUserIds = []) {
  return [
    ...new Set(
      rawUserIds.map((userId) => normalizeUserId(userId)).filter(Boolean),
    ),
  ];
}

function createSkippedVectorizeResult(
  userCount,
  configured,
  fastDeleteAvailable,
  reason,
) {
  return {
    users: userCount,
    configured,
    fastDeleteAvailable,
    attempted: 0,
    skipped: true,
    reason,
  };
}

function getVectorizeCapabilities(env) {
  return {
    configured: !!env?.JULES_MEMORY,
    fastDeleteAvailable: hasFastVectorizeDeleteMethod(env),
  };
}

function getVectorizeSkipResult(userIds, capabilities) {
  if (userIds.length === 0) {
    return createSkippedVectorizeResult(
      0,
      capabilities.configured,
      capabilities.fastDeleteAvailable,
      'no-users',
    );
  }

  if (capabilities.configured && capabilities.fastDeleteAvailable) {
    return null;
  }

  return createSkippedVectorizeResult(
    userIds.length,
    capabilities.configured,
    capabilities.fastDeleteAvailable,
    capabilities.configured ? 'no-fast-delete-method' : 'not-configured',
  );
}

async function notifyVectorizeProgress(onProgress, progress) {
  const progressResult = onProgress?.(progress);
  if (
    progressResult &&
    typeof progressResult === 'object' &&
    typeof progressResult.then === 'function'
  ) {
    await progressResult;
  }
}

async function processVectorizeUsers(env, userIds, onProgress) {
  const modeCounts = {};
  let attempted = 0;
  let processed = 0;

  for (const userId of userIds) {
    const result = await deleteVectorizeMemoriesForUser(env, userId);
    processed += 1;
    if (result?.attempted) attempted += 1;
    const mode = String(result?.mode || 'unknown');
    modeCounts[mode] = (modeCounts[mode] || 0) + 1;

    await notifyVectorizeProgress(onProgress, {
      userId,
      processed,
      total: userIds.length,
      mode,
      attempted: !!result?.attempted,
    });
  }

  return { attempted, modeCounts };
}

async function purgeVectorizeForUsers(
  env,
  rawUserIds = [],
  { onProgress = null } = {},
) {
  const userIds = normalizeUniqueUserIds(rawUserIds);
  const capabilities = getVectorizeCapabilities(env);
  const skipResult = getVectorizeSkipResult(userIds, capabilities);
  if (skipResult) return skipResult;

  const { attempted, modeCounts } = await processVectorizeUsers(
    env,
    userIds,
    onProgress,
  );

  return {
    users: userIds.length,
    configured: capabilities.configured,
    fastDeleteAvailable: capabilities.fastDeleteAvailable,
    attempted,
    skipped: false,
    modes: modeCounts,
  };
}

function appendListedKeys(keyNames, page) {
  for (const key of Array.isArray(page?.keys) ? page.keys : []) {
    const keyName = String(key?.name || '').trim();
    if (keyName) keyNames.push(keyName);
  }
}

function getNextListCursor(page) {
  if (page?.list_complete === true || !page?.cursor) return null;
  return page.cursor;
}

async function listKvKeysByPrefix(kv, prefix) {
  const keyNames = [];
  let cursor = undefined;

  for (let pages = 0; pages < MAX_KV_PURGE_SCAN_PAGES; pages += 1) {
    const page = await kv.list({
      prefix,
      cursor,
      limit: 1000,
    });

    appendListedKeys(keyNames, page);
    cursor = getNextListCursor(page);
    if (!cursor) break;
  }

  return keyNames;
}

async function updateJobPhase(kv, jobId, phase, text, progress = {}) {
  await updatePurgeJob(kv, jobId, (job) => ({
    ...job,
    phase,
    text,
    progress: {
      ...job.progress,
      ...progress,
    },
  }));
}

function collectScannedKeys(prefix, keys, uniqueKvKeys, memoryUserIds) {
  for (const key of keys) {
    uniqueKvKeys.add(key);
    if (prefix !== FALLBACK_MEMORY_PREFIX) continue;

    const maybeUserId = normalizeUserId(
      key.slice(FALLBACK_MEMORY_PREFIX.length),
    );
    if (maybeUserId) memoryUserIds.push(maybeUserId);
  }
}

async function scanPurgePrefixes(kv, jobId) {
  const kvKeysByPrefix = {};
  const uniqueKvKeys = new Set();
  const memoryUserIds = [];
  let prefixesDone = 0;

  for (const prefix of PURGE_PREFIXES) {
    const keys = await listKvKeysByPrefix(kv, prefix);
    kvKeysByPrefix[prefix] = keys.length;
    prefixesDone += 1;
    collectScannedKeys(prefix, keys, uniqueKvKeys, memoryUserIds);

    await updateJobPhase(
      kv,
      jobId,
      'scanning',
      'Scanne KV nach Nutzer- und Alias-Eintraegen…',
      {
        prefixesDone,
        scannedKvKeys: uniqueKvKeys.size,
      },
    );
  }

  return {
    kvKeysByPrefix,
    kvKeys: [...uniqueKvKeys],
    vectorizeUserIds: normalizeUniqueUserIds(memoryUserIds),
  };
}

async function runVectorizeCleanupPhase(kv, env, jobId, vectorizeUserIds) {
  await updateJobPhase(kv, jobId, 'vectorize', 'Bereinige Vectorize-Index…', {
    vectorizeUsersTotal: vectorizeUserIds.length,
    vectorizeUsersProcessed: 0,
  });

  return purgeVectorizeForUsers(env, vectorizeUserIds, {
    onProgress: ({ processed, total }) =>
      updateJobPhase(kv, jobId, 'vectorize', 'Bereinige Vectorize-Index…', {
        vectorizeUsersTotal: total,
        vectorizeUsersProcessed: processed,
      }),
  });
}

async function deleteKvKeysInBatches(kv, jobId, kvKeys) {
  let deletedKvKeys = 0;

  await updateJobPhase(kv, jobId, 'deleting', 'Loesche KV-Eintraege…', {
    scannedKvKeys: kvKeys.length,
    deletedKvKeys: 0,
  });

  for (let index = 0; index < kvKeys.length; index += KV_PURGE_BATCH_SIZE) {
    const batch = kvKeys.slice(index, index + KV_PURGE_BATCH_SIZE);
    await Promise.all(batch.map((keyName) => kv.delete(keyName)));
    deletedKvKeys += batch.length;

    await updateJobPhase(
      kv,
      jobId,
      'deleting',
      `Loesche KV-Eintraege… (${deletedKvKeys}/${kvKeys.length})`,
      {
        deletedKvKeys,
      },
    );
  }

  return deletedKvKeys;
}

async function completePurgeJob(
  kv,
  env,
  jobId,
  auth,
  deletedKvKeys,
  kvKeysByPrefix,
  kvKeys,
  vectorizeCleanup,
) {
  await updateJobPhase(
    kv,
    jobId,
    'cleaning-indexes',
    'Bereinige Admin-Indizes…',
    {
      deletedKvKeys,
    },
  );

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
}

async function failPurgeJob(kv, env, jobId, auth, error) {
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

export async function runPurgeEverythingJob(kv, env, jobId, auth) {
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
    const { kvKeysByPrefix, kvKeys, vectorizeUserIds } =
      await scanPurgePrefixes(kv, jobId);
    const vectorizeCleanup = await runVectorizeCleanupPhase(
      kv,
      env,
      jobId,
      vectorizeUserIds,
    );
    const deletedKvKeys = await deleteKvKeysInBatches(kv, jobId, kvKeys);

    await completePurgeJob(
      kv,
      env,
      jobId,
      auth,
      deletedKvKeys,
      kvKeysByPrefix,
      kvKeys,
      vectorizeCleanup,
    );
  } catch (error) {
    await failPurgeJob(kv, env, jobId, auth, error);
  }
}
