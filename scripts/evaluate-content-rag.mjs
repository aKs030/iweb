import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8788';
const DEFAULT_DELAY_MS = 5000;
const DEFAULT_FIXTURE_PATH = fileURLToPath(
  new URL('../tests/fixtures/content-rag-evals.json', import.meta.url),
);
const DEFAULT_RETRIES = 4;
const ENDPOINT_PATH = '/api/admin/content-rag';

function getFlagValue(name) {
  const exactIndex = process.argv.findIndex((arg) => arg === name);
  if (exactIndex !== -1) {
    const next = process.argv[exactIndex + 1];
    if (next && !next.startsWith('--')) return next;
  }

  const prefix = `${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : '';
}

function parseInteger(value, fallback, { min = 0, max = 60_000 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function resolveBaseUrl() {
  return new URL(
    String(
      getFlagValue('--url') ||
        process.env.RAG_SYNC_BASE_URL ||
        process.env.SITE_URL ||
        DEFAULT_BASE_URL,
    ).trim(),
  );
}

function resolveFixturePath() {
  const customPath = String(getFlagValue('--file') || '').trim();
  return customPath
    ? path.resolve(process.cwd(), customPath)
    : DEFAULT_FIXTURE_PATH;
}

function getRetryConfig() {
  return {
    retries: parseInteger(
      getFlagValue('--retries') || process.env.RAG_EVAL_RETRIES,
      DEFAULT_RETRIES,
      { min: 0, max: 20 },
    ),
    delayMs: parseInteger(
      getFlagValue('--delay-ms') || process.env.RAG_EVAL_DELAY_MS,
      DEFAULT_DELAY_MS,
      { min: 250, max: 60_000 },
    ),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadCases(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Evaluation file must contain a non-empty JSON array');
  }
  return parsed;
}

async function fetchEvaluation(baseUrl, token, query) {
  const endpoint = new URL(ENDPOINT_PATH, baseUrl);
  endpoint.searchParams.set('query', query);
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return {
    endpoint,
    response,
    payload: await response.json().catch(() => null),
  };
}

async function fetchWithRetry(baseUrl, token, query, retryConfig) {
  let lastFailure = null;

  for (let attempt = 0; attempt <= retryConfig.retries; attempt += 1) {
    try {
      const result = await fetchEvaluation(baseUrl, token, query);
      if (result.response.ok) {
        return {
          ...result,
          attempt: attempt + 1,
        };
      }

      lastFailure = {
        attempt: attempt + 1,
        status: result.response.status,
        payload: result.payload,
      };
      if (
        attempt < retryConfig.retries &&
        result.response.status >= 500 &&
        result.response.status < 600
      ) {
        await sleep(retryConfig.delayMs);
        continue;
      }
      break;
    } catch (error) {
      lastFailure = {
        attempt: attempt + 1,
        error: error?.message || String(error),
      };
      if (attempt < retryConfig.retries) {
        await sleep(retryConfig.delayMs);
        continue;
      }
    }
  }

  throw new Error(
    `Evaluation request failed for "${query}": ${JSON.stringify(lastFailure)}`,
  );
}

function assertCase(caseDefinition, retrieval) {
  const errors = [];
  const sources = Array.isArray(retrieval?.sources) ? retrieval.sources : [];
  const matches = Array.isArray(retrieval?.matches) ? retrieval.matches : [];
  const topMatch = matches[0] || null;

  if (!retrieval) {
    errors.push('retrieval missing');
    return { errors, sources, matches, topMatch };
  }

  const allowedRetrievalModes = Array.isArray(
    caseDefinition.allowedRetrievalModes,
  )
    ? caseDefinition.allowedRetrievalModes
    : [];
  if (
    allowedRetrievalModes.length > 0 &&
    !allowedRetrievalModes.includes(retrieval.retrievalMode)
  ) {
    errors.push(
      `unexpected retrievalMode "${retrieval.retrievalMode}" (expected one of ${allowedRetrievalModes.join(', ')})`,
    );
  }

  const minimumSourceCount = parseInteger(
    caseDefinition.minimumSourceCount,
    1,
    { min: 0, max: 10 },
  );
  if (sources.length < minimumSourceCount) {
    errors.push(
      `expected at least ${minimumSourceCount} source link(s), got ${sources.length}`,
    );
  }

  const expectedSourceTypes = Array.isArray(caseDefinition.expectedSourceTypes)
    ? caseDefinition.expectedSourceTypes
    : [];
  if (
    expectedSourceTypes.length > 0 &&
    (!topMatch || !expectedSourceTypes.includes(topMatch.sourceType))
  ) {
    errors.push(
      `top match sourceType "${topMatch?.sourceType || 'missing'}" not in ${expectedSourceTypes.join(', ')}`,
    );
  }

  const expectedUrlIncludes = Array.isArray(caseDefinition.expectedUrlIncludes)
    ? caseDefinition.expectedUrlIncludes
    : [];
  if (
    expectedUrlIncludes.length > 0 &&
    !sources.some((source) =>
      expectedUrlIncludes.some((needle) =>
        String(source?.url || '').includes(needle),
      ),
    )
  ) {
    errors.push(
      `no source URL matched ${expectedUrlIncludes.map((value) => `"${value}"`).join(', ')}`,
    );
  }

  return { errors, sources, matches, topMatch };
}

async function main() {
  const token = String(process.env.ADMIN_TOKEN || '').trim();
  if (!token) {
    console.error('ADMIN_TOKEN fehlt.');
    process.exitCode = 1;
    return;
  }

  const baseUrl = resolveBaseUrl();
  const fixturePath = resolveFixturePath();
  const retryConfig = getRetryConfig();
  const cases = await loadCases(fixturePath);

  const results = [];
  for (const caseDefinition of cases) {
    const query = String(caseDefinition?.query || '').trim();
    const id = String(caseDefinition?.id || query).trim();
    if (!query) {
      results.push({
        id,
        ok: false,
        errors: ['query missing'],
      });
      continue;
    }

    try {
      const { payload, attempt, endpoint } = await fetchWithRetry(
        baseUrl,
        token,
        query,
        retryConfig,
      );
      const evaluation = assertCase(caseDefinition, payload?.retrieval);
      results.push({
        id,
        ok: evaluation.errors.length === 0,
        query,
        attempt,
        endpoint: endpoint.toString(),
        retrievalMode: payload?.retrieval?.retrievalMode || '',
        topSourceType: evaluation.topMatch?.sourceType || '',
        sourceUrls: evaluation.sources.map((source) => source.url),
        errors: evaluation.errors,
      });
    } catch (error) {
      results.push({
        id,
        ok: false,
        query,
        errors: [error?.message || String(error)],
      });
    }
  }

  const failures = results.filter((result) => !result.ok);
  for (const result of results) {
    const prefix = result.ok ? 'PASS' : 'FAIL';
    const details = [
      result.retrievalMode ? `mode=${result.retrievalMode}` : '',
      result.topSourceType ? `top=${result.topSourceType}` : '',
      Array.isArray(result.sourceUrls) && result.sourceUrls.length > 0
        ? `sources=${result.sourceUrls.join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join(' | ');
    console.log(`${prefix} ${result.id}${details ? ` | ${details}` : ''}`);
    for (const error of result.errors || []) {
      console.log(`  - ${error}`);
    }
  }

  console.log(
    `Summary: ${results.length - failures.length}/${results.length} passed`,
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

await main();
