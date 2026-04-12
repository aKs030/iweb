import { createLogger } from '../../content/core/logger.js';
import {
  DEFAULT_ROBOT_MEMORY_CATEGORY,
  DEFAULT_ROBOT_MEMORY_PRIORITY,
  ROBOT_MEMORY_METADATA,
  ROBOT_MEMORY_SINGLETON_KEYS,
} from '../../content/core/robot-memory-schema.js';

const log = createLogger('ai-agent-memory-store');

export const FALLBACK_MEMORY_PREFIX = 'robot-memory:';
export const DEFAULT_MEMORY_RETENTION_DAYS = 180;
export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const MEMORY_KEY_METADATA = ROBOT_MEMORY_METADATA;

export const DEFAULT_MEMORY_CATEGORY = DEFAULT_ROBOT_MEMORY_CATEGORY;
export const DEFAULT_MEMORY_PRIORITY = DEFAULT_ROBOT_MEMORY_PRIORITY;

export const SINGLETON_MEMORY_KEYS = ROBOT_MEMORY_SINGLETON_KEYS;

export function getMemoryRetentionMs(env) {
  const days = Number.parseInt(String(env?.ROBOT_MEMORY_RETENTION_DAYS || ''), 10);
  if (Number.isFinite(days) && days > 0) return days * DAY_IN_MS;
  return DEFAULT_MEMORY_RETENTION_DAYS * DAY_IN_MS;
}

export function getMemoryKey(userId) {
  return `${FALLBACK_MEMORY_PREFIX}${String(userId || 'anonymous')}`;
}

export function getMemoryKV(env) {
  if (env?.JULES_MEMORY_KV?.get && env?.JULES_MEMORY_KV?.delete) {
    return env.JULES_MEMORY_KV;
  }
  if (env?.RATE_LIMIT_KV?.get && env?.RATE_LIMIT_KV?.delete) {
    return env.RATE_LIMIT_KV;
  }
  if (env?.SITEMAP_CACHE_KV?.get && env?.SITEMAP_CACHE_KV?.delete) {
    return env.SITEMAP_CACHE_KV;
  }
  return null;
}

export function normalizeMemoryText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeMemoryKey(rawKey) {
  return String(rawKey || 'note')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 30);
}

export function resolveMemoryMetadata(key, category, priority) {
  const normalizedKey = normalizeMemoryKey(key);
  const metadata = MEMORY_KEY_METADATA[normalizedKey] || {
    category: DEFAULT_MEMORY_CATEGORY,
    priority: DEFAULT_MEMORY_PRIORITY,
  };

  const finalCategory =
    typeof category === 'string' && category.trim()
      ? category.trim().toLowerCase()
      : metadata.category;

  const parsedPriority = Number.parseInt(String(priority), 10);
  const finalPriority = Number.isFinite(parsedPriority)
    ? parsedPriority
    : metadata.priority;

  const normalizedPriority = Math.min(100, Math.max(0, finalPriority));

  return {
    key: normalizedKey,
    category: finalCategory,
    priority: normalizedPriority,
  };
}

export function normalizeMemoryEntry(entry, now, retentionMs) {
  const ts = Number(entry?.timestamp);
  const timestamp = Number.isFinite(ts) && ts > 0 ? ts : now;
  const metadata = resolveMemoryMetadata(
    entry?.key,
    entry?.category,
    entry?.priority,
  );

  return {
    ...metadata,
    value: normalizeMemoryText(entry?.value || ''),
    timestamp,
    expiresAt: timestamp + retentionMs,
  };
}

export function compactMemories(entries, now, retentionMs) {
  const unique = new Map();
  for (const rawEntry of entries) {
    const entry = normalizeMemoryEntry(rawEntry, now, retentionMs);
    if (!entry.value) continue;
    if (now - entry.timestamp > retentionMs) continue;

    const hash = SINGLETON_MEMORY_KEYS.has(entry.key)
      ? entry.key
      : `${entry.key}:${entry.value.toLowerCase()}`;
    const existing = unique.get(hash);
    if (
      !existing ||
      entry.timestamp > existing.timestamp ||
      (entry.timestamp === existing.timestamp &&
        entry.priority > existing.priority)
    ) {
      unique.set(hash, entry);
    }
  }
  return [...unique.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export function compactMemoryEntries(entries = [], env, now = Date.now()) {
  return compactMemories(entries, now, getMemoryRetentionMs(env));
}

export async function loadFallbackMemories(
  kv,
  userId,
  env,
  { persistPruned = false } = {},
) {
  if (!kv?.get) return [];

  try {
    const raw = await kv.get(getMemoryKey(userId));
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    const retentionMs = getMemoryRetentionMs(env);
    const compacted = compactMemories(parsed, now, retentionMs);

    if (persistPruned && kv?.put) {
      const compactedJson = JSON.stringify(compacted);
      if ((raw || '[]') !== compactedJson) {
        await kv.put(getMemoryKey(userId), compactedJson);
      }
    }

    return compacted;
  } catch {
    return [];
  }
}

export async function saveFallbackMemories(kv, userId, memories, env) {
  if (!kv?.put) return false;

  try {
    const now = Date.now();
    const retentionMs = getMemoryRetentionMs(env);
    const compacted = compactMemories(memories, now, retentionMs);
    await kv.put(getMemoryKey(userId), JSON.stringify(compacted));
    return true;
  } catch {
    return false;
  }
}

export function scoreFallbackMemoryEntry(entry, query) {
  const haystack = `${entry.key} ${entry.value}`.toLowerCase();
  const normalizedQuery = normalizeMemoryText(query).toLowerCase();
  if (!normalizedQuery) return 0.5;

  if (haystack.includes(normalizedQuery)) return 1;

  const terms = normalizedQuery.split(/\s+/).filter((term) => term.length >= 2);
  if (terms.length === 0) return 0.4;

  let hits = 0;
  for (const term of terms) {
    if (haystack.includes(term)) hits += 1;
  }
  return hits / terms.length;
}

export async function saveFallbackMemorySingle(env, userId, key, value) {
  const kv = getMemoryKV(env);
  if (!kv?.get || !kv?.put) return false;

  const cleanedKey = normalizeMemoryKey(key);
  const cleanedValue = normalizeMemoryText(value);
  if (!cleanedValue) return false;

  try {
    const existing = await loadFallbackMemories(kv, userId, env);
    existing.push({
      key: cleanedKey,
      value: cleanedValue,
      timestamp: Date.now(),
    });
    return await saveFallbackMemories(kv, userId, existing, env);
  } catch {
    return false;
  }
}
