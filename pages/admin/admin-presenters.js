import {
  escapeHtml,
  formatDate,
  formatNumber,
  getTrimmedString,
  isFolderEntry,
  isLocalhostRuntime,
  truncateText,
} from './admin-utils.js';

export function getEntryTone(entry) {
  if (entry?.tone) return entry.tone;
  return 'neutral';
}

function createEntryListPresentation({
  type = 'Eintrag',
  title = '-',
  badge = 'info',
  line = '-',
  meta = '-',
  typeVariant = 'cloudflare',
} = {}) {
  return {
    type,
    title,
    badge,
    line,
    meta,
    typeVariant,
  };
}

function buildFolderEntryListPresentation(entry) {
  return createEntryListPresentation({
    type: '',
    title: entry.title || 'Cloudflare Daten',
    badge: formatNumber(entry.total || 0),
    line: '',
    meta: '',
  });
}

function getProfileEntryTitle(entry) {
  return entry.userName || entry.userId || '-';
}

function getMemoryCountValue(entry) {
  return Number(entry.memoryCount || 0);
}

function getDuplicateProfileCount(entry) {
  return Number(entry.userIds?.length || 0);
}

function formatMemoryCountLabel(entry, unit = 'Memories') {
  return `${formatNumber(getMemoryCountValue(entry))} ${unit}`;
}

function formatDuplicateProfileBadge(entry) {
  return `${formatNumber(getDuplicateProfileCount(entry))} profile`;
}

function buildLatestMemoryMeta(
  entry,
  { includeExpiry = false, includeMergedLabel = false } = {},
) {
  const parts = [];

  if (includeMergedLabel && entry.hasDuplicateProfiles) {
    parts.push('Zusammengeführt');
  }

  let latestMemoryText = `Letzte Memory: ${formatDate(entry.latestMemoryAt)}`;
  if (includeExpiry && entry.latestExpiresAt) {
    latestMemoryText += ` • Ablauf ${formatDate(entry.latestExpiresAt)}`;
  }
  parts.push(latestMemoryText);

  return parts.join(' • ');
}

function buildMemoryProfileLine(entry) {
  if (entry.hasDuplicateProfiles) {
    return `${formatNumber(getDuplicateProfileCount(entry))} Profile zusammengeführt • ${formatMemoryCountLabel(entry, 'Memories')}`;
  }

  const latestMemoryText = entry.latestKey
    ? `${entry.latestKey}: ${truncateText(entry.latestValue, 88)}`
    : 'Keine Erinnerung';

  return `${latestMemoryText} • ${formatNumber(getMemoryCountValue(entry))} gesamt`;
}

function buildUserProfileLine(entry) {
  if (entry.hasDuplicateProfiles) {
    return `${formatNumber(getDuplicateProfileCount(entry))} Profile • ${formatMemoryCountLabel(entry, 'Memories')}`;
  }

  return `${formatMemoryCountLabel(entry, 'Memories')} • ${entry.userId || '-'}`;
}

function buildMemoryProfileEntryListPresentation(entry) {
  return createEntryListPresentation({
    type: 'Erinnerungen',
    title: getProfileEntryTitle(entry),
    badge: entry.hasDuplicateProfiles
      ? formatDuplicateProfileBadge(entry)
      : formatMemoryCountLabel(entry, 'memories'),
    line: buildMemoryProfileLine(entry),
    meta: buildLatestMemoryMeta(entry, { includeExpiry: true }),
    typeVariant: 'memory',
  });
}

function buildUserEntryListPresentation(entry) {
  return createEntryListPresentation({
    type: 'Profil',
    title: getProfileEntryTitle(entry),
    badge: entry.hasDuplicateProfiles
      ? formatDuplicateProfileBadge(entry)
      : entry.status || 'profil',
    line: buildUserProfileLine(entry),
    meta: buildLatestMemoryMeta(entry, { includeMergedLabel: true }),
  });
}

function buildMappingEntryListPresentation(entry) {
  return createEntryListPresentation({
    type: 'Mapping',
    title: entry.name || '-',
    badge: entry.status || 'mapping',
    line: `${entry.userId || '-'} • ${entry.rawValue || '-'}`,
    meta: `Update: ${formatDate(entry.updatedAt)}`,
  });
}

