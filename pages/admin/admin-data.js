import {
  getAliasedDateField,
  getAliasedStringField,
  getArrayItems,
  getDateField,
  getLatestDateValue,
  getNullableField,
  getNumberField,
  getRawStringField,
  getStringField,
  getTrimmedString,
  parseToEpoch,
  resolveAuditStatus,
  resolveAuditTone,
  resolveMappingStatus,
  resolveMappingTone,
  resolveUserTone,
  sortByDateFieldDesc,
  sortByLatestMemoryAtDesc,
} from './admin-utils.js';

const FOLDER_PAGINATION_KEY = {
  memories: 'users',
  mappings: 'mappings',
  'like-events': 'likeEvents',
  comments: 'comments',
  contacts: 'contacts',
  likes: 'likes',
  audit: 'audit',
  archived: 'archived',
};

const MAPPING_STATUS_PRIORITY = Object.freeze({
  conflict: 0,
  orphan: 1,
  linked: 2,
});

export function mergeUsers(users = []) {
  const byId = new Map();

  users
    .map(normalizeMergedUser)
    .filter(Boolean)
    .forEach((user) => mergeNormalizedUser(byId, user));

  return sortByLatestMemoryAtDesc([...byId.values()]);
}

function normalizeMergedUser(user) {
  const userId = getStringField(user, 'userId');
  if (!userId) return null;

  return {
    userId,
    name: getStringField(user, 'name'),
    status: getRawStringField(user, 'status', 'anonymous'),
    memoryCount: getNumberField(user, 'memoryCount'),
    latestMemoryAt: getDateField(user, 'latestMemoryAt'),
    memories: getArrayItems(user?.memories),
  };
}

function mergeNormalizedUser(byId, normalizedUser) {
  const existing = byId.get(normalizedUser.userId);
  if (!existing) {
    byId.set(normalizedUser.userId, normalizedUser);
    return;
  }

  if (normalizedUser.memories.length > existing.memories.length) {
    byId.set(normalizedUser.userId, normalizedUser);
    return;
  }

  existing.latestMemoryAt = getLatestDateValue(
    existing.latestMemoryAt,
    normalizedUser.latestMemoryAt,
  );
  existing.memoryCount = Math.max(
    existing.memoryCount,
    normalizedUser.memoryCount,
  );
  if (!existing.name && normalizedUser.name) {
    existing.name = normalizedUser.name;
  }
}

function createUserRowBase(user) {
  const userId = getStringField(user, 'userId');
  if (!userId) return null;

  const status = getRawStringField(user, 'status', 'anonymous');
  const memories = getArrayItems(user?.memories);

  return {
    userId,
    userIds: [userId],
    userName: getStringField(user, 'name', userId),
    status,
    hasDuplicateProfiles: false,
    memories,
    tone: resolveUserTone(status),
  };
}

function getLatestMemoryEntry(memories) {
  return memories[0] || null;
}

function getMemoryProfileCount(user, memories) {
  return getNumberField(user, 'memoryCount') || memories.length;
}

function getMemoryProfileLatestAt(user, latestMemory) {
  return (
    getDateField(latestMemory, 'timestamp') ||
    getDateField(user, 'latestMemoryAt')
  );
}

function getLatestMemoryKey(latestMemory) {
  return getStringField(latestMemory, 'key');
}

function getLatestMemoryValue(latestMemory) {
  return getRawStringField(latestMemory, 'value');
}

function getLatestMemoryExpiry(latestMemory) {
  return getDateField(latestMemory, 'expiresAt');
}

function createMemoryProfileRow(user) {
  const base = createUserRowBase(user);
  if (!base) return null;

  const orderedMemories = sortByDateFieldDesc(base.memories, 'timestamp');
  const latest = getLatestMemoryEntry(orderedMemories);

  return {
    ...base,
    id: `memory-profile:${base.userId}`,
    kind: 'memory-profile',
    memoryCount: getMemoryProfileCount(user, orderedMemories),
    latestMemoryAt: getMemoryProfileLatestAt(user, latest),
    latestKey: getLatestMemoryKey(latest),
    latestValue: getLatestMemoryValue(latest),
    latestExpiresAt: getLatestMemoryExpiry(latest),
    memories: orderedMemories,
  };
}

function createMemoryRows(users = []) {
  const rows = users.map(createMemoryProfileRow).filter(Boolean);
  return sortByLatestMemoryAtDesc(rows);
}

