import { jsonResponse as buildJsonResponse } from '../_response.js';
import { getRequestClientIp } from '../_request-utils.js';

const ADMIN_SESSION_COOKIE_NAME = 'admin_session';
const DEFAULT_ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

export function jsonResponse(payload, status = 200, headers = undefined) {
  return buildJsonResponse(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(headers instanceof Headers
        ? Object.fromEntries(headers.entries())
        : headers),
    },
  });
}

export function createValidationErrorResponse(text) {
  return jsonResponse(
    {
      success: false,
      text,
    },
    400,
  );
}

function getRequestHeaderValue(request, headerName) {
  return String(request.headers.get(headerName) || '').trim();
}

function getAdminSourceIp(request) {
  return getRequestClientIp(request);
}

function getExpectedAdminToken(env) {
  return String(env?.ADMIN_TOKEN || '').trim();
}

function createAdminAuthResult({
  ok,
  sourceIp,
  response = null,
  actor = 'admin',
  authType = undefined,
}) {
  return {
    ok,
    actor,
    authType,
    sourceIp,
    response,
  };
}

function createAdminConfigErrorResponse() {
  return jsonResponse(
    {
      error: 'Admin configuration error: ADMIN_TOKEN is missing',
      code: 'admin_token_missing',
    },
    500,
  );
}

function createUnauthorizedAdminResponse() {
  return jsonResponse(
    {
      error: 'Unauthorized',
      code: 'unauthorized',
    },
    401,
  );
}

function createUnauthorizedAdminResult(sourceIp) {
  return createAdminAuthResult({
    ok: false,
    sourceIp,
    response: createUnauthorizedAdminResponse(),
  });
}

function createAdminConfigErrorResult(sourceIp) {
  return createAdminAuthResult({
    ok: false,
    sourceIp,
    response: createAdminConfigErrorResponse(),
  });
}

function createAuthorizedAdminResult(sourceIp, authType, actor = 'admin') {
  return createAdminAuthResult({
    ok: true,
    actor,
    authType,
    sourceIp,
  });
}

function hasBearerAdminAuth(request, expectedToken) {
  return (
    getRequestHeaderValue(request, 'Authorization') ===
    `Bearer ${expectedToken}`
  );
}

async function authorizeAdminSession(request, env, sourceIp) {
  const sessionToken = readCookieValue(
    request.headers.get('Cookie'),
    ADMIN_SESSION_COOKIE_NAME,
  );
  if (!sessionToken) return null;

  const session = await verifyAdminSessionToken(env, sessionToken);
  if (!session.ok) return null;

  return createAuthorizedAdminResult(
    sourceIp,
    'session',
    String(session.payload?.actor || 'admin'),
  );
}

export function getErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  return String(error || 'Unknown error');
}

