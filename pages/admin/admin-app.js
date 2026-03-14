/**
 * Admin dashboard client module.
 * Extracted from pages/admin.html to keep markup and behavior separate.
 */

const API_URL = '/api/admin/stats';
const USERS_API_URL = '/api/admin/users';
const SESSION_API_URL = '/api/admin/session';
const REFRESH_LABEL = 'Neu laden';
const DEFAULT_PAGE_SIZES = {
  likes: 8,
  comments: 10,
  contacts: 10,
  users: 10,
  mappings: 10,
  audit: 12,
  archived: 10,
};

const authOverlay = document.getElementById('auth-overlay');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const passwordInput = document.getElementById('admin-password');
const adminMain = document.getElementById('admin-main');
const authError = document.getElementById('auth-error');
const refreshButton = document.getElementById('refresh-button');

const usersGrid = document.getElementById('users-grid');
const archivedGrid = document.getElementById('archived-grid');
const memoriesContainer = document.getElementById('memories-container');
const actionUserIdInput = document.getElementById('action-user-id');
const actionMemoryKeyInput = document.getElementById('action-memory-key');
const actionMemoryValueInput = document.getElementById('action-memory-value');
const actionDeleteReasonInput = document.getElementById('action-delete-reason');
const actionDeleteConfirmInput = document.getElementById(
  'action-delete-confirm',
);
const actionAliasNameInput = document.getElementById('action-alias-name');
const actionMergeSourceInput = document.getElementById(
  'action-merge-source-id',
);
const actionSaveMemoryButton = document.getElementById('action-save-memory');
const actionDeleteMemoryButton = document.getElementById(
  'action-delete-memory',
);
const actionDeleteUserButton = document.getElementById('action-delete-user');
const actionExportUserButton = document.getElementById('action-export-user');
const actionAssignAliasButton = document.getElementById('action-assign-alias');
const actionRemoveAliasButton = document.getElementById('action-remove-alias');
const actionMergeUsersButton = document.getElementById('action-merge-users');
const actionBulkDeleteMemoriesButton = document.getElementById(
  'action-bulk-delete-memories',
);
const actionBulkDeleteUsersButton = document.getElementById(
  'action-bulk-delete-users',
);
const actionBulkRestoreUsersButton = document.getElementById(
  'action-bulk-restore-users',
);
const actionBulkPurgeUsersButton = document.getElementById(
  'action-bulk-purge-users',
);
const actionPurgeExpiredArchivesButton = document.getElementById(
  'action-purge-expired-archives',
);
const bulkSelectionSummary = document.getElementById('bulk-selection-summary');
const actionSelectedUser = document.getElementById('action-selected-user');
const selectedUserPanel = document.getElementById('selected-user-panel');
const noSelectedUser = document.getElementById('no-selected-user');
const optionalPanels = {
  archived: document.getElementById('panel-archived'),
  audit: document.getElementById('panel-audit'),
  comments: document.getElementById('panel-comments'),
  contacts: document.getElementById('panel-contacts'),
  likes: document.getElementById('panel-likes'),
  mappings: document.getElementById('panel-mappings'),
  memories: document.getElementById('panel-memories'),
};
const paginationContainers = {
  likes: document.getElementById('likes-pagination'),
  contacts: document.getElementById('contacts-pagination'),
  comments: document.getElementById('comments-pagination'),
  users: document.getElementById('users-pagination'),
  mappings: document.getElementById('names-pagination'),
  audit: document.getElementById('audit-pagination'),
  archived: document.getElementById('archived-pagination'),
};

// New UI elements
const adminToolbar = document.getElementById('admin-toolbar');
const adminPanelNav = document.getElementById('admin-panel-nav');
const toastContainer = document.getElementById('admin-toast-container');
const searchInput = document.getElementById('admin-search-input');
const searchClear = document.getElementById('admin-search-clear');
const activeSearchLabel = document.getElementById('active-search-label');
const filterUserStatus = document.getElementById('filter-user-status');
const filterMappingStatus = document.getElementById('filter-mapping-status');
const filterAuditAction = document.getElementById('filter-audit-action');
const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
const autoRefreshSpinner = document.getElementById('auto-refresh-spinner');

function createDefaultPagination() {
  return Object.fromEntries(
    Object.entries(DEFAULT_PAGE_SIZES).map(([key, pageSize]) => [
      key,
      { page: 1, pageSize },
    ]),
  );
}

const state = {
  pagination: createDefaultPagination(),
  selectedUserId: '',
  selectedUserProfile: null,
  selectedUserLoading: false,
  selectedUserError: '',
  selectedUserIds: new Set(),
  selectedArchivedUserIds: new Set(),
  selectedMemoryEntries: new Set(),
  lastPayload: null,
  isAuthenticated: false,
  searchQuery: '',
  filters: {
    userStatus: 'all',
    mappingStatus: 'all',
    auditAction: 'all',
  },
  autoRefreshEnabled: false,
  autoRefreshInterval: null,
};

let currentUsers = [];
let currentArchivedProfiles = [];
let searchDebounceTimer = null;
const SEARCH_DEBOUNCE_MS = 400;
const AUTO_REFRESH_INTERVAL_MS = 30000;

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

function pluralize(count, singular, plural) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

function buildPill(label, tone = 'neutral') {
  const safeTone =
    tone === 'success' || tone === 'warning' || tone === 'error'
      ? tone
      : 'neutral';
  return `<span class="admin-pill" data-tone="${safeTone}">${escapeHtml(label)}</span>`;
}

