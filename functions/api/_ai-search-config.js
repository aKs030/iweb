const MAX_RESULTS_CAP = 20;
const MIN_RESULTS = 1;
const MIN_SCORE_THRESHOLD = 0;
const MAX_SCORE_THRESHOLD = 1;

const DEFAULT_CONFIG = Object.freeze({
  maxResults: 10,
  contextMaxResults: 6,
  scoreThreshold: 0.25,
  rewriteQuery: true,
  rerankingEnabled: true,
  rerankingModel: '@cf/baai/bge-reranker-base',
});

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes' ||
    normalized === 'on'
  ) {
    return true;
  }
  if (
    normalized === 'false' ||
    normalized === '0' ||
    normalized === 'no' ||
    normalized === 'off'
  ) {
    return false;
  }

  return fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function clampResults(value, fallback, cap = MAX_RESULTS_CAP) {
  const upperBound = Math.max(MIN_RESULTS, cap);
  const candidate =
    parsePositiveInteger(value) ??
    parsePositiveInteger(fallback) ??
    DEFAULT_CONFIG.maxResults;
  return clamp(candidate, MIN_RESULTS, upperBound);
}

export function resolveAiSearchConfig(env = {}) {
  const maxResults = clampResults(
    parsePositiveInteger(env.AI_SEARCH_MAX_RESULTS) ??
      parsePositiveInteger(env.MAX_SEARCH_RESULTS) ??
      DEFAULT_CONFIG.maxResults,
    DEFAULT_CONFIG.maxResults,
  );

  const contextFallback = Math.min(
    maxResults,
    DEFAULT_CONFIG.contextMaxResults,
  );
  const contextMaxResults = clampResults(
    parsePositiveInteger(env.AI_SEARCH_CONTEXT_MAX_RESULTS) ?? contextFallback,
    contextFallback,
    maxResults,
  );

  const scoreThreshold = clamp(
    parseFiniteNumber(env.AI_SEARCH_SCORE_THRESHOLD) ??
      DEFAULT_CONFIG.scoreThreshold,
    MIN_SCORE_THRESHOLD,
    MAX_SCORE_THRESHOLD,
  );

  const rewriteQuery = parseBoolean(
    env.AI_SEARCH_REWRITE_QUERY,
    DEFAULT_CONFIG.rewriteQuery,
  );

  const rerankingEnabled = parseBoolean(
    env.AI_SEARCH_RERANKING_ENABLED,
    DEFAULT_CONFIG.rerankingEnabled,
  );

  const rerankingModel =
    String(
      env.AI_SEARCH_RERANKING_MODEL || DEFAULT_CONFIG.rerankingModel,
    ).trim() || DEFAULT_CONFIG.rerankingModel;

  return {
    maxResults,
    contextMaxResults,
    scoreThreshold,
    rewriteQuery,
    rerankingEnabled,
    rerankingModel,
  };
}

export function buildAiSearchRequest({
  query,
  maxResults,
  config,
  systemPrompt,
  stream = false,
  hybrid = true,
}) {
  const resolvedConfig = config || resolveAiSearchConfig();
  const payload = {
    query,
    max_num_results: clampResults(
      maxResults,
      resolvedConfig.maxResults,
      resolvedConfig.maxResults,
    ),
    stream: Boolean(stream),
    hybrid: Boolean(hybrid),
    rewrite_query: resolvedConfig.rewriteQuery,
    ranking_options: {
      score_threshold: resolvedConfig.scoreThreshold,
    },
  };

  if (systemPrompt) {
    payload.system_prompt = systemPrompt;
  }

  if (resolvedConfig.rerankingEnabled) {
    payload.reranking = {
      enabled: true,
      model: resolvedConfig.rerankingModel,
    };
  }

  return payload;
}
