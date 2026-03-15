/**
 * Unified compact admin UI.
 * Root list shows Cloudflare main folders, click opens content with actions.
 */

const API_URL = '/api/admin/stats';
const USERS_API_URL = '/api/admin/users';
const SESSION_API_URL = '/api/admin/session';

const USERS_PAGE_SIZE = 100;
const DEFAULT_MAPPINGS_PAGE_SIZE = 100;
const DEFAULT_SECTION_PAGE_SIZE = 100;
const FOLDER_PAGE_QUERY_KEY = {
  memories: 'usersPage',
  mappings: 'mappingsPage',
  'like-events': 'likeEventsPage',
  comments: 'commentsPage',
  contacts: 'contactsPage',
  likes: 'likesPage',
  audit: 'auditPage',
  archived: 'archivedPage',
};
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

const authOverlay = document.getElementById('auth-overlay');
const authError = document.getElementById('auth-error');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const passwordInput = document.getElementById('admin-password');
const adminMain = document.getElementById('admin-main');
const adminUnified = document.querySelector('.admin-unified');
const toastContainer = document.getElementById('admin-toast-container');

const recordsList = document.getElementById('records-list');
const noRecords = document.getElementById('no-records');
const recordsPagination = document.getElementById('records-pagination');
const recordsPageInfo = document.getElementById('records-page-info');
const recordsPagePrev = document.getElementById('records-page-prev');
const recordsPageNext = document.getElementById('records-page-next');
const selectedType = document.getElementById('selected-type');
const selectedSummary = document.getElementById('selected-summary');
const selectedDetails = document.getElementById('selected-details');
const selectedContent = document.getElementById('selected-content');
const detailsPanel = document.getElementById('details-panel');

const state = {
  isAuthenticated: false,
  loading: false,
  actionsBusy: false,
  cloudflareFolders: [],
  folderRecords: {},
  activeFolderId: '',
  activeFolderPage: 1,
  activeFolderPagination: null,
  memoryRows: [],
  userRows: [],
  records: [],
  latestPayload: {},
  selectedEntryId: '',
  selectedEntry: null,
};

function isFolderEntry(entry) {
  return entry?.kind === 'folder';
}

function isMemoryEntry(entry) {
  return entry?.kind === 'memory';
}

function isMemoryProfileEntry(entry) {
  return entry?.kind === 'memory-profile';
}

function isUserEntry(entry) {
  return entry?.kind === 'user';
}

function isMappingEntry(entry) {
  return entry?.kind === 'mapping';
}

function isLikeEntry(entry) {
  return entry?.kind === 'like';
}

function isLikeEventEntry(entry) {
  return entry?.kind === 'like-event';
}

function isCommentEntry(entry) {
  return entry?.kind === 'comment';
}

function isContactEntry(entry) {
  return entry?.kind === 'contact';
}

function isAuditEntry(entry) {
  return entry?.kind === 'audit';
}

function isArchivedEntry(entry) {
  return entry?.kind === 'archived';
}

function isLocalhostRuntime() {
  const host = String(window?.location?.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function setHidden(element, hidden) {
  if (!element) return;
  element.hidden = hidden;
}

function setText(element, text) {
  if (!element) return;
  element.textContent = text;
}

function setMetric(id, value) {
  setText(document.getElementById(id), value);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] || char;
  });
}

function formatDate(value, options) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('de-DE', options);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('de-DE');
}

