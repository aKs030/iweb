const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

const ADMIN_SESSION_COOKIE_NAME = 'admin_session';
const DEFAULT_ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

export function jsonResponse(payload, status = 200, headers = undefined) {
  const responseHeaders = new Headers(JSON_HEADERS);
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      responseHeaders.append(key, value);
    });
  } else if (headers && typeof headers === 'object') {
    Object.entries(headers).forEach(([key, value]) => {
      responseHeaders.append(key, String(value));
    });
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders,
  });
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
  const expectedToken = String(env?.ADMIN_TOKEN || '').trim();
  if (!expectedToken) {
    return {
      ok: false,
      actor: 'admin',
      sourceIp: String(request.headers.get('CF-Connecting-IP') || '').trim(),
      response: jsonResponse(
        {
          error: 'Admin configuration error: ADMIN_TOKEN is missing',
          code: 'admin_token_missing',
        },
        500,
      ),
    };
  }

  const sourceIp = String(request.headers.get('CF-Connecting-IP') || '').trim();
  const authHeader = String(request.headers.get('Authorization') || '').trim();
  if (authHeader === `Bearer ${expectedToken}`) {
    return {
      ok: true,
      actor: 'admin',
      authType: 'bearer',
      sourceIp,
      response: null,
    };
  }

  const sessionToken = readCookieValue(
    request.headers.get('Cookie'),
    ADMIN_SESSION_COOKIE_NAME,
  );
  if (sessionToken) {
    const session = await verifyAdminSessionToken(env, sessionToken);
    if (session.ok) {
      return {
        ok: true,
        actor: String(session.payload?.actor || 'admin'),
        authType: 'session',
        sourceIp,
        response: null,
      };
    }
  }

  return {
    ok: false,
    actor: 'admin',
    sourceIp,
    response: jsonResponse(
      {
        error: 'Unauthorized',
        code: 'unauthorized',
      },
      401,
    ),
  };
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

export async function writeAdminAuditLog(env, entry) {
  const db = env?.DB_LIKES;
  if (!db?.prepare) {
    return {
      ok: false,
      skipped: true,
      code: 'missing_binding',
    };
  }

  try {
    await db
      .prepare(
        `
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
        `,
      )
      .bind(
        String(entry?.action || 'unknown'),
        String(entry?.targetUserId || ''),
        String(entry?.memoryKey || ''),
        String(entry?.status || 'success'),
        String(entry?.summary || ''),
        JSON.stringify(entry?.details || {}),
        String(entry?.actor || 'admin'),
        String(entry?.sourceIp || ''),
        entry?.before ? JSON.stringify(entry.before) : null,
        entry?.after ? JSON.stringify(entry.after) : null,
      )
      .run();

    return { ok: true, skipped: false };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      code: /no such table|no such column/i.test(getErrorMessage(error))
        ? 'missing_table'
        : 'write_failed',
      error,
    };
  }
}
