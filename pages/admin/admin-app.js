/**
 * Unified compact admin UI.
 * Root list shows Cloudflare main folders, click opens content with actions.
 */

import {
  escapeHtml,
  formatDate,
  formatNumber,
  getTrimmedString,
  isFolderEntry,
  isMappingEntry,
  isMemoryProfileEntry,
  isUserEntry,
  normalizePageNumber,
  parseRetryAfterSeconds,
  sleep,
} from './admin-utils.js';
import {
  getFolderEntry,
  mergeUsers,
  rebuildRecords,
  syncVisibleRecords,
} from './admin-data.js';
import {
  buildGoRootListItemMarkup,
  buildRecordListItemMarkup,
  buildSelectionData,
  formatContentPreview,
  getEmptyRecordsMessage,
} from './admin-presenters.js';

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
const PURGE_JOB_POLL_INTERVAL_MS = 1500;
const PURGE_JOB_POLL_TIMEOUT_MS = 10 * 60 * 1000;

const authOverlay = document.getElementById('auth-overlay');
const authError = document.getElementById('auth-error');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const purgeAllButton = document.getElementById('purge-all-button');
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
const recordsCountMetric = document.getElementById('records-count');
const memoryCountMetric = document.getElementById('memory-count');
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
  records: [],
  selectedEntryId: '',
  selectedEntry: null,
};

function setHidden(element, hidden) {
  if (element) element.hidden = hidden;
}

function setText(element, text) {
  if (element) element.textContent = text;
}
function setMetric(id, value) {
  setText(document.getElementById(id), value);
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
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
  /** @type {any} */ (error).code = 'rate_limited';
  /** @type {any} */ (error).retryAfter = retryAfter;
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

function setAuthErrorMessage(message = '') {
  setText(authError, message);
  setHidden(authError, !message);
}

function showAuth(showError = false, message = 'Falsches Passwort!') {
  setAuthErrorMessage(showError ? message : '');
  authOverlay.classList.remove('hidden');
  setHidden(adminMain, true);
  requestAnimationFrame(() => passwordInput?.focus());
}

function hideAuth() {
  setAuthErrorMessage('');
  authOverlay.classList.add('hidden');
  setHidden(adminMain, false);
}

function setBusyState(isBusy) {
  if (logoutButton) /** @type {any} */ (logoutButton).disabled = isBusy;
  if (purgeAllButton) /** @type {any} */ (purgeAllButton).disabled = isBusy;
  renderRecordsPagination();
}

function setActionsBusy(isBusy) {
  state.actionsBusy = isBusy;

  const quickActionButtons = recordsList?.querySelectorAll(
    '.admin-unified__quick',
  );
  quickActionButtons?.forEach((button) => {
    /** @type {any} */ (button).disabled = isBusy;
  });
}

async function runWithBusyState(setBusy, task) {
  setBusy(true);
  try {
    return await task();
  } finally {
    setBusy(false);
  }
}

function createJsonRequestInit(
  { method = 'GET', body = undefined } = /** @type {any} */ ({}),
) {
  const init = /** @type {RequestInit} */ ({
    method,
    credentials: 'same-origin',
  });

  if (body !== undefined) {
    init.headers = {
      'Content-Type': 'application/json',
    };
    init.body = JSON.stringify(body);
  }

  return init;
}

async function requestJson(
  url,
  {
    method = 'GET',
    body = undefined,
    rateLimitMessage = '',
    unauthorizedMessage = '',
  } = /** @type {any} */ ({}),
) {
  const response = await fetch(url, createJsonRequestInit({ method, body }));
  const payload = await parseJsonResponse(response);

  if (response.status === 429) {
    throw createRateLimitError(response, payload, rateLimitMessage);
  }

  if (unauthorizedMessage && response.status === 401) {
    throw createUnauthorizedError(unauthorizedMessage);
  }

  return { response, payload };
}

async function checkAdminSession() {
  const { response, payload } = await requestJson(SESSION_API_URL, {
    rateLimitMessage: 'Zu viele Session-Anfragen. Bitte kurz warten.',
  });
  if (!response.ok) return false;
  return !!payload?.authenticated;
}

async function createAdminSession(password) {
  const { response, payload } = await requestJson(SESSION_API_URL, {
    method: 'POST',
    body: { password },
    rateLimitMessage: 'Zu viele Login-Versuche. Bitte kurz warten.',
  });
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || 'Login fehlgeschlagen.');
  }
  return payload;
}