function truncateText(value, maxLength = 140) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function parseToEpoch(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value || ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parseRetryAfterSeconds(value) {
  const seconds = Number.parseInt(String(value || ''), 10);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;
  return 0;
}

function createRateLimitError(response, payload, fallbackMessage) {
  const retryAfter = parseRetryAfterSeconds(
    response?.headers?.get('Retry-After'),
  );
  const message =
    payload?.message ||
    payload?.error ||
    fallbackMessage ||
    (retryAfter > 0
      ? `Zu viele Anfragen. Bitte in ${retryAfter}s erneut versuchen.`
      : 'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.');
  const error = new Error(message);
  error.code = 'rate_limited';
  error.retryAfter = retryAfter;
  return error;
}

let toastCounter = 0;

function showToast(message, tone = 'info', durationMs = 3500) {
  if (!toastContainer || !message) return;

  const toast = document.createElement('div');
  toast.className = 'admin-toast';
  toast.dataset.tone = tone;
  toast.dataset.toastId = String(++toastCounter);
  toast.innerHTML = `
    <div class="admin-toast__body">
      <p class="admin-toast__message">${escapeHtml(message)}</p>
    </div>
    <button class="admin-toast__dismiss" type="button" aria-label="Schließen">✕</button>
  `;

  const dismiss = () => {
    if (!toast.isConnected) return;
    toast.remove();
  };

  toast
    .querySelector('.admin-toast__dismiss')
    ?.addEventListener('click', dismiss);
  toastContainer.appendChild(toast);

  if (durationMs > 0) {
    setTimeout(dismiss, durationMs);
  }
}

function showStatus(message, tone = 'info') {
  if (!message) return;
  showToast(message, tone);
}

function showAuth(showError = false, message = 'Falsches Passwort!') {
  setText(authError, message);
  setHidden(authError, !showError);
  authOverlay.classList.remove('hidden');
  setHidden(adminMain, true);
  requestAnimationFrame(() => passwordInput?.focus());
}

function hideAuth() {
  setHidden(authError, true);
  authOverlay.classList.add('hidden');
  setHidden(adminMain, false);
}

function setBusyState(isBusy) {
  if (logoutButton) logoutButton.disabled = isBusy;
  renderRecordsPagination();
}

function setActionsBusy(isBusy) {
  state.actionsBusy = isBusy;

  const quickActionButtons = recordsList?.querySelectorAll(
    '.admin-unified__quick',
  );
  quickActionButtons?.forEach((button) => {
    button.disabled = isBusy;
  });
}

async function checkAdminSession() {
  const response = await fetch(SESSION_API_URL, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await parseJsonResponse(response);
  if (response.status === 429) {
    throw createRateLimitError(
      response,
      result,
      'Zu viele Session-Anfragen. Bitte kurz warten.',
    );
  }
  if (!response.ok) return false;
  return !!result?.authenticated;
}

async function createAdminSession(password) {
  const response = await fetch(SESSION_API_URL, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
  const result = await parseJsonResponse(response);
  if (response.status === 429) {
    throw createRateLimitError(
      response,
      result,
      'Zu viele Login-Versuche. Bitte kurz warten.',
    );
  }
  if (!response.ok || result?.success === false) {
    throw new Error(result?.error || 'Login fehlgeschlagen.');
  }
  return result;
}

async function deleteAdminSession() {
  await fetch(SESSION_API_URL, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
}

function createUnauthorizedError(message = 'Sitzung abgelaufen.') {
  const error = new Error(message);
  error.code = 'unauthorized';
  return error;
}

async function sendAdminUserAction(payload) {
  const response = await fetch(USERS_API_URL, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await parseJsonResponse(response);

  if (response.status === 429) {
    throw createRateLimitError(
      response,
      result,
      'Zu viele Admin-Aktionen. Bitte kurz warten.',
    );
  }

  if (response.status === 401) {
    throw createUnauthorizedError('Sitzung abgelaufen. Bitte neu einloggen.');
  }

  if (!response.ok || result?.success === false) {
    throw new Error(
      result?.text || result?.error || 'Admin-Aktion fehlgeschlagen.',
    );
  }

  return result || { success: true };
}

function buildStatsUrl({ folderId = '', page = 1 } = {}) {
  const params = new URLSearchParams();
  params.set('usersPageSize', String(USERS_PAGE_SIZE));
  params.set('mappingsPageSize', String(DEFAULT_MAPPINGS_PAGE_SIZE));
  params.set('likesPageSize', String(DEFAULT_SECTION_PAGE_SIZE));
  params.set('likeEventsPageSize', String(DEFAULT_SECTION_PAGE_SIZE));
  params.set('commentsPageSize', String(DEFAULT_SECTION_PAGE_SIZE));
  params.set('contactsPageSize', String(DEFAULT_SECTION_PAGE_SIZE));
  params.set('auditPageSize', String(DEFAULT_SECTION_PAGE_SIZE));
  params.set('archivedPageSize', String(DEFAULT_SECTION_PAGE_SIZE));
  params.set('compact', '0');
  if (folderId) {
    params.set('folder', folderId);
    const pageKey = FOLDER_PAGE_QUERY_KEY[folderId];
    if (pageKey) {
      const pageNumber = Number.isFinite(Number(page)) ? Number(page) : 1;
      params.set(pageKey, String(Math.max(1, Math.floor(pageNumber))));
    }
  }

  return `${API_URL}?${params.toString()}`;
}

async function fetchStatsPage({ folderId = '', page = 1 } = {}) {
  const response = await fetch(buildStatsUrl({ folderId, page }), {
    method: 'GET',
    credentials: 'same-origin',
  });
  const payload = await parseJsonResponse(response);

  if (response.status === 429) {
    throw createRateLimitError(
      response,
      payload,
      'Zu viele Anfragen. Daten werden in Kürze wieder verfügbar.',
    );
  }

  if (response.status === 401) {
    throw createUnauthorizedError('Sitzung abgelaufen. Bitte neu einloggen.');
  }

  if (!response.ok) {
    throw new Error(
      payload?.details ||
        payload?.error ||
        'Admin-Daten konnten nicht geladen werden.',
    );
  }

  return payload || {};
}

function mergeUsers(users = []) {
  const byId = new Map();

  users.forEach((user) => {
    const userId = String(user?.userId || '').trim();
    if (!userId) return;

    const normalized = {
      userId,
      name: String(user?.name || '').trim(),
      status: String(user?.status || 'anonymous'),
      memoryCount: Number(user?.memoryCount) || 0,
      latestMemoryAt: user?.latestMemoryAt || '',
      memories: Array.isArray(user?.memories) ? user.memories : [],
    };

    const existing = byId.get(userId);
    if (!existing) {
      byId.set(userId, normalized);
      return;
    }

    const existingMemoryCount = existing.memories.length;
    const currentMemoryCount = normalized.memories.length;
    if (currentMemoryCount > existingMemoryCount) {
      byId.set(userId, normalized);
      return;
    }

    existing.latestMemoryAt =
      parseToEpoch(normalized.latestMemoryAt) >
      parseToEpoch(existing.latestMemoryAt)
        ? normalized.latestMemoryAt
        : existing.latestMemoryAt;
    existing.memoryCount = Math.max(
      existing.memoryCount,
      normalized.memoryCount,
    );
    if (!existing.name && normalized.name) existing.name = normalized.name;
  });

  return [...byId.values()].sort(
    (a, b) => parseToEpoch(b.latestMemoryAt) - parseToEpoch(a.latestMemoryAt),
  );
}

function createMemoryRows(users = []) {
  return users
    .map((user) => {
      const userId = String(user?.userId || '').trim();
      if (!userId) return null;
      const userName = String(user?.name || '').trim();
      const status = String(user?.status || 'anonymous');
      const memories = Array.isArray(user?.memories) ? user.memories : [];
      const orderedMemories = [...memories].sort(
        (a, b) => parseToEpoch(b?.timestamp) - parseToEpoch(a?.timestamp),
      );
      const latest = orderedMemories[0] || null;
      const latestTimestamp = latest?.timestamp || user?.latestMemoryAt || '';

      return {
        id: `memory-profile:${userId}`,
        kind: 'memory-profile',
        userId,
        userIds: [userId],
        userName: userName || userId,
        status,
        hasDuplicateProfiles: false,
        memoryCount: Number(user?.memoryCount) || orderedMemories.length,
        latestMemoryAt: latestTimestamp,
        latestKey: String(latest?.key || '').trim(),
        latestValue: String(latest?.value || ''),
        latestCategory: String(latest?.category || 'note'),
        latestExpiresAt: latest?.expiresAt || '',
        memories: orderedMemories,
        tone: status === 'identified' ? 'success' : 'neutral',
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) => parseToEpoch(b.latestMemoryAt) - parseToEpoch(a.latestMemoryAt),
    );
}

function createUserRows(users = []) {
  return users
    .map((user) => {
      const userId = String(user?.userId || '').trim();
      if (!userId) return null;
      const userName = String(user?.name || '').trim();
      const status = String(user?.status || 'anonymous');
      const memories = Array.isArray(user?.memories) ? user.memories : [];
      const aliases = Array.isArray(user?.aliases) ? user.aliases : [];
      const memoryKeys = Array.isArray(user?.memoryKeys) ? user.memoryKeys : [];

      return {
        id: `user:${userId}`,
        kind: 'user',
        userId,
        userIds: [userId],
        userName: userName || userId,
        status,
        hasDuplicateProfiles: false,
        memoryCount: Number(user?.memoryCount) || memories.length,
        latestMemoryAt: user?.latestMemoryAt || '',
        aliases,
        memoryKeys,
        memories,
        tone: status === 'identified' ? 'success' : 'neutral',
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) => parseToEpoch(b.latestMemoryAt) - parseToEpoch(a.latestMemoryAt),
    );
}

function createMappingRows(items = []) {
  return items
    .map((item, index) => {
      const status = String(item?.status || 'linked')
        .trim()
        .toLowerCase();
      const tone =
        status === 'conflict'
          ? 'error'
          : status === 'linked'
            ? 'success'
            : status === 'orphan'
              ? 'warning'
              : 'neutral';
      return {
        id: `mapping:${item?.name || 'unknown'}:${item?.userId || '-'}:${index}`,
        kind: 'mapping',
        name: String(item?.name || '').trim(),
        userId: String(item?.userId || '').trim(),
        rawValue: String(item?.rawValue || '').trim(),
        status,
        updatedAt: item?.updatedAt || '',
        tone,
      };
    })
    .filter((item) => item.name || item.userId || item.rawValue)
    .sort((a, b) => {
      const priority = {
        conflict: 0,
        orphan: 1,
        linked: 2,
      };
      const priorityA = Number.isFinite(priority[a.status])
        ? priority[a.status]
        : 3;
      const priorityB = Number.isFinite(priority[b.status])
        ? priority[b.status]
        : 3;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return parseToEpoch(b.updatedAt) - parseToEpoch(a.updatedAt);
    });
}

function resolveLikeCount(item) {
  return Number(item?.likes ?? item?.likeCount ?? item?.count) || 0;
}

function createLikeRows(items = []) {
  return items
    .map((item, index) => {
      const projectIdRaw = String(
        item?.project_id ?? item?.projectId ?? '',
      ).trim();
      const projectId = projectIdRaw || '-';
      return {
        id: `like:${projectId || 'unknown'}:${index}`,
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
  return items
    .map((item, index) => ({
      id: `like-event:${item?.id || index}`,
      kind: 'like-event',
      eventId: Number(item?.id) || 0,
      projectId:
        String(item?.project_id ?? item?.projectId ?? '').trim() || '-',
      sourceIp: String(item?.source_ip ?? item?.sourceIp ?? '').trim(),
      userAgent: String(item?.user_agent ?? item?.userAgent ?? '').trim(),
      requestId: String(item?.request_id ?? item?.requestId ?? '').trim(),
      createdAt: item?.created_at || item?.createdAt || '',
      tone: 'neutral',
    }))
    .sort((a, b) => {
      const timeDiff = parseToEpoch(b.createdAt) - parseToEpoch(a.createdAt);
      if (timeDiff !== 0) return timeDiff;
      return (Number(b.eventId) || 0) - (Number(a.eventId) || 0);
    });
}

function createCommentRows(items = []) {
  return items
    .map((item, index) => ({
      id: `comment:${item?.id || index}`,
      kind: 'comment',
      postId: String(item?.post_id || '').trim(),
      authorName: String(item?.author_name || '').trim(),
      content: String(item?.content || ''),
      createdAt: item?.created_at || '',
      tone: 'neutral',
    }))
    .sort((a, b) => parseToEpoch(b.createdAt) - parseToEpoch(a.createdAt));
}

function createContactRows(items = []) {
  return items
    .map((item, index) => ({
      id: `contact:${item?.id || index}`,
      kind: 'contact',
      name: String(item?.name || '').trim(),
      email: String(item?.email || '').trim(),
      subject: String(item?.subject || '').trim(),
      message: String(item?.message || ''),
      createdAt: item?.created_at || '',
      tone: 'neutral',
    }))
    .sort((a, b) => parseToEpoch(b.createdAt) - parseToEpoch(a.createdAt));
}

function createAuditRows(items = []) {
  return items
    .map((item, index) => {
      const status = String(item?.status || '')
        .trim()
        .toLowerCase();
      const tone =
        status === 'failed' || status === 'error'
          ? 'error'
          : status === 'success' || status === 'ok'
            ? 'success'
            : 'neutral';
      return {
        id: `audit:${item?.id || index}`,
        kind: 'audit',
        action: String(item?.action || '').trim(),
        targetUserId: String(item?.targetUserId || '').trim(),
        memoryKey: String(item?.memoryKey || '').trim(),
        status: status || '-',
        summary: String(item?.summary || ''),
        actor: String(item?.actor || 'admin').trim(),
        sourceIp: String(item?.sourceIp || '').trim(),
        details: item?.details ?? null,
        before: item?.before ?? null,
        after: item?.after ?? null,
        createdAt: item?.createdAt || '',
        tone,
      };
    })
    .sort((a, b) => parseToEpoch(b.createdAt) - parseToEpoch(a.createdAt));
}

function createArchivedRows(items = []) {
  return items
    .map((item, index) => ({
      id: `archived:${item?.userId || 'unknown'}:${index}`,
      kind: 'archived',
      userId: String(item?.userId || '').trim(),
      displayName: String(item?.displayName || '').trim(),
      deletedAt: item?.deletedAt || '',
      restoreUntil: item?.restoreUntil || '',
      deletedBy: String(item?.deletedBy || 'admin').trim(),
      deleteReason: String(item?.deleteReason || '').trim(),
      memoryCount: Number(item?.memoryCount) || 0,
      aliasCount: Number(item?.aliasCount) || 0,
      snapshot: item?.snapshot ?? null,
      tone: 'warning',
    }))
    .sort((a, b) => parseToEpoch(b.deletedAt) - parseToEpoch(a.deletedAt));
}

function createFolderRow({
  folderId,
  title,
  source,
  total,
  loaded,
  detail,
  tone = 'neutral',
  preview = null,
}) {
  return {
    id: `folder:${folderId}`,
    kind: 'folder',
    folderId,
    title,
    source,
    total: Number(total) || 0,
    loaded: Number(loaded) || 0,
    detail: String(detail || '').trim(),
    tone,
    preview,
  };
}

function createCloudflareFolders(payload = {}, folderRecords = {}) {
  const summary = payload.summary || {};
  const storage = payload.storage || {};
  const health = payload.health || {};
  const pagination = payload.pagination || {};
  const memoryRows = Array.isArray(folderRecords.memories)
    ? folderRecords.memories
    : [];
  const userRows = Array.isArray(folderRecords.users)
    ? folderRecords.users
    : [];
  const mappingRows = Array.isArray(folderRecords.mappings)
    ? folderRecords.mappings
    : [];
  const commentRows = Array.isArray(folderRecords.comments)
    ? folderRecords.comments
    : [];
  const contactRows = Array.isArray(folderRecords.contacts)
    ? folderRecords.contacts
    : [];
  const likeRows = Array.isArray(folderRecords.likes)
    ? folderRecords.likes
    : [];
  const likeEventRows = Array.isArray(folderRecords['like-events'])
    ? folderRecords['like-events']
    : [];
  const auditRows = Array.isArray(folderRecords.audit)
    ? folderRecords.audit
    : [];
  const archivedRows = Array.isArray(folderRecords.archived)
    ? folderRecords.archived
    : [];
  const totalMemories = Number(
    summary.filteredMemoryCount ?? storage.memoryCount ?? 0,
  );
  const totalMappings = Number(
    pagination?.mappings?.total ??
      storage.nameMappingCount ??
      mappingRows.length,
  );
  const totalComments = Number(
    summary.totalComments ?? pagination?.comments?.total ?? commentRows.length,
  );
  const totalContacts = Number(
    summary.totalContacts ?? pagination?.contacts?.total ?? contactRows.length,
  );
  const totalLikesRows = Number(pagination?.likes?.total ?? likeRows.length);
  const totalLikes = Number(
    summary.totalLikes ??
      likeRows.reduce((sum, entry) => sum + (Number(entry?.likes) || 0), 0),
  );
  const totalLikeEvents = Number(
    summary.totalLikeEvents ??
      pagination?.likeEvents?.total ??
      likeEventRows.length,
  );
  const totalAudit = Number(
    summary.totalAuditLogs ?? pagination?.audit?.total ?? auditRows.length,
  );
  const totalArchived = Number(
    summary.totalArchivedProfiles ??
      pagination?.archived?.total ??
      archivedRows.length,
  );
  const conflictCount = Number(
    health.conflictMappings ??
      mappingRows.filter((entry) => entry.status === 'conflict').length,
  );
  const loadedUniqueUsers = new Set(
    userRows
      .flatMap((entry) =>
        Array.isArray(entry?.userIds) && entry.userIds.length > 0
          ? entry.userIds
          : [entry?.userId],
      )
      .filter(Boolean),
  ).size;
  const totalUsers = Number(summary.filteredUsers ?? loadedUniqueUsers);
  const totalProfiles = totalUsers;

  const folders = [
    createFolderRow({
      folderId: 'memories',
      title: 'Profile + Erinnerungen',
      source: 'Cloudflare D1',
      total: totalMemories || memoryRows.length,
      loaded: memoryRows.length,
      detail: `${formatNumber(totalProfiles)} Profile • ${formatNumber(totalUsers)} User`,
      tone: 'neutral',
      preview: {
        totalMemoryRows: totalMemories,
        profileRows: totalProfiles,
        sample: memoryRows.slice(0, 40).map((entry) => ({
          userId: entry.userId,
          memoryCount: entry.memoryCount,
          latestKey: entry.latestKey,
          latestValue: entry.latestValue,
          latestMemoryAt: entry.latestMemoryAt,
        })),
      },
    }),
    createFolderRow({
      folderId: 'mappings',
      title: 'Name-Mappings',
      source: 'Cloudflare D1',
      total: totalMappings,
      loaded: mappingRows.length,
      detail: `${formatNumber(conflictCount)} Konflikte`,
      tone: conflictCount > 0 ? 'error' : 'success',
      preview: {
        total: totalMappings,
        conflicts: conflictCount,
        loaded: mappingRows.length,
      },
    }),
    createFolderRow({
      folderId: 'comments',
      title: 'Kommentare',
      source: 'Cloudflare D1',
      total: totalComments,
      loaded: commentRows.length,
      detail: `${formatNumber(commentRows.length)} geladen`,
      tone: 'neutral',
      preview: {
        total: totalComments,
        loaded: commentRows.length,
      },
    }),
    createFolderRow({
      folderId: 'contacts',
      title: 'Kontaktanfragen',
      source: 'Cloudflare D1',
      total: totalContacts,
      loaded: contactRows.length,
      detail: `${formatNumber(contactRows.length)} geladen`,
      tone: 'neutral',
      preview: {
        total: totalContacts,
        loaded: contactRows.length,
      },
    }),
    createFolderRow({
      folderId: 'likes',
      title: 'Projekt-Likes',
      source: 'Cloudflare D1',
      total: totalLikesRows,
      loaded: likeRows.length,
      detail: `${formatNumber(totalLikes)} Gesamt-Likes`,
      tone: 'neutral',
      preview: {
        totalRows: totalLikesRows,
        totalLikes,
        loaded: likeRows.length,
      },
    }),
    createFolderRow({
      folderId: 'like-events',
      title: 'Like-Events',
      source: 'Cloudflare D1',
      total: totalLikeEvents,
      loaded: likeEventRows.length,
      detail: `${formatNumber(likeEventRows.length)} geladen`,
      tone: 'neutral',
      preview: {
        total: totalLikeEvents,
        loaded: likeEventRows.length,
      },
    }),
    createFolderRow({
      folderId: 'audit',
      title: 'Audit-Log',
      source: 'Cloudflare D1',
      total: totalAudit,
      loaded: auditRows.length,
      detail: `${formatNumber(auditRows.length)} geladen`,
      tone: auditRows.some((entry) => entry.tone === 'error')
        ? 'warning'
        : 'neutral',
      preview: {
        total: totalAudit,
        loaded: auditRows.length,
      },
    }),
    createFolderRow({
      folderId: 'archived',
      title: 'Archivierte Profile',
      source: 'Cloudflare D1',
      total: totalArchived,
      loaded: archivedRows.length,
      detail: `${formatNumber(archivedRows.length)} geladen`,
      tone: totalArchived > 0 ? 'warning' : 'neutral',
      preview: {
        total: totalArchived,
        loaded: archivedRows.length,
      },
    }),
  ];

  return folders;
}

function syncVisibleRecords() {
  if (state.activeFolderId) {
    state.records = [...(state.folderRecords[state.activeFolderId] || [])];
    return;
  }
  state.records = [...state.cloudflareFolders];
}

function getFolderPagination(payload, folderId) {
  if (!folderId) return null;
  const sectionKey = FOLDER_PAGINATION_KEY[folderId];
  if (!sectionKey) return null;
  const pagination = payload?.pagination?.[sectionKey];
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

function rebuildRecords(payload, users) {
  state.latestPayload = payload || {};
  state.memoryRows = createMemoryRows(users);
  state.userRows = createUserRows(users);
  state.folderRecords = {
    memories: state.memoryRows,
    users: state.userRows,
    mappings: createMappingRows(payload?.nameMappings || []),
    comments: createCommentRows(payload?.comments || []),
    contacts: createContactRows(payload?.contacts || []),
    likes: createLikeRows(payload?.likes || []),
    'like-events': createLikeEventRows(payload?.likeEvents || []),
    audit: createAuditRows(payload?.auditLogs || []),
    archived: createArchivedRows(payload?.archivedProfiles || []),
  };
  state.cloudflareFolders = createCloudflareFolders(
    payload,
    state.folderRecords,
  );
  if (state.activeFolderId && !getFolderEntry(state.activeFolderId)) {
    state.activeFolderId = '';
  }
  const folderPagination = getFolderPagination(payload, state.activeFolderId);
  state.activeFolderPagination = folderPagination;
  state.activeFolderPage = folderPagination?.page || 1;
  syncVisibleRecords();
}

function getFolderEntry(folderId) {
  return (
    state.cloudflareFolders.find((entry) => entry.folderId === folderId) || null
  );
}

async function openFolder(folderId, page = 1) {
  const folder = getFolderEntry(folderId);
  if (!folder) return;
  await fetchData({ silent: true, folderId: folder.folderId, page });
}

function goToRootFolders() {
  const currentFolderId = state.activeFolderId;
  state.activeFolderId = '';
  state.activeFolderPage = 1;
  state.activeFolderPagination = null;
  syncVisibleRecords();

  const activeRoot = currentFolderId ? getFolderEntry(currentFolderId) : null;
  if (activeRoot) {
    state.selectedEntryId = activeRoot.id;
    state.selectedEntry = activeRoot;
  } else if (state.records.length > 0) {
    state.selectedEntryId = state.records[0].id;
    state.selectedEntry = state.records[0];
  } else {
    state.selectedEntryId = '';
    state.selectedEntry = null;
  }

  renderRecordsList();
  renderSelectionPanel();
}

function findRecordById(recordId) {
  return state.records.find((entry) => entry.id === recordId) || null;
}

function getEntryTone(entry) {
  if (entry?.tone) return entry.tone;
  return 'neutral';
}

function getEntryType(entry) {
  if (isFolderEntry(entry)) return '';
  if (isMemoryEntry(entry)) return 'Memory';
  if (isMemoryProfileEntry(entry)) return 'Erinnerungen';
  if (isUserEntry(entry)) return 'Profil';
  if (isMappingEntry(entry)) return 'Mapping';
  if (isCommentEntry(entry)) return 'Kommentar';
  if (isContactEntry(entry)) return 'Kontakt';
  if (isLikeEntry(entry)) return 'Like';
  if (isLikeEventEntry(entry)) return 'Like Event';
  if (isAuditEntry(entry)) return 'Audit';
  if (isArchivedEntry(entry)) return 'Archiv';
  return 'Eintrag';
}

function getEntryBadge(entry) {
  if (isFolderEntry(entry)) return formatNumber(entry.total || 0);
  if (isMemoryEntry(entry)) return entry.category || 'note';
  if (isMemoryProfileEntry(entry) && entry.hasDuplicateProfiles)
    return `${formatNumber(entry.userIds?.length || 0)} profile`;
  if (isMemoryProfileEntry(entry))
    return `${formatNumber(entry.memoryCount || 0)} memories`;
  if (isUserEntry(entry) && entry.hasDuplicateProfiles)
    return `${formatNumber(entry.userIds?.length || 0)} profile`;
  if (isUserEntry(entry)) return entry.status || 'profil';
  if (isMappingEntry(entry)) return entry.status || 'mapping';
  if (isCommentEntry(entry)) return entry.postId || '-';
  if (isContactEntry(entry)) return entry.email || '-';
  if (isLikeEntry(entry)) return `${formatNumber(entry.likes || 0)} likes`;
  if (isLikeEventEntry(entry)) return entry.projectId || '-';
  if (isAuditEntry(entry)) return entry.status || '-';
  if (isArchivedEntry(entry))
    return `${formatNumber(entry.memoryCount || 0)} memories`;
  return 'info';
}

function getEntryTitle(entry) {
  if (isFolderEntry(entry)) return entry.title || 'Cloudflare Daten';
  if (isMemoryEntry(entry)) return entry.userName || entry.userId || '-';
  if (isMemoryProfileEntry(entry)) return entry.userName || entry.userId || '-';
  if (isUserEntry(entry)) return entry.userName || entry.userId || '-';
  if (isMappingEntry(entry)) return entry.name || '-';
  if (isCommentEntry(entry)) return entry.authorName || 'Unbekannt';
  if (isContactEntry(entry)) return entry.subject || '(Ohne Betreff)';
  if (isLikeEntry(entry)) return entry.projectId || '-';
  if (isLikeEventEntry(entry)) return `Event ${entry.eventId || '-'}`;
  if (isAuditEntry(entry)) return entry.action || 'audit';
  if (isArchivedEntry(entry)) return entry.displayName || entry.userId || '-';
  return '-';
}

function getEntryLine(entry) {
  if (isFolderEntry(entry)) return '';
  if (isMemoryEntry(entry)) {
    return `${entry.key || '-'}: ${truncateText(entry.value, 110)}`;
  }
  if (isMemoryProfileEntry(entry)) {
    if (entry.hasDuplicateProfiles) {
      return `${formatNumber(entry.userIds?.length || 0)} Profile zusammengeführt • ${formatNumber(entry.memoryCount || 0)} Memories`;
    }
    const latestLine = entry.latestKey
      ? `${entry.latestKey}: ${truncateText(entry.latestValue, 88)}`
      : 'Keine Erinnerung';
    return `${latestLine} • ${formatNumber(entry.memoryCount || 0)} gesamt`;
  }
  if (isUserEntry(entry)) {
    if (entry.hasDuplicateProfiles) {
      return `${formatNumber(entry.userIds?.length || 0)} Profile • ${formatNumber(entry.memoryCount || 0)} Memories`;
    }
    return `${formatNumber(entry.memoryCount || 0)} Memories • ${entry.userId || '-'}`;
  }
  if (isMappingEntry(entry)) {
    return `${entry.userId || '-'} • ${entry.rawValue || '-'}`;
  }
  if (isCommentEntry(entry)) {
    return truncateText(entry.content, 110);
  }
  if (isContactEntry(entry)) {
    return `${entry.name || '-'} • ${truncateText(entry.message, 72)}`;
  }
  if (isLikeEntry(entry)) {
    return `${formatNumber(entry.likes || 0)} Likes`;
  }
  if (isLikeEventEntry(entry)) {
    return `${entry.projectId || '-'} • ${entry.sourceIp || '-'}`;
  }
  if (isAuditEntry(entry)) {
    return `${entry.targetUserId || '-'} • ${truncateText(entry.summary, 84)}`;
  }
  if (isArchivedEntry(entry)) {
    return `${entry.userId || '-'} • ${formatNumber(entry.aliasCount || 0)} Aliase`;
  }
  return '-';
}

function getEntryMeta(entry) {
  if (isFolderEntry(entry)) return '';
  if (isMemoryEntry(entry)) {
    return `${formatDate(entry.timestamp)}${
      entry.expiresAt ? ` • Ablauf ${formatDate(entry.expiresAt)}` : ''
    }`;
  }
  if (isMemoryProfileEntry(entry)) {
    return `Letzte Memory: ${formatDate(entry.latestMemoryAt)}${
      entry.latestExpiresAt
        ? ` • Ablauf ${formatDate(entry.latestExpiresAt)}`
        : ''
    }`;
  }
  if (isUserEntry(entry)) {
    if (entry.hasDuplicateProfiles) {
      return `Zusammengeführt • Letzte Memory: ${formatDate(entry.latestMemoryAt)}`;
    }
    return `Letzte Memory: ${formatDate(entry.latestMemoryAt)}`;
  }
  if (isMappingEntry(entry)) return `Update: ${formatDate(entry.updatedAt)}`;
  if (isCommentEntry(entry) || isContactEntry(entry) || isAuditEntry(entry))
    return formatDate(entry.createdAt);
  if (isLikeEntry(entry)) return '';
  if (isLikeEventEntry(entry)) return formatDate(entry.createdAt);
  if (isArchivedEntry(entry)) {
    return `Gelöscht: ${formatDate(entry.deletedAt)} • Restore bis ${formatDate(entry.restoreUntil)}`;
  }
  return '-';
}

function getQuickActionsMarkup(entry) {
  if (isFolderEntry(entry) && !state.activeFolderId) return '';

  if (isMemoryEntry(entry)) {
    return `
      <button
        type="button"
        class="admin-unified__quick"
        data-admin-action="open-memory-user"
        data-record-id="${escapeHtml(entry.id)}"
      >
        User
      </button>
      <button
        type="button"
        class="admin-unified__quick admin-unified__quick--danger"
        data-admin-action="delete-memory-inline"
        data-record-id="${escapeHtml(entry.id)}"
      >
        Löschen
      </button>
    `;
  }

  if (isMemoryProfileEntry(entry)) {
    if (entry.hasDuplicateProfiles) return '';
    return `
      <button
        type="button"
        class="admin-unified__quick"
        data-admin-action="open-memory-profile-user"
        data-record-id="${escapeHtml(entry.id)}"
      >
        User
      </button>
      <button
        type="button"
        class="admin-unified__quick admin-unified__quick--danger"
        data-admin-action="delete-memory-profile-user"
        data-record-id="${escapeHtml(entry.id)}"
      >
        User löschen
      </button>
    `;
  }

  if (isUserEntry(entry)) {
    if (entry.hasDuplicateProfiles) return '';
    return `
      <button
        type="button"
        class="admin-unified__quick"
        data-admin-action="open-user-inline"
        data-record-id="${escapeHtml(entry.id)}"
      >
        Laden
      </button>
      <button
        type="button"
        class="admin-unified__quick admin-unified__quick--danger"
        data-admin-action="delete-user-inline"
        data-record-id="${escapeHtml(entry.id)}"
      >
        Löschen
      </button>
    `;
  }

  if (isMappingEntry(entry)) {
    return `
      <button
        type="button"
        class="admin-unified__quick"
        data-admin-action="assign-mapping-inline"
        data-record-id="${escapeHtml(entry.id)}"
      >
        Zuweisen
      </button>
      <button
        type="button"
        class="admin-unified__quick admin-unified__quick--danger"
        data-admin-action="delete-mapping-inline"
        data-record-id="${escapeHtml(entry.id)}"
      >
        Löschen
      </button>
    `;
  }

  return '';
}

function renderRecordsList() {
  if (!recordsList || !noRecords) return;

  const inRootView = !state.activeFolderId;
  const activeFolder = state.activeFolderId
    ? getFolderEntry(state.activeFolderId)
    : null;
  const totalCount = inRootView
    ? state.cloudflareFolders.length
    : Number(activeFolder?.total || state.records.length);
  const visibleCount = state.records.length;

  setMetric('records-count', formatNumber(totalCount));
  setMetric('memory-count', formatNumber(visibleCount));

  const recordsCountElement = document.getElementById('records-count');
  if (recordsCountElement) {
    const label = `Gesamt: ${formatNumber(totalCount)}`;
    recordsCountElement.title = label;
    recordsCountElement.setAttribute('aria-label', label);
  }
  const memoryCountElement = document.getElementById('memory-count');
  if (memoryCountElement) {
    const label = `Angezeigt: ${formatNumber(visibleCount)}`;
    memoryCountElement.title = label;
    memoryCountElement.setAttribute('aria-label', label);
  }

  if (state.records.length === 0) {
    recordsList.innerHTML = '';
    setText(
      noRecords,
      isLocalhostRuntime()
        ? 'Keine lokalen Daten.'
        : inRootView
          ? 'Keine Daten vorhanden.'
          : 'Keine Einträge.',
    );
    setHidden(noRecords, false);
    renderRecordsPagination();
    return;
  }

  const html = [];
  if (!inRootView) {
    html.push(`
      <li class="admin-unified__item">
        <button
          type="button"
          class="admin-unified__select admin-unified__select--back"
          data-admin-action="go-root"
        >
          <strong class="admin-unified__item-title">← Zurück</strong>
        </button>
      </li>
    `);
  }

  html.push(
    ...state.records.map((entry) => {
      const isSelected = entry.id === state.selectedEntryId;
      const isMemory = isMemoryEntry(entry) || isMemoryProfileEntry(entry);
      const tone = getEntryTone(entry);
      const quickActions = getQuickActionsMarkup(entry);
      const typeLabel = getEntryType(entry);
      const badge = getEntryBadge(entry);
      const lineText = getEntryLine(entry);
      const metaText = getEntryMeta(entry);

      return `
        <li class="admin-unified__item ${isSelected ? 'is-selected' : ''}">
          <button
            type="button"
            class="admin-unified__select"
            data-admin-action="select-record"
            data-record-id="${escapeHtml(entry.id)}"
          >
            <div class="admin-unified__item-head">
              ${
                typeLabel
                  ? `<span class="admin-unified__type admin-unified__type--${
                      isMemory ? 'memory' : 'cloudflare'
                    }">${escapeHtml(typeLabel)}</span>`
                  : ''
              }
              <span class="admin-lite__pill admin-lite__pill--${escapeHtml(
                tone,
              )}">${escapeHtml(badge)}</span>
            </div>
            <strong class="admin-unified__item-title">${escapeHtml(
              getEntryTitle(entry),
            )}</strong>
            ${
              lineText
                ? `<p class="admin-unified__item-line">${escapeHtml(lineText)}</p>`
                : ''
            }
            ${
              metaText
                ? `<p class="admin-unified__item-meta">${escapeHtml(metaText)}</p>`
                : ''
            }
          </button>
          ${
            quickActions
              ? `<div class="admin-unified__item-actions">${quickActions}</div>`
              : ''
          }
        </li>
      `;
    }),
  );

  recordsList.innerHTML = html.join('');
  setHidden(noRecords, true);
  renderRecordsPagination();
}

function renderRecordsPagination() {
  if (
    !recordsPagination ||
    !recordsPageInfo ||
    !recordsPagePrev ||
    !recordsPageNext
  ) {
    return;
  }

  if (!state.activeFolderId || !state.activeFolderPagination) {
    setHidden(recordsPagination, true);
    return;
  }

  const pagination = state.activeFolderPagination;
  const totalPages = Math.max(1, Number(pagination.totalPages) || 1);
  const currentPage = Math.min(
    Math.max(1, Number(pagination.page) || 1),
    totalPages,
  );

  setText(
    recordsPageInfo,
    `Seite ${formatNumber(currentPage)} / ${formatNumber(totalPages)} • ${formatNumber(
      pagination.total || 0,
    )} Total`,
  );
  recordsPagePrev.disabled = !pagination.hasPreviousPage || state.loading;
  recordsPageNext.disabled = !pagination.hasNextPage || state.loading;
  setHidden(recordsPagination, totalPages <= 1);
}

function buildDetailRow(label, value) {
  return `
    <div class="admin-unified__detail-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

function formatContentPreview(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string') {
    const raw = value;
    const trimmed = raw.trim();
    if (!trimmed) return '-';
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return raw;
      }
    }
    return raw;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatStatusLabel(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  if (normalized === 'identified') return 'identifiziert';
  if (normalized === 'anonymous') return 'anonym';
  if (normalized === 'conflict') return 'konflikt';
  return normalized || '-';
}

function formatMemoryItemsForPreview(memories = [], limit = 50) {
  return memories.slice(0, limit).map((memory) => ({
    key: String(memory?.key || '').trim() || '-',
    value: String(memory?.value || ''),
    category: String(memory?.category || 'note'),
    zeit: formatDate(memory?.timestamp),
    ablauf: memory?.expiresAt ? formatDate(memory.expiresAt) : null,
  }));
}

function buildSelectionData(entry) {
  if (isFolderEntry(entry)) {
    return {
      type: '',
      summary: '',
      details: [],
      content: null,
    };
  }

  if (isMemoryEntry(entry)) {
    return {
      type: 'Cloudflare Memory',
      summary: `${entry.userName || entry.userId} • ${entry.key || '-'}`,
      details: [
        ['User-ID', entry.userId || '-'],
        ['Name', entry.userName || '-'],
        ['Feld', entry.key || '-'],
        ['Kategorie', entry.category || 'note'],
        ['Zeit', formatDate(entry.timestamp)],
        ['Ablauf', entry.expiresAt ? formatDate(entry.expiresAt) : '-'],
      ],
      content: entry.value,
    };
  }

  if (isMemoryProfileEntry(entry)) {
    const displayName =
      entry.userName && entry.userName !== entry.userId
        ? entry.userName
        : 'Anonym';
    return {
      type: 'Profil Erinnerungen',
      summary: `${displayName} • ${formatNumber(
        entry.memoryCount || 0,
      )} Memories`,
      details: [
        ['Profil', displayName],
        ['User-ID', entry.userId || '-'],
        ['Status', formatStatusLabel(entry.status)],
        ['Erinnerungen', formatNumber(entry.memoryCount || 0)],
        ['Letzte Aktivität', formatDate(entry.latestMemoryAt)],
        ...(entry.hasDuplicateProfiles
          ? [['Zusammengeführt', (entry.userIds || []).join(', ') || '-']]
          : []),
      ],
      content: formatMemoryItemsForPreview(entry.memories || []),
    };
  }

  if (isUserEntry(entry)) {
    const displayName =
      entry.userName && entry.userName !== entry.userId
        ? entry.userName
        : 'Anonym';
    return {
      type: 'User Profil',
      summary: `${displayName} • ${formatNumber(
        entry.memoryCount || 0,
      )} Memories`,
      details: [
        ['Profil', displayName],
        ['User-ID', entry.userId || '-'],
        ['Status', formatStatusLabel(entry.status)],
        ['Memories', formatNumber(entry.memoryCount || 0)],
        ['Letzte Memory', formatDate(entry.latestMemoryAt)],
        ...(entry.hasDuplicateProfiles
          ? [['Zusammengeführt', (entry.userIds || []).join(', ') || '-']]
          : []),
      ],
      content: {
        aliases: entry.aliases || [],
        memoryKeys: entry.memoryKeys || [],
        memories: formatMemoryItemsForPreview(entry.memories || [], 50),
      },
    };
  }

  if (isMappingEntry(entry)) {
    return {
      type: 'Name Mapping',
      summary: `${entry.name || '-'} • ${entry.status || '-'}`,
      details: [
        ['Name', entry.name || '-'],
        ['User-ID (aktuell)', entry.userId || '-'],
        ['Rohwert', entry.rawValue || '-'],
        ['Status', entry.status || '-'],
        ['Update', formatDate(entry.updatedAt)],
      ],
      content: {
        name: entry.name,
        userId: entry.userId,
        rawValue: entry.rawValue,
        status: entry.status,
        updatedAt: entry.updatedAt,
      },
    };
  }

  if (isCommentEntry(entry)) {
    return {
      type: 'Kommentar',
      summary: `${entry.authorName || 'Unbekannt'} • ${entry.postId || '-'}`,
      details: [
        ['Post-ID', entry.postId || '-'],
        ['Autor', entry.authorName || '-'],
        ['Zeit', formatDate(entry.createdAt)],
      ],
      content: entry.content || '-',
    };
  }

  if (isContactEntry(entry)) {
    return {
      type: 'Kontaktanfrage',
      summary: `${entry.subject || '(Ohne Betreff)'} • ${entry.email || '-'}`,
      details: [
        ['Name', entry.name || '-'],
        ['E-Mail', entry.email || '-'],
        ['Betreff', entry.subject || '(Ohne Betreff)'],
        ['Zeit', formatDate(entry.createdAt)],
      ],
      content: entry.message || '-',
    };
  }

  if (isLikeEntry(entry)) {
    return {
      type: 'Projekt-Like',
      summary: `${entry.projectId || '-'} • ${formatNumber(entry.likes || 0)} Likes`,
      details: [
        ['Projekt', entry.projectId || '-'],
        ['Likes', formatNumber(entry.likes || 0)],
      ],
      content: {
        projectId: entry.projectId,
        likes: entry.likes,
      },
    };
  }

  if (isLikeEventEntry(entry)) {
    return {
      type: 'Projekt Like Event',
      summary: `${entry.projectId || '-'} • ${formatDate(entry.createdAt)}`,
      details: [
        ['Event-ID', entry.eventId ? String(entry.eventId) : '-'],
        ['Projekt-ID', entry.projectId || '-'],
        ['IP', entry.sourceIp || '-'],
        ['Request-ID', entry.requestId || '-'],
        ['Zeit', formatDate(entry.createdAt)],
      ],
      content: {
        userAgent: entry.userAgent || '-',
      },
    };
  }

  if (isAuditEntry(entry)) {
    return {
      type: 'Audit-Eintrag',
      summary: `${entry.action || '-'} • ${entry.status || '-'}`,
      details: [
        ['Aktion', entry.action || '-'],
        ['Status', entry.status || '-'],
        ['User-ID', entry.targetUserId || '-'],
        ['Memory Key', entry.memoryKey || '-'],
        ['Actor', entry.actor || '-'],
        ['IP', entry.sourceIp || '-'],
        ['Zeit', formatDate(entry.createdAt)],
      ],
      content: {
        summary: entry.summary || '',
        details: entry.details,
        before: entry.before,
        after: entry.after,
      },
    };
  }

  if (isArchivedEntry(entry)) {
    return {
      type: 'Archiviertes Profil',
      summary: `${entry.displayName || entry.userId || '-'} • ${formatNumber(
        entry.memoryCount || 0,
      )} Memories`,
      details: [
        ['User-ID', entry.userId || '-'],
        ['Name', entry.displayName || '-'],
        ['Gelöscht am', formatDate(entry.deletedAt)],
        ['Restore bis', formatDate(entry.restoreUntil)],
        ['Gelöscht von', entry.deletedBy || '-'],
        ['Grund', entry.deleteReason || '-'],
        ['Memories', formatNumber(entry.memoryCount || 0)],
        ['Aliase', formatNumber(entry.aliasCount || 0)],
      ],
      content: entry.snapshot || {},
    };
  }

  return {
    type: 'Eintrag',
    summary: 'Eintrag ausgewählt',
    details: [['Typ', entry?.kind || 'unknown']],
    content: entry,
  };
}

function renderSelectionPanel() {
  if (!selectedType || !selectedDetails || !selectedContent) return;

  const entry = state.selectedEntry;
  const collapseDetails = !entry || isFolderEntry(entry);
  if (detailsPanel) {
    setHidden(detailsPanel, collapseDetails);
  }
  adminMain?.classList.toggle('is-details-collapsed', collapseDetails);
  adminUnified?.classList.toggle('is-compact-rail', collapseDetails);

  if (!entry) {
    setText(selectedType, '');
    setHidden(selectedType, true);
    if (selectedSummary) {
      setText(selectedSummary, '');
      setHidden(selectedSummary, true);
    }
    selectedDetails.innerHTML = '';
    selectedContent.textContent = '';
    setHidden(selectedDetails, true);
    setHidden(selectedContent, true);
    return;
  }

  if (isFolderEntry(entry)) {
    setText(selectedType, '');
    setHidden(selectedType, true);
    if (selectedSummary) {
      setText(selectedSummary, '');
      setHidden(selectedSummary, true);
    }
    selectedDetails.innerHTML = '';
    selectedContent.textContent = '';
    setHidden(selectedDetails, true);
    setHidden(selectedContent, true);
    return;
  }

  const selection = buildSelectionData(entry);
  setText(selectedType, selection.type);
  setHidden(selectedType, !selection.type);
  if (selectedSummary) {
    setText(selectedSummary, selection.summary);
    setHidden(selectedSummary, !selection.summary);
  }
  const details = Array.isArray(selection.details) ? selection.details : [];
  selectedDetails.innerHTML = details
    .map(([label, value]) => buildDetailRow(label, value))
    .join('');
  setHidden(selectedDetails, details.length === 0);

  const hasContent =
    selection.content !== null &&
    selection.content !== undefined &&
    selection.content !== '';

  selectedContent.textContent = hasContent
    ? formatContentPreview(selection.content)
    : '';
  setHidden(selectedContent, !hasContent);
}

function selectRecord(recordId) {
  if (!recordId) return;
  state.selectedEntryId = recordId;
  state.selectedEntry = findRecordById(recordId);
  renderRecordsList();
  renderSelectionPanel();
}

function ensureSelectionExists() {
  if (!state.selectedEntryId) return;
  if (findRecordById(state.selectedEntryId)) {
    state.selectedEntry = findRecordById(state.selectedEntryId);
    return;
  }

  state.selectedEntryId = '';
  state.selectedEntry = null;
}

function updateHeader(payload = {}) {
  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
  const warningLabel =
    warnings.length > 0 ? `Hinweise: ${warnings.length}` : '';
  const systemStateElement = document.getElementById('system-state');
  setText(systemStateElement, warningLabel);
  setHidden(systemStateElement, !warningLabel);
  setMetric(
    'last-update',
    formatDate(payload.timestamp, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  );
}

function updateUI(payload, users) {
  rebuildRecords(payload, users);
  ensureSelectionExists();
  if (!state.selectedEntry && state.records.length > 0) {
    state.selectedEntryId = state.records[0].id;
    state.selectedEntry = state.records[0];
  }
  updateHeader(payload);
  renderRecordsList();
  renderSelectionPanel();
}

function getPayloadUsers(payload, folderId) {
  if (folderId !== 'memories') return [];
  return Array.isArray(payload?.users) ? payload.users : [];
}

async function fetchData({ silent = false, folderId, page } = {}) {
  if (state.loading) return;
  state.loading = true;
  setBusyState(true);

  const targetFolderId = String(
    (folderId ?? state.activeFolderId) || '',
  ).trim();
  const targetPageRaw = Number((page ?? state.activeFolderPage) || 1);
  const targetPage = Number.isFinite(targetPageRaw)
    ? Math.max(1, Math.floor(targetPageRaw))
    : 1;

  try {
    const payload = await fetchStatsPage({
      folderId: targetFolderId,
      page: targetPage,
    });
    const users = mergeUsers(getPayloadUsers(payload, targetFolderId));

    state.isAuthenticated = true;
    state.activeFolderId = targetFolderId;
    state.activeFolderPage = targetPage;
    hideAuth();
    updateUI(payload, users);

    if (!silent) {
      const warnings = Array.isArray(payload?.warnings) ? payload.warnings : [];
      if (warnings.length > 0) {
        showStatus(
          warnings
            .map((entry) => String(entry?.message || '').trim())
            .filter(Boolean)
            .join(' '),
          'warning',
        );
      }
    }
  } catch (error) {
    if (error?.code === 'unauthorized') {
      state.isAuthenticated = false;
      showAuth(true, 'Sitzung abgelaufen.');
      if (!silent) showStatus(error.message, 'error');
      return;
    }

    if (error?.code === 'rate_limited') {
      if (!silent) showStatus(error.message, 'warning');
      return;
    }

    showStatus(
      error instanceof Error
        ? error.message
        : 'Daten konnten nicht geladen werden.',
      'error',
    );
  } finally {
    state.loading = false;
    setBusyState(false);
  }
}

async function performAction(requestFactory, successMessage) {
  setActionsBusy(true);
  try {
    const result = await requestFactory();
    await fetchData({ silent: true });
    showStatus(result?.text || successMessage, 'success');
    return result;
  } catch (error) {
    if (error?.code === 'unauthorized') {
      state.isAuthenticated = false;
      showAuth(true, 'Sitzung abgelaufen.');
      showStatus(error.message, 'error');
      return null;
    }

    if (error?.code === 'rate_limited') {
      showStatus(error.message, 'warning');
      return null;
    }

    showStatus(
      error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
      'error',
    );
    return null;
  } finally {
    setActionsBusy(false);
  }
}

async function handleDeleteSelectedMemory() {
  const entry = state.selectedEntry;
  if (!entry || !isMemoryEntry(entry)) {
    showStatus('Bitte zuerst einen Memory-Eintrag auswählen.', 'error');
    return;
  }

  if (
    !window.confirm(`Memory "${entry.key}" für ${entry.userId} direkt löschen?`)
  )
    return;

  await performAction(
    () =>
      sendAdminUserAction({
        action: 'delete-memory',
        userId: entry.userId,
        key: entry.key,
        value: entry.value,
      }),
    'Memory direkt gelöscht.',
  );
}

function resolveSelectedUserId(entry) {
  if (isMemoryEntry(entry)) return String(entry.userId || '').trim();
  if (isMemoryProfileEntry(entry) || isUserEntry(entry)) {
    const userIds = Array.isArray(entry.userIds)
      ? entry.userIds.filter(Boolean)
      : [];
    if (userIds.length === 1) return String(userIds[0] || '').trim();
    if (userIds.length > 1) return '';
    return String(entry.userId || '').trim();
  }
  return '';
}

async function handleDeleteSelectedUser() {
  const entry = state.selectedEntry;
  if (
    !entry ||
    (!isMemoryEntry(entry) &&
      !isMemoryProfileEntry(entry) &&
      !isUserEntry(entry))
  ) {
    showStatus(
      'Bitte zuerst einen User- oder Memory-Eintrag auswählen.',
      'error',
    );
    return;
  }

  const userId = resolveSelectedUserId(entry);
  if (!userId) {
    showStatus(
      'Keine eindeutige User-ID. Konflikt zuerst auflösen oder einzelnes Profil wählen.',
      'error',
    );
    return;
  }

  if (
    !window.confirm(
      `User ${userId} direkt löschen? Das erfolgt ohne Archivierung.`,
    )
  ) {
    return;
  }

  await performAction(
    () =>
      sendAdminUserAction({
        action: 'delete-user',
        userId,
        confirmUserId: userId,
        reason: 'Direkt gelöscht aus kompakter Admin-Liste.',
      }),
    'User direkt gelöscht.',
  );
}

async function handleOpenSelectedUser() {
  const entry = state.selectedEntry;
  if (
    !entry ||
    (!isMemoryEntry(entry) &&
      !isMemoryProfileEntry(entry) &&
      !isUserEntry(entry))
  ) {
    showStatus(
      'Bitte zuerst einen User- oder Memory-Eintrag auswählen.',
      'error',
    );
    return;
  }

  const userId = resolveSelectedUserId(entry);
  if (!userId) {
    showStatus(
      'Keine eindeutige User-ID. Konflikt zuerst auflösen oder einzelnes Profil wählen.',
      'error',
    );
    return;
  }

  setActionsBusy(true);
  try {
    const result = await sendAdminUserAction({
      action: 'list-user',
      userId,
    });

    showStatus(
      `${result.userId}: ${formatNumber(result.count || 0)} gespeicherte Memories.`,
      'info',
    );
  } catch (error) {
    if (error?.code === 'unauthorized') {
      state.isAuthenticated = false;
      showAuth(true, 'Sitzung abgelaufen.');
      showStatus(error.message, 'error');
      return;
    }
    showStatus(
      error instanceof Error
        ? error.message
        : 'Profil konnte nicht geladen werden.',
      'error',
    );
  } finally {
    setActionsBusy(false);
  }
}

async function handleAssignSelectedMapping() {
  const entry = state.selectedEntry;
  if (!entry || !isMappingEntry(entry)) {
    showStatus('Bitte zuerst ein Mapping auswählen.', 'error');
    return;
  }

  const alias = String(entry.name || '').trim();
  if (!alias) {
    showStatus('Mapping-Name fehlt.', 'error');
    return;
  }

  const targetUserId = String(
    window.prompt(`User-ID für "${alias}"`, entry.userId || '') || '',
  ).trim();
  if (!targetUserId) return;

  await performAction(
    () =>
      sendAdminUserAction({
        action: 'assign-alias',
        userId: targetUserId,
        alias,
      }),
    `Mapping "${alias}" zu ${targetUserId} zugewiesen.`,
  );
}

async function handleDeleteSelectedMapping() {
  const entry = state.selectedEntry;
  if (!entry || !isMappingEntry(entry)) {
    showStatus('Bitte zuerst ein Mapping auswählen.', 'error');
    return;
  }

  const alias = String(entry.name || '').trim();
  if (!alias) {
    showStatus('Mapping-Name fehlt.', 'error');
    return;
  }

  if (!window.confirm(`Mapping "${alias}" direkt löschen?`)) return;

  await performAction(
    () =>
      sendAdminUserAction({
        action: 'remove-alias',
        alias,
        userId: entry.userId || '',
      }),
    `Mapping "${alias}" gelöscht.`,
  );
}

async function handleLogin() {
  const password = passwordInput?.value.trim() || '';
  if (!password) {
    setText(authError, 'Bitte Passwort eingeben.');
    setHidden(authError, false);
    passwordInput?.focus();
    return;
  }

  loginButton.disabled = true;
  try {
    await createAdminSession(password);
    state.isAuthenticated = true;
    if (passwordInput) passwordInput.value = '';
    hideAuth();
    await fetchData();
  } catch (error) {
    if (error?.code === 'rate_limited') {
      const message =
        error instanceof Error
          ? error.message
          : 'Zu viele Login-Versuche. Bitte kurz warten.';
      setText(authError, message);
      setHidden(authError, false);
      showStatus(message, 'warning');
      return;
    }

    setText(
      authError,
      error instanceof Error ? error.message : 'Login fehlgeschlagen.',
    );
    setHidden(authError, false);
  } finally {
    loginButton.disabled = false;
  }
}

async function handleLogout() {
  await deleteAdminSession();
  state.isAuthenticated = false;
  state.selectedEntryId = '';
  state.selectedEntry = null;
  state.activeFolderId = '';
  state.activeFolderPage = 1;
  state.activeFolderPagination = null;
  state.records = [];
  state.memoryRows = [];
  state.userRows = [];
  state.cloudflareFolders = [];
  state.folderRecords = {};
  state.latestPayload = {};

  renderRecordsList();
  renderSelectionPanel();
  showAuth();
}

function selectRecordByButton(button) {
  const recordId = String(button?.dataset?.recordId || '').trim();
  if (!recordId) return null;
  selectRecord(recordId);
  return state.selectedEntry;
}

function handleMainClick(event) {
  const button = event.target.closest('[data-admin-action]');
  if (!button) return;

  const action = String(button.dataset.adminAction || '').trim();

  if (state.actionsBusy && action !== 'select-record' && action !== 'go-root') {
    return;
  }

  if (action === 'select-record') {
    const recordId = String(button.dataset.recordId || '').trim();
    selectRecord(recordId);
    const selected = state.selectedEntry;
    if (!state.activeFolderId && isFolderEntry(selected)) {
      void openFolder(selected.folderId, 1);
    }
    return;
  }

  if (action === 'go-root') {
    goToRootFolders();
    return;
  }

  if (action === 'open-memory-user') {
    const entry = selectRecordByButton(button);
    if (isMemoryEntry(entry)) {
      handleOpenSelectedUser();
    }
    return;
  }

  if (action === 'delete-memory-inline') {
    const entry = selectRecordByButton(button);
    if (isMemoryEntry(entry)) {
      handleDeleteSelectedMemory();
    }
    return;
  }

  if (action === 'open-memory-profile-user') {
    const entry = selectRecordByButton(button);
    if (isMemoryProfileEntry(entry)) {
      handleOpenSelectedUser();
    }
    return;
  }

  if (action === 'delete-memory-profile-user') {
    const entry = selectRecordByButton(button);
    if (isMemoryProfileEntry(entry)) {
      handleDeleteSelectedUser();
    }
    return;
  }

  if (action === 'open-user-inline') {
    const entry = selectRecordByButton(button);
    if (isUserEntry(entry)) {
      handleOpenSelectedUser();
    }
    return;
  }

  if (action === 'delete-user-inline') {
    const entry = selectRecordByButton(button);
    if (isUserEntry(entry)) {
      handleDeleteSelectedUser();
    }
    return;
  }

  if (action === 'records-page-prev' || action === 'records-page-next') {
    if (!state.activeFolderId || !state.activeFolderPagination) return;
    const currentPage = Number(state.activeFolderPagination.page) || 1;
    const targetPage =
      action === 'records-page-prev' ? currentPage - 1 : currentPage + 1;
    if (targetPage < 1) return;
    void fetchData({
      silent: true,
      folderId: state.activeFolderId,
      page: targetPage,
    });
    return;
  }

  if (action === 'assign-mapping-inline') {
    const entry = selectRecordByButton(button);
    if (isMappingEntry(entry)) {
      handleAssignSelectedMapping();
    }
    return;
  }

  if (action === 'delete-mapping-inline') {
    const entry = selectRecordByButton(button);
    if (isMappingEntry(entry)) {
      handleDeleteSelectedMapping();
    }
  }
}

function registerEventListeners() {
  loginButton?.addEventListener('click', handleLogin);
  logoutButton?.addEventListener('click', handleLogout);

  adminMain?.addEventListener('click', handleMainClick);

  passwordInput?.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') handleLogin();
  });

  document.addEventListener('keydown', (event) => {
    const tag = (event.target?.tagName || '').toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (event.key === 'r' && !isInput && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      if (state.isAuthenticated) fetchData({ silent: true });
    }
  });
}

async function initializeAdmin() {
  renderRecordsList();
  renderSelectionPanel();

  let authenticated = false;
  try {
    authenticated = await checkAdminSession();
  } catch (error) {
    if (error?.code === 'rate_limited') {
      showAuth(true, error.message);
      showStatus(error.message, 'warning');
      return;
    }
  }

  if (!authenticated) {
    showAuth();
    return;
  }

  state.isAuthenticated = true;
  hideAuth();
  await fetchData({ silent: true });
}

registerEventListeners();
initializeAdmin();