function createMemorySelectionId(key, value) {
  return `${String(key || '').trim()}::${String(value || '').trim()}`;
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function showStatus(message, tone = 'info') {
  if (!message) return;
  showToast(message, tone);
}

function clearStatus() {
  // Toasts auto-dismiss, no-op here
}

// ─── Toast Notification System ───
let toastIdCounter = 0;

function showToast(message, tone = 'info', durationMs = 5000) {
  if (!toastContainer || !message) return;

  const toastId = ++toastIdCounter;
  const iconMap = {
    success: `<svg class="admin-toast__icon admin-toast__icon--success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg class="admin-toast__icon admin-toast__icon--error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg class="admin-toast__icon admin-toast__icon--warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg class="admin-toast__icon admin-toast__icon--info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = 'admin-toast';
  toast.dataset.tone = tone;
  toast.dataset.toastId = toastId;
  toast.innerHTML = `
    ${iconMap[tone] || iconMap.info}
    <div class="admin-toast__body">
      <p class="admin-toast__message">${escapeHtml(message)}</p>
    </div>
    <button class="admin-toast__dismiss" type="button" aria-label="Schließen">✕</button>
    <span class="admin-toast__progress"></span>
  `;

  toast.querySelector('.admin-toast__dismiss').addEventListener('click', () => {
    dismissToast(toast);
  });

  toastContainer.appendChild(toast);

  // Limit to 4 visible toasts
  const toasts = toastContainer.querySelectorAll('.admin-toast');
  if (toasts.length > 4) {
    dismissToast(toasts[0]);
  }

  if (durationMs > 0) {
    setTimeout(() => dismissToast(toast), durationMs);
  }

  return toastId;
}

function dismissToast(toast) {
  if (!toast || toast.classList.contains('is-dismissing')) return;
  toast.classList.add('is-dismissing');
  toast.addEventListener('animationend', () => toast.remove(), {
    once: true,
  });
}

function showAuthError(message) {
  setText(authError, message || 'Falsches Passwort!');
  setHidden(authError, !message);
}

function formatWarnings(warnings) {
  return warnings
    .map((warning) => warning && warning.message)
    .filter(Boolean)
    .join(' ');
}

function buildSystemSummary(summary = {}, health = {}) {
  return [
    pluralize(summary.filteredUsers || 0, 'Profil', 'Profile'),
    pluralize(summary.filteredMemoryCount || 0, 'Memory', 'Memories'),
    pluralize(summary.totalContacts || 0, 'Kontakt', 'Kontakte'),
    pluralize(summary.totalComments || 0, 'Kommentar', 'Kommentare'),
    pluralize(summary.totalArchivedProfiles || 0, 'Archiv', 'Archive'),
    health.auditAvailable ? 'Audit aktiv' : 'Audit fehlt',
  ].join(' • ');
}

function syncPaginationFromPayload(pagination = {}) {
  Object.keys(DEFAULT_PAGE_SIZES).forEach((key) => {
    if (!pagination[key]) return;
    state.pagination[key] = {
      page: Number(pagination[key].page) || 1,
      pageSize: Number(pagination[key].pageSize) || DEFAULT_PAGE_SIZES[key],
    };
  });
}

function buildQueryString() {
  const params = new URLSearchParams();

  Object.entries(state.pagination).forEach(([key, value]) => {
    params.set(`${key}Page`, String(value.page));
    params.set(`${key}PageSize`, String(value.pageSize));
  });

  // Add search/filter params
  if (state.searchQuery) {
    params.set('q', state.searchQuery);
  }
  if (state.filters.userStatus !== 'all') {
    params.set('userStatus', state.filters.userStatus);
  }
  if (state.filters.mappingStatus !== 'all') {
    params.set('mappingStatus', state.filters.mappingStatus);
  }
  if (state.filters.auditAction !== 'all') {
    params.set('auditAction', state.filters.auditAction);
  }

  return params.toString();
}

function syncUrlState() {
  const params = new URLSearchParams(buildQueryString());
  if (state.selectedUserId) {
    params.set('selectedUser', state.selectedUserId);
  }

  const nextUrl = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  window.history.replaceState(null, '', nextUrl);
}

function restoreStateFromUrl() {
  const url = new URL(window.location.href);
  state.pagination = createDefaultPagination();
  Object.keys(DEFAULT_PAGE_SIZES).forEach((key) => {
    const page = Number(url.searchParams.get(`${key}Page`)) || 1;
    const pageSize =
      Number(url.searchParams.get(`${key}PageSize`)) || DEFAULT_PAGE_SIZES[key];
    state.pagination[key] = {
      page: Math.max(1, page),
      pageSize: Math.max(1, pageSize),
    };
  });
  state.selectedUserId = String(
    url.searchParams.get('selectedUser') || '',
  ).trim();

  // Restore search & filters
  state.searchQuery = String(url.searchParams.get('q') || '').trim();
  state.filters.userStatus = String(url.searchParams.get('userStatus') || 'all')
    .trim()
    .toLowerCase();
  state.filters.mappingStatus = String(
    url.searchParams.get('mappingStatus') || 'all',
  )
    .trim()
    .toLowerCase();
  state.filters.auditAction = String(
    url.searchParams.get('auditAction') || 'all',
  )
    .trim()
    .toLowerCase();

  // Sync inputs
  if (searchInput) searchInput.value = state.searchQuery;
  if (searchClear) setHidden(searchClear, !state.searchQuery);
  if (filterUserStatus) filterUserStatus.value = state.filters.userStatus;
  if (filterMappingStatus)
    filterMappingStatus.value = state.filters.mappingStatus;
  if (filterAuditAction) filterAuditAction.value = state.filters.auditAction;

  updateActiveSearchLabel();
}

function updateActiveSearchLabel() {
  if (!activeSearchLabel) return;
  const parts = [];
  if (state.searchQuery) parts.push(`"${state.searchQuery}"`);
  if (state.filters.userStatus !== 'all')
    parts.push(`Status: ${state.filters.userStatus}`);
  if (state.filters.mappingStatus !== 'all')
    parts.push(`Mapping: ${state.filters.mappingStatus}`);
  if (state.filters.auditAction !== 'all')
    parts.push(`Audit: ${state.filters.auditAction}`);

  if (parts.length > 0) {
    setText(activeSearchLabel, `Filter aktiv: ${parts.join(' • ')}`);
    setHidden(activeSearchLabel, false);
  } else {
    setHidden(activeSearchLabel, true);
  }
}

function setBusyState(isBusy) {
  if (refreshButton) {
    refreshButton.disabled = isBusy;
    refreshButton.textContent = isBusy ? 'Lädt…' : REFRESH_LABEL;
  }
  if (logoutButton) logoutButton.disabled = isBusy;
}

function setActionsBusy(isBusy) {
  [
    actionSaveMemoryButton,
    actionDeleteMemoryButton,
    actionDeleteUserButton,
    actionExportUserButton,
    actionAssignAliasButton,
    actionRemoveAliasButton,
    actionMergeUsersButton,
    actionBulkDeleteMemoriesButton,
    actionBulkDeleteUsersButton,
    actionBulkRestoreUsersButton,
    actionBulkPurgeUsersButton,
    actionPurgeExpiredArchivesButton,
  ].forEach((button) => {
    if (!button) return;
    button.disabled = isBusy;
  });
}

function updateSelectionSummary() {
  const selectedUsers = state.selectedUserIds.size;
  const selectedArchived = state.selectedArchivedUserIds.size;
  const selectedMemories = state.selectedMemoryEntries.size;
  const parts = [];

  if (selectedUsers > 0) {
    parts.push(pluralize(selectedUsers, 'aktives Profil', 'aktive Profile'));
  }
  if (selectedArchived > 0) {
    parts.push(pluralize(selectedArchived, 'Archivprofil', 'Archivprofile'));
  }
  if (selectedMemories > 0) {
    parts.push(pluralize(selectedMemories, 'Memory', 'Memories'));
  }

  setText(
    bulkSelectionSummary,
    parts.length > 0
      ? `Ausgewählt: ${parts.join(' • ')}`
      : 'Keine Auswahl aktiv.',
  );
  setMetric(
    'actions-count-label',
    parts.length > 0
      ? `${selectedUsers + selectedArchived + selectedMemories} gewählt`
      : 'Live',
  );

  if (actionBulkDeleteUsersButton) {
    actionBulkDeleteUsersButton.disabled = selectedUsers === 0;
  }
  if (actionBulkRestoreUsersButton) {
    actionBulkRestoreUsersButton.disabled = selectedArchived === 0;
  }
  if (actionBulkPurgeUsersButton) {
    actionBulkPurgeUsersButton.disabled = selectedArchived === 0;
  }
  if (actionBulkDeleteMemoriesButton) {
    actionBulkDeleteMemoriesButton.disabled =
      selectedMemories === 0 || !state.selectedUserId;
  }
  if (actionMergeUsersButton) {
    actionMergeUsersButton.disabled =
      !(actionUserIdInput?.value.trim() || state.selectedUserId) ||
      !String(actionMergeSourceInput?.value || '').trim();
  }
  if (actionAssignAliasButton) {
    actionAssignAliasButton.disabled =
      !(actionUserIdInput?.value.trim() || state.selectedUserId) ||
      !String(actionAliasNameInput?.value || '').trim();
  }
  if (actionRemoveAliasButton) {
    actionRemoveAliasButton.disabled = !String(
      actionAliasNameInput?.value || '',
    ).trim();
  }
}

function getUserLabel(userId) {
  const selected =
    state.selectedUserProfile && state.selectedUserProfile.userId === userId
      ? state.selectedUserProfile
      : currentUsers.find((item) => item.userId === userId);
  const name = selected?.profile?.name || selected?.name || '';
  return name ? `${name} (${userId})` : userId;
}

function fillActionForm(userId = '', key = '', value = '') {
  if (actionUserIdInput) actionUserIdInput.value = userId;
  if (actionMemoryKeyInput) actionMemoryKeyInput.value = key;
  if (actionMemoryValueInput) actionMemoryValueInput.value = value;
  if (actionDeleteConfirmInput) actionDeleteConfirmInput.value = '';

  setText(
    actionSelectedUser,
    userId ? `Ausgewählt: ${getUserLabel(userId)}` : 'Kein Profil ausgewählt.',
  );
  updateSelectionSummary();
}

function requireAliasName() {
  const alias = actionAliasNameInput?.value.trim() || '';
  if (!alias) {
    showStatus('Bitte einen Alias oder Mapping-Namen eingeben.', 'error');
    actionAliasNameInput?.focus();
    return '';
  }
  return alias;
}

function requireMergeSourceUserId() {
  const sourceUserId = actionMergeSourceInput?.value.trim() || '';
  if (!sourceUserId) {
    showStatus('Bitte eine Quell-User-ID für den Merge eingeben.', 'error');
    actionMergeSourceInput?.focus();
    return '';
  }
  return sourceUserId;
}

function requireActionUserId() {
  const userId = actionUserIdInput?.value.trim() || '';
  if (!userId) {
    showStatus('Bitte zuerst eine User-ID auswählen oder eingeben.', 'error');
    actionUserIdInput?.focus();
    return '';
  }
  return userId;
}

function getActionReason() {
  return actionDeleteReasonInput?.value.trim() || '';
}

function getFallbackSelectedUserProfile() {
  if (!state.selectedUserId) return null;
  const user =
    currentUsers.find((item) => item.userId === state.selectedUserId) ||
    state.lastPayload?.users?.find(
      (item) => item.userId === state.selectedUserId,
    );
  if (!user) return null;

  return {
    userId: user.userId,
    memories: Array.isArray(user.memories) ? user.memories : [],
    count: Number(user.memoryCount) || 0,
    aliases: Array.isArray(user.aliases) ? user.aliases : [],
    profile: {
      userId: user.userId,
      name: user.name || '',
      status: user.status || (user.name ? 'identified' : 'anonymous'),
      label: user.name ? `Profil: ${user.name}` : 'Profil: ohne Namen',
    },
  };
}

function groupMemoriesByCategory(memories = []) {
  const groups = new Map();
  memories.forEach((memory) => {
    const category = memory?.category || 'note';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(memory);
  });

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'de', { sensitivity: 'base' }))
    .map(([category, items]) => ({
      category,
      items,
    }));
}

function renderPagination(section, pagination) {
  const container = paginationContainers[section];
  if (!container) return;

  if (!pagination) {
    container.innerHTML = '';
    setHidden(container, true);
    return;
  }

  container.innerHTML = `
    <div class="admin-pagination__info">
      Seite ${formatNumber(pagination.page)} von ${formatNumber(
        pagination.totalPages,
      )} • ${pluralize(pagination.total, 'Eintrag', 'Einträge')}
    </div>
    <div class="admin-pagination__actions">
      <button
        type="button"
        class="admin-secondary-button admin-secondary-button--compact"
        data-page-target="${section}"
        data-page="${Math.max(1, pagination.page - 1)}"
        ${pagination.hasPreviousPage ? '' : 'disabled'}
      >
        Zurück
      </button>
      <button
        type="button"
        class="admin-secondary-button admin-secondary-button--compact"
        data-page-target="${section}"
        data-page="${Math.min(pagination.totalPages, pagination.page + 1)}"
        ${pagination.hasNextPage ? '' : 'disabled'}
      >
        Weiter
      </button>
    </div>
  `;
  setHidden(container, pagination.total <= 0);
}

function renderSelectedUserPanel() {
  const profile = state.selectedUserProfile || getFallbackSelectedUserProfile();
  setText(
    document.getElementById('selected-user-state'),
    state.selectedUserId ? 'Aktiv' : 'Kein Profil',
  );

  if (!state.selectedUserId) {
    selectedUserPanel.innerHTML = '';
    setHidden(noSelectedUser, false);
    setText(
      noSelectedUser,
      'Wähle ein Profil aus, um alle gespeicherten Details Schritt für Schritt anzuzeigen.',
    );
    updateSelectionSummary();
    return;
  }

  if (!profile && state.selectedUserLoading) {
    setHidden(noSelectedUser, true);
    selectedUserPanel.innerHTML = `
      <div class="admin-detail-loading">
        Lade vollständiges Profil für ${escapeHtml(state.selectedUserId)} …
      </div>
    `;
    updateSelectionSummary();
    return;
  }

  if (!profile) {
    selectedUserPanel.innerHTML = '';
    setHidden(noSelectedUser, false);
    setText(
      noSelectedUser,
      state.selectedUserError ||
        'Für diese User-ID konnten keine gespeicherten Details geladen werden.',
    );
    updateSelectionSummary();
    return;
  }

  const aliases =
    profile.aliases ||
    currentUsers.find((item) => item.userId === profile.userId)?.aliases ||
    [];
  const groupedMemories = groupMemoriesByCategory(profile.memories || []);
  const rawPayload = {
    userId: profile.userId,
    profile: profile.profile,
    count: profile.count,
    aliases,
    memories: profile.memories || [],
    deleted: profile.deleted || null,
  };

  setHidden(noSelectedUser, true);
  selectedUserPanel.innerHTML = `
    <div class="admin-selected-user-shell">
      <div class="admin-selected-user-shell__header">
        <div>
          <div class="admin-memory-group__label">Ausgewähltes Profil</div>
          <div class="admin-memory-group__title">${escapeHtml(
            profile.profile?.name || profile.userId,
          )}</div>
          <div class="admin-memory-group__meta">
            ID: ${escapeHtml(profile.userId)} • Status: ${escapeHtml(
              profile.profile?.status || 'unknown',
            )}
          </div>
        </div>
        <div class="admin-selected-user-shell__summary">
          ${pluralize(profile.count || 0, 'Memory', 'Memories')}
        </div>
      </div>

      <div class="admin-selection-toolbar">
        <span class="admin-selection-toolbar__copy">
          ${pluralize(
            state.selectedMemoryEntries.size,
            'Memory für Bulk-Löschung markiert',
            'Memories für Bulk-Löschung markiert',
          )}
        </span>
        <button
          type="button"
          class="admin-secondary-button admin-secondary-button--compact"
          data-admin-action="clear-memory-selection"
        >
          Auswahl leeren
        </button>
      </div>

      ${
        aliases.length > 0
          ? `<div class="admin-inline-chip-list">${aliases
              .map(
                (alias) => `
                  <div class="admin-inline-chip">
                    ${buildPill(`Alias: ${alias}`)}
                    <button
                      type="button"
                      class="admin-secondary-button admin-secondary-button--compact"
                      data-admin-action="remove-alias"
                      data-alias-name="${escapeHtml(alias)}"
                      data-user-id="${escapeHtml(profile.userId)}"
                    >
                      Entfernen
                    </button>
                  </div>
                `,
              )
              .join('')}</div>`
          : ''
      }

      <div class="admin-detail-grid">
        <article class="admin-detail-card">
          <span class="admin-health-card__label">Profilstatus</span>
          <strong class="admin-health-card__value">${escapeHtml(
            profile.profile?.status === 'identified'
              ? 'Identifiziert'
              : 'Anonym',
          )}</strong>
          <p class="admin-health-card__meta">${escapeHtml(
            profile.profile?.label || 'Kein Label vorhanden',
          )}</p>
        </article>

        <article class="admin-detail-card">
          <span class="admin-health-card__label">Letzte Schritte</span>
          <strong class="admin-health-card__value">${escapeHtml(
            state.selectedUserLoading ? 'Synchronisiert…' : 'Live',
          )}</strong>
          <p class="admin-health-card__meta">
            Vollständige Detailansicht inklusive gruppierter Memories, Bulk-Auswahl und Rohdaten.
          </p>
        </article>
      </div>

      <div class="admin-category-grid">
        ${groupedMemories
          .map(
            (group) => `
              <section class="admin-category-card">
                <div class="admin-category-card__header">
                  <span class="admin-memory-group__label">${escapeHtml(
                    group.category,
                  )}</span>
                  <span class="admin-section__count">${formatNumber(
                    group.items.length,
                  )}</span>
                </div>
                <div class="admin-category-card__list">
                  ${group.items
                    .map((memory) => {
                      const memoryId = createMemorySelectionId(
                        memory.key,
                        memory.value,
                      );
                      return `
                        <article class="comment-item comment-item--memory">
                          <div class="comment-meta">
                            <label class="admin-selection-row">
                              <input
                                type="checkbox"
                                class="admin-selection-checkbox"
                                data-selection-type="memory"
                                data-memory-key="${escapeHtml(memory.key)}"
                                data-memory-value="${escapeHtml(memory.value)}"
                                ${
                                  state.selectedMemoryEntries.has(memoryId)
                                    ? 'checked'
                                    : ''
                                }
                              />
                              <span class="comment-author comment-author--memory">${escapeHtml(
                                memory.key,
                              )}</span>
                            </label>
                            <span class="comment-date">${formatDate(
                              memory.timestamp,
                            )}</span>
                          </div>
                          <div class="admin-pill-row">
                            ${buildPill(
                              `Prio: ${formatNumber(memory.priority)}`,
                            )}
                            ${
                              memory.expiresAt
                                ? buildPill(
                                    `Ablauf: ${formatDate(memory.expiresAt, {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })}`,
                                    'warning',
                                  )
                                : ''
                            }
                          </div>
                          <p class="comment-content comment-content--memory">${escapeHtml(
                            memory.value,
                          )}</p>
                        </article>
                      `;
                    })
                    .join('')}
                </div>
              </section>
            `,
          )
          .join('')}
      </div>

      <div class="admin-json-block">
        <div class="admin-json-block__header">Rohdaten</div>
        <pre class="admin-json-preview">${escapeHtml(
          JSON.stringify(rawPayload, null, 2),
        )}</pre>
      </div>
    </div>
  `;
  updateSelectionSummary();
}

function renderHealthFindings(findings = []) {
  const container = document.getElementById('health-findings');
  if (!container) return;

  if (!Array.isArray(findings) || findings.length === 0) {
    container.innerHTML = '';
    setHidden(container, true);
    return;
  }

  container.innerHTML = findings
    .map(
      (entry) => `
        <article class="admin-health-finding" data-tone="${escapeHtml(
          entry.tone || 'neutral',
        )}">
          <div class="admin-health-finding__head">
            <strong>${escapeHtml(entry.title || 'Hinweis')}</strong>
            ${buildPill(
              entry.count
                ? `${formatNumber(entry.count)} offen`
                : entry.tone === 'success'
                  ? 'OK'
                  : 'Prüfen',
              entry.tone || 'neutral',
            )}
          </div>
          <p class="admin-health-finding__detail">${escapeHtml(
            entry.detail || '',
          )}</p>
        </article>
      `,
    )
    .join('');
  setHidden(container, false);
}

function renderHealth(health = {}, summary = {}) {
  setText(
    document.getElementById('health-users-primary'),
    formatNumber(summary.filteredUsers || 0),
  );
  setText(
    document.getElementById('health-users-secondary'),
    `${pluralize(health.identifiedUsers || 0, 'identifiziert', 'identifiziert')} • ${pluralize(
      health.anonymousUsers || 0,
      'anonym',
      'anonym',
    )}`,
  );
  setText(
    document.getElementById('health-mappings-primary'),
    formatNumber(
      (health.linkedMappings || 0) +
        (health.conflictMappings || 0) +
        (health.orphanMappings || 0),
    ),
  );
  setText(
    document.getElementById('health-mappings-secondary'),
    `${pluralize(health.linkedMappings || 0, 'linked', 'linked')} • ${pluralize(
      health.conflictMappings || 0,
      'Konflikt',
      'Konflikte',
    )} • ${pluralize(health.orphanMappings || 0, 'orphan', 'orphan')}`,
  );
  setText(
    document.getElementById('health-memory-primary'),
    formatNumber(health.totalMemories || 0),
  );
  setText(
    document.getElementById('health-memory-secondary'),
    `${pluralize(
      health.expiringSoon || 0,
      'bald ablaufend',
      'bald ablaufend',
    )} • ${pluralize(health.deletedProfiles || 0, 'archiviert', 'archiviert')}`,
  );
  setText(
    document.getElementById('health-storage-primary'),
    health.kvAvailable ? 'Online' : 'Fehlt',
  );
  setText(
    document.getElementById('health-storage-secondary'),
    [
      health.kvAvailable ? 'KV' : 'KV fehlt',
      health.vectorizeConfigured ? 'Vectorize' : 'ohne Vectorize',
      health.aiConfigured ? 'AI' : 'ohne AI',
      health.auditAvailable ? 'Audit aktiv' : 'Audit fehlt',
    ].join(' • '),
  );
  renderHealthFindings(health.findings || []);
}

function renderLikes(likes = [], pagination = {}) {
  const likesBody = document.getElementById('likes-table-body');
  const likesTable = likesBody.closest('table');
  const noLikes = document.getElementById('no-likes');

  if (likes.length > 0) {
    setHidden(likesTable, false);
    setHidden(noLikes, true);
    likesBody.innerHTML = likes
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.project_id)}</td>
            <td>${escapeHtml(formatNumber(item.likes))}</td>
          </tr>
        `,
      )
      .join('');
  } else {
    likesBody.innerHTML = '';
    setHidden(likesTable, true);
    setHidden(noLikes, false);
  }

  renderPagination('likes', pagination);
}

