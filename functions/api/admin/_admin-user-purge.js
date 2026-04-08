import { createValidationErrorResponse, jsonResponse } from './_admin-utils.js';
import { runPurgeEverythingJob } from './_admin-user-purge-runner.js';
import {
  createInitialPurgeJob,
  createPurgeConfirmationToken,
  createPurgeJobId,
  consumePurgeConfirmationToken,
  enforcePurgeCooldown,
  normalizePurgeJobId,
  PURGE_COOLDOWN_MS,
  PURGE_STATUS_POLL_AFTER_MS,
  readPurgeJob,
  writePurgeJob,
} from './_admin-user-purge-store.js';

async function handlePurgeConfirmationAction({ kv, auth }) {
  const confirmation = await createPurgeConfirmationToken(kv, auth);
  return jsonResponse({
    success: true,
    confirmToken: confirmation.token,
    expiresAt: confirmation.expiresAt,
    text: 'Bestaetigungstoken erstellt. Bitte purge-everything sofort ausfuehren.',
  });
}

async function handlePurgeStatusAction({ body, kv }) {
  const jobId = normalizePurgeJobId(body?.jobId);
  if (!jobId) return createValidationErrorResponse('Job-ID fehlt.');

  const job = await readPurgeJob(kv, jobId);
  if (!job) {
    return jsonResponse(
      {
        success: false,
        text: 'Purge-Job nicht gefunden oder bereits abgelaufen.',
      },
      404,
    );
  }

  return jsonResponse({
    success: true,
    job,
    pollAfterMs: PURGE_STATUS_POLL_AFTER_MS,
  });
}

function createPurgeCooldownResponse(retryAfterMs) {
  const retryAfterSec = Math.max(
    1,
    Math.ceil((retryAfterMs || PURGE_COOLDOWN_MS) / 1000),
  );
  const headers = new Headers();
  headers.set('Retry-After', String(retryAfterSec));

  return jsonResponse(
    {
      success: false,
      text: `Purge ist aktuell gesperrt. Bitte in ${retryAfterSec}s erneut versuchen.`,
    },
    429,
    headers,
  );
}

async function handlePurgeEverythingAction({ body, kv, env, auth, waitUntil }) {
  const confirmationResult = await consumePurgeConfirmationToken(
    kv,
    body?.confirmToken,
    auth,
  );
  if (!confirmationResult.ok) {
    return jsonResponse(
      {
        success: false,
        text: confirmationResult.text,
      },
      confirmationResult.status || 400,
    );
  }

  const cooldown = await enforcePurgeCooldown(kv);
  if (!cooldown.ok) {
    return createPurgeCooldownResponse(cooldown.retryAfterMs);
  }

  const jobId = createPurgeJobId();
  await writePurgeJob(kv, createInitialPurgeJob(jobId, auth));

  const backgroundTask = runPurgeEverythingJob(kv, env, jobId, auth);
  if (typeof waitUntil === 'function') {
    waitUntil(backgroundTask);
  } else {
    await backgroundTask;
  }

  return jsonResponse({
    success: true,
    jobId,
    status: 'queued',
    pollAfterMs: PURGE_STATUS_POLL_AFTER_MS,
    text: 'Purge-Job wurde gestartet.',
  });
}

const PURGE_ACTION_HANDLERS = Object.freeze({
  'request-purge-everything-confirmation': handlePurgeConfirmationAction,
  'purge-everything-status': handlePurgeStatusAction,
  'purge-everything': handlePurgeEverythingAction,
});

export async function handlePurgeAdminAction(request) {
  const handler = PURGE_ACTION_HANDLERS[request.action];
  if (!handler) return null;
  return handler(request);
}
