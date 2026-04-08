import { normalizeUserId } from '../_user-identity.js';
import {
  buildProfileInfo,
  forgetSingleMemory,
  loadFallbackMemories,
  orderMemories,
  updateSingleMemory,
} from '../ai-agent-user.js';
import {
  purgeArchivedUser,
  purgeExpiredArchivedUsers,
} from './_admin-index.js';
import { createValidationErrorResponse, jsonResponse } from './_admin-utils.js';
import {
  assignAliasToUser,
  auditAction,
  buildSuccessPayload,
  bulkDeleteUsers,
  bulkPurgeUsers,
  bulkRestoreUsers,
  deleteUserDirectly,
  loadUserAliases,
  mergeUserProfiles,
  normalizeUserIds,
  removeAliasFromUser,
  restoreUserProfile,
} from './_admin-user-operations.js';
import { handlePurgeAdminAction } from './_admin-user-purge.js';

const PERSIST_PRUNED_OPTIONS = Object.freeze({
  persistPruned: true,
});

function getRequestedAlias(body) {
  return String(body?.alias || body?.name || '').trim();
}

function getRequestedMemoryEntries(body) {
  return Array.isArray(body?.entries) ? body.entries : [];
}

function getResultStatus(result) {
  return result.status || 200;
}

function getResultCount(result) {
  return result.count ?? result.memories?.length ?? 0;
}

function getResultAuditStatus(result) {
  return result.success ? 'success' : 'error';
}

function loadUserMemories(kv, env, userId) {
  return loadFallbackMemories(kv, userId, env, PERSIST_PRUNED_OPTIONS);
}

function createUserActionResponse(userId, result, audit, extraPayload = {}) {
  return jsonResponse(
    {
      ...buildSuccessPayload(userId, result, audit),
      ...extraPayload,
    },
    getResultStatus(result),
  );
}

function resolveResultUserId(result, fallbackUserId = '') {
  return result.userId || normalizeUserId(fallbackUserId) || '';
}

function createAliasAuditDetails(result, alias) {
  return {
    alias: result.alias || alias,
    previousUserId: result.previousUserId || '',
  };
}

function getRequiredUserIds(body, errorText) {
  const userIds = normalizeUserIds(body?.userIds);
  return userIds.length === 0
    ? { response: createValidationErrorResponse(errorText) }
    : { userIds };
}

function validateMergeSourceUserId(body, targetUserId) {
  const sourceUserId = normalizeUserId(body?.sourceUserId);
  if (!sourceUserId) {
    return {
      response: createValidationErrorResponse(
        'Gueltige Quell-User-ID fuer den Merge fehlt.',
      ),
    };
  }
  if (sourceUserId === targetUserId) {
    return {
      response: createValidationErrorResponse(
        'Quell- und Zielprofil muessen unterschiedlich sein.',
      ),
    };
  }

  return { sourceUserId };
}

async function loadMergeBeforeState(kv, env, sourceUserId, targetUserId) {
  const [sourceBefore, targetBefore, sourceAliases] = await Promise.all([
    loadUserMemories(kv, env, sourceUserId),
    loadUserMemories(kv, env, targetUserId),
    loadUserAliases(kv, sourceUserId),
  ]);

  return {
    sourceBefore,
    targetBefore,
    sourceAliases,
  };
}

function createEmptyMemoryMutationResult(userId) {
  return {
    success: true,
    memories: [],
    count: 0,
    profile: buildProfileInfo(userId, []),
  };
}

function getFinalMemoryMutationResult(userId, results) {
  return results.at(-1) || createEmptyMemoryMutationResult(userId);
}

async function forgetMemoryEntries(kv, env, userId, entries) {
  const results = [];
  for (const entry of entries) {
    results.push(
      await forgetSingleMemory(kv, env, userId, {
        key: entry?.key,
        value: entry?.value,
      }),
    );
  }
  return results;
}

async function runMemoryMutationAction({
  action,
  auth,
  body,
  env,
  execute,
  includeAfterProfile = false,
  includeBeforeProfile = false,
  kv,
  summary,
  userId,
  details,
}) {
  const before = await loadUserMemories(kv, env, userId);
  const result = await execute(kv, env, userId, body);
  const audit = await auditAction(env, auth, {
    action,
    targetUserId: userId,
    memoryKey: body?.key,
    status: getResultAuditStatus(result),
    summary: result.text || summary,
    details,
    before: {
      count: before.length,
      ...(includeBeforeProfile
        ? {
            profile: buildProfileInfo(userId, before),
          }
        : {}),
    },
    after: {
      count: getResultCount(result),
      ...(includeAfterProfile
        ? {
            profile: result.profile || null,
          }
        : {}),
    },
  });

  return createUserActionResponse(userId, result, audit);
}