function renderContacts(contacts = [], pagination = {}) {
  const contactsList = document.getElementById('contacts-list');
  const noContacts = document.getElementById('no-contacts');

  if (contacts.length > 0) {
    setHidden(noContacts, true);
    contactsList.innerHTML = contacts
      .map(
        (entry) => `
          <article class="comment-item comment-item--primary">
            <div class="comment-meta">
              <span class="comment-author">${escapeHtml(entry.name)} (${escapeHtml(
                entry.email,
              )})</span>
              <span class="comment-date">${formatDate(entry.created_at)}</span>
            </div>
            <div class="admin-accent-title">${escapeHtml(
              entry.subject || '(Ohne Betreff)',
            )}</div>
            <p class="comment-content">${escapeHtml(entry.message)}</p>
          </article>
        `,
      )
      .join('');
  } else {
    contactsList.innerHTML = '';
    setHidden(noContacts, false);
  }

  renderPagination('contacts', pagination);
}

function renderComments(comments = [], pagination = {}) {
  const commentsList = document.getElementById('comments-list');
  const noComments = document.getElementById('no-comments');

  if (comments.length > 0) {
    setHidden(noComments, true);
    commentsList.innerHTML = comments
      .map(
        (comment) => `
          <article class="comment-item">
            <div class="comment-meta">
              <span class="comment-author">${escapeHtml(
                comment.author_name,
              )}</span>
              <span class="comment-date">${formatDate(comment.created_at)}</span>
            </div>
            <p class="comment-content">${escapeHtml(comment.content)}</p>
            <span class="comment-post">Post: ${escapeHtml(
              comment.post_id,
            )}</span>
          </article>
        `,
      )
      .join('');
  } else {
    commentsList.innerHTML = '';
    setHidden(noComments, false);
  }

  renderPagination('comments', pagination);
}

