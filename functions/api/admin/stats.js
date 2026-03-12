import {
  backfillAdminIndexesFromKv,
  loadIndexedUsers,
} from "./_admin-index.js";
import {
  authorizeAdmin,
  getErrorMessage,
  jsonResponse,
  normalizeSearch,
  paginateArray,
  parsePaginationParams,
} from "./_admin-utils.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZES = {
  likes: 8,
  users: 10,
  mappings: 10,
  comments: 10,
  contacts: 10,
  audit: 12,
  archived: 10,
};

function buildWarning(section, error, code = "query_failed") {
  const detail = getErrorMessage(error);
  const isMissingTable = /no such table|no such column/i.test(detail);

  return {
    section,
    code: isMissingTable ? "missing_table" : code,
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

function buildSqlSearch(columns, search) {
  if (!search) return { clause: "", bindings: [] };

  const like = `%${search}%`;
  return {
    clause: ` WHERE ${columns.map((column) => `${column} LIKE ?`).join(" OR ")}`,
    bindings: columns.map(() => like),
  };
}

function buildDynamicWhere(clauses = []) {
  const validClauses = clauses.filter(Boolean);
  return validClauses.length > 0 ? ` WHERE ${validClauses.join(" AND ")}` : "";
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
    action: row?.action || "",
    targetUserId: row?.target_user_id || "",
    memoryKey: row?.memory_key || "",
    status: row?.status || "",
    summary: row?.summary || "",
    actor: row?.actor || "admin",
    sourceIp: row?.source_ip || "",
    details: parseJson(row?.details_json),
    before: parseJson(row?.before_json),
    after: parseJson(row?.after_json),
    createdAt: row?.created_at || "",
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
    userId: row?.user_id || "",
    displayName: row?.display_name || snapshot?.profile?.name || "",
    deletedAt: row?.deleted_at || "",
    restoreUntil: row?.restore_until || "",
    deletedBy: row?.deleted_by || "admin",
    deleteReason: row?.delete_reason || "",
    memoryCount: Array.isArray(snapshot?.memories)
      ? snapshot.memories.length
      : 0,
    aliasCount: Array.isArray(snapshot?.aliases) ? snapshot.aliases.length : 0,
    snapshot,
  };
}

function buildUserFilter(filters) {
  const clauses = [];
  const bindings = [];

  if (filters.userStatus !== "all") {
    clauses.push(`p.status = ?`);
    bindings.push(filters.userStatus);
  }

  if (filters.memoryKey !== "all") {
    clauses.push(`
      EXISTS (
        SELECT 1
        FROM admin_memory_entries me_key
        WHERE me_key.user_id = p.user_id
          AND me_key.memory_key = ?
      )
    `);
    bindings.push(filters.memoryKey);
  }

  if (filters.q) {
    const like = `%${filters.q}%`;
    clauses.push(`
      (
        p.user_id LIKE ?
        OR p.display_name LIKE ?
        OR EXISTS (
          SELECT 1
          FROM admin_name_mappings nm
          WHERE nm.user_id = p.user_id
            AND (nm.name LIKE ? OR nm.raw_value LIKE ?)
        )
        OR EXISTS (
          SELECT 1
          FROM admin_memory_entries me
          WHERE me.user_id = p.user_id
            AND (
              me.memory_key LIKE ?
              OR me.memory_value LIKE ?
              OR me.category LIKE ?
            )
        )
      )
    `);
    bindings.push(like, like, like, like, like, like, like);
  }

  return {
    clause: buildDynamicWhere(clauses),
    bindings,
  };
}

function buildMappingFilter(filters) {
  const clauses = [];
  const bindings = [];

  if (filters.mappingStatus !== "all") {
    clauses.push(`status = ?`);
    bindings.push(filters.mappingStatus);
  }

  if (filters.q) {
    const like = `%${filters.q}%`;
    clauses.push(
      `(name LIKE ? OR user_id LIKE ? OR raw_value LIKE ? OR status LIKE ?)`,
    );
    bindings.push(like, like, like, like);
  }

  return {
    clause: buildDynamicWhere(clauses),
    bindings,
  };
}

function buildArchivedFilter(filters) {
  const clauses = [`restored_at IS NULL`, `purged_at IS NULL`];
  const bindings = [];

  if (filters.q) {
    const like = `%${filters.q}%`;
    clauses.push(
      `(user_id LIKE ? OR display_name LIKE ? OR delete_reason LIKE ? OR snapshot_json LIKE ?)`,
    );
    bindings.push(like, like, like, like);
  }

  return {
    clause: buildDynamicWhere(clauses),
    bindings,
  };
}

function buildAuditFilter(filters) {
  const clauses = [];
  const bindings = [];

  if (filters.q) {
    const like = `%${filters.q}%`;
    clauses.push(
      `(
        action LIKE ?
        OR target_user_id LIKE ?
        OR memory_key LIKE ?
        OR status LIKE ?
        OR summary LIKE ?
        OR details_json LIKE ?
        OR actor LIKE ?
        OR source_ip LIKE ?
      )`,
    );
    bindings.push(like, like, like, like, like, like, like, like);
  }

  if (filters.auditAction !== "all") {
    clauses.push(`action = ?`);
    bindings.push(filters.auditAction);
  }

  if (filters.auditStatus !== "all") {
    clauses.push(`status = ?`);
    bindings.push(filters.auditStatus);
  }

  if (filters.auditActor) {
    clauses.push(`actor LIKE ?`);
    bindings.push(`%${filters.auditActor}%`);
  }

  if (filters.auditUserId) {
    clauses.push(`target_user_id LIKE ?`);
    bindings.push(`%${filters.auditUserId}%`);
  }

  return {
    clause: buildDynamicWhere(clauses),
    bindings,
  };
}

function parseFilters(url) {
  const rawMemoryKey = String(url.searchParams.get("memoryKey") || "").trim();
  const rawAuditAction = String(
    url.searchParams.get("auditAction") || "",
  ).trim();
  const rawAuditStatus = String(
    url.searchParams.get("auditStatus") || "",
  ).trim();

  return {
    q: normalizeSearch(url.searchParams.get("q")),
    userStatus: String(url.searchParams.get("userStatus") || "all")
      .trim()
      .toLowerCase(),
    mappingStatus: String(url.searchParams.get("mappingStatus") || "all")
      .trim()
      .toLowerCase(),
    memoryKey: rawMemoryKey ? rawMemoryKey.toLowerCase() : "all",
    auditAction: rawAuditAction ? rawAuditAction.toLowerCase() : "all",
    auditStatus: rawAuditStatus ? rawAuditStatus.toLowerCase() : "all",
    auditActor: normalizeSearch(url.searchParams.get("auditActor")),
    auditUserId: normalizeSearch(url.searchParams.get("auditUserId")),
  };
}

async function loadLikes(db, filters, pagination, warnings) {
  const likes = await queryAll(
    db,
    `SELECT project_id, likes FROM project_likes ORDER BY likes DESC`,
    [],
    "likes",
    warnings,
  );
  const filtered = filters.q
    ? likes.filter(
        (entry) =>
          String(entry?.project_id || "")
            .toLowerCase()
            .includes(filters.q) ||
          String(entry?.likes || "").includes(filters.q),
      )
    : likes;

  const paginated = paginateArray(filtered, pagination);
  return {
    ...paginated,
    totalLikes: filtered.reduce(
      (sum, item) => sum + (Number(item?.likes) || 0),
      0,
    ),
    topProject: filtered[0] || null,
  };
}

async function loadComments(db, filters, pagination, warnings) {
  const search = buildSqlSearch(
    ["post_id", "author_name", "content"],
    filters.q,
  );
  return loadPaginatedD1Section(db, {
    section: "comments",
    selectSql: `
      SELECT id, post_id, author_name, content, created_at
      FROM blog_comments${search.clause}
      ORDER BY created_at DESC
    `,
    countSql: `SELECT COUNT(*) AS total FROM blog_comments${search.clause}`,
    bindings: search.bindings,
    page: pagination.page,
    pageSize: pagination.pageSize,
    warnings,
  });
}

async function loadContacts(db, filters, pagination, warnings) {
  const search = buildSqlSearch(
    ["name", "email", "subject", "message"],
    filters.q,
  );
  return loadPaginatedD1Section(db, {
    section: "contacts",
    selectSql: `
      SELECT id, name, email, subject, message, created_at
      FROM contact_messages${search.clause}
      ORDER BY created_at DESC
    `,
    countSql: `SELECT COUNT(*) AS total FROM contact_messages${search.clause}`,
    bindings: search.bindings,
    page: pagination.page,
    pageSize: pagination.pageSize,
    warnings,
  });
}

async function loadAuditLogs(db, filters, pagination, warnings) {
  const filter = buildAuditFilter(filters);

  return loadPaginatedD1Section(db, {
    section: "audit",
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
      FROM admin_audit_log${filter.clause}
      ORDER BY created_at DESC
    `,
    countSql: `SELECT COUNT(*) AS total FROM admin_audit_log${filter.clause}`,
    bindings: filter.bindings,
    page: pagination.page,
    pageSize: pagination.pageSize,
    warnings,
    transformItem: parseAuditLogRow,
  });
}

async function loadNameMappings(db, filters, pagination, warnings) {
  const search = buildMappingFilter(filters);
  return loadPaginatedD1Section(db, {
    section: "name-mappings",
    selectSql: `
      SELECT name, user_id, raw_value, status, updated_at
      FROM admin_name_mappings${search.clause}
      ORDER BY
        CASE status
          WHEN 'linked' THEN 0
          WHEN 'conflict' THEN 1
          ELSE 2
        END ASC,
        name ASC
    `,
    countSql: `SELECT COUNT(*) AS total FROM admin_name_mappings${search.clause}`,
    bindings: search.bindings,
    page: pagination.page,
    pageSize: pagination.pageSize,
    warnings,
    transformItem: (row) => ({
      name: row?.name || "",
      userId: row?.user_id || "",
      rawValue: row?.raw_value || "",
      status: row?.status || "linked",
      updatedAt: row?.updated_at || "",
    }),
  });
}

async function loadUsers(db, filters, pagination, warnings) {
  const filter = buildUserFilter(filters);
  const result = await loadPaginatedD1Section(db, {
    section: "users",
    selectSql: `
      SELECT user_id, display_name, status, memory_count, latest_memory_at
      FROM admin_user_profiles p${filter.clause}
      ORDER BY latest_memory_at DESC, memory_count DESC, display_name ASC, user_id ASC
    `,
    countSql: `SELECT COUNT(*) AS total FROM admin_user_profiles p${filter.clause}`,
    bindings: filter.bindings,
    page: pagination.page,
    pageSize: pagination.pageSize,
    warnings,
  });

  const userIds = result.items.map((item) => item.user_id).filter(Boolean);
  const indexedUsers = await loadIndexedUsers(db, userIds).catch((error) => {
    warnings.push(buildWarning("users", error));
    return [];
  });
  const indexedByUserId = new Map(
    indexedUsers.map((user) => [user.userId, user]),
  );

  const users = result.items.map((row) => {
    const indexed = indexedByUserId.get(row.user_id) || {
      aliases: [],
      memoryKeys: [],
      memories: [],
    };

    return {
      userId: row.user_id,
      name: row.display_name || "",
      status: row.status || "anonymous",
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

async function loadFilteredUserSummary(db, filters, warnings) {
  const filter = buildUserFilter(filters);
  const row = await queryFirst(
    db,
    `
      SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN p.status = 'identified' THEN 1 ELSE 0 END) AS identified_users,
        SUM(CASE WHEN p.status = 'anonymous' THEN 1 ELSE 0 END) AS anonymous_users,
        COALESCE(SUM(p.memory_count), 0) AS total_memories
      FROM admin_user_profiles p${filter.clause}
    `,
    filter.bindings,
    "user-summary",
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

async function loadArchivedProfiles(db, filters, pagination, warnings) {
  const archivedFilter = buildArchivedFilter(filters);
  return loadPaginatedD1Section(db, {
    section: "archived",
    selectSql: `
      SELECT
        user_id,
        display_name,
        snapshot_json,
        deleted_at,
        restore_until,
        deleted_by,
        delete_reason
      FROM admin_deleted_profiles${archivedFilter.clause}
      ORDER BY deleted_at DESC
    `,
    countSql: `SELECT COUNT(*) AS total FROM admin_deleted_profiles${archivedFilter.clause}`,
    bindings: archivedFilter.bindings,
    page: pagination.page,
    pageSize: pagination.pageSize,
    warnings,
    transformItem: parseArchivedProfileRow,
  });
}

async function loadMemoryOptions(db, warnings) {
  const rows = await queryAll(
    db,
    `
      SELECT DISTINCT memory_key
      FROM admin_memory_entries
      ORDER BY memory_key ASC
    `,
    [],
    "memory-options",
    warnings,
  );

  return rows.map((row) => String(row?.memory_key || "")).filter(Boolean);
}

async function loadHealth(db, warnings, { auditAvailable }) {
  const now = Date.now();
  const archiveWindowEnd = new Date(now + 7 * DAY_IN_MS).toISOString();
  const mappingRows = await queryAll(
    db,
    `
      SELECT status, COUNT(*) AS total
      FROM admin_name_mappings
      GROUP BY status
    `,
    [],
    "health-mappings",
    warnings,
  );
  const userRows = await queryAll(
    db,
    `
      SELECT status, COUNT(*) AS total
      FROM admin_user_profiles
      GROUP BY status
    `,
    [],
    "health-users",
    warnings,
  );
  const totals = await queryFirst(
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
    [
      now + 7 * DAY_IN_MS,
      new Date(now).toISOString(),
      new Date(now).toISOString(),
      archiveWindowEnd,
    ],
    "health-totals",
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
  );

  const mappingCounts = Object.fromEntries(
    mappingRows.map((row) => [row.status || "unknown", Number(row.total) || 0]),
  );
  const userCounts = Object.fromEntries(
    userRows.map((row) => [row.status || "unknown", Number(row.total) || 0]),
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
    status: "ok",
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
      "warnings",
      "error",
      "Admin-Warnungen offen",
      `${warnings.length} Bereiche liefern Hinweise oder Teilfehler.`,
      warnings.length,
    );
  }

  if (!storage?.indexReady) {
    pushFinding(
      "index_not_ready",
      "error",
      "Admin-Index nicht bereit",
      "Die D1-Indexdaten sind noch nicht vollständig synchronisiert.",
    );
  }

  if (!health.kvAvailable) {
    pushFinding(
      "kv_missing",
      "error",
      "KV nicht verfügbar",
      "Jules-Memory kann ohne KV nicht zuverlässig gelesen oder gepflegt werden.",
    );
  }

  if (!health.auditAvailable) {
    pushFinding(
      "audit_missing",
      "warning",
      "Audit-Tabelle fehlt",
      "Admin-Änderungen können aktuell nicht vollständig nachvollzogen werden.",
    );
  }

  if (health.conflictMappings > 0) {
    pushFinding(
      "mapping_conflicts",
      "warning",
      "Alias-Konflikte vorhanden",
      `${health.conflictMappings} Name-Mappings zeigen auf Konflikte und sollten repariert werden.`,
      health.conflictMappings,
    );
  }

  if (health.orphanMappings > 0) {
    pushFinding(
      "orphan_mappings",
      "warning",
      "Orphan-Mappings vorhanden",
      `${health.orphanMappings} bekannte Namen sind keiner User-ID zugeordnet.`,
      health.orphanMappings,
    );
  }

  if (health.usersWithoutName > 0) {
    pushFinding(
      "users_without_name",
      "warning",
      "Profile ohne Namen",
      `${health.usersWithoutName} Profile haben Memories, aber keinen stabilen Namen.`,
      health.usersWithoutName,
    );
  }

  if (health.emptyProfiles > 0) {
    pushFinding(
      "empty_profiles",
      "warning",
      "Leere Profile im Index",
      `${health.emptyProfiles} Profile haben aktuell keine nutzbaren Memory-Einträge.`,
      health.emptyProfiles,
    );
  }

  if (health.expiringSoon > 0) {
    pushFinding(
      "expiring_memories",
      "warning",
      "Memories laufen bald ab",
      `${health.expiringSoon} Memory-Einträge erreichen in den nächsten 7 Tagen ihr Ablaufdatum.`,
      health.expiringSoon,
    );
  }

  if (health.expiredArchives > 0) {
    pushFinding(
      "expired_archives",
      "error",
      "Archive über der Restore-Frist",
      `${health.expiredArchives} archivierte Profile sind überfällig und können bereinigt werden.`,
      health.expiredArchives,
    );
  } else if (health.archivesDueSoon > 0) {
    pushFinding(
      "archives_due_soon",
      "warning",
      "Archive laufen bald ab",
      `${health.archivesDueSoon} archivierte Profile erreichen in den nächsten 7 Tagen ihre Restore-Frist.`,
      health.archivesDueSoon,
    );
  }

  if (findings.length === 0) {
    pushFinding(
      "healthy",
      "success",
      "Keine offenen Befunde",
      "Der Admin-Bereich zeigt aktuell keine auffälligen Integritäts- oder Betriebsprobleme.",
    );
  }

  return findings;
}

async function ensureAdminIndexesReady(db, env, warnings) {
  const backfill = await backfillAdminIndexesFromKv(env);
  if (!backfill.ok && !backfill.skipped) {
    warnings.push(
      buildWarning(
        "memory-index",
        backfill.error,
        backfill.code || "backfill_failed",
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
    "storage",
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
        section: "database",
        code: "missing_binding",
        message: "Die D1-Bindung DB_LIKES ist nicht verfügbar.",
        detail: "Missing DB_LIKES binding",
      });

      return jsonResponse({
        likes: [],
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
              code: "missing_database",
              tone: "error",
              title: "D1-Bindung fehlt",
              detail:
                "Die Admin-API kann ohne DB_LIKES keine Datenbereiche laden.",
              count: 1,
            },
          ],
          status: "error",
        },
        auditLogs: [],
        filters: parseFilters(new URL(request.url)),
        options: {
          memoryKeys: [],
        },
        summary: {
          totalLikes: 0,
          topProjectId: "",
          topProjectLikes: 0,
          filteredUsers: 0,
          filteredIdentifiedUsers: 0,
          filteredAnonymousUsers: 0,
          filteredMemoryCount: 0,
          totalComments: 0,
          totalContacts: 0,
          totalAuditLogs: 0,
          totalArchivedProfiles: 0,
        },
        pagination: {
          likes: paginateArray([], {
            page: 1,
            pageSize: DEFAULT_PAGE_SIZES.likes,
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
    const filters = parseFilters(url);
    const likesPagination = parsePaginationParams(url, "likes", {
      defaultPageSize: DEFAULT_PAGE_SIZES.likes,
      maxPageSize: 50,
    });
    const usersPagination = parsePaginationParams(url, "users", {
      defaultPageSize: DEFAULT_PAGE_SIZES.users,
      maxPageSize: 100,
    });
    const mappingsPagination = parsePaginationParams(url, "mappings", {
      defaultPageSize: DEFAULT_PAGE_SIZES.mappings,
      maxPageSize: 100,
    });
    const commentsPagination = parsePaginationParams(url, "comments", {
      defaultPageSize: DEFAULT_PAGE_SIZES.comments,
      maxPageSize: 100,
    });
    const contactsPagination = parsePaginationParams(url, "contacts", {
      defaultPageSize: DEFAULT_PAGE_SIZES.contacts,
      maxPageSize: 100,
    });
    const auditPagination = parsePaginationParams(url, "audit", {
      defaultPageSize: DEFAULT_PAGE_SIZES.audit,
      maxPageSize: 100,
    });
    const archivedPagination = parsePaginationParams(url, "archived", {
      defaultPageSize: DEFAULT_PAGE_SIZES.archived,
      maxPageSize: 100,
    });

    const { storage } = await ensureAdminIndexesReady(db, env, warnings);
    const likesResult = await loadLikes(db, filters, likesPagination, warnings);
    const commentsResult = await loadComments(
      db,
      filters,
      commentsPagination,
      warnings,
    );
    const contactsResult = await loadContacts(
      db,
      filters,
      contactsPagination,
      warnings,
    );
    const mappingsResult = await loadNameMappings(
      db,
      filters,
      mappingsPagination,
      warnings,
    );
    const usersResult = await loadUsers(db, filters, usersPagination, warnings);
    const filteredUserSummary = await loadFilteredUserSummary(
      db,
      filters,
      warnings,
    );
    const auditResult = await loadAuditLogs(
      db,
      filters,
      auditPagination,
      warnings,
    );
    const archivedResult = await loadArchivedProfiles(
      db,
      filters,
      archivedPagination,
      warnings,
    );
    const memoryKeys = await loadMemoryOptions(db, warnings);
    const health = await loadHealth(db, warnings, {
      auditAvailable: auditResult.available,
    });
    health.kvAvailable = storage.kvAvailable;
    health.vectorizeConfigured = storage.vectorizeConfigured;
    health.aiConfigured = storage.aiConfigured;
    health.warningCount = warnings.length;
    health.findings = buildHealthFindings(health, warnings, storage);
    health.status = health.findings.some((entry) => entry.tone === "error")
      ? "error"
      : health.findings.some((entry) => entry.tone === "warning")
        ? "warning"
        : "ok";

    const filteredMemoryCount = filteredUserSummary.totalMemories;
    const filteredIdentifiedUsers = filteredUserSummary.identifiedUsers;
    const filteredAnonymousUsers = filteredUserSummary.anonymousUsers;
    const totalLikes = likesResult.totalLikes || 0;
    const topProject = likesResult.topProject || null;

    return jsonResponse({
      likes: likesResult.items,
      comments: commentsResult.items,
      contacts: contactsResult.items,
      aiMemories: usersResult.items,
      nameMappings: mappingsResult.items,
      users: usersResult.items,
      archivedProfiles: archivedResult.items,
      storage,
      health,
      auditLogs: auditResult.items,
      filters,
      options: {
        memoryKeys,
      },
      summary: {
        totalLikes,
        topProjectId: topProject?.project_id || "",
        topProjectLikes: Number(topProject?.likes) || 0,
        filteredUsers: filteredUserSummary.totalUsers,
        filteredIdentifiedUsers,
        filteredAnonymousUsers,
        filteredMemoryCount,
        totalComments: commentsResult.pagination.total,
        totalContacts: contactsResult.pagination.total,
        totalAuditLogs: auditResult.pagination.total,
        totalArchivedProfiles: archivedResult.pagination.total,
      },
      pagination: {
        likes: likesResult.pagination,
        comments: commentsResult.pagination,
        contacts: contactsResult.pagination,
        users: usersResult.pagination,
        mappings: mappingsResult.pagination,
        audit: auditResult.pagination,
        archived: archivedResult.pagination,
      },
      warnings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Admin API Error:", error);
    return jsonResponse(
      {
        error: "Internal Server Error",
        details: getErrorMessage(error),
      },
      500,
    );
  }
}