async function deleteAdminSession() {
  await fetch(SESSION_API_URL, createJsonRequestInit({ method: 'DELETE' }));
}

function createUnauthorizedError(message = 'Sitzung abgelaufen.') {
  const error = new Error(message);
  /** @type {any} */ (error).code = 'unauthorized';
  return error;
}

async function sendAdminUserAction(payload) {
  const { response, payload: result } = await requestJson(USERS_API_URL, {
    method: 'POST',
    body: payload,
    rateLimitMessage: 'Zu viele Admin-Aktionen. Bitte kurz warten.',
    unauthorizedMessage: 'Sitzung abgelaufen. Bitte neu einloggen.',
  });

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
      params.set(pageKey, String(normalizePageNumber(page)));
    }
  }

  return `${API_URL}?${params.toString()}`;
}

async function fetchStatsPage({ folderId = '', page = 1 } = {}) {
  const { response, payload } = await requestJson(
    buildStatsUrl({ folderId, page }),
    {
      rateLimitMessage:
        'Zu viele Anfragen. Daten werden in Kürze wieder verfügbar.',
      unauthorizedMessage: 'Sitzung abgelaufen. Bitte neu einloggen.',
    },
  );

  if (!response.ok) {
    throw new Error(
      payload?.details ||
        payload?.error ||
        'Admin-Daten konnten nicht geladen werden.',
    );
  }

  return payload || {};
}

async function openFolder(folderId, page = 1) {
  const folder = getFolderEntry(state, folderId);
  if (!folder) return;
  await fetchData({ silent: true, folderId: folder.folderId, page });
}