async function handleBulkDeleteUsersAction({ body, env, auth, kv }) {
  const { response, userIds } = getRequiredUserIds(
    body,
    'Keine gueltigen User-IDs fuer Bulk-Loeschung uebergeben.',
  );
  if (response) return response;

  const results = await bulkDeleteUsers(
    kv,
    env,
    userIds,
    auth,
    String(body?.reason || ''),
  );
  const audit = await auditAction(env, auth, {
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

async function handleBulkRestoreUsersAction({ body, env, auth, kv }) {
  const { response, userIds } = getRequiredUserIds(
    body,
    'Keine gueltigen User-IDs fuer Bulk-Wiederherstellung uebergeben.',
  );
  if (response) return response;

  const results = await bulkRestoreUsers(kv, env, userIds);
  const restored = results.filter((result) => result.success !== false);
  const audit = await auditAction(env, auth, {
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

async function handleBulkPurgeUsersAction({ body, env, auth }) {
  const { response, userIds } = getRequiredUserIds(
    body,
    'Keine gueltigen User-IDs fuer Bulk-Purge uebergeben.',
  );
  if (response) return response;

  const results = await bulkPurgeUsers(env, userIds);
  const purged = results.filter((result) => result.ok);
  const audit = await auditAction(env, auth, {
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

async function handlePurgeExpiredArchivesAction({ body, env, auth }) {
  const limit = Math.max(1, Math.min(500, Number(body?.limit) || 100));
  const result = await purgeExpiredArchivedUsers(env, { limit });
  const audit = await auditAction(env, auth, {
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

async function handleRemoveAliasAction({ body, env, auth, kv }) {
  const alias = getRequestedAlias(body);
  const result = await removeAliasFromUser(kv, env, alias, body?.userId);
  const responseUserId = resolveResultUserId(result, body?.userId);
  const audit = await auditAction(env, auth, {
    action: 'remove-alias',
    targetUserId: responseUserId,
    status: getResultAuditStatus(result),
    summary: result.text || 'Alias entfernt.',
    details: createAliasAuditDetails(result, alias),
  });

  return createUserActionResponse(responseUserId, result, audit);
}

async function handleListUserAction({ env, kv, userId }) {
  const [memories, aliases] = await Promise.all([
    loadUserMemories(kv, env, userId),
    loadUserAliases(kv, userId),
  ]);
  const ordered = orderMemories(memories);

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

async function handleAssignAliasAction({ body, env, auth, kv, userId }) {
  const alias = getRequestedAlias(body);
  const result = await assignAliasToUser(kv, env, userId, alias);
  const audit = await auditAction(env, auth, {
    action: 'assign-alias',
    targetUserId: userId,
    status: getResultAuditStatus(result),
    summary: result.text || 'Alias zugewiesen.',
    details: createAliasAuditDetails(result, alias),
    after: {
      aliases: result.aliases || [],
    },
  });

  return createUserActionResponse(userId, result, audit);
}

async function handleMergeUsersAction({ body, env, auth, kv, userId }) {
  const { response, sourceUserId } = validateMergeSourceUserId(body, userId);
  if (response) return response;

  const { sourceBefore, targetBefore, sourceAliases } =
    await loadMergeBeforeState(kv, env, sourceUserId, userId);
  const result = await mergeUserProfiles(kv, env, sourceUserId, userId);
  const audit = await auditAction(env, auth, {
    action: 'merge-users',
    targetUserId: userId,
    status: getResultAuditStatus(result),
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
      count: getResultCount(result),
      aliases: result.aliases || [],
    },
  });

  return createUserActionResponse(userId, result, audit, {
    sourceUserId,
    transferredAliases: result.transferredAliases || [],
  });
}

async function handleUpdateMemoryAction(requestContext) {
  return runMemoryMutationAction({
    ...requestContext,
    action: 'update-memory',
    execute: updateSingleMemory,
    summary: 'Memory aktualisiert.',
    details: {
      nextValue: requestContext.body?.value || '',
      previousValue: requestContext.body?.previousValue || '',
    },
    includeBeforeProfile: true,
    includeAfterProfile: true,
  });
}

async function handleDeleteMemoryAction(requestContext) {
  return runMemoryMutationAction({
    ...requestContext,
    action: 'delete-memory',
    execute: forgetSingleMemory,
    summary: 'Memory entfernt.',
    details: {
      value: requestContext.body?.value || '',
    },
  });
}

async function handleBulkDeleteMemoriesAction({ body, env, auth, kv, userId }) {
  const entries = getRequestedMemoryEntries(body);
  if (entries.length === 0) {
    return createValidationErrorResponse(
      'Keine Memory-Eintraege fuer Bulk-Loeschung uebergeben.',
    );
  }

  const results = await forgetMemoryEntries(kv, env, userId, entries);
  const finalResult = getFinalMemoryMutationResult(userId, results);
  const audit = await auditAction(env, auth, {
    action: 'bulk-delete-memories',
    targetUserId: userId,
    status: 'success',
    summary: `${entries.length} Memory-Eintraege entfernt.`,
    details: {
      entries,
    },
    after: {
      count: getResultCount(finalResult),
    },
  });

  return createUserActionResponse(userId, finalResult, audit, {
    results,
    text: `${entries.length} Memory-Eintraege wurden entfernt.`,
  });
}

async function handleRestoreUserAction({ env, auth, kv, userId }) {
  const result = await restoreUserProfile(kv, env, userId);
  const audit = await auditAction(env, auth, {
    action: 'restore-user',
    targetUserId: userId,
    status: getResultAuditStatus(result),
    summary: result.text || 'Archiviertes Profil wiederhergestellt.',
    after: {
      count: getResultCount(result),
      restored: result.restoredFromArchive || false,
    },
  });
  return createUserActionResponse(userId, result, audit);
}

async function handlePurgeUserAction({ env, auth, userId }) {
  const purge = await purgeArchivedUser(env, userId);
  const audit = await auditAction(env, auth, {
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

async function handleDeleteUserAction({ body, env, auth, kv, userId }) {
  const confirmUserId = String(body?.confirmUserId || '').trim();
  if (confirmUserId !== userId) {
    return createValidationErrorResponse(
      'Loeschbestaetigung fehlt oder stimmt nicht mit der User-ID ueberein.',
    );
  }

  const result = await deleteUserDirectly(
    kv,
    env,
    userId,
    auth,
    String(body?.reason || ''),
  );
  const audit = await auditAction(env, auth, {
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

  return createUserActionResponse(userId, result, audit);
}

const GLOBAL_ACTION_HANDLERS = Object.freeze({
  'bulk-delete-users': handleBulkDeleteUsersAction,
  'bulk-restore-users': handleBulkRestoreUsersAction,
  'bulk-purge-users': handleBulkPurgeUsersAction,
  'purge-expired-archives': handlePurgeExpiredArchivesAction,
  'remove-alias': handleRemoveAliasAction,
});

const USER_ACTION_HANDLERS = Object.freeze({
  'list-user': handleListUserAction,
  'assign-alias': handleAssignAliasAction,
  'merge-users': handleMergeUsersAction,
  'update-memory': handleUpdateMemoryAction,
  'delete-memory': handleDeleteMemoryAction,
  'bulk-delete-memories': handleBulkDeleteMemoriesAction,
  'restore-user': handleRestoreUserAction,
  'purge-user': handlePurgeUserAction,
  'delete-user': handleDeleteUserAction,
});

export async function handleAdminUsersAction(action, requestContext) {
  const purgeResponse = await handlePurgeAdminAction({
    action,
    body: requestContext.body,
    kv: requestContext.kv,
    env: requestContext.env,
    auth: requestContext.auth,
    waitUntil: requestContext.waitUntil,
  });
  if (purgeResponse) return purgeResponse;

  const globalActionHandler = GLOBAL_ACTION_HANDLERS[action];
  if (globalActionHandler) {
    return globalActionHandler(requestContext);
  }

  if (!requestContext.userId) {
    return createValidationErrorResponse('Gueltige User-ID fehlt.');
  }

  const userActionHandler =
    USER_ACTION_HANDLERS[action] || USER_ACTION_HANDLERS['delete-user'];
  return userActionHandler(requestContext);
}
