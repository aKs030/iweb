import {
  backfillAdminIndexesFromKv,
  loadIndexedUsers,
} from './_admin-index.js';
import {
  authorizeAdmin,
  getErrorMessage,
  jsonResponse,
  paginateArray,
  parsePaginationParams,
} from './_admin-utils.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZES = {
  likes: 8,
  likeEvents: 12,
  users: 10,
  mappings: 10,
  comments: 10,
  contacts: 10,
  audit: 12,
  archived: 10,
};

const FOLDER_TO_SECTION = {
  memories: 'users',
  mappings: 'mappings',
  comments: 'comments',
  contacts: 'contacts',
  likes: 'likes',
  'like-events': 'likeEvents',
  audit: 'audit',
  archived: 'archived',
};

function parseRequestedFolder(url) {
  const raw = String(url.searchParams.get('folder') || '')
    .trim()
    .toLowerCase();
  if (!raw) return '';
  return Object.prototype.hasOwnProperty.call(FOLDER_TO_SECTION, raw)
    ? raw
    : '';
}

function buildPaginationFromTotal(total, pagination) {
  const totalItems = Math.max(0, Number(total) || 0);
  const pageSize = Math.max(1, Number(pagination?.pageSize) || 1);
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 1;
  const safePage = Math.min(
    Math.max(Number(pagination?.page) || 1, 1),
    totalPages,
  );

  return {
    page: safePage,
    pageSize,
    total: totalItems,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
  };
}

function buildEmptySectionResult(
  total,
  pagination,
  available = true,
  extras = {},
) {
  return {
    items: [],
    pagination: buildPaginationFromTotal(total, pagination),
    available,
    ...extras,
  };
}

function buildStaticPagination(pageSize) {
  return paginateArray([], {
    page: 1,
    pageSize,
  }).pagination;
}

function resolvePagination(url, section, options = {}) {
  const {
    compactMode = false,
    defaultPageSize,
    maxPageSize,
    compactPageSize = defaultPageSize,
  } = options;

  return compactMode
    ? buildStaticPagination(compactPageSize)
    : parsePaginationParams(url, section, {
        defaultPageSize,
        maxPageSize,
      });
}

async function resolveOptionalSection({
  compactMode = false,
  loadRequested = false,
  pagination,
  loadSection,
  loadSummary,
  compactAvailable = true,
  compactExtras = {},
}) {
  if (compactMode) {
    return buildEmptySectionResult(
      0,
      pagination,
      compactAvailable,
      compactExtras,
    );
  }

  if (loadRequested) {
    return loadSection();
  }

  const summary = await loadSummary();
  return buildEmptySectionResult(
    summary.total,
    pagination,
    summary.available,
    summary.extras || {},
  );
}

function buildWarning(section, error, code = 'query_failed') {
  const detail = getErrorMessage(error);
  const isMissingTable = /no such table|no such column/i.test(detail);

  return {
    section,
    code: isMissingTable ? 'missing_table' : code,
    message: isMissingTable
      ? `Der Bereich "${section}" ist noch nicht migriert.`
      : `Der Bereich "${section}" konnte nicht geladen werden.`,
    detail,
  };
}

function bindStatement(db, query, bindings = []) {
  const statement = db.prepare(query);
  return bindings.length > 0 ? statement.bind(...bindings) : statement;
}

async function queryAll(db, query, bindings, section, warnings) {
  try {
    const result = await bindStatement(db, query, bindings).all();
    return result?.results || [];
  } catch (error) {
    console.error(`Admin stats query failed for ${section}:`, error);
    warnings.push(buildWarning(section, error));
    return [];
  }
}

async function queryFirst(db, query, bindings, section, warnings, fallback) {
  try {
    const result = await bindStatement(db, query, bindings).first();
    return result || fallback;
  } catch (error) {
    console.error(`Admin stats first query failed for ${section}:`, error);
    warnings.push(buildWarning(section, error));
    return fallback;
  }
}

async function loadPaginatedD1Section(
  db,
  {
    section,
    selectSql,
    countSql,
    bindings = [],
    page,
    pageSize,
    warnings,
    transformItem = (item) => item,
    transformCount = (row) => Number(row?.total) || 0,
  },
) {
  try {
    const countRow = await bindStatement(db, countSql, bindings).first();
    const total = transformCount(countRow);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const offset = (safePage - 1) * pageSize;
    const itemsResult = await bindStatement(
      db,
      `${selectSql} LIMIT ? OFFSET ?`,
      [...bindings, pageSize, offset],
    ).all();

    return {
      items: (itemsResult?.results || []).map(transformItem),
      pagination: {
        page: safePage,
        pageSize,
        total,
        totalPages,
        hasPreviousPage: safePage > 1,
        hasNextPage: safePage < totalPages,
      },
      available: true,
    };
  } catch (error) {
    console.error(`Admin stats paginated query failed for ${section}:`, error);
    warnings.push(buildWarning(section, error));
    return {
      items: [],
      pagination: paginateArray([], { page, pageSize }).pagination,
      available: false,
    };
  }
}