function goToRootFolders() {
  const currentFolderId = state.activeFolderId;
  state.activeFolderId = '';
  state.activeFolderPage = 1;
  state.activeFolderPagination = null;
  syncVisibleRecords(state);

  const activeRoot = currentFolderId
    ? getFolderEntry(state, currentFolderId)
    : null;
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

function setMetricSummary(metricId, element, value, labelPrefix) {
  const formattedValue = formatNumber(value);
  setMetric(metricId, formattedValue);
  if (!element) return;

  const label = `${labelPrefix}: ${formattedValue}`;
  element.title = label;
  element.setAttribute('aria-label', label);
}

function renderRecordsList() {
  if (!recordsList || !noRecords) return;

  const inRootView = !state.activeFolderId;
  const activeFolder = state.activeFolderId
    ? getFolderEntry(state, state.activeFolderId)
    : null;
  const totalCount = inRootView
    ? state.cloudflareFolders.length
    : Number(activeFolder?.total || state.records.length);
  const visibleCount = state.records.length;

  setMetricSummary('records-count', recordsCountMetric, totalCount, 'Gesamt');
  setMetricSummary(
    'memory-count',
    memoryCountMetric,
    visibleCount,
    'Angezeigt',
  );

  if (state.records.length === 0) {
    recordsList.innerHTML = '';
    setText(noRecords, getEmptyRecordsMessage(inRootView));
    setHidden(noRecords, false);
    renderRecordsPagination();
    return;
  }

  const html = [];
  if (!inRootView) {
    html.push(buildGoRootListItemMarkup());
  }

  html.push(
    ...state.records.map((entry) =>
      buildRecordListItemMarkup(entry, {
        selectedEntryId: state.selectedEntryId,
        activeFolderId: state.activeFolderId,
      }),
    ),
  );

  recordsList.innerHTML = html.join('');
  setHidden(noRecords, true);
  renderRecordsPagination();
}

function getNormalizedPaginationState(pagination) {
  const totalPages = Math.max(1, Number(pagination?.totalPages) || 1);
  const currentPage = Math.min(
    normalizePageNumber(pagination?.page),
    totalPages,
  );

  return {
    currentPage,
    totalPages,
    total: Number(pagination?.total) || 0,
    hasPreviousPage: !!pagination?.hasPreviousPage,
    hasNextPage: !!pagination?.hasNextPage,
  };
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

  const pagination = getNormalizedPaginationState(state.activeFolderPagination);

  setText(
    recordsPageInfo,
    `Seite ${formatNumber(pagination.currentPage)} / ${formatNumber(
      pagination.totalPages,
    )} • ${formatNumber(pagination.total)} Total`,
  );
  /** @type {any} */ (recordsPagePrev).disabled =
    !pagination.hasPreviousPage || state.loading;
  /** @type {any} */ (recordsPageNext).disabled =
    !pagination.hasNextPage || state.loading;
  setHidden(recordsPagination, pagination.totalPages <= 1);
}

function buildDetailRow(label, value) {
  return `
    <div class="admin-unified__detail-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

function clearSelectionPanel() {
  if (!selectedType || !selectedDetails || !selectedContent) return;

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
}

function setSelectionPanelCollapsed(isCollapsed) {
  if (detailsPanel) {
    setHidden(detailsPanel, isCollapsed);
  }
  adminMain?.classList.toggle('is-details-collapsed', isCollapsed);
  adminUnified?.classList.toggle('is-compact-rail', isCollapsed);
}

function renderSelectionHeader(selection) {
  if (!selectedType) return;

  setText(selectedType, selection.type);
  setHidden(selectedType, !selection.type);
  if (selectedSummary) {
    setText(selectedSummary, selection.summary);
    setHidden(selectedSummary, !selection.summary);
  }
}

function renderSelectionDetails(details) {
  if (!selectedDetails) return;

  const normalizedDetails = Array.isArray(details) ? details : [];
  selectedDetails.innerHTML = normalizedDetails
    .map(([label, value]) => buildDetailRow(label, value))
    .join('');
  setHidden(selectedDetails, normalizedDetails.length === 0);
}

function hasSelectionContent(content) {
  return content !== null && content !== undefined && content !== '';
}

function renderSelectionContent(content) {
  if (!selectedContent) return;

  const hasContent = hasSelectionContent(content);
  selectedContent.textContent = hasContent ? formatContentPreview(content) : '';
  setHidden(selectedContent, !hasContent);
}

function renderSelectionPanel() {
  if (!selectedType || !selectedDetails || !selectedContent) return;

  const entry = state.selectedEntry;
  const collapseDetails = !entry || isFolderEntry(entry);
  setSelectionPanelCollapsed(collapseDetails);

  if (collapseDetails) {
    clearSelectionPanel();
    return;
  }

  const selection = buildSelectionData(entry);
  renderSelectionHeader(selection);
  renderSelectionDetails(selection.details);
  renderSelectionContent(selection.content);
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
  rebuildRecords(state, payload, users);
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
  return folderId === 'memories' && Array.isArray(payload?.users)
    ? payload.users
    : [];
}

function resolveStatsRequest({ folderId = '', page = 1 } = {}) {
  return {
    folderId: String((folderId ?? state.activeFolderId) || '').trim(),
    page: normalizePageNumber(page ?? state.activeFolderPage),
  };
}

function applyStatsPayload(payload, request) {
  const users = mergeUsers(getPayloadUsers(payload, request.folderId));

  state.isAuthenticated = true;
  state.activeFolderId = request.folderId;
  state.activeFolderPage = request.page;
  hideAuth();
  updateUI(payload, users);
}

function getWarningMessage(payload) {
  const warnings = Array.isArray(payload?.warnings) ? payload.warnings : [];
  return warnings
    .map((entry) => String(entry?.message || '').trim())
    .filter(Boolean)
    .join(' ');
}

function getErrorMessage(error, fallbackMessage) {
  return error instanceof Error ? error.message : fallbackMessage;
}

function handleUnauthorizedAdminRequest(
  error,
  { authMessage, silentUnauthorized },
) {
  if (error?.code !== 'unauthorized') return false;

  state.isAuthenticated = false;
  showAuth(true, authMessage);
  if (!silentUnauthorized) {
    showStatus(getErrorMessage(error, authMessage), 'error');
  }
  return true;
}

function handleRateLimitedAdminRequest(
  error,
  { fallbackMessage, silentRateLimited },
) {
  if (error?.code !== 'rate_limited') return false;

  if (!silentRateLimited) {
    showStatus(getErrorMessage(error, fallbackMessage), 'warning');
  }
  return true;
}

function handleAdminRequestError(
  error,
  {
    fallbackMessage = 'Aktion fehlgeschlagen.',
    authMessage = 'Sitzung abgelaufen.',
    silentUnauthorized = false,
    silentRateLimited = false,
  } = {},
) {
  if (
    handleUnauthorizedAdminRequest(error, {
      authMessage,
      silentUnauthorized,
    })
  )
    return;
  if (
    handleRateLimitedAdminRequest(error, {
      fallbackMessage,
      silentRateLimited,
    })
  )
    return;

  showStatus(getErrorMessage(error, fallbackMessage), 'error');
}

function showAuthRateLimitError(error, fallbackMessage) {
  const message = getErrorMessage(error, fallbackMessage);
  showAuth(true, message);
  showStatus(message, 'warning');
  return message;
}

async function runHandledBusyTask(
  task,
  { setBusy = null, fallbackMessage = 'Aktion fehlgeschlagen.' } = {},
) {
  const executeTask = async () => {
    try {
      return await task();
    } catch (error) {
      handleAdminRequestError(error, { fallbackMessage });
      return null;
    }
  };

  if (!setBusy) return executeTask();
  return runWithBusyState(setBusy, executeTask);
}

async function fetchData(
  { silent = false, folderId = '', page = 1 } = /** @type {any} */ ({}),
) {
  if (state.loading) return;
  const request = resolveStatsRequest({ folderId, page });
  state.loading = true;
  setBusyState(true);

  try {
    const payload = await fetchStatsPage(request);
    applyStatsPayload(payload, request);

    if (!silent) {
      const warningMessage = getWarningMessage(payload);
      if (warningMessage) showStatus(warningMessage, 'warning');
    }
  } catch (error) {
    handleAdminRequestError(error, {
      fallbackMessage: 'Daten konnten nicht geladen werden.',
      silentUnauthorized: silent,
      silentRateLimited: silent,
    });
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
    handleAdminRequestError(error, {
      fallbackMessage: 'Aktion fehlgeschlagen.',
    });
    return null;
  } finally {
    setActionsBusy(false);
  }
}

function resolveSelectedUserId(entry) {
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

function getSelectedUserContext() {
  const entry = state.selectedEntry;
  if (!entry || (!isMemoryProfileEntry(entry) && !isUserEntry(entry))) {
    showStatus(
      'Bitte zuerst ein Profil oder einen User-Eintrag auswählen.',
      'error',
    );
    return null;
  }

  const userId = resolveSelectedUserId(entry);
  if (!userId) {
    showStatus(
      'Keine eindeutige User-ID. Konflikt zuerst auflösen oder einzelnes Profil wählen.',
      'error',
    );
    return null;
  }

  return { entry, userId };
}

async function handleDeleteSelectedUser() {
  const context = getSelectedUserContext();
  if (!context) return;
  const { userId } = context;

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
  const context = getSelectedUserContext();
  if (!context) return;

  const result = await runHandledBusyTask(
    () =>
      sendAdminUserAction({
        action: 'list-user',
        userId: context.userId,
      }),
    {
      setBusy: setActionsBusy,
      fallbackMessage: 'Profil konnte nicht geladen werden.',
    },
  );
  if (!result) return;

  showStatus(
    `${result.userId}: ${formatNumber(result.count || 0)} gespeicherte Memories.`,
    'info',
  );
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
  const password = /** @type {any} */ (passwordInput)?.value.trim() || '';
  if (!password) {
    setAuthErrorMessage('Bitte Passwort eingeben.');
    passwordInput?.focus();
    return;
  }

  /** @type {any} */ (loginButton).disabled = true;
  try {
    await createAdminSession(password);
    state.isAuthenticated = true;
    if (passwordInput) /** @type {any} */ (passwordInput).value = '';
    hideAuth();
    await fetchData();
  } catch (error) {
    if (error?.code === 'rate_limited') {
      showAuthRateLimitError(
        error,
        'Zu viele Login-Versuche. Bitte kurz warten.',
      );
      return;
    }

    setAuthErrorMessage(getErrorMessage(error, 'Login fehlgeschlagen.'));
  } finally {
    /** @type {any} */ (loginButton).disabled = false;
  }
}

function resetAdminState() {
  state.isAuthenticated = false;
  state.selectedEntryId = '';
  state.selectedEntry = null;
  state.activeFolderId = '';
  state.activeFolderPage = 1;
  state.activeFolderPagination = null;
  state.records = [];
  state.cloudflareFolders = [];
  state.folderRecords = {};
}

async function handleLogout() {
  await deleteAdminSession();
  resetAdminState();

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

function handleSelectRecordAction(button) {
  const recordId = String(button?.dataset?.recordId || '').trim();
  if (!recordId) return;
  selectRecord(recordId);
  const selected = state.selectedEntry;
  if (!state.activeFolderId && isFolderEntry(selected)) {
    void openFolder(selected.folderId, 1);
  }
}

function handleFolderPaginationAction(direction) {
  if (!state.activeFolderId || !state.activeFolderPagination) return;
  const currentPage = Number(state.activeFolderPagination.page) || 1;
  const targetPage = currentPage + direction;
  if (targetPage < 1) return;
  void fetchData({
    silent: true,
    folderId: state.activeFolderId,
    page: targetPage,
  });
}

function runInlineRecordAction(button, isMatch, handler) {
  const entry = selectRecordByButton(button);
  if (!isMatch(entry)) return;
  void handler();
}

const INLINE_RECORD_ACTIONS = Object.freeze({
  'open-memory-profile-user': {
    isMatch: isMemoryProfileEntry,
    handler: handleOpenSelectedUser,
  },
  'delete-memory-profile-user': {
    isMatch: isMemoryProfileEntry,
    handler: handleDeleteSelectedUser,
  },
  'open-user-inline': {
    isMatch: isUserEntry,
    handler: handleOpenSelectedUser,
  },
  'delete-user-inline': {
    isMatch: isUserEntry,
    handler: handleDeleteSelectedUser,
  },
  'assign-mapping-inline': {
    isMatch: isMappingEntry,
    handler: handleAssignSelectedMapping,
  },
  'delete-mapping-inline': {
    isMatch: isMappingEntry,
    handler: handleDeleteSelectedMapping,
  },
});

const MAIN_ACTIONS_ALLOWED_WHILE_BUSY = new Set(['select-record', 'go-root']);
const MAIN_ACTION_HANDLERS = Object.freeze({
  'select-record': handleSelectRecordAction,
  'go-root': () => goToRootFolders(),
  'records-page-prev': () => handleFolderPaginationAction(-1),
  'records-page-next': () => handleFolderPaginationAction(1),
});

function handleMainClick(event) {
  const button = event.target.closest('[data-admin-action]');
  if (!button) return;

  const action = String(button.dataset.adminAction || '').trim();
  if (!action) return;

  if (state.actionsBusy && !MAIN_ACTIONS_ALLOWED_WHILE_BUSY.has(action)) {
    return;
  }

  const mainAction = MAIN_ACTION_HANDLERS[action];
  if (mainAction) {
    mainAction(button);
    return;
  }

  const inlineAction = INLINE_RECORD_ACTIONS[action];
  if (inlineAction) {
    runInlineRecordAction(button, inlineAction.isMatch, inlineAction.handler);
  }
}

async function handlePurgeAll() {
  const code = prompt(
    'Achtung: Du löschst ALLE Profile und Erinnerungen! Bitte tippe "LÖSCHEN" zum Bestätigen.',
  );
  if (code !== 'LÖSCHEN') return;

  const job = await runHandledBusyTask(
    async () => {
      const confirmation = await sendAdminUserAction({
        action: 'request-purge-everything-confirmation',
      });
      const start = await sendAdminUserAction({
        action: 'purge-everything',
        confirmToken: confirmation.confirmToken,
      });

      const jobId = String(start?.jobId || '').trim();
      if (!jobId) {
        throw new Error(
          start?.text || 'Purge-Job konnte nicht gestartet werden.',
        );
      }

      showToast(start.text || 'Purge-Job gestartet.', 'info');
      const result = await waitForPurgeEverythingJob(jobId);
      state.activeFolderId = 'memories';
      await fetchData();
      return result;
    },
    {
      setBusy: setBusyState,
      fallbackMessage: 'Purge fehlgeschlagen.',
    },
  );
  if (!job) return;

  showToast(
    job?.text || 'Purge abgeschlossen.',
    job?.status === 'completed' ? 'success' : 'error',
    4500,
  );
}

function getPurgeJob(status) {
  const job = status?.job || null;
  if (!job) {
    throw new Error('Purge-Status konnte nicht geladen werden.');
  }
  return job;
}
function getNextPurgePhase(job) {
  return getTrimmedString(job?.phase);
}

function updatePurgePhaseToast(phase, lastPhase) {
  if (!phase || phase === lastPhase) return lastPhase;
  showToast(`Purge läuft: ${phase}`, 'info', 1500);
  return phase;
}

function ensurePurgeJobIsActive(job) {
  if (job.status === 'completed') return job;
  if (job.status === 'failed') {
    throw new Error(job.error || job.text || 'Purge fehlgeschlagen.');
  }
  return null;
}

function resolvePurgePollWaitMs(status) {
  return (
    Math.max(
      500,
      Number(status?.pollAfterMs || PURGE_JOB_POLL_INTERVAL_MS) || 0,
    ) || PURGE_JOB_POLL_INTERVAL_MS
  );
}

async function waitForPurgeEverythingJob(jobId) {
  const startedAt = Date.now();
  let lastPhase = '';

  while (Date.now() - startedAt < PURGE_JOB_POLL_TIMEOUT_MS) {
    const status = await sendAdminUserAction({
      action: 'purge-everything-status',
      jobId,
    });
    const job = getPurgeJob(status);

    lastPhase = updatePurgePhaseToast(getNextPurgePhase(job), lastPhase);

    const completedJob = ensurePurgeJobIsActive(job);
    if (completedJob) {
      return completedJob;
    }

    await sleep(resolvePurgePollWaitMs(status));
  }

  throw new Error(
    'Purge-Job dauert unerwartet lange. Bitte Seite neu laden und Status prüfen.',
  );
}

function handlePasswordKeyPress(event) {
  if (event.key === 'Enter') handleLogin();
}

function handleAdminGlobalKeydown(event) {
  const target = /** @type {HTMLElement} */ (event.target);
  const tag = (target?.tagName || '').toLowerCase();
  const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';
  if (event.key === 'r' && !isInput && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    if (state.isAuthenticated) fetchData({ silent: true });
  }
}

function registerEventListeners() {
  [
    { element: loginButton, handler: handleLogin },
    { element: logoutButton, handler: handleLogout },
    { element: purgeAllButton, handler: handlePurgeAll },
  ].forEach(({ element, handler }) => {
    element?.addEventListener('click', handler);
  });

  adminMain?.addEventListener('click', handleMainClick);
  passwordInput?.addEventListener('keypress', handlePasswordKeyPress);
  document.addEventListener('keydown', handleAdminGlobalKeydown);
}

async function initializeAdmin() {
  renderRecordsList();
  renderSelectionPanel();

  let authenticated = false;
  try {
    authenticated = await checkAdminSession();
  } catch (error) {
    if (error?.code === 'rate_limited') {
      showAuthRateLimitError(
        error,
        'Zu viele Session-Anfragen. Bitte kurz warten.',
      );
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