function renderUsers(users = [], pagination = {}) {
  const noUsers = document.getElementById('no-users');

  if (users.length > 0) {
    setHidden(noUsers, true);
    usersGrid.innerHTML = users
      .map(
        (user) => `
          <article class="admin-user-card ${
            user.userId === state.selectedUserId ? 'is-selected' : ''
          } ${state.selectedUserIds.has(user.userId) ? 'is-bulk-selected' : ''}">
            <div class="admin-user-card__head">
              <label class="admin-selection-row">
                <input
                  type="checkbox"
                  class="admin-selection-checkbox"
                  data-selection-type="user"
                  data-user-id="${escapeHtml(user.userId || '')}"
                  ${state.selectedUserIds.has(user.userId) ? 'checked' : ''}
                />
                <span class="stat-label">User ID</span>
              </label>
              ${buildPill(
                user.name ? 'Identifiziert' : 'Anonym',
                user.name ? 'success' : 'neutral',
              )}
            </div>
            <div class="admin-user-card__id">${escapeHtml(
              user.userId || '-',
            )}</div>
            <div class="admin-user-card__name">${escapeHtml(
              user.name || 'Ohne gespeicherten Namen',
            )}</div>
            <p class="admin-user-card__meta">
              ${pluralize(
                Number(user.memoryCount) || 0,
                'Memory-Eintrag',
                'Memory-Einträge',
              )}${
                user.latestMemoryAt
                  ? ` • Letzte Speicherung ${formatDate(user.latestMemoryAt)}`
                  : ''
              }
            </p>
            ${
              Array.isArray(user.aliases) && user.aliases.length > 0
                ? `<div class="admin-pill-row">${user.aliases
                    .map((alias) => buildPill(`Alias: ${alias}`))
                    .join('')}</div>`
                : ''
            }
            ${
              Array.isArray(user.memoryKeys) && user.memoryKeys.length > 0
                ? `<div class="admin-user-card__keys">Keys: ${escapeHtml(
                    user.memoryKeys.join(', '),
                  )}</div>`
                : `<div class="admin-user-card__keys">Noch keine gespeicherten Keys.</div>`
            }
            <div class="admin-card-actions">
              <button
                type="button"
                class="admin-secondary-button"
                data-admin-action="select-user"
                data-user-id="${escapeHtml(user.userId || '')}"
                data-user-name="${escapeHtml(user.name || '')}"
              >
                Auswählen
              </button>
              <button
                type="button"
                class="admin-danger-button admin-danger-button--inline"
                data-admin-action="delete-user"
                data-user-id="${escapeHtml(user.userId || '')}"
                data-user-name="${escapeHtml(user.name || '')}"
              >
                Profil archivieren
              </button>
            </div>
          </article>
        `,
      )
      .join('');
  } else {
    usersGrid.innerHTML = '';
    setHidden(noUsers, false);
  }

  renderPagination('users', pagination);
}

function renderArchivedProfiles(archivedProfiles = [], pagination = {}) {
  const noArchived = document.getElementById('no-archived');

  if (archivedProfiles.length > 0) {
    setHidden(noArchived, true);
    archivedGrid.innerHTML = archivedProfiles
      .map(
        (profile) => `
          <article class="admin-user-card ${
            state.selectedArchivedUserIds.has(profile.userId)
              ? 'is-bulk-selected'
              : ''
          }">
            <div class="admin-user-card__head">
              <label class="admin-selection-row">
                <input
                  type="checkbox"
                  class="admin-selection-checkbox"
                  data-selection-type="archived-user"
                  data-user-id="${escapeHtml(profile.userId || '')}"
                  ${
                    state.selectedArchivedUserIds.has(profile.userId)
                      ? 'checked'
                      : ''
                  }
                />
                <span class="stat-label">Archiv</span>
              </label>
              ${buildPill('Soft Delete', 'warning')}
            </div>
            <div class="admin-user-card__id">${escapeHtml(
              profile.userId || '-',
            )}</div>
            <div class="admin-user-card__name">${escapeHtml(
              profile.displayName || 'Ohne Namen archiviert',
            )}</div>
            <p class="admin-user-card__meta">
              ${pluralize(
                Number(profile.memoryCount) || 0,
                'Memory',
                'Memories',
              )} • Gelöscht ${formatDate(profile.deletedAt)}
            </p>
            <div class="admin-pill-row">
              ${buildPill(`Wiederherstellen bis ${formatDate(profile.restoreUntil)}`)}
              ${
                profile.deleteReason
                  ? buildPill(`Grund: ${profile.deleteReason}`)
                  : ''
              }
            </div>
            <div class="admin-card-actions">
              <button
                type="button"
                class="admin-secondary-button"
                data-admin-action="restore-user"
                data-user-id="${escapeHtml(profile.userId || '')}"
              >
                Wiederherstellen
              </button>
              <button
                type="button"
                class="admin-danger-button admin-danger-button--inline"
                data-admin-action="purge-user"
                data-user-id="${escapeHtml(profile.userId || '')}"
              >
                Endgültig löschen
              </button>
            </div>
          </article>
        `,
      )
      .join('');
  } else {
    archivedGrid.innerHTML = '';
    setHidden(noArchived, false);
  }

  renderPagination('archived', pagination);
}

function renderNameMappings(nameMappings = [], pagination = {}) {
  const namesGrid = document.getElementById('names-grid');
  const noNames = document.getElementById('no-names');

  if (nameMappings.length > 0) {
    setHidden(noNames, true);
    namesGrid.innerHTML = nameMappings
      .map(
        (mapping) => `
          <article class="admin-name-card">
            <div class="admin-user-card__head">
              <span class="stat-label">Bekannter Name</span>
              ${buildPill(
                mapping.status === 'linked'
                  ? 'Linked'
                  : mapping.status === 'conflict'
                    ? 'Konflikt'
                    : 'Orphan',
                mapping.status === 'linked'
                  ? 'success'
                  : mapping.status === 'conflict'
                    ? 'warning'
                    : 'error',
              )}
            </div>
            <div class="admin-name-card__title">${escapeHtml(
              mapping.name,
            )}</div>
            <div class="admin-name-card__meta">
              ${
                mapping.userId
                  ? `ID: ${escapeHtml(mapping.userId)}`
                  : `Wert: ${escapeHtml(mapping.rawValue || 'leer')}`
              }
            </div>
            <div class="admin-card-actions">
              ${
                mapping.userId
                  ? `<button
                      type="button"
                      class="admin-secondary-button admin-secondary-button--compact"
                      data-admin-action="select-user"
                      data-user-id="${escapeHtml(mapping.userId || '')}"
                    >
                      Profil öffnen
                    </button>`
                  : ''
              }
              <button
                type="button"
                class="admin-secondary-button admin-secondary-button--compact"
                data-admin-action="use-alias"
                data-alias-name="${escapeHtml(mapping.name || '')}"
                data-user-id="${escapeHtml(mapping.userId || '')}"
              >
                Alias ins Formular
              </button>
              <button
                type="button"
                class="admin-secondary-button admin-secondary-button--compact"
                data-admin-action="remove-alias"
                data-alias-name="${escapeHtml(mapping.name || '')}"
                data-user-id="${escapeHtml(mapping.userId || '')}"
              >
                Alias löschen
              </button>
            </div>
          </article>
        `,
      )
      .join('');
  } else {
    namesGrid.innerHTML = '';
    setHidden(noNames, false);
  }

  renderPagination('mappings', pagination);
}

