import { createLogger } from '../../content/core/logger.js';
import {
  createProfileState,
  createRecoveryState,
} from '../../content/core/profile-state.js';
import { getRobotMemoryRank } from '../../content/core/robot-memory-schema.js';

const log = createLogger('ai-agent-user');
/**
 * Cloudflare Pages Function – POST /api/ai-agent-user
 * Profile and memory operations for the robot companion.
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import { jsonResponse } from './_response.js';
import { parseInteger } from '../_shared/number-utils.js';
import {
  USER_ID_HEADER_NAME,
  normalizeUserId,
} from './_user-identity.js';
import { findRecoveryCandidates } from './_profile-recovery.js';
import { pickAutoRecoveryCandidate } from './_profile-recovery.js';
import {
  CACHE_CONTROL_NO_STORE,
  mergeHeaders,
} from '../_shared/http-headers.js';

import {
  FALLBACK_MEMORY_PREFIX,
  DEFAULT_MEMORY_RETENTION_DAYS,
  DAY_IN_MS,
  MEMORY_KEY_METADATA,
  DEFAULT_MEMORY_CATEGORY,
  DEFAULT_MEMORY_PRIORITY,
  SINGLETON_MEMORY_KEYS,
  getMemoryRetentionMs,
  getMemoryKey,
  getMemoryKV,
  normalizeMemoryText,
  normalizeMemoryKey,
  resolveMemoryMetadata,
  normalizeMemoryEntry,
  compactMemories,
  compactMemoryEntries,
  loadFallbackMemories,
  saveFallbackMemories,
  scoreFallbackMemoryEntry,
} from './_ai-agent-memory-store.js';
const USERNAME_LOOKUP_PREFIX = 'username:';
const USERNAME_LOOKUP_CONFLICT = '__conflict__';
const VECTORIZE_METADATA_DELETE_METHODS = Object.freeze([
  'deleteByMetadata',
  'deleteByFilter',
  'deleteByMetadataFilter',
]);

function jsonWithHeaders(payload, options = {}) {
  return jsonResponse(payload, options);
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
  return createProfileState({
    userId: normalizeUserId(userId),
    name,
  });
}





function buildDeferredVectorizeStats(env) {
  return {
    available: Boolean(env?.JULES_MEMORY),
    attempted: false,
    deleted: null,
    mode: env?.JULES_MEMORY ? 'deferred' : 'not-configured',
    pending: Boolean(env?.JULES_MEMORY),
  };
}

function scheduleVectorizeProfileDelete(executionContext, env, userId) {
  if (!executionContext?.waitUntil || !env?.JULES_MEMORY) return false;

  executionContext.waitUntil(
    deleteVectorizeMemoriesForUser(env, userId).catch((error) => {
      log.warn(
        '[ai-agent-user] Deferred vectorize profile delete failed:',
        error?.message || error,
      );
      return null;
    }),
  );
  return true;
}

export async function deleteUserProfile(
  kv,
  env,
  userId,
  { deferVectorize = false, executionContext = null } = {},
) {
  const memoryKey = getMemoryKey(userId);
  await kv.delete(memoryKey);

  const usernameStatsPromise = deleteUsernameMappingsForUser(kv, userId);
  const shouldDeferVectorize =
    deferVectorize && scheduleVectorizeProfileDelete(executionContext, env, userId);

  const [usernameStats, vectorizeStats] = shouldDeferVectorize
    ? await Promise.all([
        usernameStatsPromise,
        Promise.resolve(buildDeferredVectorizeStats(env)),
      ])
    : await Promise.all([
        usernameStatsPromise,
        deleteVectorizeMemoriesForUser(env, userId),
      ]);

  return {
    memoryKey,
    usernameMappings: usernameStats.deleted,
    scannedUsernameMappings: usernameStats.scanned,
    vectorize: vectorizeStats,
  };
}

async function syncUserNameLookup(kv, userId, nextName = '', previousName = '') {
  if (!kv?.get || !kv?.put) return { linked: false, conflict: false };

  const normalizedUserId = normalizeUserId(userId);
  const nextKey = getUserNameLookupKey(nextName);
  const previousKey = getUserNameLookupKey(previousName);

  try {
    if (previousKey && previousKey !== nextKey && kv?.delete) {
      const previousMappedUserId = normalizeUserId(await kv.get(previousKey));
      if (previousMappedUserId === normalizedUserId) {
        await kv.delete(previousKey);
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
      return { linked: false, conflict: true };
    }

    await kv.put(nextKey, normalizedUserId);
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

async function tryDeleteVectorizeByMetadata(index, filter, onError = null) {
  if (!index) return '';

  for (const method of VECTORIZE_METADATA_DELETE_METHODS) {
    if (typeof index[method] !== 'function') continue;
    try {
      await index[method](filter);
      return method;
    } catch (error) {
      onError?.(method, error);
    }
  }

  return '';
}

async function deleteVectorizeMemoryByMetadata(env, filter) {
  return Boolean(await tryDeleteVectorizeByMetadata(env?.JULES_MEMORY, filter));
}

export function orderMemories(memories = []) {
  return [...memories].sort((a, b) => {
    const priorityDiff = (b.priority || 0) - (a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    const rankDiff = getRobotMemoryRank(a.key) - getRobotMemoryRank(b.key);
    if (rankDiff !== 0) return rankDiff;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
}

function normalizeAction(raw) {
  const value = String(raw || 'delete')
    .toLowerCase()
    .trim();
  if (value === 'list') return 'list';
  if (value === 'resolve') return 'resolve';
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

  const metadataDeleteMethod = await tryDeleteVectorizeByMetadata(
    index,
    { userId },
    (method, error) => {
      log.warn(
        `[ai-agent-user] Vectorize ${method} failed:`,
        error?.message || error,
      );
    },
  );
  if (metadataDeleteMethod) {
    return {
      available: true,
      attempted: true,
      deleted: null,
      mode: metadataDeleteMethod,
    };
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
    log.warn(
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

async function loadUserMemories(kv, env, userId) {
  return loadFallbackMemories(kv, userId, env, {
    persistPruned: true,
  });
}

async function loadUserMemorySnapshot(kv, env, userId) {
  const memories = await loadUserMemories(kv, env, userId);
  return {
    memories,
    previousName: normalizeMemoryText(
      getLatestMemoryEntry(memories, 'name')?.value,
    ),
  };
}

function getRetentionDays(env) {
  return parseInteger(env?.ROBOT_MEMORY_RETENTION_DAYS, DEFAULT_MEMORY_RETENTION_DAYS, {
    min: 1,
    max: 3650,
  });
}

async function buildMemoryListPayload(
  kv,
  env,
  userId,
  {
    successText = 'Gespeicherte Erinnerungen erfolgreich geladen.',
    emptyText = 'Keine Erinnerungen gespeichert.',
  } = {},
) {
  const memories = await loadUserMemories(kv, env, userId);
  const ordered = orderMemories(memories);

  return {
    success: true,
    userId,
    count: ordered.length,
    retentionDays: getRetentionDays(env),
    memories: ordered,
    profile: buildProfileInfo(userId, ordered),
    text: ordered.length > 0 ? successText : emptyText,
  };
}

function buildMemoryMutationPayload(result, userId) {
  const memories = result.memories || [];
  return {
    success: result.success,
    userId,
    memories,
    profile: result.profile || buildProfileInfo(userId, memories),
    text: result.text,
  };
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

  const { memories: existing, previousName } = await loadUserMemorySnapshot(
    kv,
    env,
    userId,
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
    await syncUserNameLookup(kv, userId, value, previousName);
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

  const memories = await loadUserMemories(kv, env, userId);

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

  const { memories: existing, previousName } = await loadUserMemorySnapshot(
    kv,
    env,
    userId,
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
    await syncUserNameLookup(kv, userId, '', previousName);
  }

  if (SINGLETON_MEMORY_KEYS.has(key)) {
    await deleteVectorizeMemoryByMetadata(env, { userId, key });
  } else if (value) {
    await deleteVectorizeMemoryByMetadata(env, { userId, key, value });
  }

  const memories = await loadUserMemories(kv, env, userId);

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
  const baseHeaders = new Headers(
    mergeHeaders(getCorsHeaders(request, env), {
      'Cache-Control': CACHE_CONTROL_NO_STORE,
    }),
  );

  try {
    const body = await request.json().catch(() => ({}));
    const action = normalizeAction(body?.action);
    const headerUserId = normalizeUserId(
      request.headers.get(USER_ID_HEADER_NAME),
    );
    const bodyUserId = normalizeUserId(body?.userId);
    const trustedUserId = headerUserId;
    const userId = trustedUserId || bodyUserId;

    const kv = getMemoryKV(env);
    if (!kv) {
      return jsonWithHeaders(
        {
          success: false,
          text: 'Cloudflare KV für Memory ist nicht verfügbar.',
        },
        { status: 503, headers: baseHeaders },
      );
    }

    const responseHeaders = new Headers(baseHeaders);

    if (trustedUserId && bodyUserId && bodyUserId !== trustedUserId) {
      return jsonWithHeaders(
        {
          success: false,
          text: 'User-ID-Mismatch: Zugriff nur auf die angemeldete ID erlaubt.',
        },
        { status: 403, headers: baseHeaders },
      );
    }

    if (action === 'resolve') {
      const recoveryName = normalizeMemoryText(
        body?.name || body?.recoveryName || '',
      );
      if (!recoveryName) {
        return jsonWithHeaders(
          {
            success: false,
            text: 'Bitte gib einen Namen für die Profilsuche ein.',
          },
          { status: 400, headers: baseHeaders },
        );
      }

      const candidates = await findRecoveryCandidates(kv, recoveryName);
      const autoCandidate = pickAutoRecoveryCandidate(candidates);
      const recoveryStatus =
        candidates.length === 0
          ? 'none'
          : candidates.length === 1
            ? 'needs_confirmation'
            : 'conflict';
      const recovery = createRecoveryState(
        {
          status: recoveryStatus,
          name: recoveryName,
          candidateUserId: candidates[0]?.userId || '',
          autoCandidateUserId: autoCandidate?.userId || '',
          candidates,
        },
        { allowNone: true },
      );

      return jsonWithHeaders(
        {
          success: true,
          recovery,
          text:
            candidates.length > 0
              ? 'Profile gefunden.'
              : 'Kein Profil für diesen Namen gefunden.',
        },
        { headers: responseHeaders },
      );
    }

    if (action === 'activate') {
      const targetUserId = normalizeUserId(
        body?.targetUserId || body?.candidateUserId,
      );
      const recoveryName = normalizeMemoryText(
        body?.name || body?.recoveryName || '',
      );

      if (!targetUserId || !recoveryName) {
        return jsonWithHeaders(
          {
            success: false,
            text: 'Profil-Aktivierung erfordert Name und Zielprofil.',
          },
          { status: 400, headers: baseHeaders },
        );
      }

      const candidates = await findRecoveryCandidates(kv, recoveryName);
      if (!candidates.some((candidate) => candidate.userId === targetUserId)) {
        return jsonWithHeaders(
          {
            success: false,
            text: 'Das gewaehlte Profil passt nicht zum angefragten Namen.',
          },
          { status: 403, headers: baseHeaders },
        );
      }

      return jsonWithHeaders(
        await buildMemoryListPayload(kv, env, targetUserId, {
          successText: 'Profil aktiviert und Erinnerungen geladen.',
          emptyText:
            'Profil aktiviert. Es sind noch keine Erinnerungen gespeichert.',
        }),
        { headers: responseHeaders },
      );
    }

    if (action === 'disconnect') {
      return jsonWithHeaders(
        {
          success: true,
          userId: '',
          profile: createProfileState({
            userId: '',
            name: '',
            status: 'disconnected',
          }),
          text: 'Dieses Gerät ist nicht mehr mit einem Profil verbunden.',
        },
        { headers: responseHeaders },
      );
    }

    if (!userId) {
      return jsonWithHeaders(
        {
          success: false,
          text: 'Keine aktive User-ID im Request vorhanden.',
        },
        { status: 401, headers: baseHeaders },
      );
    }

    if (action === 'list') {
      return jsonWithHeaders(
        await buildMemoryListPayload(kv, env, userId),
        { headers: responseHeaders },
      );
    }

    if (action === 'update-memory') {
      const result = await updateSingleMemory(kv, env, userId, body);
      return jsonWithHeaders(
        buildMemoryMutationPayload(result, userId),
        {
          status: result.status,
          headers: responseHeaders,
        },
      );
    }

    if (action === 'forget-memory') {
      const result = await forgetSingleMemory(kv, env, userId, body);
      return jsonWithHeaders(
        buildMemoryMutationPayload(result, userId),
        {
          status: result.status,
          headers: responseHeaders,
        },
      );
    }

    const deleted = await deleteUserProfile(kv, env, userId, {
      deferVectorize: true,
      executionContext: context,
    });

    return jsonWithHeaders(
      {
        success: true,
        userId,
        deleted,
        text: 'User-ID und verknüpfte Erinnerungen wurden aus Cloudflare gelöscht. Neue User-ID wird beim nächsten Chat automatisch verwendet.',
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    log.error('[ai-agent-user] Delete failed:', error?.message || error);
    return jsonWithHeaders(
      {
        success: false,
        text: 'Cloudflare-Löschung fehlgeschlagen.',
      },
      { status: 500, headers: baseHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