function parseAuditLogRow(row) {
  const parseJson = (value) => {
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  };

  return {
    id: row?.id,
    action: row?.action || '',
    targetUserId: row?.target_user_id || '',
    memoryKey: row?.memory_key || '',
    status: row?.status || '',
    summary: row?.summary || '',
    actor: row?.actor || 'admin',
    sourceIp: row?.source_ip || '',
    details: parseJson(row?.details_json),
    before: parseJson(row?.before_json),
    after: parseJson(row?.after_json),
    createdAt: row?.created_at || '',
  };
}

function parseArchivedProfileRow(row) {
  let snapshot;
  try {
    snapshot = row?.snapshot_json ? JSON.parse(row.snapshot_json) : null;
  } catch {
    snapshot = null;
  }

  return {
    userId: row?.user_id || '',
    displayName: row?.display_name || snapshot?.profile?.name || '',
    deletedAt: row?.deleted_at || '',
    restoreUntil: row?.restore_until || '',
    deletedBy: row?.deleted_by || 'admin',
    deleteReason: row?.delete_reason || '',
    memoryCount: Array.isArray(snapshot?.memories)
      ? snapshot.memories.length
      : 0,
    aliasCount: Array.isArray(snapshot?.aliases) ? snapshot.aliases.length : 0,
    snapshot,
  };
}

