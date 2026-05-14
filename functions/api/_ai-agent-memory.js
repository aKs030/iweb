import { createLogger } from '../../content/core/logger.js';
import { extractPromptMemoryFacts, promptNeedsMemoryRecall } from './_ai-agent-intent.js';
import {
  getMemoryKV,
  loadFallbackMemories,
  scoreFallbackMemoryEntry,
  saveFallbackMemorySingle
} from './_ai-agent-memory-store.js';

const log = createLogger('ai-agent-memory');

/**
 * Compute a single embedding vector for the given text.
 * Returns null when the AI binding or Vectorize is unavailable.
 * Callers can share one embedding across recall + persist to avoid
 * paying the embedding cost twice per chat turn.
 *
 * @param {object} env
 * @param {string} text
 * @param {object} config
 * @returns {Promise<number[]|null>}
 */
export async function computeEmbedding(env, text, config) {
  if (!env.AI || !text) return null;
  try {
    const { data } = await env.AI.run(config.embeddingModel, { text: [text] });
    return data?.[0] ?? null;
  } catch (error) {
    log.warn('computeEmbedding failed:', error?.message || error);
    return null;
  }
}

const DEFAULT_MAX_MEMORY_RESULTS = 5;

async function recallMemoriesFromFallback(
  env,
  userId,
  query,
  { topK = DEFAULT_MAX_MEMORY_RESULTS, scoreThreshold = 0 } = {},
) {
  const kv = getMemoryKV(env);
  const entries = await loadFallbackMemories(kv, userId, env);
  if (!entries.length) return [];

  return entries
    .map((entry) => ({
      ...entry,
      score: scoreFallbackMemoryEntry(entry, query),
    }))
    .filter((entry) => entry.score >= scoreThreshold)
    .sort((a, b) =>
      b.score === a.score ? b.timestamp - a.timestamp : b.score - a.score,
    )
    .slice(0, topK);
}

/**
 * Store a single memory fact in KV and (optionally) Vectorize.
 * Accepts an optional pre-computed embedding so the caller can share one
 * embedding across multiple store calls without redundant AI.run calls.
 *
 * @param {object} env
 * @param {string} userId
 * @param {string} key
 * @param {string} value
 * @param {object} config
 * @param {number[]|null} [precomputedEmbedding]
 * @returns {Promise<object>}
 */
export async function storeMemory(env, userId, key, value, config, precomputedEmbedding = null) {
  log.debug('storeMemory called', { userId, key, value });
  const kvStored = await saveFallbackMemorySingle(env, userId, key, value);
  if (!env.AI || !env.JULES_MEMORY) {
    return kvStored
      ? { success: true, id: `kv_${Date.now()}`, storage: 'kv' }
      : { success: false };
  }

  try {
    const text = `${key}: ${value}`;
    // Reuse a pre-computed embedding when provided to avoid an extra AI.run call.
    const embedding = precomputedEmbedding ?? (await computeEmbedding(env, text, config));
    if (!embedding) {
      return kvStored
        ? { success: true, id: `kv_${Date.now()}`, storage: 'kv' }
        : { success: false, error: 'Embedding failed' };
    }

    const id = `${userId}_${key}_${Date.now()}`;
    await env.JULES_MEMORY.upsert([
      {
        id,
        values: embedding,
        metadata: { userId, key, value, timestamp: Date.now(), text },
      },
    ]);
    return {
      success: true,
      id,
      storage: kvStored ? 'vectorize+kv' : 'vectorize',
    };
  } catch (error) {
    if (error?.remote) {
      return kvStored
        ? { success: true, id: `kv_${Date.now()}`, storage: 'kv' }
        : { success: false, error: 'Vectorize not available locally' };
    }
    log.error('storeMemory error:', error?.message || error);
    return kvStored
      ? { success: true, id: `kv_${Date.now()}`, storage: 'kv' }
      : { success: false, error: error.message };
  }
}

/**
 * Recall memories using a pre-computed embedding vector (preferred) or
 * a raw query string (falls back to recomputing or KV search).
 *
 * @param {object} env
 * @param {string} userId
 * @param {string} query
 * @param {object} config
 * @param {object} [options]
 * @param {number[]|null} [options.embedding] - Pre-computed embedding to reuse
 * @returns {Promise<object[]>}
 */
