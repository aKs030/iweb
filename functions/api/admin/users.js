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
