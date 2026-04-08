import { normalizeUserId } from '../_user-identity.js';
import {
  buildProfileInfo,
  compactMemoryEntries,
  deleteUserProfile,
  deleteVectorizeMemoriesForUser,
  loadFallbackMemories,
  orderMemories,
  upsertVectorizeMemory,
} from '../ai-agent-user.js';
import {
  deleteAdminNameMapping,
  loadAdminLinkedAliasesFromKv,
  normalizeAdminLookupName,
  purgeArchivedUser,
  restoreDeletedUserFromArchive,
  syncAdminUserIndex,
  upsertAdminNameMapping,
} from './_admin-index.js';
import { writeAdminAuditLog } from './_admin-utils.js';

const FALLBACK_MEMORY_PREFIX = 'robot-memory:';
const USERNAME_LOOKUP_PREFIX = 'username:';
const ACTION_ALIAS_GROUPS = Object.freeze({
  'update-memory': ['update-memory', 'updatememory'],
  'delete-memory': [
    'delete-memory',
    'deletememory',
    'forget-memory',
    'forgetmemory',
  ],
  'bulk-delete-memories': [
    'bulk-delete-memories',
    'bulkdeletememories',
    'bulk-delete-memory',
  ],
  'delete-user': ['delete-user', 'deleteuser'],
  'bulk-delete-users': [
    'bulk-delete-users',
    'bulkdeleteusers',
    'bulk-delete-user',
  ],
  'restore-user': ['restore-user', 'restoreuser'],
  'bulk-restore-users': [
    'bulk-restore-users',
    'bulkrestoreusers',
    'bulk-restore-user',
  ],
  'purge-user': ['purge-user', 'purgeuser', 'hard-delete-user'],
  'bulk-purge-users': ['bulk-purge-users', 'bulkpurgeusers', 'bulk-purge-user'],
  'assign-alias': ['assign-alias', 'assignalias', 'link-alias'],
  'remove-alias': ['remove-alias', 'removealias', 'delete-alias'],
  'merge-users': ['merge-users', 'mergeusers', 'merge-user'],
  'purge-expired-archives': [
    'purge-expired-archives',
    'purgeexpiredarchives',
    'purge-expired-archive',
  ],
  'purge-everything': ['purge-everything'],
  'request-purge-everything-confirmation': [
    'request-purge-everything-confirmation',
    'request-purge-confirmation',
  ],
  'purge-everything-status': [
    'purge-everything-status',
    'purge-status',
    'purge-everything-job-status',
  ],
});
const ACTION_ALIAS_LOOKUP = new Map(
  Object.entries(ACTION_ALIAS_GROUPS).flatMap(([normalized, aliases]) =>
    aliases.map((alias) => [alias, normalized]),
  ),
);

function normalizeActionValue(raw) {
  return String(raw || 'list-user')
    .toLowerCase()
    .trim();
}

function createMemoryKey(userId) {
  return `${FALLBACK_MEMORY_PREFIX}${userId}`;
}

function createUsernameLookupKey(name) {
  const normalizedAlias = normalizeAdminLookupName(name);
  return normalizedAlias ? `${USERNAME_LOOKUP_PREFIX}${normalizedAlias}` : '';
}

export function normalizeAction(raw) {
  return ACTION_ALIAS_LOOKUP.get(normalizeActionValue(raw)) || 'list-user';
}

export function normalizeUserIds(rawUserIds) {
  const values = Array.isArray(rawUserIds) ? rawUserIds : [];
  return [
    ...new Set(values.map((value) => normalizeUserId(value)).filter(Boolean)),
  ];
}

export function buildSuccessPayload(userId, result, audit = null) {
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

export async function loadUserAliases(kv, userId) {
  const aliases = await loadAdminLinkedAliasesFromKv(kv, userId);
  return aliases.map((entry) => entry.name).filter(Boolean);
}

export async function assignAliasToUser(kv, env, userId, alias) {
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

export async function removeAliasFromUser(kv, env, alias, fallbackUserId = '') {
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

export async function mergeUserProfiles(kv, env, sourceUserId, targetUserId) {
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

export async function auditAction(env, auth, entry) {
  return writeAdminAuditLog(env, {
    actor: auth.actor,
    sourceIp: auth.sourceIp,
    ...entry,
  });
}

export async function restoreUserProfile(kv, env, userId) {
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

export async function deleteUserDirectly(kv, env, userId, auth, reason = '') {
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

export async function bulkDeleteUsers(kv, env, userIds, auth, reason = '') {
  const results = [];
  for (const userId of userIds) {
    results.push(await deleteUserDirectly(kv, env, userId, auth, reason));
  }
  return results;
}

export async function bulkRestoreUsers(kv, env, userIds) {
  const results = [];
  for (const userId of userIds) {
    results.push(await restoreUserProfile(kv, env, userId));
  }
  return results;
}

export async function bulkPurgeUsers(env, userIds) {
  const results = [];
  for (const userId of userIds) {
    results.push(await purgeArchivedUser(env, userId));
  }
  return results;
}