export async function recallMemories(env, userId, query, config, options = {}) {
  log.debug('recallMemories', { userId, query, options });
  const topK = Number.isFinite(options.topK)
    ? Math.max(1, Math.floor(options.topK))
    : config.maxMemoryResults;
  const scoreThreshold =
    typeof options.scoreThreshold === 'number'
      ? options.scoreThreshold
      : config.memoryScoreThreshold;

  if (!env.AI || !env.JULES_MEMORY) {
    return recallMemoriesFromFallback(env, userId, query, {
      topK,
      scoreThreshold,
    });
  }

  try {
    // Reuse a pre-computed embedding when provided to avoid a second AI.run call.
    const embedding = options.embedding ?? (await computeEmbedding(env, query, config));
    if (!embedding) {
      return recallMemoriesFromFallback(env, userId, query, {
        topK,
        scoreThreshold,
      });
    }

    const results = await env.JULES_MEMORY.query(embedding, {
      topK,
      filter: { userId },
      returnMetadata: 'all',
    });

    const vectorMemories = (results?.matches || [])
      .filter((m) => m.score >= scoreThreshold)
      .map((m) => ({
        key: m.metadata?.key || 'unknown',
        value: m.metadata?.value || '',
        score: m.score,
        timestamp: m.metadata?.timestamp || 0,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    if (vectorMemories.length > 0) return vectorMemories;

    return recallMemoriesFromFallback(env, userId, query, {
      topK,
      scoreThreshold,
    });
  } catch (error) {
    if (!error?.remote)
      log.warn('recallMemories error:', error?.message || error);
    return recallMemoriesFromFallback(env, userId, query, {
      topK,
      scoreThreshold,
    });
  }
}

/**
 * Extract memory facts from the prompt and store them.
 * Accepts an optional pre-computed embedding so the caller can share one
 * embedding across recall + persist without a second AI.run call.
 *
 * @param {object} env
 * @param {string} userId
 * @param {string} prompt
 * @param {object} config
 * @param {number[]|null} [sharedEmbedding]
 * @returns {Promise<object[]>}
 */
export async function persistPromptMemories(env, userId, prompt, config, sharedEmbedding = null) {
  const facts = extractPromptMemoryFacts(prompt);
  if (!facts.length) return [];

  const results = await Promise.allSettled(
    facts.map((fact) => storeMemory(env, userId, fact.key, fact.value, config, sharedEmbedding)),
  );

  return facts
    .map((fact, index) => ({ fact, result: results[index] }))
    .filter(
      (entry) =>
        entry.result.status === 'fulfilled' && entry.result.value?.success,
    )
    .map((entry) => ({
      key: entry.fact.key,
      value: entry.fact.value,
      score: 1,
      timestamp: Date.now(),
    }));
}

/**
 * Resolve memory context for the current prompt.
 * Accepts an optional pre-computed embedding so the AI.run call for embedding
 * is only made once when shared with persistPromptMemories.
 *
 * @param {object} env
 * @param {string} userId
 * @param {string} prompt
 * @param {object} config
 * @param {number[]|null} [sharedEmbedding]
 * @returns {Promise<object[]>}
 */
export async function resolveMemoryContext(env, userId, prompt, config, sharedEmbedding = null) {
  // Always attempt a name lookup first (cheap KV path when Vectorize is down).
  const nameMem = await recallMemories(env, userId, 'name', config, {
    embedding: sharedEmbedding,
  });
  if (nameMem.length > 0) return nameMem;

  const hasExtractedFacts = extractPromptMemoryFacts(prompt).length > 0;
  const needsRecall = promptNeedsMemoryRecall(prompt);

  if (needsRecall || hasExtractedFacts) {
    const primary = await recallMemories(env, userId, prompt || 'user', config, {
      embedding: sharedEmbedding,
    });
    if (primary.length > 0) return primary;
  }

  if (needsRecall) {
    const recallQueries = [
      'name',
      'interests',
      'preferences',
      'notes about this user',
    ];

    for (const query of recallQueries) {
      const fallback = await recallMemories(env, userId, query, config, {
        topK: Math.max(12, config.maxMemoryResults),
        scoreThreshold: 0,
        // Don't forward the shared embedding here – queries differ from the prompt.
      });
      if (fallback.length > 0) return fallback;
    }
  }

  return [];
}

export function mergeMemoryEntries(recalled = [], stored = []) {
  const merged = [...recalled];
  const seen = new Set(
    merged.map((entry) => `${entry.key}:${String(entry.value).toLowerCase()}`),
  );

  for (const item of stored) {
    const hash = `${item.key}:${String(item.value).toLowerCase()}`;
    if (seen.has(hash)) continue;
    seen.add(hash);
    merged.push(item);
  }

  return merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}
