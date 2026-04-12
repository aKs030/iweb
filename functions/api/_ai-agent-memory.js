import { createLogger } from '../../content/core/logger.js';
import { extractPromptMemoryFacts, promptNeedsMemoryRecall } from './_ai-agent-intent.js';
import {
  getMemoryKV,
  loadFallbackMemories,
  scoreFallbackMemoryEntry,
  saveFallbackMemorySingle
} from './_ai-agent-memory-store.js';

const log = createLogger('ai-agent-memory');

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

export async function storeMemory(env, userId, key, value, config) {
  log.debug('storeMemory called', { userId, key, value });
  const kvStored = await saveFallbackMemorySingle(env, userId, key, value);
  if (!env.AI || !env.JULES_MEMORY) {
    return kvStored
      ? { success: true, id: `kv_${Date.now()}`, storage: 'kv' }
      : { success: false };
  }

  try {
    const text = `${key}: ${value}`;
    const { data } = await env.AI.run(config.embeddingModel, { text: [text] });
    if (!data?.[0]) {
      return kvStored
        ? { success: true, id: `kv_${Date.now()}`, storage: 'kv' }
        : { success: false, error: 'Embedding failed' };
    }

    const id = `${userId}_${key}_${Date.now()}`;
    await env.JULES_MEMORY.upsert([
      {
        id,
        values: data[0],
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
    const { data } = await env.AI.run(config.embeddingModel, { text: [query] });
    if (!data?.[0]) {
      return recallMemoriesFromFallback(env, userId, query, {
        topK,
        scoreThreshold,
      });
    }

    const results = await env.JULES_MEMORY.query(data[0], {
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

export async function persistPromptMemories(env, userId, prompt, config) {
  const facts = extractPromptMemoryFacts(prompt);
  if (!facts.length) return [];

  const results = await Promise.allSettled(
    facts.map((fact) => storeMemory(env, userId, fact.key, fact.value, config)),
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

export async function resolveMemoryContext(env, userId, prompt, config) {
  // B. Memory-Context bei jedem Request optimiert!
  // Nur Namen und Intents abfragen, es sei denn der Recall Intent schlägt an
  const nameMem = await recallMemories(env, userId, 'name', config);
  if (nameMem.length > 0) return nameMem;

  // Optimize: Only do heavy memory queries if the prompt seems to need it
  // Check if there are memory facts to extract or explicit requests
  const hasExtractedFacts = extractPromptMemoryFacts(prompt).length > 0;
  const needsRecall = promptNeedsMemoryRecall(prompt);

  // If prompt needs recall or seems to have facts to store, do a primary search
  if (needsRecall || hasExtractedFacts) {
    const primary = await recallMemories(env, userId, prompt || 'user', config);
    if (primary.length > 0) return primary;
  }

  // Only run the extensive queries if explicitly looking for memory
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
