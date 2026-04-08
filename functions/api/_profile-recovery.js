import { normalizeUserId } from './_user-identity.js';
import { normalizeSchemaText } from './_text-utils.js';

const FALLBACK_MEMORY_PREFIX = 'robot-memory:';
const MAX_KV_SCAN_PAGES = 100;
const NAME_MEMORY_KEY = 'name';

export function normalizeRecoveryLookupName(rawName) {
  return normalizeSchemaText(rawName)
    .replace(/[.,;:!?]+$/g, '')
    .toLowerCase()
    .slice(0, 80);
}

function buildRecoveryCandidate(raw, source = 'unknown') {
  const userId = normalizeUserId(raw?.userId);
  if (!userId) return null;

  const memoryCount = Math.max(
    0,
    Number.parseInt(String(raw?.memoryCount), 10) || 0,
  );
  const latestMemoryAt = Math.max(
    0,
    Number.parseInt(String(raw?.latestMemoryAt), 10) || 0,
  );

  return {
    userId,
    name: normalizeSchemaText(raw?.name || ''),
    status:
      normalizeSchemaText(raw?.status || 'anonymous').toLowerCase() ||
      'anonymous',
    memoryCount,
    latestMemoryAt,
    source,
  };
}

function orderRecoveryCandidates(candidates = []) {
  return [...candidates].sort((a, b) => {
    const countDiff = (b.memoryCount || 0) - (a.memoryCount || 0);
    if (countDiff !== 0) return countDiff;

    const latestDiff = (b.latestMemoryAt || 0) - (a.latestMemoryAt || 0);
    if (latestDiff !== 0) return latestDiff;

    return String(a.userId || '').localeCompare(String(b.userId || ''), 'de', {
      sensitivity: 'base',
    });
  });
}

function getAdminDb(env) {
  return env?.DB_LIKES?.prepare ? env.DB_LIKES : null;
}

async function loadRecoveryCandidatesFromAdminDb(env, normalizedName, limit) {
  const db = getAdminDb(env);
  if (!db || !normalizedName) return [];

  const safeLimit = Math.max(1, Math.min(10, Number(limit) || 5));

  try {
    const result = await db
      .prepare(
        `
          SELECT
            p.user_id AS userId,
            p.display_name AS name,
            p.status AS status,
            p.memory_count AS memoryCount,
            p.latest_memory_at AS latestMemoryAt
          FROM admin_user_profiles p
          INNER JOIN admin_memory_entries m
            ON m.user_id = p.user_id
          WHERE m.memory_key = ?
            AND lower(m.memory_value) = ?
          GROUP BY
            p.user_id,
            p.display_name,
            p.status,
            p.memory_count,
            p.latest_memory_at
          ORDER BY
            p.memory_count DESC,
            COALESCE(p.latest_memory_at, 0) DESC,
            p.user_id ASC
          LIMIT ${safeLimit}
        `,
      )
      .bind(NAME_MEMORY_KEY, normalizedName)
      .all();

    const rows = Array.isArray(result?.results) ? result.results : [];
    return orderRecoveryCandidates(
      rows.map((row) => buildRecoveryCandidate(row, 'd1')).filter(Boolean),
    );
  } catch {
    return [];
  }
}

function getLatestNameValue(memories = []) {
  let latestName = '';
  let latestTimestamp = 0;

  for (const entry of memories) {
    if (normalizeSchemaText(entry?.key || '').toLowerCase() !== NAME_MEMORY_KEY)
      continue;

    const name = normalizeSchemaText(entry?.value || '');
    if (!name) continue;

    const timestamp = Math.max(
      0,
      Number.parseInt(String(entry?.timestamp), 10) || 0,
    );
    if (timestamp >= latestTimestamp) {
      latestTimestamp = timestamp;
      latestName = name;
    }
  }

  return latestName;
}

function summarizeMemories(memories = []) {
  let count = 0;
  let latestMemoryAt = 0;

  for (const entry of memories) {
    const value = normalizeSchemaText(entry?.value || '');
    if (!value) continue;
    count += 1;
    latestMemoryAt = Math.max(
      latestMemoryAt,
      Number.parseInt(String(entry?.timestamp), 10) || 0,
    );
  }

  return { count, latestMemoryAt };
}

async function loadRecoveryCandidatesFromKv(
  kv,
  normalizedName,
  { limit = 5, maxPages = MAX_KV_SCAN_PAGES } = {},
) {
  if (!kv?.list || !kv?.get || !normalizedName) return [];

  const matches = [];
  let cursor = undefined;
  let pages = 0;

  do {
    const page = await kv.list({
      prefix: FALLBACK_MEMORY_PREFIX,
      cursor,
      limit: 1000,
    });

    const keys = Array.isArray(page?.keys) ? page.keys : [];
    for (const key of keys) {
      const keyName = String(key?.name || '');
      const userId = normalizeUserId(
        keyName.slice(FALLBACK_MEMORY_PREFIX.length),
      );
      if (!userId) continue;

      let memories;
      try {
        const rawMemories = await kv.get(keyName);
        const parsed = JSON.parse(rawMemories || '[]');
        memories = Array.isArray(parsed) ? parsed : [];
      } catch {
        continue;
      }

      const name = getLatestNameValue(memories);
      if (normalizeRecoveryLookupName(name) !== normalizedName) continue;

      const summary = summarizeMemories(memories);
      const candidate = buildRecoveryCandidate(
        {
          userId,
          name,
          status: name ? 'identified' : 'anonymous',
          memoryCount: summary.count,
          latestMemoryAt: summary.latestMemoryAt,
        },
        'kv',
      );

      if (candidate) {
        matches.push(candidate);
      }
    }

    const listComplete = !!page?.list_complete;
    cursor = listComplete ? undefined : page?.cursor;
    pages += 1;
  } while (cursor && pages < maxPages && matches.length < limit * 3);

  return orderRecoveryCandidates(matches).slice(0, limit);
}

export async function findRecoveryCandidates(
  env,
  kv,
  name,
  { limit = 5 } = {},
) {
  const normalizedName = normalizeRecoveryLookupName(name);
  if (!normalizedName) return [];

  const fromDb = await loadRecoveryCandidatesFromAdminDb(
    env,
    normalizedName,
    limit,
  );
  if (fromDb.length > 0) return fromDb;

  return loadRecoveryCandidatesFromKv(kv, normalizedName, { limit });
}

export function pickAutoRecoveryCandidate(candidates = []) {
  const ordered = orderRecoveryCandidates(candidates);
  if (ordered.length === 1) return ordered[0] || null;

  const nonTrivial = ordered.filter(
    (candidate) => Number(candidate?.memoryCount || 0) > 1,
  );
  if (nonTrivial.length === 1) return nonTrivial[0] || null;

  const [top, second] = ordered;
  if (
    top &&
    second &&
    Number(top.memoryCount || 0) >= 3 &&
    Number(second.memoryCount || 0) <= 1
  ) {
    return top;
  }

  return null;
}