function buildCommentEntryListPresentation(entry) {
  return createEntryListPresentation({
    type: 'Kommentar',
    title: entry.authorName || 'Unbekannt',
    badge: entry.postId || '-',
    line: truncateText(entry.content, 110),
    meta: formatDate(entry.createdAt),
  });
}

function buildContactEntryListPresentation(entry) {
  return createEntryListPresentation({
    type: 'Kontakt',
    title: entry.subject || '(Ohne Betreff)',
    badge: entry.email || '-',
    line: `${entry.name || '-'} • ${truncateText(entry.message, 72)}`,
    meta: formatDate(entry.createdAt),
  });
}

function buildLikeEntryListPresentation(entry) {
  return createEntryListPresentation({
    type: 'Like',
    title: entry.projectId || '-',
    badge: `${formatNumber(entry.likes || 0)} likes`,
    line: `${formatNumber(entry.likes || 0)} Likes`,
    meta: '',
  });
}

function buildLikeEventEntryListPresentation(entry) {
  return createEntryListPresentation({
    type: 'Like Event',
    title: `Event ${entry.eventId || '-'}`,
    badge: entry.projectId || '-',
    line: `${entry.projectId || '-'} • ${entry.sourceIp || '-'}`,
    meta: formatDate(entry.createdAt),
  });
}

function buildAuditEntryListPresentation(entry) {
  return createEntryListPresentation({
    type: 'Audit',
    title: entry.action || 'audit',
    badge: entry.status || '-',
    line: `${entry.targetUserId || '-'} • ${truncateText(entry.summary, 84)}`,
    meta: formatDate(entry.createdAt),
  });
}

function buildArchivedEntryListPresentation(entry) {
  return createEntryListPresentation({
    type: 'Archiv',
    title: entry.displayName || entry.userId || '-',
    badge: `${formatNumber(entry.memoryCount || 0)} memories`,
    line: `${entry.userId || '-'} • ${formatNumber(entry.aliasCount || 0)} Aliase`,
    meta: `Gelöscht: ${formatDate(entry.deletedAt)} • Restore bis ${formatDate(
      entry.restoreUntil,
    )}`,
  });
}

const ENTRY_LIST_PRESENTERS = Object.freeze({
  folder: buildFolderEntryListPresentation,
  'memory-profile': buildMemoryProfileEntryListPresentation,
  user: buildUserEntryListPresentation,
  mapping: buildMappingEntryListPresentation,
  comment: buildCommentEntryListPresentation,
  contact: buildContactEntryListPresentation,
  like: buildLikeEntryListPresentation,
  'like-event': buildLikeEventEntryListPresentation,
  audit: buildAuditEntryListPresentation,
  archived: buildArchivedEntryListPresentation,
});

function getEntryListPresentation(entry) {
  const presenter = ENTRY_LIST_PRESENTERS[String(entry?.kind || '')];
  if (presenter) return presenter(entry);
  return createEntryListPresentation();
}

const QUICK_ACTION_BUILDERS = Object.freeze({
  'memory-profile': (entry) =>
    entry.hasDuplicateProfiles
      ? []
      : [
          { action: 'open-memory-profile-user', label: 'User' },
          {
            action: 'delete-memory-profile-user',
            label: 'User löschen',
            isDanger: true,
          },
        ],
  user: (entry) =>
    entry.hasDuplicateProfiles
      ? []
      : [
          { action: 'open-user-inline', label: 'Laden' },
          { action: 'delete-user-inline', label: 'Löschen', isDanger: true },
        ],
  mapping: () => [
    { action: 'assign-mapping-inline', label: 'Zuweisen' },
    { action: 'delete-mapping-inline', label: 'Löschen', isDanger: true },
  ],
});

