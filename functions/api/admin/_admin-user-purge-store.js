import {
  generatePurgeConfirmationId,
  generatePurgeJobId,
} from '../_id-generator.js';

/**
 * Purge Job Store - KV-backed job tracking
 * @version 1.0.0
 */

const PURGE_CONFIRM_PREFIX = 'admin:purge-confirm:';
const PURGE_JOB_PREFIX = 'admin:purge-job:';
const PURGE_COOLDOWN_KEY = 'admin:purge-cooldown:next';
const PURGE_CONFIRM_TTL_MS = 2 * 60 * 1000;
const PURGE_JOB_TTL_SECONDS = 60 * 60 * 24;

export const PURGE_COOLDOWN_MS = 5 * 60 * 1000;
export const PURGE_STATUS_POLL_AFTER_MS = 1500;

const createPurgeToken = generatePurgeConfirmationId;

function createPurgeConfirmKey(token) {
  return `${PURGE_CONFIRM_PREFIX}${token}`;
}

function createPurgeJobKey(jobId) {
  return `${PURGE_JOB_PREFIX}${jobId}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizePurgeJobId(rawJobId) {
  return String(rawJobId || '')
    .trim()
    .replace(/[^a-z0-9_-]/gi, '')
    .slice(0, 80);
}

export function createPurgeJobId() {
  return generatePurgeJobId();
}

export function createInitialPurgeJob(jobId, auth) {
  return {
    jobId,
    status: 'queued',
    phase: 'queued',
    actor: auth?.actor || 'admin',
    sourceIp: auth?.sourceIp || '',
    text: 'Purge-Job wurde gestartet und wartet auf Ausführung.',
    progress: {
      prefixesTotal: 2,
      prefixesDone: 0,
      scannedKvKeys: 0,
      deletedKvKeys: 0,
      vectorizeUsersTotal: 0,
      vectorizeUsersProcessed: 0,
    },
    result: null,
    error: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    startedAt: '',
    finishedAt: '',
  };
}

async function readJsonFromKv(kv, key, fallback = null) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonToKv(kv, key, payload, ttlSeconds = null) {
  const value = JSON.stringify(payload);
  if (ttlSeconds && Number(ttlSeconds) > 0) {
    await kv.put(key, value, {
      expirationTtl: Math.max(1, Math.floor(Number(ttlSeconds))),
    });
    return;
  }
  await kv.put(key, value);
}

export async function readPurgeJob(kv, jobId) {
  const normalizedJobId = normalizePurgeJobId(jobId);
  if (!normalizedJobId) return null;
  return readJsonFromKv(kv, createPurgeJobKey(normalizedJobId), null);
}

export async function writePurgeJob(kv, job) {
  if (!job?.jobId) return;
  job.updatedAt = nowIso();
  await writeJsonToKv(
    kv,
    createPurgeJobKey(job.jobId),
    job,
    PURGE_JOB_TTL_SECONDS,
  );
}

export async function updatePurgeJob(kv, jobId, updater) {
  const current = await readPurgeJob(kv, jobId);
  if (!current) return null;
  const next =
    typeof updater === 'function'
      ? updater(current) || current
      : { ...current, ...updater };
  await writePurgeJob(kv, next);
  return next;
}

export async function createPurgeConfirmationToken(kv, auth) {
  const token = createPurgeToken();
  const expiresAtMs = Date.now() + PURGE_CONFIRM_TTL_MS;
  const payload = {
    actor: auth?.actor || 'admin',
    sourceIp: auth?.sourceIp || '',
    createdAt: nowIso(),
    expiresAtMs,
  };
  await writeJsonToKv(
    kv,
    createPurgeConfirmKey(token),
    payload,
    Math.ceil(PURGE_CONFIRM_TTL_MS / 1000),
  );
  return {
    token,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export async function consumePurgeConfirmationToken(kv, token, auth) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    return {
      ok: false,
      status: 400,
      text: 'Bestaetigungstoken fehlt.',
    };
  }

  const payload = await readJsonFromKv(
    kv,
    createPurgeConfirmKey(normalizedToken),
    null,
  );
  if (!payload) {
    return {
      ok: false,
      status: 400,
      text: 'Bestaetigungstoken ungueltig oder bereits verwendet.',
    };
  }

  await kv.delete(createPurgeConfirmKey(normalizedToken));

  if (payload.actor && payload.actor !== auth?.actor) {
    return {
      ok: false,
      status: 403,
      text: 'Bestaetigungstoken gehoert zu einer anderen Session.',
    };
  }

  const expiresAtMs = Number(payload.expiresAtMs) || 0;
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
    return {
      ok: false,
      status: 400,
      text: 'Bestaetigungstoken ist abgelaufen.',
    };
  }

  return {
    ok: true,
  };
}

export async function enforcePurgeCooldown(kv) {
  const now = Date.now();
  const nextAllowedRaw = await kv.get(PURGE_COOLDOWN_KEY);
  const nextAllowedAt = Number.parseInt(String(nextAllowedRaw || ''), 10);

  if (Number.isFinite(nextAllowedAt) && nextAllowedAt > now) {
    return {
      ok: false,
      retryAfterMs: nextAllowedAt - now,
    };
  }

  const next = now + PURGE_COOLDOWN_MS;
  await kv.put(PURGE_COOLDOWN_KEY, String(next), {
    expirationTtl: Math.ceil(PURGE_COOLDOWN_MS / 1000) + 60,
  });

  return {
    ok: true,
    nextAllowedAt: next,
  };
}