function renderMemories(users = []) {
  const noMemories = document.getElementById('no-memories');
  const usersWithMemories = users.filter(
    (user) => Array.isArray(user.memories) && user.memories.length > 0,
  );

  if (usersWithMemories.length > 0) {
    setHidden(noMemories, true);
    memoriesContainer.innerHTML = usersWithMemories
      .map(
        (user) => `
          <section class="admin-memory-group">
            <div class="admin-memory-group__header">
              <div>
                <div class="admin-memory-group__label">Profil</div>
                <div class="admin-memory-group__title">${escapeHtml(
                  user.name || user.userId,
                )}</div>
                <div class="admin-memory-group__meta">ID: ${escapeHtml(
                  user.userId || '-',
                )}</div>
              </div>
              <div class="admin-memory-group__summary">
                ${pluralize(
                  Number(user.memoryCount) || 0,
                  'Eintrag',
                  'Einträge',
                )}
              </div>
            </div>
            ${
              Array.isArray(user.aliases) && user.aliases.length > 0
                ? `<div class="admin-pill-row">${user.aliases
                    .map((alias) => buildPill(`Alias: ${alias}`))
                    .join('')}</div>`
                : ''
            }
            <div class="admin-memory-list">
              ${user.memories
                .map(
                  (memory) => `
                    <article class="comment-item comment-item--memory">
                      <div class="comment-meta">
                        <span class="comment-author comment-author--memory">${escapeHtml(
                          memory.key,
                        )}</span>
                        <div class="admin-memory-actions">
                          <span class="comment-date">${formatDate(
                            memory.timestamp,
                          )}</span>
                          <button
                            type="button"
                            class="admin-secondary-button admin-secondary-button--compact"
                            data-admin-action="delete-memory"
                            data-user-id="${escapeHtml(user.userId || '')}"
                            data-user-name="${escapeHtml(user.name || '')}"
                            data-memory-key="${escapeHtml(memory.key || '')}"
                            data-memory-value="${escapeHtml(memory.value || '')}"
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                      <div class="admin-pill-row">
                        ${buildPill(`Kategorie: ${memory.category || 'note'}`)}
                        ${buildPill(`Prio: ${formatNumber(memory.priority)}`)}
                        ${
                          memory.expiresAt
                            ? buildPill(
                                `Ablauf: ${formatDate(memory.expiresAt, {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}`,
                                'warning',
                              )
                            : ''
                        }
                      </div>
                      <p class="comment-content comment-content--memory">${escapeHtml(
                        memory.value,
                      )}</p>
                    </article>
                  `,
                )
                .join('')}
            </div>
          </section>
        `,
      )
      .join('');
  } else {
    memoriesContainer.innerHTML = '';
    setHidden(noMemories, false);
  }
}

function updateOptionalPanelVisibility(pagination = {}, summary = {}) {
  const visibleSections = {
    archived: (pagination.archived?.total || 0) > 0,
    audit: (pagination.audit?.total || 0) > 0,
    comments: (pagination.comments?.total || 0) > 0,
    contacts: (pagination.contacts?.total || 0) > 0,
    likes: (pagination.likes?.total || 0) > 0,
    mappings: (pagination.mappings?.total || 0) > 0,
    memories: (summary.filteredMemoryCount || 0) > 0,
  };

  Object.entries(optionalPanels).forEach(([key, panel]) => {
    setHidden(panel, !visibleSections[key]);
  });
}

function renderAuditLogs(auditLogs = [], pagination = {}) {
  const auditList = document.getElementById('audit-list');
  const noAudit = document.getElementById('no-audit');

  if (auditLogs.length > 0) {
    setHidden(noAudit, true);
    auditList.innerHTML = auditLogs
      .map(
        (entry) => `
          <article class="comment-item comment-item--audit">
            <div class="comment-meta">
              <span class="comment-author">${escapeHtml(
                entry.action || 'unknown',
              )}</span>
              <span class="comment-date">${formatDate(entry.createdAt)}</span>
            </div>
            <div class="admin-pill-row">
              ${buildPill(
                entry.status === 'success' ? 'Success' : entry.status,
                entry.status === 'success' ? 'success' : 'warning',
              )}
              ${
                entry.targetUserId
                  ? buildPill(`User: ${entry.targetUserId}`)
                  : ''
              }
              ${entry.memoryKey ? buildPill(`Key: ${entry.memoryKey}`) : ''}
              ${entry.actor ? buildPill(`Actor: ${entry.actor}`) : ''}
              ${entry.sourceIp ? buildPill(`IP: ${entry.sourceIp}`) : ''}
            </div>
            <p class="comment-content">${escapeHtml(
              entry.summary || 'Keine Zusammenfassung.',
            )}</p>
            ${
              entry.details
                ? `<pre class="admin-json-preview admin-json-preview--compact">${escapeHtml(
                    JSON.stringify(entry.details, null, 2),
                  )}</pre>`
                : ''
            }
            ${
              entry.before || entry.after
                ? `<div class="admin-audit-diff">
                    ${
                      entry.before
                        ? `<div class="admin-json-block">
                            <div class="admin-json-block__header">Vorher</div>
                            <pre class="admin-json-preview admin-json-preview--compact">${escapeHtml(
                              JSON.stringify(entry.before, null, 2),
                            )}</pre>
                          </div>`
                        : ''
                    }
                    ${
                      entry.after
                        ? `<div class="admin-json-block">
                            <div class="admin-json-block__header">Nachher</div>
                            <pre class="admin-json-preview admin-json-preview--compact">${escapeHtml(
                              JSON.stringify(entry.after, null, 2),
                            )}</pre>
                          </div>`
                        : ''
                    }
                  </div>`
                : ''
            }
          </article>
        `,
      )
      .join('');
  } else {
    auditList.innerHTML = '';
    setHidden(noAudit, false);
  }

  renderPagination('audit', pagination);
}