export function parseInteger(value, fallback, { min = 1, max = 1000 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isSecureRequest(request) {
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}

function readCookieValue(cookieHeader, cookieName) {
  const entries = String(cookieHeader || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex <= 0) continue;

    const name = entry.slice(0, separatorIndex).trim();
    if (name !== cookieName) continue;

    const rawValue = entry.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return '';
}

function toBase64Url(value) {
  const bytes =
    typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding =
    normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function importAdminSessionKey(env) {
  const secret = String(
    env?.ADMIN_SESSION_SECRET || env?.ADMIN_TOKEN || '',
  ).trim();
  if (!secret) return null;

  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function createAdminSessionToken(env, ttlSeconds) {
  const key = await importAdminSessionKey(env);
  if (!key) return '';

  const issuedAt = Date.now();
  const payload = {
    iat: issuedAt,
    exp: issuedAt + ttlSeconds * 1000,
    actor: 'admin',
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(encodedPayload),
  );

  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verifyAdminSessionToken(env, token) {
  const [encodedPayload, encodedSignature] = String(token || '').split('.');
  if (!encodedPayload || !encodedSignature) {
    return { ok: false, code: 'malformed' };
  }

  const key = await importAdminSessionKey(env);
  if (!key) return { ok: false, code: 'missing_secret' };

  try {
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(encodedSignature),
      new TextEncoder().encode(encodedPayload),
    );
    if (!isValid) return { ok: false, code: 'invalid_signature' };

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encodedPayload)),
    );
    if (!payload?.exp || Number(payload.exp) <= Date.now()) {
      return { ok: false, code: 'expired' };
    }

    return {
      ok: true,
      payload,
    };
  } catch {
    return { ok: false, code: 'invalid_payload' };
  }
}

export async function buildAdminSessionCookie(request, env) {
  const ttlSeconds = parseInteger(
    env?.ADMIN_SESSION_MAX_AGE,
    DEFAULT_ADMIN_SESSION_MAX_AGE,
    {
      min: 60,
      max: 60 * 60 * 24 * 30,
    },
  );
  const token = await createAdminSessionToken(env, ttlSeconds);
  if (!token) return buildAdminSessionClearCookie(request);

  const parts = [
    `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${ttlSeconds}`,
    'SameSite=Lax',
    'HttpOnly',
  ];

  if (isSecureRequest(request)) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function buildAdminSessionClearCookie(request) {
  const parts = [
    `${ADMIN_SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'SameSite=Lax',
    'HttpOnly',
  ];

  if (isSecureRequest(request)) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export async function authorizeAdmin(request, env) {
  const sourceIp = getAdminSourceIp(request);
  const expectedToken = getExpectedAdminToken(env);
  if (!expectedToken) return createAdminConfigErrorResult(sourceIp);

  if (hasBearerAdminAuth(request, expectedToken)) {
    return createAuthorizedAdminResult(sourceIp, 'bearer');
  }

  const sessionAuth = await authorizeAdminSession(request, env, sourceIp);
  return sessionAuth || createUnauthorizedAdminResult(sourceIp);
}

export function parsePaginationParams(
  url,
  prefix,
  { defaultPage = 1, defaultPageSize = 10, maxPageSize = 100 } = {},
) {
  return {
    page: parseInteger(url.searchParams.get(`${prefix}Page`), defaultPage, {
      min: 1,
      max: 10_000,
    }),
    pageSize: parseInteger(
      url.searchParams.get(`${prefix}PageSize`),
      defaultPageSize,
      {
        min: 1,
        max: maxPageSize,
      },
    ),
  };
}

export function paginateArray(items, { page = 1, pageSize = 10 } = {}) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: list.slice(start, end),
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
      hasPreviousPage: safePage > 1,
      hasNextPage: safePage < totalPages,
    },
  };
}

export function normalizeSearch(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function includesSearch(values, search) {
  const needle = normalizeSearch(search);
  if (!needle) return true;

  return values.some((value) => normalizeSearch(value).includes(needle));
}

const ADMIN_AUDIT_INSERT_SQL = `
  INSERT INTO admin_audit_log (
    action,
    target_user_id,
    memory_key,
    status,
    summary,
    details_json,
    actor,
    source_ip,
    before_json,
    after_json
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function getAdminAuditDb(env) {
  return env?.DB_LIKES?.prepare ? env.DB_LIKES : null;
}

function createAuditLogMissingBindingResult() {
  return {
    ok: false,
    skipped: true,
    code: 'missing_binding',
  };
}

function createAuditLogSuccessResult() {
  return { ok: true, skipped: false };
}

function stringifyAuditString(value, fallback = '') {
  return String(value || fallback);
}

function stringifyAuditJson(value, fallback = {}) {
  return JSON.stringify(value || fallback);
}

function stringifyOptionalAuditJson(value) {
  return value ? JSON.stringify(value) : null;
}

function createAuditLogIdentityBindings(entry) {
  return [
    stringifyAuditString(entry?.action, 'unknown'),
    stringifyAuditString(entry?.targetUserId),
    stringifyAuditString(entry?.memoryKey),
    stringifyAuditString(entry?.status, 'success'),
  ];
}

function createAuditLogMetadataBindings(entry) {
  return [
    stringifyAuditString(entry?.summary),
    stringifyAuditJson(entry?.details),
    stringifyAuditString(entry?.actor, 'admin'),
    stringifyAuditString(entry?.sourceIp),
  ];
}

function createAuditLogSnapshotBindings(entry) {
  return [
    stringifyOptionalAuditJson(entry?.before),
    stringifyOptionalAuditJson(entry?.after),
  ];
}

function createAuditLogBindings(entry) {
  return [
    ...createAuditLogIdentityBindings(entry),
    ...createAuditLogMetadataBindings(entry),
    ...createAuditLogSnapshotBindings(entry),
  ];
}

function isMissingAuditTableError(error) {
  return /no such table|no such column/i.test(getErrorMessage(error));
}

function createAuditLogFailureResult(error) {
  return {
    ok: false,
    skipped: false,
    code: isMissingAuditTableError(error) ? 'missing_table' : 'write_failed',
    error,
  };
}

export async function writeAdminAuditLog(env, entry) {
  const db = getAdminAuditDb(env);
  if (!db) return createAuditLogMissingBindingResult();

  try {
    await db
      .prepare(ADMIN_AUDIT_INSERT_SQL)
      .bind(...createAuditLogBindings(entry))
      .run();
    return createAuditLogSuccessResult();
  } catch (error) {
    return createAuditLogFailureResult(error);
  }
}
