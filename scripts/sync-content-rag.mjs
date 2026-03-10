const DEFAULT_BASE_URL = "http://127.0.0.1:8788";
const ENDPOINT_PATH = "/api/admin/content-rag";
const DEFAULT_RETRIES = 6;
const DEFAULT_DELAY_MS = 10000;

function getFlagValue(name) {
  const exactIndex = process.argv.findIndex((arg) => arg === name);
  if (exactIndex !== -1) {
    const next = process.argv[exactIndex + 1];
    if (next && !next.startsWith("--")) return next;
  }

  const prefix = `${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : "";
}

function parseInteger(value, fallback, { min = 0, max = 60 } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function resolveBaseUrl() {
  const value =
    getFlagValue("--url") ||
    process.env.RAG_SYNC_BASE_URL ||
    process.env.SITE_URL ||
    DEFAULT_BASE_URL;

  return new URL(value);
}

function getMethod() {
  return process.argv.includes("--status") ? "GET" : "POST";
}

function isFlagEnabled(name) {
  return process.argv.includes(name);
}

function getRetryConfig() {
  return {
    retries: parseInteger(
      getFlagValue("--retries") || process.env.RAG_SYNC_RETRIES,
      DEFAULT_RETRIES,
      { min: 0, max: 20 },
    ),
    delayMs: parseInteger(
      getFlagValue("--delay-ms") || process.env.RAG_SYNC_DELAY_MS,
      DEFAULT_DELAY_MS,
      { min: 250, max: 60000 },
    ),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function performRequest(endpoint, method, token) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null);
  return {
    response,
    payload,
  };
}

function getExpectedCommitSha() {
  return String(
    getFlagValue("--wait-for-commit") ||
      process.env.RAG_SYNC_WAIT_FOR_COMMIT ||
      "",
  )
    .trim()
    .toLowerCase();
}

function getRuntimeCommitSha(payload) {
  return String(payload?.runtime?.commitSha || "")
    .trim()
    .toLowerCase();
}

async function waitForExpectedCommit(
  endpoint,
  token,
  retryConfig,
  expectedCommitSha,
) {
  if (!expectedCommitSha) {
    return null;
  }

  for (let attempt = 0; attempt <= retryConfig.retries; attempt += 1) {
    try {
      const { response, payload } = await performRequest(
        endpoint,
        "GET",
        token,
      );
      const runtimeCommitSha = getRuntimeCommitSha(payload);
      if (response.ok && runtimeCommitSha === expectedCommitSha) {
        return {
          ok: true,
          status: response.status,
          payload,
          attempt: attempt + 1,
        };
      }

      const failure = {
        ok: false,
        status: response.status,
        endpoint: endpoint.toString(),
        payload,
        attempt: attempt + 1,
        expectedCommitSha,
        runtimeCommitSha,
      };

      if (attempt < retryConfig.retries) {
        await sleep(retryConfig.delayMs);
        continue;
      }

      console.error(JSON.stringify(failure, null, 2));
      process.exitCode = 1;
      return null;
    } catch (error) {
      const failure = {
        ok: false,
        endpoint: endpoint.toString(),
        attempt: attempt + 1,
        expectedCommitSha,
        error: error?.message || String(error),
      };
      if (attempt < retryConfig.retries) {
        await sleep(retryConfig.delayMs);
        continue;
      }
      console.error(JSON.stringify(failure, null, 2));
      process.exitCode = 1;
      return null;
    }
  }

  return null;
}

async function main() {
  const token = String(process.env.ADMIN_TOKEN || "").trim();
  if (!token) {
    console.error("ADMIN_TOKEN fehlt.");
    process.exitCode = 1;
    return;
  }

  const baseUrl = resolveBaseUrl();
  const endpoint = new URL(ENDPOINT_PATH, baseUrl);
  if (
    getMethod() === "POST" &&
    (isFlagEnabled("--full") || isFlagEnabled("--reindex"))
  ) {
    endpoint.searchParams.set("full", "1");
  }
  const method = getMethod();
  const retryConfig = getRetryConfig();
  const expectedCommitSha = getExpectedCommitSha();
  let lastError = null;

  const waitedStatus = await waitForExpectedCommit(
    endpoint,
    token,
    retryConfig,
    expectedCommitSha,
  );
  if (expectedCommitSha && !waitedStatus) {
    return;
  }

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
          expectedCommitSha,
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
            waitedForCommit: expectedCommitSha || null,
            statusBeforeSync: waitedStatus,
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
        expectedCommitSha,
        error: error?.message || String(error),
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