function updateUI(data) {
  const likes = Array.isArray(data.likes) ? data.likes : [];
  const comments = Array.isArray(data.comments) ? data.comments : [];
  const contacts = Array.isArray(data.contacts) ? data.contacts : [];
  const users = Array.isArray(data.users) ? data.users : [];
  const aiMemories = Array.isArray(data.aiMemories) ? data.aiMemories : [];
  const archivedProfiles = Array.isArray(data.archivedProfiles)
    ? data.archivedProfiles
    : [];
  const nameMappings = Array.isArray(data.nameMappings)
    ? data.nameMappings
    : [];
  const auditLogs = Array.isArray(data.auditLogs) ? data.auditLogs : [];
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  const pagination = data.pagination || {};
  const summary = data.summary || {};
  const health = data.health || {};

  state.lastPayload = data;
  syncPaginationFromPayload(pagination);
  currentUsers = users;
  currentArchivedProfiles = archivedProfiles;
  syncUrlState();

  const datasetCount =
    (pagination.likes?.total || 0) +
    (pagination.contacts?.total || 0) +
    (pagination.comments?.total || 0) +
    (summary.filteredUsers || 0) +
    (pagination.mappings?.total || 0) +
    (summary.filteredMemoryCount || 0) +
    (pagination.audit?.total || 0) +
    (pagination.archived?.total || 0);
  const topProject = summary.topProjectId
    ? `${summary.topProjectId} (${formatNumber(summary.topProjectLikes)})`
    : '-';
  const systemState = warnings.length > 0 ? 'Mit Hinweisen' : 'Stabil';

  setMetric('total-likes', formatNumber(summary.totalLikes || 0));
  setMetric(
    'likes-dataset-meta',
    pluralize(pagination.likes?.total || 0, 'Projekt', 'Projekte'),
  );
  setMetric('top-project', topProject);
  setMetric(
    'top-project-meta',
    summary.topProjectId
      ? `${pluralize(
          summary.topProjectLikes || 0,
          'Like',
          'Likes',
        )} auf Platz 1`
      : 'Noch keine Reaktionen',
  );
  setMetric(
    'feedback-count',
    formatNumber((summary.totalContacts || 0) + (summary.totalComments || 0)),
  );
  setMetric(
    'feedback-meta',
    `${pluralize(
      summary.totalContacts || 0,
      'Kontaktanfrage',
      'Kontaktanfragen',
    )} • ${pluralize(summary.totalComments || 0, 'Kommentar', 'Kommentare')}`,
  );
  setMetric('known-users-count', formatNumber(summary.filteredUsers || 0));
  setMetric(
    'known-users-meta',
    `${pluralize(
      summary.filteredMemoryCount || 0,
      'Erinnerung',
      'Erinnerungen',
    )} • ${pluralize(
      summary.filteredIdentifiedUsers || 0,
      'identifiziertes Profil',
      'identifizierte Profile',
    )}`,
  );
  setMetric('warning-count', formatNumber(warnings.length));
  setMetric('dataset-count', formatNumber(datasetCount));
  setMetric('hero-top-project', topProject);
  setMetric('system-state', systemState);
  setMetric('hero-system-state', systemState);
  setMetric(
    'hero-system-copy',
    warnings.length > 0
      ? formatWarnings(warnings)
      : buildSystemSummary(summary, health),
  );
  setMetric(
    'last-update',
    formatDate(data.timestamp, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  );

  setMetric('likes-count-label', formatNumber(pagination.likes?.total || 0));
  setMetric(
    'contacts-count-label',
    formatNumber(pagination.contacts?.total || 0),
  );
  setMetric(
    'comments-count-label',
    formatNumber(pagination.comments?.total || 0),
  );
  setMetric('users-count-label', formatNumber(pagination.users?.total || 0));
  setMetric(
    'archived-count-label',
    formatNumber(pagination.archived?.total || 0),
  );
  setMetric('names-count-label', formatNumber(pagination.mappings?.total || 0));
  setMetric('audit-count-label', formatNumber(pagination.audit?.total || 0));
  setMetric(
    'memories-count-label',
    formatNumber(summary.filteredMemoryCount || 0),
  );

  updateOptionalPanelVisibility(pagination, summary);
  renderHealth(health, summary);
  renderLikes(likes, pagination.likes);
  renderContacts(contacts, pagination.contacts);
  renderComments(comments, pagination.comments);
  renderUsers(users, pagination.users);
  renderArchivedProfiles(archivedProfiles, pagination.archived);
  renderNameMappings(nameMappings, pagination.mappings);
  renderMemories(aiMemories);
  renderAuditLogs(auditLogs, pagination.audit);
  renderSelectedUserPanel();
  fillActionForm(
    actionUserIdInput?.value.trim() || state.selectedUserId || '',
    actionMemoryKeyInput?.value.trim() || '',
    actionMemoryValueInput?.value || '',
  );

  setHidden(adminMain, false);
  setHidden(adminToolbar, false);
  setHidden(adminPanelNav, false);
  updateSelectionSummary();
  updatePanelNavBadges(pagination, summary);
  updateActiveSearchLabel();
}

async function checkAdminSession() {
  const response = await fetch(SESSION_API_URL, {
    method: 'GET',
    credentials: 'same-origin',
  });
  const result = await parseJsonResponse(response);
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

  if (response.status === 401) {
    state.isAuthenticated = false;
    passwordInput.value = '';
    showStatus('Sitzung abgelaufen. Bitte erneut einloggen.', 'error');
    showAuth(true, 'Ungültige oder abgelaufene Session.');
    return null;
  }

  if (!response.ok || result?.success === false) {
    throw new Error(
      result?.text || result?.error || 'Admin-Aktion fehlgeschlagen.',
    );
  }

  return result || { success: true };
}

async function loadSelectedUserProfile({ silent = false } = {}) {
  if (!state.selectedUserId) {
    state.selectedUserProfile = null;
    state.selectedUserError = '';
    renderSelectedUserPanel();
    return;
  }

  state.selectedUserLoading = true;
  state.selectedUserError = '';
  renderSelectedUserPanel();

  try {
    const result = await sendAdminUserAction({
      action: 'list-user',
      userId: state.selectedUserId,
    });
    if (!result || state.selectedUserId !== result.userId) return;
    state.selectedUserProfile = result;
    fillActionForm(
      result.userId,
      actionMemoryKeyInput?.value.trim() || '',
      actionMemoryValueInput?.value || '',
    );
    if (!silent) {
      showStatus(result.text || `Profil ${result.userId} geladen.`, 'info');
    }
  } catch (error) {
    state.selectedUserProfile = null;
    state.selectedUserError =
      error instanceof Error
        ? error.message
        : 'Profil konnte nicht geladen werden.';
    if (!silent) showStatus(state.selectedUserError, 'error');
  } finally {
    state.selectedUserLoading = false;
    renderSelectedUserPanel();
  }
}

async function fetchData() {
  setBusyState(true);
  syncUrlState();

  try {
    const queryString = buildQueryString();
    const response = await fetch(
      queryString ? `${API_URL}?${queryString}` : API_URL,
      {
        method: 'GET',
        credentials: 'same-origin',
      },
    );
    const payload = await parseJsonResponse(response);

    if (response.status === 401) {
      state.isAuthenticated = false;
      passwordInput.value = '';
      showStatus('Sitzung abgelaufen. Bitte erneut einloggen.', 'error');
      showAuth(true, 'Ungültige oder abgelaufene Session.');
      return;
    }

    if (!response.ok) {
      throw new Error(
        payload?.details || payload?.error || 'Fehler beim Laden',
      );
    }

    state.isAuthenticated = true;
    updateUI(payload || {});
    hideAuth();

    const warningMessage = formatWarnings(payload?.warnings || []);
    if (warningMessage) {
      showStatus(`Teilweise geladen. ${warningMessage}`, 'warning');
    } else {
      clearStatus();
    }

    if (state.selectedUserId) {
      await loadSelectedUserProfile({ silent: true });
    }
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : 'Daten konnten nicht geladen werden.';
    showStatus(message, 'error');
    if (!authOverlay.classList.contains('hidden')) {
      showAuthError(message);
    }
  } finally {
    setBusyState(false);
  }
}

async function performAdminAction(requestFactory, successFallback) {
  setActionsBusy(true);

  try {
    const result = await requestFactory();
    if (!result) return null;

    if (result.userId && result.userId === state.selectedUserId) {
      state.selectedUserProfile = result;
      state.selectedUserError = '';
    }

    await fetchData();
    showStatus(result.text || successFallback, 'success');
    return result;
  } catch (error) {
    showStatus(
      error instanceof Error ? error.message : 'Admin-Aktion fehlgeschlagen.',
      'error',
    );
    return null;
  } finally {
    setActionsBusy(false);
    updateSelectionSummary();
  }
}

function validateMemoryActionInputs() {
  const userId = requireActionUserId();
  if (!userId) return null;

  const key = actionMemoryKeyInput?.value.trim() || '';
  if (!key) {
    showStatus('Bitte ein Memory-Feld eingeben.', 'error');
    actionMemoryKeyInput?.focus();
    return null;
  }

  const value = actionMemoryValueInput?.value.trim() || '';
  return { userId, key, value };
}

async function handleSaveMemoryAction() {
  const input = validateMemoryActionInputs();
  if (!input) return;
  if (!input.value) {
    showStatus('Bitte einen Memory-Wert eingeben.', 'error');
    actionMemoryValueInput?.focus();
    return;
  }

  await performAdminAction(
    () =>
      sendAdminUserAction({
        action: 'update-memory',
        userId: input.userId,
        key: input.key,
        value: input.value,
      }),
    'Memory gespeichert.',
  );
}

async function handleAssignAliasAction(overrides = {}) {
  const userId = overrides.userId || requireActionUserId();
  if (!userId) return;

  const alias = overrides.alias || requireAliasName();
  if (!alias) return;

  const result = await performAdminAction(
    () =>
      sendAdminUserAction({
        action: 'assign-alias',
        userId,
        alias,
      }),
    'Alias zugewiesen.',
  );

  if (result?.success) {
    fillActionForm(
      userId,
      actionMemoryKeyInput?.value.trim() || '',
      actionMemoryValueInput?.value || '',
    );
    if (!overrides.alias && actionAliasNameInput) {
      actionAliasNameInput.value = alias;
    }
    updateSelectionSummary();
  }
}

async function handleRemoveAliasAction(overrides = {}) {
  const alias = overrides.alias || requireAliasName();
  if (!alias) return;

  const userId =
    overrides.userId ||
    actionUserIdInput?.value.trim() ||
    state.selectedUserId ||
    '';
  if (!window.confirm(`Alias "${alias}" wirklich entfernen?`)) return;

  const result = await performAdminAction(
    () =>
      sendAdminUserAction({
        action: 'remove-alias',
        userId,
        alias,
      }),
    'Alias entfernt.',
  );

  if (result?.success && actionAliasNameInput && !overrides.alias) {
    actionAliasNameInput.value = '';
    updateSelectionSummary();
  }
}

async function handleMergeUsersAction() {
  const targetUserId = requireActionUserId();
  if (!targetUserId) return;

  const sourceUserId = requireMergeSourceUserId();
  if (!sourceUserId) return;

  if (targetUserId === sourceUserId) {
    showStatus('Quell- und Zielprofil müssen unterschiedlich sein.', 'error');
    actionMergeSourceInput?.focus();
    return;
  }

  if (
    !window.confirm(
      `${sourceUserId} wirklich in ${targetUserId} zusammenführen? Das Quellprofil wird danach entfernt.`,
    )
  ) {
    return;
  }

  const result = await performAdminAction(
    () =>
      sendAdminUserAction({
        action: 'merge-users',
        userId: targetUserId,
        sourceUserId,
      }),
    'Profile zusammengeführt.',
  );

  if (result?.success) {
    state.selectedUserIds.delete(sourceUserId);
    state.selectedUserId = targetUserId;
    state.selectedUserProfile = null;
    state.selectedUserError = '';
    state.selectedMemoryEntries.clear();
    if (actionMergeSourceInput) actionMergeSourceInput.value = '';
    fillActionForm(targetUserId, '', '');
    syncUrlState();
    renderSelectedUserPanel();
    loadSelectedUserProfile({ silent: true });
    updateSelectionSummary();
  }
}

async function handlePurgeExpiredArchivesAction() {
  if (
    !window.confirm(
      'Alle abgelaufenen Archivprofile jetzt endgültig bereinigen?',
    )
  ) {
    return;
  }

  const result = await performAdminAction(
    () =>
      sendAdminUserAction({
        action: 'purge-expired-archives',
      }),
    'Abgelaufene Archive bereinigt.',
  );

  if (result?.success) {
    state.selectedArchivedUserIds.forEach((userId) => {
      if (
        currentArchivedProfiles.some((profile) => profile.userId === userId)
      ) {
        state.selectedArchivedUserIds.delete(userId);
      }
    });
    updateSelectionSummary();
  }
}

async function handleDeleteMemoryAction(overrides = {}) {
  const userId = overrides.userId || requireActionUserId();
  if (!userId) return;

  const key = overrides.key || actionMemoryKeyInput?.value.trim() || '';
  if (!key) {
    showStatus('Bitte ein Memory-Feld eingeben.', 'error');
    actionMemoryKeyInput?.focus();
    return;
  }

  const value =
    overrides.value !== undefined
      ? String(overrides.value)
      : actionMemoryValueInput?.value.trim() || '';
  const confirmText = value
    ? `Memory "${key}" für ${userId} wirklich entfernen?`
    : `Singleton-Memory "${key}" für ${userId} wirklich entfernen?`;
  if (!window.confirm(confirmText)) return;

  const result = await performAdminAction(
    () =>
      sendAdminUserAction({
        action: 'delete-memory',
        userId,
        key,
        value,
      }),
    'Memory entfernt.',
  );

  if (result?.success) {
    state.selectedMemoryEntries.delete(createMemorySelectionId(key, value));
    updateSelectionSummary();
  }
}

async function handleBulkDeleteMemoriesAction() {
  const userId = state.selectedUserId || requireActionUserId();
  if (!userId) return;

  const profile = state.selectedUserProfile || getFallbackSelectedUserProfile();
  if (!profile) {
    showStatus('Bitte zuerst ein Profil auswählen.', 'error');
    return;
  }

  const entries = (profile.memories || [])
    .filter((memory) =>
      state.selectedMemoryEntries.has(
        createMemorySelectionId(memory.key, memory.value),
      ),
    )
    .map((memory) => ({
      key: memory.key,
      value: memory.value,
    }));

  if (entries.length === 0) {
    showStatus(
      'Keine markierten Memories für Bulk-Löschung vorhanden.',
      'error',
    );
    return;
  }

  if (
    !window.confirm(
      `${entries.length} Memories für ${userId} wirklich löschen?`,
    )
  ) {
    return;
  }

  const result = await performAdminAction(
    () =>
      sendAdminUserAction({
        action: 'bulk-delete-memories',
        userId,
        entries,
      }),
    'Ausgewählte Memories entfernt.',
  );

  if (result?.success) {
    state.selectedMemoryEntries.clear();
    updateSelectionSummary();
  }
}

async function handleDeleteUserAction(overrides = {}) {
  const userId = overrides.userId || requireActionUserId();
  if (!userId) return;

  if ((actionUserIdInput?.value || '').trim() !== userId) {
    fillActionForm(userId, '', '');
  }

  const confirmUserId = actionDeleteConfirmInput?.value.trim() || '';
  if (confirmUserId !== userId) {
    showStatus(
      'Zum Löschen muss die exakte User-ID in die Bestätigung eingetragen werden.',
      'error',
    );
    actionDeleteConfirmInput?.focus();
    return;
  }

  const userName = overrides.userName || '';
  const confirmText = userName
    ? `Profil "${userName}" (${userId}) wirklich archivieren?`
    : `Profil ${userId} wirklich archivieren?`;
  if (!window.confirm(confirmText)) return;

  const result = await performAdminAction(
    () =>
      sendAdminUserAction({
        action: 'delete-user',
        userId,
        confirmUserId,
        reason: getActionReason(),
      }),
    'Profil archiviert.',
  );

  if (result?.success) {
    state.selectedUserIds.delete(userId);
    if (state.selectedUserId === userId) {
      state.selectedUserId = '';
      state.selectedUserProfile = null;
      state.selectedUserError = '';
      state.selectedMemoryEntries.clear();
      renderSelectedUserPanel();
      syncUrlState();
    }
    fillActionForm('', '', '');
  }
}

async function handleBulkDeleteUsersAction() {
  const userIds = [...state.selectedUserIds];
  if (userIds.length === 0) {
    showStatus('Bitte zuerst aktive Profile auswählen.', 'error');
    return;
  }

  if (
    !window.confirm(`${userIds.length} aktive Profile wirklich archivieren?`)
  ) {
    return;
  }

  const result = await performAdminAction(
    () =>
      sendAdminUserAction({
        action: 'bulk-delete-users',
        userIds,
        reason: getActionReason(),
      }),
    'Ausgewählte Profile archiviert.',
  );

  if (result?.success) {
    const selectedWasDeleted = userIds.includes(state.selectedUserId);
    state.selectedUserIds.clear();
    if (selectedWasDeleted) {
      state.selectedUserId = '';
      state.selectedUserProfile = null;
      state.selectedUserError = '';
      state.selectedMemoryEntries.clear();
      syncUrlState();
      fillActionForm('', '', '');
      renderSelectedUserPanel();
    }
    updateSelectionSummary();
  }
}

async function handleRestoreUserAction(userId) {
  if (!userId) return;
  if (!window.confirm(`Archiviertes Profil ${userId} wiederherstellen?`)) {
    return;
  }

  const result = await performAdminAction(
    () =>
      sendAdminUserAction({
        action: 'restore-user',
        userId,
      }),
    'Archiviertes Profil wiederhergestellt.',
  );

  if (result?.success) {
    state.selectedArchivedUserIds.delete(userId);
    updateSelectionSummary();
  }
}

async function handleBulkRestoreUsersAction() {
  const userIds = [...state.selectedArchivedUserIds];
  if (userIds.length === 0) {
    showStatus('Bitte zuerst archivierte Profile auswählen.', 'error');
    return;
  }

  if (
    !window.confirm(
      `${userIds.length} archivierte Profile wirklich wiederherstellen?`,
    )
  ) {
    return;
  }

  const result = await performAdminAction(
    () =>
      sendAdminUserAction({
        action: 'bulk-restore-users',
        userIds,
      }),
    'Archivierte Profile wiederhergestellt.',
  );

  if (result?.success) {
    state.selectedArchivedUserIds.clear();
    updateSelectionSummary();
  }
}

async function handlePurgeUserAction(userId) {
  if (!userId) return;
  if (
    !window.confirm(
      `Archiviertes Profil ${userId} endgültig löschen? Dieser Schritt ist irreversibel.`,
    )
  ) {
    return;
  }

  const result = await performAdminAction(
    () =>
      sendAdminUserAction({
        action: 'purge-user',
        userId,
      }),
    'Archiviertes Profil endgültig entfernt.',
  );

  if (result?.success) {
    state.selectedArchivedUserIds.delete(userId);
    updateSelectionSummary();
  }
}

async function handleBulkPurgeUsersAction() {
  const userIds = [...state.selectedArchivedUserIds];
  if (userIds.length === 0) {
    showStatus('Bitte zuerst archivierte Profile auswählen.', 'error');
    return;
  }

  if (
    !window.confirm(
      `${userIds.length} archivierte Profile endgültig löschen? Dieser Schritt ist irreversibel.`,
    )
  ) {
    return;
  }

  const result = await performAdminAction(
    () =>
      sendAdminUserAction({
        action: 'bulk-purge-users',
        userIds,
      }),
    'Archivierte Profile endgültig entfernt.',
  );

  if (result?.success) {
    state.selectedArchivedUserIds.clear();
    updateSelectionSummary();
  }
}

function selectUser(userId, userName = '') {
  if (!userId) return;
  if (state.selectedUserId !== userId) {
    state.selectedMemoryEntries.clear();
  }
  state.selectedUserId = userId;
  state.selectedUserProfile = null;
  state.selectedUserError = '';
  fillActionForm(userId, '', '');
  renderSelectedUserPanel();
  syncUrlState();
  loadSelectedUserProfile();
  showStatus(`Profil ${userName || userId} ausgewählt.`, 'info');
}

function exportSelectedUserProfile() {
  const profile = state.selectedUserProfile || getFallbackSelectedUserProfile();
  if (!profile) {
    showStatus('Bitte zuerst ein Profil auswählen.', 'error');
    return;
  }

  const blob = new Blob([JSON.stringify(profile, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `admin-user-${profile.userId}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showStatus(`Profil ${profile.userId} exportiert.`, 'success');
}

function showAuth(showError = false, message = 'Falsches Passwort!') {
  showAuthError(showError ? message : '');
  authOverlay.classList.remove('hidden');
  setHidden(adminMain, true);
  setHidden(adminToolbar, true);
  setHidden(adminPanelNav, true);
  requestAnimationFrame(() => {
    passwordInput.focus();
  });
}

function hideAuth() {
  setHidden(authError, true);
  authOverlay.classList.add('hidden');
  setHidden(adminMain, false);
  setHidden(adminToolbar, false);
  setHidden(adminPanelNav, false);
}

async function handleLogin() {
  setHidden(authError, true);
  const password = passwordInput.value.trim();
  if (!password) {
    showAuthError('Bitte Passwort eingeben.');
    passwordInput.focus();
    return;
  }

  loginButton.disabled = true;
  try {
    await createAdminSession(password);
    state.isAuthenticated = true;
    passwordInput.value = '';
    hideAuth();
    await fetchData();
  } catch (error) {
    showAuthError(
      error instanceof Error ? error.message : 'Login fehlgeschlagen.',
    );
  } finally {
    loginButton.disabled = false;
  }
}

async function handleLogout() {
  await deleteAdminSession();
  state.isAuthenticated = false;
  state.selectedUserIds.clear();
  state.selectedArchivedUserIds.clear();
  state.selectedMemoryEntries.clear();
  state.selectedUserProfile = null;

  // Disable auto-refresh
  if (state.autoRefreshEnabled) {
    state.autoRefreshEnabled = false;
    clearInterval(state.autoRefreshInterval);
    state.autoRefreshInterval = null;
    autoRefreshToggle?.classList.remove('is-active');
    setHidden(autoRefreshSpinner, true);
  }

  clearStatus();
  updateSelectionSummary();
  showAuth();
}

loginButton.addEventListener('click', handleLogin);
logoutButton?.addEventListener('click', handleLogout);

passwordInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') handleLogin();
});
actionSaveMemoryButton?.addEventListener('click', handleSaveMemoryAction);
actionDeleteMemoryButton?.addEventListener('click', () =>
  handleDeleteMemoryAction(),
);
actionDeleteUserButton?.addEventListener('click', () =>
  handleDeleteUserAction(),
);
actionExportUserButton?.addEventListener('click', exportSelectedUserProfile);
actionAssignAliasButton?.addEventListener('click', () =>
  handleAssignAliasAction(),
);
actionRemoveAliasButton?.addEventListener('click', () =>
  handleRemoveAliasAction(),
);
actionMergeUsersButton?.addEventListener('click', handleMergeUsersAction);
actionBulkDeleteMemoriesButton?.addEventListener(
  'click',
  handleBulkDeleteMemoriesAction,
);
actionBulkDeleteUsersButton?.addEventListener(
  'click',
  handleBulkDeleteUsersAction,
);
actionBulkRestoreUsersButton?.addEventListener(
  'click',
  handleBulkRestoreUsersAction,
);
actionBulkPurgeUsersButton?.addEventListener(
  'click',
  handleBulkPurgeUsersAction,
);
actionPurgeExpiredArchivesButton?.addEventListener(
  'click',
  handlePurgeExpiredArchivesAction,
);
refreshButton.addEventListener('click', fetchData);

[actionUserIdInput, actionAliasNameInput, actionMergeSourceInput].forEach(
  (input) => {
    input?.addEventListener('input', updateSelectionSummary);
  },
);

adminMain?.addEventListener('click', (event) => {
  const pageButton = event.target.closest('[data-page-target]');
  if (pageButton) {
    const section = pageButton.dataset.pageTarget || '';
    const page = Number(pageButton.dataset.page) || 1;
    if (!state.pagination[section]) return;
    state.pagination[section].page = page;
    syncUrlState();
    fetchData();
    return;
  }

  const button = event.target.closest('[data-admin-action]');
  if (!button) return;

  const action = button.dataset.adminAction || '';
  const userId = button.dataset.userId || '';
  const userName = button.dataset.userName || '';

  if (action === 'select-user') {
    selectUser(userId, userName);
    return;
  }

  if (action === 'delete-user') {
    selectUser(userId, userName);
    handleDeleteUserAction({ userId, userName });
    return;
  }

  if (action === 'restore-user') {
    handleRestoreUserAction(userId);
    return;
  }

  if (action === 'purge-user') {
    handlePurgeUserAction(userId);
    return;
  }

  if (action === 'delete-memory') {
    selectUser(userId, userName);
    handleDeleteMemoryAction({
      userId,
      key: button.dataset.memoryKey || '',
      value: button.dataset.memoryValue || '',
    });
    return;
  }

  if (action === 'use-alias') {
    const aliasName = button.dataset.aliasName || '';
    if (actionAliasNameInput) actionAliasNameInput.value = aliasName;
    if (userId && actionUserIdInput && !actionUserIdInput.value.trim()) {
      actionUserIdInput.value = userId;
    }
    updateSelectionSummary();
    showStatus(`Alias ${aliasName || '-'} ins Formular übernommen.`, 'info');
    return;
  }

  if (action === 'remove-alias') {
    const aliasName = button.dataset.aliasName || '';
    if (aliasName && actionAliasNameInput) {
      actionAliasNameInput.value = aliasName;
    }
    handleRemoveAliasAction({
      alias: aliasName,
      userId,
    });
    return;
  }

  if (action === 'clear-memory-selection') {
    state.selectedMemoryEntries.clear();
    renderSelectedUserPanel();
    updateSelectionSummary();
  }
});

adminMain?.addEventListener('change', (event) => {
  const input = event.target.closest('[data-selection-type]');
  if (!input) return;

  const selectionType = input.dataset.selectionType || '';
  const userId = String(input.dataset.userId || '').trim();
  if (selectionType === 'user' && userId) {
    if (input.checked) {
      state.selectedUserIds.add(userId);
    } else {
      state.selectedUserIds.delete(userId);
    }
    updateSelectionSummary();
    return;
  }

  if (selectionType === 'archived-user' && userId) {
    if (input.checked) {
      state.selectedArchivedUserIds.add(userId);
    } else {
      state.selectedArchivedUserIds.delete(userId);
    }
    updateSelectionSummary();
    return;
  }

  if (selectionType === 'memory') {
    const memoryId = createMemorySelectionId(
      input.dataset.memoryKey || '',
      input.dataset.memoryValue || '',
    );
    if (input.checked) {
      state.selectedMemoryEntries.add(memoryId);
    } else {
      state.selectedMemoryEntries.delete(memoryId);
    }
    updateSelectionSummary();
  }
});

window.addEventListener('popstate', async () => {
  restoreStateFromUrl();
  if (state.isAuthenticated) {
    await fetchData();
  }
});

// ─── Panel Navigation Badge Updates ───
function updatePanelNavBadges(pagination = {}, summary = {}) {
  const badgeCounts = {
    users: pagination.users?.total || 0,
    archived: pagination.archived?.total || 0,
    audit: pagination.audit?.total || 0,
    contacts: pagination.contacts?.total || 0,
    comments: pagination.comments?.total || 0,
    likes: pagination.likes?.total || 0,
    mappings: pagination.mappings?.total || 0,
    memories: summary.filteredMemoryCount || 0,
  };

  Object.entries(badgeCounts).forEach(([key, count]) => {
    const badge = document.querySelector(`[data-nav-badge="${key}"]`);
    if (badge) setText(badge, formatNumber(count));
  });
}

// ─── Panel Navigation Click Handler ───
if (adminPanelNav) {
  adminPanelNav.addEventListener('click', (event) => {
    const link = event.target.closest('[data-nav-target]');
    if (!link) return;

    const targetId = link.dataset.navTarget || '';
    const target = document.getElementById(targetId);
    if (!target) return;

    // Update active state
    adminPanelNav.querySelectorAll('.admin-panel-nav__link').forEach((el) => {
      el.classList.remove('is-active');
    });
    link.classList.add('is-active');

    // Scroll to target
    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  });
}

// ─── Search Handler ───
function handleSearchInput() {
  const value = (searchInput?.value || '').trim();
  state.searchQuery = value;
  setHidden(searchClear, !value);

  // Reset pagination to page 1 on search
  Object.keys(state.pagination).forEach((key) => {
    state.pagination[key].page = 1;
  });

  updateActiveSearchLabel();
  syncUrlState();
  fetchData();
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(handleSearchInput, SEARCH_DEBOUNCE_MS);
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      searchInput.value = '';
      searchInput.blur();
      handleSearchInput();
    }
    if (event.key === 'Enter') {
      clearTimeout(searchDebounceTimer);
      handleSearchInput();
    }
  });
}

if (searchClear) {
  searchClear.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    handleSearchInput();
    searchInput?.focus();
  });
}

// ─── Filter Handlers ───
function handleFilterChange() {
  state.filters.userStatus = filterUserStatus?.value || 'all';
  state.filters.mappingStatus = filterMappingStatus?.value || 'all';
  state.filters.auditAction = filterAuditAction?.value || 'all';

  // Reset pagination on filter
  Object.keys(state.pagination).forEach((key) => {
    state.pagination[key].page = 1;
  });

  updateActiveSearchLabel();
  syncUrlState();
  fetchData();
}

[filterUserStatus, filterMappingStatus, filterAuditAction].forEach((select) => {
  select?.addEventListener('change', handleFilterChange);
});

// ─── Auto Refresh ───
function toggleAutoRefresh() {
  state.autoRefreshEnabled = !state.autoRefreshEnabled;
  autoRefreshToggle?.classList.toggle('is-active', state.autoRefreshEnabled);
  setHidden(autoRefreshSpinner, !state.autoRefreshEnabled);

  if (state.autoRefreshEnabled) {
    state.autoRefreshInterval = setInterval(() => {
      if (state.isAuthenticated && !refreshButton?.disabled) {
        fetchData();
      }
    }, AUTO_REFRESH_INTERVAL_MS);
    showToast('Auto-Refresh aktiviert (30s Intervall)', 'success', 2500);
  } else {
    clearInterval(state.autoRefreshInterval);
    state.autoRefreshInterval = null;
    showToast('Auto-Refresh deaktiviert', 'info', 2000);
  }
}

autoRefreshToggle?.addEventListener('click', toggleAutoRefresh);

// ─── Keyboard Shortcuts ───
document.addEventListener('keydown', (event) => {
  // Don't fire shortcuts when typing in inputs
  const tag = (event.target?.tagName || '').toLowerCase();
  const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

  if (event.key === '/' && !isInput) {
    event.preventDefault();
    searchInput?.focus();
    return;
  }

  if (event.key === 'r' && !isInput && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    if (state.isAuthenticated) fetchData();
    return;
  }

  if (event.key === 'Escape' && isInput) {
    event.target.blur();
    return;
  }
});

// ─── Intersection Observer for Panel Nav Active State ───
const panelSections = document.querySelectorAll(
  '.admin-panel[id], .admin-summary-strip',
);
const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && adminPanelNav) {
        const targetId = entry.target.id;
        if (!targetId) return;
        adminPanelNav
          .querySelectorAll('.admin-panel-nav__link')
          .forEach((link) => {
            link.classList.toggle(
              'is-active',
              link.dataset.navTarget === targetId,
            );
          });
      }
    });
  },
  {
    threshold: 0.2,
    rootMargin: '-80px 0px -60% 0px',
  },
);

panelSections.forEach((section) => navObserver.observe(section));

async function initializeAdmin() {
  restoreStateFromUrl();
  fillActionForm(state.selectedUserId, '', '');
  updateSelectionSummary();

  const authenticated = await checkAdminSession().catch(() => false);
  if (authenticated) {
    state.isAuthenticated = true;
    await fetchData();
    return;
  }

  showAuth();
}

initializeAdmin();