function createUserRows(users = []) {
  const rows = users
    .map((user) => {
      const base = createUserRowBase(user);
      if (!base) return null;

      return {
        ...base,
        id: `user:${base.userId}`,
        kind: 'user',
        memoryCount:
          getNumberField(user, 'memoryCount') || base.memories.length,
        latestMemoryAt: getDateField(user, 'latestMemoryAt'),
        aliases: getArrayItems(user?.aliases),
        memoryKeys: getArrayItems(user?.memoryKeys),
      };
    })
    .filter(Boolean);

  return sortByLatestMemoryAtDesc(rows);
}

function createMappingRows(items = []) {
  return items
    .map(createMappingRow)
    .filter(hasMappingRowContent)
    .sort(compareMappingRows);
}

function createMappingRow(item, index) {
  const status = resolveMappingStatus(
    getRawStringField(item, 'status', 'linked'),
  );
  return {
    id: `mapping:${getRawStringField(item, 'name', 'unknown')}:${getRawStringField(item, 'userId', '-')}:${index}`,
    kind: 'mapping',
    name: getStringField(item, 'name'),
    userId: getStringField(item, 'userId'),
    rawValue: getStringField(item, 'rawValue'),
    status,
    updatedAt: getDateField(item, 'updatedAt'),
    tone: resolveMappingTone(status),
  };
}

function hasMappingRowContent(item) {
  return !!(item.name || item.userId || item.rawValue);
}

function getMappingStatusPriority(status) {
  return Number.isFinite(MAPPING_STATUS_PRIORITY[status])
    ? MAPPING_STATUS_PRIORITY[status]
    : 3;
}

function compareMappingRows(a, b) {
  const priorityDifference =
    getMappingStatusPriority(a.status) - getMappingStatusPriority(b.status);
  if (priorityDifference !== 0) return priorityDifference;
  return parseToEpoch(b.updatedAt) - parseToEpoch(a.updatedAt);
}

function resolveLikeCount(item) {
  return Number(item?.likes ?? item?.likeCount ?? item?.count) || 0;
}