function isCompactMode(url) {
  const raw = String(url.searchParams.get('compact') || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

async function loadLikes(db, pagination, warnings) {
  const [paginated, sumRow, topProject] = await Promise.all([
    loadPaginatedD1Section(db, {
      section: 'likes',
      selectSql: `
        SELECT project_id, likes
        FROM project_likes
        ORDER BY likes DESC, project_id ASC
      `,
      countSql: `SELECT COUNT(*) AS total FROM project_likes`,
      page: pagination.page,
      pageSize: pagination.pageSize,
      warnings,
    }),
    queryFirst(
      db,
      `SELECT COALESCE(SUM(likes), 0) AS total_likes FROM project_likes`,
      [],
      'likes-sum',
      warnings,
      { total_likes: 0 },
    ),
    queryFirst(
      db,
      `
        SELECT project_id, likes
        FROM project_likes
        ORDER BY likes DESC, project_id ASC
        LIMIT 1
      `,
      [],
      'likes-top-project',
      warnings,
      null,
    ),
  ]);

  return {
    ...paginated,
    totalLikes: Number(sumRow?.total_likes) || 0,
    topProject: topProject
      ? {
          project_id: topProject.project_id || '',
          likes: Number(topProject.likes) || 0,
        }
      : null,
  };
}

async function loadTotalCount(db, query, bindings, section, warnings) {
  try {
    const row = await bindStatement(db, query, bindings).first();
    return {
      total: Number(row?.total) || 0,
      available: true,
    };
  } catch (error) {
    console.error(`Admin stats total query failed for ${section}:`, error);
    warnings.push(buildWarning(section, error));
    return {
      total: 0,
      available: false,
    };
  }
}

async function loadLikesSummary(db, warnings) {
  try {
    const [aggregateRow, topProject] = await Promise.all([
      bindStatement(
        db,
        `SELECT COUNT(*) AS total_rows, COALESCE(SUM(likes), 0) AS total_likes FROM project_likes`,
        [],
      ).first(),
      bindStatement(
        db,
        `
          SELECT project_id, likes
          FROM project_likes
          ORDER BY likes DESC, project_id ASC
          LIMIT 1
        `,
        [],
      ).first(),
    ]);

    return {
      totalRows: Number(aggregateRow?.total_rows) || 0,
      totalLikes: Number(aggregateRow?.total_likes) || 0,
      topProject: topProject
        ? {
            project_id: topProject.project_id || '',
            likes: Number(topProject.likes) || 0,
          }
        : null,
      available: true,
    };
  } catch (error) {
    console.error('Admin stats likes summary query failed:', error);
    warnings.push(buildWarning('likes-summary', error));
    return {
      totalRows: 0,
      totalLikes: 0,
      topProject: null,
      available: false,
    };
  }
}

async function loadMappingsTotal(db, warnings) {
  return loadTotalCount(
    db,
    `SELECT COUNT(*) AS total FROM admin_name_mappings`,
    [],
    'mappings-total',
    warnings,
  );
}

async function loadLikeEventsTotal(db, warnings) {
  return loadTotalCount(
    db,
    `SELECT COUNT(*) AS total FROM project_like_events`,
    [],
    'like-events-total',
    warnings,
  );
}

async function loadCommentsTotal(db, warnings) {
  return loadTotalCount(
    db,
    `SELECT COUNT(*) AS total FROM blog_comments`,
    [],
    'comments-total',
    warnings,
  );
}

async function loadContactsTotal(db, warnings) {
  return loadTotalCount(
    db,
    `SELECT COUNT(*) AS total FROM contact_messages`,
    [],
    'contacts-total',
    warnings,
  );
}

async function loadAuditTotal(db, warnings) {
  return loadTotalCount(
    db,
    `SELECT COUNT(*) AS total FROM admin_audit_log`,
    [],
    'audit-total',
    warnings,
  );
}

async function loadArchivedTotal(db, warnings) {
  return loadTotalCount(
    db,
    `SELECT COUNT(*) AS total FROM admin_deleted_profiles WHERE restored_at IS NULL AND purged_at IS NULL`,
    [],
    'archived-total',
    warnings,
  );
}

async function loadComments(db, pagination, warnings) {
  return loadPaginatedD1Section(db, {
    section: 'comments',
    selectSql: `
      SELECT id, post_id, author_name, content, created_at
      FROM blog_comments
      ORDER BY created_at DESC
    `,
    countSql: `SELECT COUNT(*) AS total FROM blog_comments`,
    page: pagination.page,
    pageSize: pagination.pageSize,
    warnings,
  });
}

async function loadLikeEvents(db, pagination, warnings) {
  return loadPaginatedD1Section(db, {
    section: 'like-events',
    selectSql: `
      SELECT
        id,
        project_id,
        source_ip,
        user_agent,
        request_id,
        created_at
      FROM project_like_events
      ORDER BY created_at DESC, id DESC
    `,
    countSql: `SELECT COUNT(*) AS total FROM project_like_events`,
    page: pagination.page,
    pageSize: pagination.pageSize,
    warnings,
  });
}

async function loadContacts(db, pagination, warnings) {
  return loadPaginatedD1Section(db, {
    section: 'contacts',
    selectSql: `
      SELECT id, name, email, subject, message, created_at
      FROM contact_messages
      ORDER BY created_at DESC
    `,
    countSql: `SELECT COUNT(*) AS total FROM contact_messages`,
    page: pagination.page,
    pageSize: pagination.pageSize,
    warnings,
  });
}

async function loadAuditLogs(db, pagination, warnings) {
  return loadPaginatedD1Section(db, {
    section: 'audit',
    selectSql: `
      SELECT
        id,
        action,
        target_user_id,
        memory_key,
        status,
        summary,
        details_json,
        actor,
        source_ip,
        before_json,
        after_json,
        created_at
      FROM admin_audit_log
      ORDER BY created_at DESC
    `,
    countSql: `SELECT COUNT(*) AS total FROM admin_audit_log`,
    page: pagination.page,
    pageSize: pagination.pageSize,
    warnings,
    transformItem: parseAuditLogRow,
  });
}

async function loadNameMappings(db, pagination, warnings) {
  return loadPaginatedD1Section(db, {
    section: 'name-mappings',
    selectSql: `
      SELECT name, user_id, raw_value, status, updated_at
      FROM admin_name_mappings
      ORDER BY
        CASE status
          WHEN 'linked' THEN 0
          WHEN 'conflict' THEN 1
          ELSE 2
        END ASC,
        name ASC
    `,
    countSql: `SELECT COUNT(*) AS total FROM admin_name_mappings`,
    page: pagination.page,
    pageSize: pagination.pageSize,
    warnings,
    transformItem: (row) => ({
      name: row?.name || '',
      userId: row?.user_id || '',
      rawValue: row?.raw_value || '',
      status: row?.status || 'linked',
      updatedAt: row?.updated_at || '',
    }),
  });
}

async function loadUsers(db, pagination, warnings) {
  const result = await loadPaginatedD1Section(db, {
    section: 'users',
    selectSql: `
      SELECT user_id, display_name, status, memory_count, latest_memory_at
      FROM admin_user_profiles p
      ORDER BY latest_memory_at DESC, memory_count DESC, display_name ASC, user_id ASC
    `,
    countSql: `SELECT COUNT(*) AS total FROM admin_user_profiles p`,
    page: pagination.page,
    pageSize: pagination.pageSize,
    warnings,
  });

  const userIds = result.items.map((item) => item.user_id).filter(Boolean);
  const indexedUsers = await loadIndexedUsers(db, userIds).catch((error) => {
    warnings.push(buildWarning('users', error));
    return [];
  });
  const indexedByUserId = new Map(
    indexedUsers
      .filter((user) => user?.userId)
      .map((user) => /** @type {[string, any]} */ ([user.userId, user])),
  );

  const users = result.items.map((row) => {
    const indexed = indexedByUserId.get(row.user_id) || {
      aliases: [],
      memoryKeys: [],
      memories: [],
    };

    return {
      userId: row.user_id,
      name: row.display_name || '',
      status: row.status || 'anonymous',
      memoryCount: Number(row.memory_count) || 0,
      latestMemoryAt: Number(row.latest_memory_at) || null,
      aliases: indexed.aliases || [],
      memoryKeys: indexed.memoryKeys || [],
      memories: indexed.memories || [],
    };
  });

  return {
    ...result,
    items: users,
  };
}

async function loadUserSummary(db, warnings) {
  const row = await queryFirst(
    db,
    `
      SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN p.status = 'identified' THEN 1 ELSE 0 END) AS identified_users,
        SUM(CASE WHEN p.status = 'anonymous' THEN 1 ELSE 0 END) AS anonymous_users,
        COALESCE(SUM(p.memory_count), 0) AS total_memories
      FROM admin_user_profiles p
    `,
    [],
    'user-summary',
    warnings,
    {
      total_users: 0,
      identified_users: 0,
      anonymous_users: 0,
      total_memories: 0,
    },
  );

  return {
    totalUsers: Number(row?.total_users) || 0,
    identifiedUsers: Number(row?.identified_users) || 0,
    anonymousUsers: Number(row?.anonymous_users) || 0,
    totalMemories: Number(row?.total_memories) || 0,
  };
}

async function loadArchivedProfiles(db, pagination, warnings) {
  return loadPaginatedD1Section(db, {
    section: 'archived',
    selectSql: `
      SELECT
        user_id,
        display_name,
        snapshot_json,
        deleted_at,
        restore_until,
        deleted_by,
        delete_reason
      FROM admin_deleted_profiles
      WHERE restored_at IS NULL AND purged_at IS NULL
      ORDER BY deleted_at DESC
    `,
    countSql: `SELECT COUNT(*) AS total FROM admin_deleted_profiles WHERE restored_at IS NULL AND purged_at IS NULL`,
    page: pagination.page,
    pageSize: pagination.pageSize,
    warnings,
    transformItem: parseArchivedProfileRow,
  });
}

async function loadHealth(db, warnings, { auditAvailable }) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const archiveWindowEnd = new Date(now + 7 * DAY_IN_MS).toISOString();
  const [mappingRows, userRows, totals] = await Promise.all([
    queryAll(
      db,
      `
        SELECT status, COUNT(*) AS total
        FROM admin_name_mappings
        GROUP BY status
      `,
      [],
      'health-mappings',
      warnings,
    ),
    queryAll(
      db,
      `
        SELECT status, COUNT(*) AS total
        FROM admin_user_profiles
        GROUP BY status
      `,
      [],
      'health-users',
      warnings,
    ),
    queryFirst(
      db,
      `
        SELECT
          (SELECT COUNT(*) FROM admin_memory_entries) AS total_memories,
          (SELECT COUNT(*) FROM admin_user_profiles WHERE display_name = '') AS users_without_name,
          (SELECT COUNT(*) FROM admin_user_profiles WHERE memory_count = 0) AS empty_profiles,
          (SELECT COUNT(*) FROM admin_memory_entries WHERE expires_at IS NOT NULL AND expires_at <= ?) AS expiring_soon,
          (SELECT COUNT(*) FROM admin_deleted_profiles WHERE restored_at IS NULL AND purged_at IS NULL) AS deleted_profiles,
          (SELECT COUNT(*) FROM admin_deleted_profiles WHERE restored_at IS NULL AND purged_at IS NULL AND restore_until IS NOT NULL AND restore_until <= ?) AS expired_archives,
          (SELECT COUNT(*) FROM admin_deleted_profiles WHERE restored_at IS NULL AND purged_at IS NULL AND restore_until IS NOT NULL AND restore_until > ? AND restore_until <= ?) AS archives_due_soon
      `,
      [now + 7 * DAY_IN_MS, nowIso, nowIso, archiveWindowEnd],
      'health-totals',
      warnings,
      {
        total_memories: 0,
        users_without_name: 0,
        empty_profiles: 0,
        expiring_soon: 0,
        deleted_profiles: 0,
        expired_archives: 0,
        archives_due_soon: 0,
      },
    ),
  ]);

  const mappingCounts = Object.fromEntries(
    mappingRows.map((row) => [row.status || 'unknown', Number(row.total) || 0]),
  );
  const userCounts = Object.fromEntries(
    userRows.map((row) => [row.status || 'unknown', Number(row.total) || 0]),
  );

  return {
    linkedMappings: mappingCounts.linked || 0,
    conflictMappings: mappingCounts.conflict || 0,
    orphanMappings: mappingCounts.orphan || 0,
    identifiedUsers: userCounts.identified || 0,
    anonymousUsers: userCounts.anonymous || 0,
    usersWithoutName: Number(totals.users_without_name) || 0,
    emptyProfiles: Number(totals.empty_profiles) || 0,
    totalMemories: Number(totals.total_memories) || 0,
    expiringSoon: Number(totals.expiring_soon) || 0,
    malformedMemoryRecords: 0,
    deletedProfiles: Number(totals.deleted_profiles) || 0,
    expiredArchives: Number(totals.expired_archives) || 0,
    archivesDueSoon: Number(totals.archives_due_soon) || 0,
    kvAvailable: true,
    vectorizeConfigured: false,
    aiConfigured: false,
    auditAvailable,
    warningCount: warnings.length,
    findings: [],
    status: 'ok',
  };
}

function buildHealthFindings(health, warnings, storage) {
  const findings = [];
  const pushFinding = (code, tone, title, detail, count = 0) => {
    findings.push({
      code,
      tone,
      title,
      detail,
      count,
    });
  };

  if (warnings.length > 0) {
    pushFinding(
      'warnings',
      'error',
      'Admin-Warnungen offen',
      `${warnings.length} Bereiche liefern Hinweise oder Teilfehler.`,
      warnings.length,
    );
  }

  if (!storage?.indexReady) {
    pushFinding(
      'index_not_ready',
      'error',
      'Admin-Index nicht bereit',
      'Die D1-Indexdaten sind noch nicht vollständig aktualisiert.',
    );
  }

  if (!health.kvAvailable) {
    pushFinding(
      'kv_missing',
      'error',
      'KV nicht verfügbar',
      'Jules-Memory kann ohne KV nicht zuverlässig gelesen oder gepflegt werden.',
    );
  }

  if (!health.auditAvailable) {
    pushFinding(
      'audit_missing',
      'warning',
      'Audit-Tabelle fehlt',
      'Admin-Änderungen können aktuell nicht vollständig nachvollzogen werden.',
    );
  }

  if (health.conflictMappings > 0) {
    pushFinding(
      'mapping_conflicts',
      'warning',
      'Alias-Konflikte vorhanden',
      `${health.conflictMappings} Name-Mappings zeigen auf Konflikte und sollten repariert werden.`,
      health.conflictMappings,
    );
  }

  if (health.orphanMappings > 0) {
    pushFinding(
      'orphan_mappings',
      'warning',
      'Orphan-Mappings vorhanden',
      `${health.orphanMappings} bekannte Namen sind keiner User-ID zugeordnet.`,
      health.orphanMappings,
    );
  }

  if (health.usersWithoutName > 0) {
    pushFinding(
      'users_without_name',
      'warning',
      'Profile ohne Namen',
      `${health.usersWithoutName} Profile haben Memories, aber keinen stabilen Namen.`,
      health.usersWithoutName,
    );
  }

  if (health.emptyProfiles > 0) {
    pushFinding(
      'empty_profiles',
      'warning',
      'Leere Profile im Index',
      `${health.emptyProfiles} Profile haben aktuell keine nutzbaren Memory-Einträge.`,
      health.emptyProfiles,
    );
  }

  if (health.expiringSoon > 0) {
    pushFinding(
      'expiring_memories',
      'warning',
      'Memories laufen bald ab',
      `${health.expiringSoon} Memory-Einträge erreichen in den nächsten 7 Tagen ihr Ablaufdatum.`,
      health.expiringSoon,
    );
  }

  if (health.expiredArchives > 0) {
    pushFinding(
      'expired_archives',
      'error',
      'Archive über der Restore-Frist',
      `${health.expiredArchives} archivierte Profile sind überfällig und können bereinigt werden.`,
      health.expiredArchives,
    );
  } else if (health.archivesDueSoon > 0) {
    pushFinding(
      'archives_due_soon',
      'warning',
      'Archive laufen bald ab',
      `${health.archivesDueSoon} archivierte Profile erreichen in den nächsten 7 Tagen ihre Restore-Frist.`,
      health.archivesDueSoon,
    );
  }

  if (findings.length === 0) {
    pushFinding(
      'healthy',
      'success',
      'Keine offenen Befunde',
      'Der Admin-Bereich zeigt aktuell keine auffälligen Integritäts- oder Betriebsprobleme.',
    );
  }

  return findings;
}

async function ensureAdminIndexesReady(db, env, warnings) {
  const backfill = await backfillAdminIndexesFromKv(env);
  if (!backfill.ok && !backfill.skipped) {
    warnings.push(
      buildWarning(
        'memory-index',
        backfill.error,
        backfill.code || 'backfill_failed',
      ),
    );
  }

  const totals = await queryFirst(
    db,
    `
      SELECT
        (SELECT COUNT(*) FROM admin_user_profiles) AS user_count,
        (SELECT COUNT(*) FROM admin_memory_entries) AS memory_count,
        (SELECT COUNT(*) FROM admin_name_mappings) AS mapping_count
    `,
    [],
    'storage',
    warnings,
    {
      user_count: 0,
      memory_count: 0,
      mapping_count: 0,
    },
  );

  return {
    backfill,
    storage: {
      kvAvailable: !!(
        env?.JULES_MEMORY_KV ||
        env?.RATE_LIMIT_KV ||
        env?.SITEMAP_CACHE_KV
      ),
      vectorizeConfigured: !!env?.JULES_MEMORY,
      aiConfigured: !!env?.AI,
      userCount: Number(totals.user_count) || 0,
      memoryCount: Number(totals.memory_count) || 0,
      nameMappingCount: Number(totals.mapping_count) || 0,
      malformedMemoryRecords: 0,
      indexBackfilled: !backfill.skipped && backfill.ok,
      indexReady: backfill.ok !== false,
    },
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return auth.response;

  try {
    const db = env?.DB_LIKES;
    const warnings = [];
    if (!db?.prepare) {
      warnings.push({
        section: 'database',
        code: 'missing_binding',
        message: 'Die D1-Bindung DB_LIKES ist nicht verfügbar.',
        detail: 'Missing DB_LIKES binding',
      });

      return jsonResponse({
        likes: [],
        likeEvents: [],
        comments: [],
        contacts: [],
        aiMemories: [],
        nameMappings: [],
        users: [],
        archivedProfiles: [],
        storage: {
          kvAvailable: !!(
            env?.JULES_MEMORY_KV ||
            env?.RATE_LIMIT_KV ||
            env?.SITEMAP_CACHE_KV
          ),
          vectorizeConfigured: !!env?.JULES_MEMORY,
          aiConfigured: !!env?.AI,
          userCount: 0,
          memoryCount: 0,
          nameMappingCount: 0,
          malformedMemoryRecords: 0,
          indexBackfilled: false,
          indexReady: false,
        },
        health: {
          linkedMappings: 0,
          conflictMappings: 0,
          orphanMappings: 0,
          identifiedUsers: 0,
          anonymousUsers: 0,
          usersWithoutName: 0,
          emptyProfiles: 0,
          totalMemories: 0,
          expiringSoon: 0,
          malformedMemoryRecords: 0,
          deletedProfiles: 0,
          expiredArchives: 0,
          archivesDueSoon: 0,
          kvAvailable: !!(
            env?.JULES_MEMORY_KV ||
            env?.RATE_LIMIT_KV ||
            env?.SITEMAP_CACHE_KV
          ),
          vectorizeConfigured: !!env?.JULES_MEMORY,
          aiConfigured: !!env?.AI,
          auditAvailable: false,
          warningCount: 1,
          findings: [
            {
              code: 'missing_database',
              tone: 'error',
              title: 'D1-Bindung fehlt',
              detail:
                'Die Admin-API kann ohne DB_LIKES keine Datenbereiche laden.',
              count: 1,
            },
          ],
          status: 'error',
        },
        auditLogs: [],
        summary: {
          totalLikes: 0,
          topProjectId: '',
          topProjectLikes: 0,
          filteredUsers: 0,
          filteredIdentifiedUsers: 0,
          filteredAnonymousUsers: 0,
          filteredMemoryCount: 0,
          totalComments: 0,
          totalLikeEvents: 0,
          totalContacts: 0,
          totalAuditLogs: 0,
          totalArchivedProfiles: 0,
        },
        pagination: {
          likes: paginateArray([], {
            page: 1,
            pageSize: DEFAULT_PAGE_SIZES.likes,
          }).pagination,
          likeEvents: paginateArray([], {
            page: 1,
            pageSize: DEFAULT_PAGE_SIZES.likeEvents,
          }).pagination,
          comments: paginateArray([], {
            page: 1,
            pageSize: DEFAULT_PAGE_SIZES.comments,
          }).pagination,
          contacts: paginateArray([], {
            page: 1,
            pageSize: DEFAULT_PAGE_SIZES.contacts,
          }).pagination,
          users: paginateArray([], {
            page: 1,
            pageSize: DEFAULT_PAGE_SIZES.users,
          }).pagination,
          mappings: paginateArray([], {
            page: 1,
            pageSize: DEFAULT_PAGE_SIZES.mappings,
          }).pagination,
          audit: paginateArray([], {
            page: 1,
            pageSize: DEFAULT_PAGE_SIZES.audit,
          }).pagination,
          archived: paginateArray([], {
            page: 1,
            pageSize: DEFAULT_PAGE_SIZES.archived,
          }).pagination,
        },
        warnings,
        timestamp: new Date().toISOString(),
      });
    }

    const url = new URL(request.url);
    const compactMode = isCompactMode(url);
    const requestedFolder = parseRequestedFolder(url);
    const usersPagination = resolvePagination(url, 'users', {
      defaultPageSize: DEFAULT_PAGE_SIZES.users,
      maxPageSize: 100,
    });
    const mappingsPagination = resolvePagination(url, 'mappings', {
      defaultPageSize: DEFAULT_PAGE_SIZES.mappings,
      maxPageSize: 100,
    });
    const likesPagination = resolvePagination(url, 'likes', {
      compactMode,
      defaultPageSize: DEFAULT_PAGE_SIZES.likes,
      maxPageSize: 50,
    });
    const likeEventsPagination = resolvePagination(url, 'likeEvents', {
      compactMode,
      defaultPageSize: DEFAULT_PAGE_SIZES.likeEvents,
      maxPageSize: 100,
    });
    const commentsPagination = resolvePagination(url, 'comments', {
      compactMode,
      defaultPageSize: DEFAULT_PAGE_SIZES.comments,
      maxPageSize: 100,
    });
    const contactsPagination = resolvePagination(url, 'contacts', {
      compactMode,
      defaultPageSize: DEFAULT_PAGE_SIZES.contacts,
      maxPageSize: 100,
    });
    const auditPagination = resolvePagination(url, 'audit', {
      compactMode,
      defaultPageSize: DEFAULT_PAGE_SIZES.audit,
      maxPageSize: 100,
    });
    const archivedPagination = resolvePagination(url, 'archived', {
      compactMode,
      defaultPageSize: DEFAULT_PAGE_SIZES.archived,
      maxPageSize: 100,
    });

    const { storage } = await ensureAdminIndexesReady(db, env, warnings);
    const loadMemoriesSection = requestedFolder === 'memories';
    const loadMappingsSection = requestedFolder === 'mappings';
    const loadLikesSection = !compactMode && requestedFolder === 'likes';
    const loadLikeEventsSection =
      !compactMode && requestedFolder === 'like-events';
    const loadCommentsSection = !compactMode && requestedFolder === 'comments';
    const loadContactsSection = !compactMode && requestedFolder === 'contacts';
    const loadAuditSection = !compactMode && requestedFolder === 'audit';
    const loadArchivedSection = !compactMode && requestedFolder === 'archived';

    const userSummaryPromise = loadUserSummary(db, warnings);
    const usersResultPromise = userSummaryPromise.then((userSummary) =>
      loadMemoriesSection
        ? loadUsers(db, usersPagination, warnings)
        : buildEmptySectionResult(userSummary.totalUsers, usersPagination),
    );
    const mappingsResultPromise = resolveOptionalSection({
      loadRequested: loadMappingsSection,
      pagination: mappingsPagination,
      loadSection: () => loadNameMappings(db, mappingsPagination, warnings),
      loadSummary: () => loadMappingsTotal(db, warnings),
    });
    const resolvedLikesResultPromise = resolveOptionalSection({
      compactMode,
      loadRequested: loadLikesSection,
      pagination: likesPagination,
      loadSection: () => loadLikes(db, likesPagination, warnings),
      loadSummary: async () => {
        const summary = await loadLikesSummary(db, warnings);
        return {
          total: summary.totalRows,
          available: summary.available,
          extras: {
            totalLikes: summary.totalLikes,
            topProject: summary.topProject,
          },
        };
      },
      compactExtras: {
        totalLikes: 0,
        topProject: null,
      },
    });
    const resolvedCommentsResultPromise = resolveOptionalSection({
      compactMode,
      loadRequested: loadCommentsSection,
      pagination: commentsPagination,
      loadSection: () => loadComments(db, commentsPagination, warnings),
      loadSummary: () => loadCommentsTotal(db, warnings),
    });
    const resolvedLikeEventsResultPromise = resolveOptionalSection({
      compactMode,
      loadRequested: loadLikeEventsSection,
      pagination: likeEventsPagination,
      loadSection: () => loadLikeEvents(db, likeEventsPagination, warnings),
      loadSummary: () => loadLikeEventsTotal(db, warnings),
    });
    const resolvedContactsResultPromise = resolveOptionalSection({
      compactMode,
      loadRequested: loadContactsSection,
      pagination: contactsPagination,
      loadSection: () => loadContacts(db, contactsPagination, warnings),
      loadSummary: () => loadContactsTotal(db, warnings),
    });
    const resolvedAuditResultPromise = resolveOptionalSection({
      compactMode,
      loadRequested: loadAuditSection,
      pagination: auditPagination,
      loadSection: () => loadAuditLogs(db, auditPagination, warnings),
      loadSummary: () => loadAuditTotal(db, warnings),
      compactAvailable: false,
    });
    const resolvedArchivedResultPromise = resolveOptionalSection({
      compactMode,
      loadRequested: loadArchivedSection,
      pagination: archivedPagination,
      loadSection: () => loadArchivedProfiles(db, archivedPagination, warnings),
      loadSummary: () => loadArchivedTotal(db, warnings),
    });
    const healthPromise = resolvedAuditResultPromise.then(
      (resolvedAuditResult) =>
        loadHealth(db, warnings, {
          auditAvailable: resolvedAuditResult.available,
        }),
    );

    const [
      userSummary,
      usersResult,
      mappingsResult,
      resolvedLikesResult,
      resolvedCommentsResult,
      resolvedLikeEventsResult,
      resolvedContactsResult,
      resolvedAuditResult,
      resolvedArchivedResult,
      health,
    ] = await Promise.all([
      userSummaryPromise,
      usersResultPromise,
      mappingsResultPromise,
      resolvedLikesResultPromise,
      resolvedCommentsResultPromise,
      resolvedLikeEventsResultPromise,
      resolvedContactsResultPromise,
      resolvedAuditResultPromise,
      resolvedArchivedResultPromise,
      healthPromise,
    ]);
    health.kvAvailable = storage.kvAvailable;
    health.vectorizeConfigured = storage.vectorizeConfigured;
    health.aiConfigured = storage.aiConfigured;
    health.warningCount = warnings.length;
    health.findings = buildHealthFindings(health, warnings, storage);
    health.status = health.findings.some((entry) => entry.tone === 'error')
      ? 'error'
      : health.findings.some((entry) => entry.tone === 'warning')
        ? 'warning'
        : 'ok';

    const filteredMemoryCount = userSummary.totalMemories;
    const filteredIdentifiedUsers = userSummary.identifiedUsers;
    const filteredAnonymousUsers = userSummary.anonymousUsers;
    const totalLikes = resolvedLikesResult.totalLikes || 0;
    const topProject = resolvedLikesResult.topProject || null;

    return jsonResponse({
      likes: resolvedLikesResult.items,
      comments: resolvedCommentsResult.items,
      likeEvents: resolvedLikeEventsResult.items,
      contacts: resolvedContactsResult.items,
      aiMemories: usersResult.items,
      nameMappings: mappingsResult.items,
      users: usersResult.items,
      archivedProfiles: resolvedArchivedResult.items,
      storage,
      health,
      auditLogs: resolvedAuditResult.items,
      folder: requestedFolder || '',
      summary: {
        totalLikes,
        topProjectId: topProject?.project_id || '',
        topProjectLikes: Number(topProject?.likes) || 0,
        filteredUsers: userSummary.totalUsers,
        filteredIdentifiedUsers,
        filteredAnonymousUsers,
        filteredMemoryCount,
        totalComments: resolvedCommentsResult.pagination.total,
        totalLikeEvents: resolvedLikeEventsResult.pagination.total,
        totalContacts: resolvedContactsResult.pagination.total,
        totalAuditLogs: resolvedAuditResult.pagination.total,
        totalArchivedProfiles: resolvedArchivedResult.pagination.total,
      },
      pagination: {
        likes: resolvedLikesResult.pagination,
        likeEvents: resolvedLikeEventsResult.pagination,
        comments: resolvedCommentsResult.pagination,
        contacts: resolvedContactsResult.pagination,
        users: usersResult.pagination,
        mappings: mappingsResult.pagination,
        audit: resolvedAuditResult.pagination,
        archived: resolvedArchivedResult.pagination,
      },
      warnings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin API Error:', error);
    return jsonResponse(
      {
        error: 'Internal Server Error',
        details: getErrorMessage(error),
      },
      500,
    );
  }
}
