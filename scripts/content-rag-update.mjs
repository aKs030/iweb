import { loadLocalEnv } from './load-local-env.mjs';
import {
  fetchJson,
  getFlagValue,
  isFlagEnabled,
  parseInteger,
  resolveUrl,
  sleep,
} from './script-utils.mjs';

const DEFAULT_BASE_URL = 'https://www.abdulkerimsesli.de';
const ENDPOINT_PATH = '/api/admin/content-rag';
const DEFAULT_RETRIES = 6;
const DEFAULT_DELAY_MS = 10000;
const argv = process.argv.slice(2);

function resolveBaseUrl() {
  return resolveUrl({
    argv,
    envKeys: ['CONTENT_RAG_UPDATE_BASE_URL', 'PRODUCTION_SITE_URL', 'SITE_URL'],
    defaultValue: DEFAULT_BASE_URL,
  });
}

function getMethod() {
  return isFlagEnabled('--status', argv) ? 'GET' : 'POST';
}

function getRetryConfig() {
  return {
    retries: parseInteger(
      getFlagValue('--retries') || process.env.CONTENT_RAG_UPDATE_RETRIES,
      DEFAULT_RETRIES,
      { min: 0, max: 20 },
    ),
    delayMs: parseInteger(
      getFlagValue('--delay-ms') || process.env.CONTENT_RAG_UPDATE_DELAY_MS,
      DEFAULT_DELAY_MS,
      { min: 250, max: 60000 },
    ),
  };
}

/**
 * @param {URL | string} endpoint
 * @param {string} method
 * @param {string} token
 */
async function performRequest(endpoint, method, token) {
  return await fetchJson(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function main() {
  await loadLocalEnv();

  const token = String(process.env.ADMIN_TOKEN || '').trim();
  if (!token) {
    console.error('ADMIN_TOKEN fehlt (.dev.vars/.env.local/.env geprueft).');
    process.exitCode = 1;
    return;
  }

  const baseUrl = resolveBaseUrl();
  const endpoint = new URL(ENDPOINT_PATH, baseUrl);
  if (
    getMethod() === 'POST' &&
    (isFlagEnabled('--full') || isFlagEnabled('--reindex'))
  ) {
    endpoint.searchParams.set('full', '1');
  }
  const method = getMethod();
  const retryConfig = getRetryConfig();
  let lastError = null;

  for (let attempt = 0; attempt <= retryConfig.retries; attempt += 1) {
    try {
      const { response, payload } = await performRequest(
        endpoint,
        method,
        token,
      );
      if (!response.ok) {
        const failure = {
          ok: false,
          status: response.status,
          endpoint: endpoint.toString(),
          payload,
          attempt: attempt + 1,
        };

        if (
          attempt < retryConfig.retries &&
          response.status >= 500 &&
          response.status < 600
        ) {
          lastError = failure;
          await sleep(retryConfig.delayMs);
          continue;
        }

        console.error(JSON.stringify(failure, null, 2));
        process.exitCode = 1;
        return;
      }

      console.log(
        JSON.stringify(
          {
            ok: true,
            method,
            endpoint: endpoint.toString(),
            attempt: attempt + 1,
            payload,
          },
          null,
          2,
        ),
      );
      return;
    } catch (error) {
      lastError = {
        ok: false,
        endpoint: endpoint.toString(),
        attempt: attempt + 1,
        error:
          error && typeof error === 'object' && 'message' in error
            ? String(error.message)
            : String(error),
      };
      if (attempt < retryConfig.retries) {
        await sleep(retryConfig.delayMs);
        continue;
      }
      console.error(JSON.stringify(lastError, null, 2));
      process.exitCode = 1;
      return;
    }
  }

  console.error(JSON.stringify(lastError, null, 2));
  process.exitCode = 1;
}

await main();