function getQuickActionsMarkup(entry, activeFolderId = '') {
  if (isFolderEntry(entry) && !activeFolderId) return '';

  const resolveQuickActions = QUICK_ACTION_BUILDERS[String(entry?.kind || '')];
  if (!resolveQuickActions) return '';

  const actions = resolveQuickActions(entry);
  if (!Array.isArray(actions) || actions.length === 0) return '';

  return actions
    .map(
      ({ action, label, isDanger = false }) => `
        <button
          type="button"
          class="admin-unified__quick${
            isDanger ? ' admin-unified__quick--danger' : ''
          }"
          data-admin-action="${escapeHtml(action)}"
          data-record-id="${escapeHtml(entry.id)}"
        >
          ${escapeHtml(label)}
        </button>
      `,
    )
    .join('');
}

export function getEmptyRecordsMessage(inRootView) {
  if (isLocalhostRuntime()) return 'Keine lokalen Daten.';
  return inRootView ? 'Keine Daten vorhanden.' : 'Keine Einträge.';
}

export function buildGoRootListItemMarkup() {
  return `
    <li class="admin-unified__item">
      <button
        type="button"
        class="admin-unified__select admin-unified__select--back"
        data-admin-action="go-root"
      >
        <strong class="admin-unified__item-title">← Zurück</strong>
      </button>
    </li>
  `;
}

export function buildRecordListItemMarkup(
  entry,
  { selectedEntryId = '', activeFolderId = '' } = {},
) {
  const presentation = getEntryListPresentation(entry);
  const isSelected = entry.id === selectedEntryId;
  const tone = getEntryTone(entry);
  const quickActions = getQuickActionsMarkup(entry, activeFolderId);

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
            presentation.type
              ? `<span class="admin-unified__type admin-unified__type--${
                  presentation.typeVariant
                }">${escapeHtml(presentation.type)}</span>`
              : ''
          }
          <span class="admin-lite__pill admin-lite__pill--${escapeHtml(
            tone,
          )}">${escapeHtml(presentation.badge)}</span>
        </div>
        <strong class="admin-unified__item-title">${escapeHtml(
          presentation.title,
        )}</strong>
        ${
          presentation.line
            ? `<p class="admin-unified__item-line">${escapeHtml(
                presentation.line,
              )}</p>`
            : ''
        }
        ${
          presentation.meta
            ? `<p class="admin-unified__item-meta">${escapeHtml(
                presentation.meta,
              )}</p>`
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
}

export function formatContentPreview(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value !== 'string') return stringifyPreviewValue(value);

  const trimmed = value.trim();
  if (!trimmed) return '-';
  if (!isStructuredJsonString(trimmed)) return value;

  return formatJsonStringPreview(trimmed, value);
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
  return memories.slice(0, limit).map(formatMemoryPreviewItem);
}

function stringifyPreviewValue(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isStructuredJsonString(value) {
  return (
    (value.startsWith('{') && value.endsWith('}')) ||
    (value.startsWith('[') && value.endsWith(']'))
  );
}

function formatJsonStringPreview(value, fallbackValue) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return fallbackValue;
  }
}

function getMemoryPreviewKey(memory) {
  return getTrimmedString(memory?.key, '-');
}

function getMemoryPreviewCategory(memory) {
  return String(memory?.category || 'note');
}

function getMemoryPreviewExpiry(memory) {
  if (!memory?.expiresAt) return null;
  return formatDate(memory.expiresAt);
}

function formatMemoryPreviewItem(memory) {
  return {
    key: getMemoryPreviewKey(memory),
    value: String(memory?.value || ''),
    category: getMemoryPreviewCategory(memory),
    zeit: formatDate(memory?.timestamp),
    ablauf: getMemoryPreviewExpiry(memory),
  };
}

function createSelectionData({
  type = '',
  summary = '',
  details = [],
  content = null,
} = {}) {
  return {
    type,
    summary,
    details,
    content,
  };
}

function getProfileDisplayName(entry) {
  return entry.userName && entry.userName !== entry.userId
    ? entry.userName
    : 'Anonym';
}

function buildProfileSelectionData(
  entry,
  { type, memoryCountLabel, latestActivityLabel, content },
) {
  const displayName = getProfileDisplayName(entry);
  return createSelectionData({
    type,
    summary: `${displayName} • ${formatNumber(
      entry.memoryCount || 0,
    )} Memories`,
    details: [
      ['Profil', displayName],
      ['User-ID', entry.userId || '-'],
      ['Status', formatStatusLabel(entry.status)],
      [memoryCountLabel, formatNumber(entry.memoryCount || 0)],
      [latestActivityLabel, formatDate(entry.latestMemoryAt)],
      ...(entry.hasDuplicateProfiles
        ? [['Zusammengeführt', (entry.userIds || []).join(', ') || '-']]
        : []),
    ],
    content,
  });
}

