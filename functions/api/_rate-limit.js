function createRateLimitToken() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID().replace(/-/g, '');
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeRateLimitIdentifier(identifier) {
  return String(identifier || 'unknown')
    .trim()
    .replace(/[^A-Za-z0-9._:-]/g, '_')
    .slice(0, 120);
}

function getRateLimitWindowState(windowSeconds) {
  const windowMs = Math.max(1, Number(windowSeconds || 0)) * 1000;
  const now = Date.now();
  const windowIndex = Math.floor(now / windowMs);
  const resetAt = (windowIndex + 1) * windowMs;

  return {
    bucketKey: String(windowIndex),
    resetAt,
    retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    ttlSeconds: Math.max(2, Math.ceil((resetAt - now) / 1000) + 1),
    windowMs,
  };
}

/**
 * @param {{
 *   cleanupIntervalMs?: number,
 *   keyNamespace: string,
 *   maxEntries?: number,
 * }} options
 * @returns {{
 *   check: (identifier: string, options: {
 *     kv?: KVNamespace | null,
 *     limit: number,
 *     windowSeconds: number,
 *   }) => Promise<{ allowed: boolean, remaining: number, retryAfter?: number }>,
 *   checkInMemory: (identifier: string, options: {
 *     limit: number,
 *     windowSeconds: number,
 *   }) => { allowed: boolean, remaining: number, retryAfter?: number },
 * }}
 */
export function createWindowRateLimiter(options) {
  const cleanupIntervalMs = Math.max(
    1,
    Number(options?.cleanupIntervalMs || 300_000),
  );
  const keyNamespace =
    String(options?.keyNamespace || 'rl:v2').trim() || 'rl:v2';
  const maxEntries = Math.max(100, Number(options?.maxEntries || 1000));
  const memoryStore = new Map();
  let lastCleanupAt = Date.now();

  function maybeCleanupStore(now) {
    if (
      memoryStore.size <= maxEntries &&
      now - lastCleanupAt < cleanupIntervalMs
    ) {
      return;
    }

    lastCleanupAt = now;
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt <= now) {
        memoryStore.delete(key);
      }
    }

    if (memoryStore.size > maxEntries) {
      memoryStore.clear();
    }
  }

  function checkInMemory(identifier, checkOptions) {
    const limit = Math.max(1, Number(checkOptions?.limit || 1));
    const windowState = getRateLimitWindowState(checkOptions?.windowSeconds);
    const normalizedIdentifier = normalizeRateLimitIdentifier(identifier);
    const now = Date.now();

    maybeCleanupStore(now);

    const entry = memoryStore.get(normalizedIdentifier);
    if (!entry || entry.resetAt <= now) {
      memoryStore.set(normalizedIdentifier, {
        count: 1,
        resetAt: now + windowState.windowMs,
      });
      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
      };
    }

    if (entry.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      };
    }

    entry.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, limit - entry.count),
    };
  }

  async function check(identifier, checkOptions) {
    const limit = Math.max(1, Number(checkOptions?.limit || 1));
    const kv = checkOptions?.kv;

    if (!kv?.put || !kv?.list) {
      return checkInMemory(identifier, checkOptions);
    }

    try {
      const normalizedIdentifier = normalizeRateLimitIdentifier(identifier);
      const windowState = getRateLimitWindowState(checkOptions?.windowSeconds);
      const keyPrefix = `${keyNamespace}:${normalizedIdentifier}:${windowState.bucketKey}:`;
      const requestKey = `${keyPrefix}${createRateLimitToken()}`;

      await kv.put(requestKey, '1', {
        expirationTtl: windowState.ttlSeconds,
      });

      const page = await kv.list({
        prefix: keyPrefix,
        limit: limit + 1,
      });
      const count = Array.isArray(page?.keys) ? page.keys.length : 0;

      if (count > limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfter: windowState.retryAfter,
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, limit - count),
      };
    } catch {
      return checkInMemory(identifier, checkOptions);
    }
  }

  return {
    check,
    checkInMemory,
  };
}