function createLikeRows(items = []) {
  return items
    .map((item, index) => {
      const projectId = getAliasedStringField(
        item,
        ['project_id', 'projectId'],
        '-',
      );
      return {
        id: `like:${projectId}:${index}`,
        kind: 'like',
        projectId,
        likes: resolveLikeCount(item),
        tone: 'neutral',
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.likes - a.likes);
}

function createLikeEventRows(items = []) {
  return items.map(createLikeEventRow).sort(compareLikeEventRows);
}

function createLikeEventRow(item, index) {
  return {
    id: `like-event:${getRawStringField(item, 'id', index)}`,
    kind: 'like-event',
    eventId: getNumberField(item, 'id'),
    projectId: getAliasedStringField(item, ['project_id', 'projectId'], '-'),
    sourceIp: getAliasedStringField(item, ['source_ip', 'sourceIp']),
    userAgent: getAliasedStringField(item, ['user_agent', 'userAgent']),
    requestId: getAliasedStringField(item, ['request_id', 'requestId']),
    createdAt: getAliasedDateField(item, ['created_at', 'createdAt']),
    tone: 'neutral',
  };
}

function compareLikeEventRows(a, b) {
  const timeDiff = parseToEpoch(b.createdAt) - parseToEpoch(a.createdAt);
  if (timeDiff !== 0) return timeDiff;
  return (Number(b.eventId) || 0) - (Number(a.eventId) || 0);
}

function createCommentRows(items = []) {
  return sortByDateFieldDesc(
    items.map((item, index) => ({
      id: `comment:${item?.id || index}`,
      kind: 'comment',
      postId: getTrimmedString(item?.post_id),
      authorName: getTrimmedString(item?.author_name),
      content: String(item?.content || ''),
      createdAt: item?.created_at || '',
      tone: 'neutral',
    })),
    'createdAt',
  );
}

function createContactRows(items = []) {
  return sortByDateFieldDesc(
    items.map((item, index) => ({
      id: `contact:${item?.id || index}`,
      kind: 'contact',
      name: getStringField(item, 'name'),
      email: getStringField(item, 'email'),
      subject: getStringField(item, 'subject'),
      message: String(item?.message || ''),
      createdAt: item?.created_at || '',
      tone: 'neutral',
    })),
    'createdAt',
  );
}

function createAuditRows(items = []) {
  return sortByDateFieldDesc(items.map(createAuditRow), 'createdAt');
}

function createAuditRow(item, index) {
  const status = resolveAuditStatus(getRawStringField(item, 'status'));
  return {
    id: `audit:${getRawStringField(item, 'id', index)}`,
    kind: 'audit',
    action: getStringField(item, 'action'),
    targetUserId: getStringField(item, 'targetUserId'),
    memoryKey: getStringField(item, 'memoryKey'),
    status: status || '-',
    summary: getRawStringField(item, 'summary'),
    actor: getStringField(item, 'actor', 'admin'),
    sourceIp: getStringField(item, 'sourceIp'),
    details: getNullableField(item, 'details'),
    before: getNullableField(item, 'before'),
    after: getNullableField(item, 'after'),
    createdAt: getDateField(item, 'createdAt'),
    tone: resolveAuditTone(status),
  };
}

function createArchivedRows(items = []) {
  return sortByDateFieldDesc(items.map(createArchivedRow), 'deletedAt');
}

function createArchivedRow(item, index) {
  return {
    id: `archived:${getRawStringField(item, 'userId', 'unknown')}:${index}`,
    kind: 'archived',
    userId: getStringField(item, 'userId'),
    displayName: getStringField(item, 'displayName'),
    deletedAt: getDateField(item, 'deletedAt'),
    restoreUntil: getDateField(item, 'restoreUntil'),
    deletedBy: getStringField(item, 'deletedBy', 'admin'),
    deleteReason: getStringField(item, 'deleteReason'),
    memoryCount: getNumberField(item, 'memoryCount'),
    aliasCount: getNumberField(item, 'aliasCount'),
    snapshot: getNullableField(item, 'snapshot'),
    tone: 'warning',
  };
}

function createFolderRow({ folderId, title, total, tone = 'neutral' }) {
  return {
    id: `folder:${folderId}`,
    kind: 'folder',
    folderId,
    title,
    total: Number(total) || 0,
    tone,
  };
}

function getFolderRows(folderRecords, folderId) {
  const rows = folderRecords?.[folderId];
  return Array.isArray(rows) ? rows : [];
}

function createLoadedFolderRow({ folderId, title, total, tone = 'neutral' }) {
  return createFolderRow({
    folderId,
    title,
    total,
    tone,
  });
}

function getCloudflareRowsByFolder(folderRecords) {
  return {
    memories: getFolderRows(folderRecords, 'memories'),
    mappings: getFolderRows(folderRecords, 'mappings'),
    comments: getFolderRows(folderRecords, 'comments'),
    contacts: getFolderRows(folderRecords, 'contacts'),
    likes: getFolderRows(folderRecords, 'likes'),
    'like-events': getFolderRows(folderRecords, 'like-events'),
    audit: getFolderRows(folderRecords, 'audit'),
    archived: getFolderRows(folderRecords, 'archived'),
  };
}

const CLOUDFLARE_TOTAL_RESOLVERS = Object.freeze({
  memories: ({ summary, storage }) =>
    Number(summary.filteredMemoryCount ?? storage.memoryCount ?? 0),
  mappings: ({ pagination, storage }, rowsByFolder) =>
    Number(
      pagination?.mappings?.total ??
        storage.nameMappingCount ??
        rowsByFolder.mappings.length,
    ),
  comments: ({ summary, pagination }, rowsByFolder) =>
    Number(
      summary.totalComments ??
        pagination?.comments?.total ??
        rowsByFolder.comments.length,
    ),
  contacts: ({ summary, pagination }, rowsByFolder) =>
    Number(
      summary.totalContacts ??
        pagination?.contacts?.total ??
        rowsByFolder.contacts.length,
    ),
  likes: ({ pagination }, rowsByFolder) =>
    Number(pagination?.likes?.total ?? rowsByFolder.likes.length),
  'like-events': ({ summary, pagination }, rowsByFolder) =>
    Number(
      summary.totalLikeEvents ??
        pagination?.likeEvents?.total ??
        rowsByFolder['like-events'].length,
    ),
  audit: ({ summary, pagination }, rowsByFolder) =>
    Number(
      summary.totalAuditLogs ??
        pagination?.audit?.total ??
        rowsByFolder.audit.length,
    ),
  archived: ({ summary, pagination }, rowsByFolder) =>
    Number(
      summary.totalArchivedProfiles ??
        pagination?.archived?.total ??
        rowsByFolder.archived.length,
    ),
});

function getCloudflareFolderTotals(payload = {}, rowsByFolder) {
  const sources = {
    summary: payload.summary || {},
    storage: payload.storage || {},
    pagination: payload.pagination || {},
  };

  return Object.fromEntries(
    Object.entries(CLOUDFLARE_TOTAL_RESOLVERS).map(([folderId, resolve]) => [
      folderId,
      resolve(sources, rowsByFolder),
    ]),
  );
}

function getConflictMappingCount(health = {}, rowsByFolder) {
  return Number(
    health.conflictMappings ??
      rowsByFolder.mappings.filter((entry) => entry.status === 'conflict')
        .length,
  );
}

function createCloudflareFolderContext(payload = {}, folderRecords = {}) {
  const rowsByFolder = getCloudflareRowsByFolder(folderRecords);

  return {
    rowsByFolder,
    totals: getCloudflareFolderTotals(payload, rowsByFolder),
    conflictCount: getConflictMappingCount(payload.health || {}, rowsByFolder),
  };
}

const CLOUDFLARE_FOLDER_DEFINITIONS = Object.freeze([
  {
    folderId: 'memories',
    title: 'Profile + Erinnerungen',
    total: (context) =>
      context.totals.memories || context.rowsByFolder.memories.length,
  },
  {
    folderId: 'mappings',
    title: 'Name-Mappings',
    total: (context) => context.totals.mappings,
    tone: (context) => (context.conflictCount > 0 ? 'error' : 'success'),
  },
  {
    folderId: 'comments',
    title: 'Kommentare',
    total: (context) => context.totals.comments,
  },
  {
    folderId: 'contacts',
    title: 'Kontaktanfragen',
    total: (context) => context.totals.contacts,
  },
  {
    folderId: 'likes',
    title: 'Projekt-Likes',
    total: (context) => context.totals.likes,
  },
  {
    folderId: 'like-events',
    title: 'Like-Events',
    total: (context) => context.totals['like-events'],
  },
  {
    folderId: 'audit',
    title: 'Audit-Log',
    total: (context) => context.totals.audit,
    tone: (context) =>
      context.rowsByFolder.audit.some((entry) => entry.tone === 'error')
        ? 'warning'
        : 'neutral',
  },
  {
    folderId: 'archived',
    title: 'Archivierte Profile',
    total: (context) => context.totals.archived,
    tone: (context) => (context.totals.archived > 0 ? 'warning' : 'neutral'),
  },
]);

function createCloudflareFolders(payload = {}, folderRecords = {}) {
  const context = createCloudflareFolderContext(payload, folderRecords);

  return CLOUDFLARE_FOLDER_DEFINITIONS.map((definition) =>
    createLoadedFolderRow({
      folderId: definition.folderId,
      title: definition.title,
      total: definition.total(context),
      tone: definition.tone ? definition.tone(context) : 'neutral',
    }),
  );
}

export function syncVisibleRecords(state) {
  if (state.activeFolderId) {
    state.records = [...(state.folderRecords[state.activeFolderId] || [])];
    return;
  }
  state.records = [...state.cloudflareFolders];
}

function normalizeFolderPagination(pagination) {
  if (!pagination || typeof pagination !== 'object') return null;

  return {
    page: Number(pagination.page) || 1,
    pageSize: Number(pagination.pageSize) || 0,
    total: Number(pagination.total) || 0,
    totalPages: Number(pagination.totalPages) || 1,
    hasPreviousPage: !!pagination.hasPreviousPage,
    hasNextPage: !!pagination.hasNextPage,
  };
}

function getFolderPagination(payload, folderId) {
  if (!folderId) return null;
  const sectionKey = FOLDER_PAGINATION_KEY[folderId];
  if (!sectionKey) return null;
  return normalizeFolderPagination(payload?.pagination?.[sectionKey]);
}

const FOLDER_RECORD_BUILDERS = Object.freeze({
  memories: ({ users }) => createMemoryRows(users),
  users: ({ users }) => createUserRows(users),
  mappings: ({ payload }) => createMappingRows(payload?.nameMappings || []),
  comments: ({ payload }) => createCommentRows(payload?.comments || []),
  contacts: ({ payload }) => createContactRows(payload?.contacts || []),
  likes: ({ payload }) => createLikeRows(payload?.likes || []),
  'like-events': ({ payload }) =>
    createLikeEventRows(payload?.likeEvents || []),
  audit: ({ payload }) => createAuditRows(payload?.auditLogs || []),
  archived: ({ payload }) =>
    createArchivedRows(payload?.archivedProfiles || []),
});

function createFolderRecords(payload, users) {
  return Object.fromEntries(
    Object.entries(FOLDER_RECORD_BUILDERS).map(([folderId, buildRows]) => [
      folderId,
      buildRows({ payload, users }),
    ]),
  );
}

export function rebuildRecords(state, payload, users) {
  state.folderRecords = createFolderRecords(payload, users);
  state.cloudflareFolders = createCloudflareFolders(
    payload,
    state.folderRecords,
  );
  if (state.activeFolderId && !getFolderEntry(state, state.activeFolderId)) {
    state.activeFolderId = '';
  }
  const folderPagination = getFolderPagination(payload, state.activeFolderId);
  state.activeFolderPagination = folderPagination;
  state.activeFolderPage = folderPagination?.page || 1;
  syncVisibleRecords(state);
}

export function getFolderEntry(state, folderId) {
  return (
    state.cloudflareFolders.find((entry) => entry.folderId === folderId) || null
  );
}