function buildMemoryProfileSelectionData(entry) {
  return buildProfileSelectionData(entry, {
    type: 'Profil Erinnerungen',
    memoryCountLabel: 'Erinnerungen',
    latestActivityLabel: 'Letzte Aktivität',
    content: formatMemoryItemsForPreview(entry.memories || []),
  });
}

function buildUserSelectionData(entry) {
  return buildProfileSelectionData(entry, {
    type: 'User Profil',
    memoryCountLabel: 'Memories',
    latestActivityLabel: 'Letzte Memory',
    content: {
      aliases: entry.aliases || [],
      memoryKeys: entry.memoryKeys || [],
      memories: formatMemoryItemsForPreview(entry.memories || [], 50),
    },
  });
}

function buildMappingSelectionData(entry) {
  return createSelectionData({
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
  });
}

function buildCommentSelectionData(entry) {
  return createSelectionData({
    type: 'Kommentar',
    summary: `${entry.authorName || 'Unbekannt'} • ${entry.postId || '-'}`,
    details: [
      ['Post-ID', entry.postId || '-'],
      ['Autor', entry.authorName || '-'],
      ['Zeit', formatDate(entry.createdAt)],
    ],
    content: entry.content || '-',
  });
}

function buildContactSelectionData(entry) {
  return createSelectionData({
    type: 'Kontaktanfrage',
    summary: `${entry.subject || '(Ohne Betreff)'} • ${entry.email || '-'}`,
    details: [
      ['Name', entry.name || '-'],
      ['E-Mail', entry.email || '-'],
      ['Betreff', entry.subject || '(Ohne Betreff)'],
      ['Zeit', formatDate(entry.createdAt)],
    ],
    content: entry.message || '-',
  });
}

function buildLikeSelectionData(entry) {
  return createSelectionData({
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
  });
}

function buildLikeEventSelectionData(entry) {
  return createSelectionData({
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
  });
}

function buildAuditSelectionData(entry) {
  return createSelectionData({
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
  });
}

function buildArchivedSelectionData(entry) {
  return createSelectionData({
    type: 'Archiviertes Profil',
    summary: buildArchivedSelectionSummary(entry),
    details: buildArchivedSelectionDetails(entry),
    content: entry.snapshot || {},
  });
}

function buildArchivedSelectionSummary(entry) {
  return `${entry.displayName || entry.userId || '-'} • ${formatMemoryCountLabel(
    entry,
    'Memories',
  )}`;
}

function buildArchivedSelectionDetails(entry) {
  return [
    ['User-ID', entry.userId || '-'],
    ['Name', entry.displayName || '-'],
    ['Gelöscht am', formatDate(entry.deletedAt)],
    ['Restore bis', formatDate(entry.restoreUntil)],
    ['Gelöscht von', entry.deletedBy || '-'],
    ['Grund', entry.deleteReason || '-'],
    ['Memories', formatNumber(entry.memoryCount || 0)],
    ['Aliase', formatNumber(entry.aliasCount || 0)],
  ];
}

const SELECTION_DATA_BUILDERS = Object.freeze({
  'memory-profile': buildMemoryProfileSelectionData,
  user: buildUserSelectionData,
  mapping: buildMappingSelectionData,
  comment: buildCommentSelectionData,
  contact: buildContactSelectionData,
  like: buildLikeSelectionData,
  'like-event': buildLikeEventSelectionData,
  audit: buildAuditSelectionData,
  archived: buildArchivedSelectionData,
});

export function buildSelectionData(entry) {
  if (isFolderEntry(entry)) {
    return createSelectionData();
  }

  const builder = SELECTION_DATA_BUILDERS[String(entry?.kind || '')];
  if (builder) return builder(entry);

  return createSelectionData({
    type: 'Eintrag',
    summary: 'Eintrag ausgewählt',
    details: [['Typ', entry?.kind || 'unknown']],
    content: entry,
  });
}
