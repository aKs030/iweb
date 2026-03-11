import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_INDEX_NAME = 'jules-content-rag';
const DEFAULT_WAIT_RETRIES = 10;
const DEFAULT_WAIT_DELAY_MS = 2000;
const REQUIRED_METADATA_INDEXES = [
  { propertyName: 'sourceType', type: 'string' },
  { propertyName: 'category', type: 'string' },
];

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

function isFlagEnabled(name) {
  return process.argv.includes(name);
}

function parseInteger(value, fallback, { min = 0, max = 60_000 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveSyncUrl() {
  return String(
    getFlagValue('--url') ||
      process.env.RAG_SYNC_BASE_URL ||
      process.env.SITE_URL ||
      '',
  ).trim();
}

async function runCommand(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          [stdout.trim(), stderr.trim()].filter(Boolean).join('\n') ||
            `${command} exited with code ${code}`,
        ),
      );
    });
  });
}

async function runWrangler(args) {
  return await runCommand('npx', ['wrangler', ...args]);
}

function parseJsonOutput(stdout) {
  const trimmed = String(stdout || '').trim();
  const arrayStart = trimmed.indexOf('[');
  const objectStart = trimmed.indexOf('{');
  const start =
    arrayStart === -1
      ? objectStart
      : objectStart === -1
        ? arrayStart
        : Math.min(arrayStart, objectStart);

  if (start === -1) {
    throw new Error('Command did not return JSON output');
  }

  return JSON.parse(trimmed.slice(start));
}

async function listMetadataIndexes(indexName) {
  const { stdout } = await runWrangler([
    'vectorize',
    'list-metadata-index',
    indexName,
    '--json',
  ]);
  const parsed = parseJsonOutput(stdout);
  return Array.isArray(parsed) ? parsed : [];
}

async function createMetadataIndex(indexName, definition) {
  await runWrangler([
    'vectorize',
    'create-metadata-index',
    indexName,
    `--property-name=${definition.propertyName}`,
    `--type=${definition.type}`,
  ]);
}

async function waitForMetadataIndexes(indexName, propertyNames) {
  const retries = parseInteger(
    getFlagValue('--wait-retries') ||
      process.env.CONTENT_RAG_INDEX_WAIT_RETRIES,
    DEFAULT_WAIT_RETRIES,
    { min: 0, max: 60 },
  );
  const delayMs = parseInteger(
    getFlagValue('--wait-delay-ms') ||
      process.env.CONTENT_RAG_INDEX_WAIT_DELAY_MS,
    DEFAULT_WAIT_DELAY_MS,
    { min: 250, max: 60_000 },
  );

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const indexes = await listMetadataIndexes(indexName);
    const available = new Set(
      indexes.map((item) => String(item?.propertyName || '').trim()),
    );
    const missing = propertyNames.filter((name) => !available.has(name));
    if (missing.length === 0) return indexes;

    if (attempt < retries) {
      await sleep(delayMs);
      continue;
    }

    throw new Error(
      `Metadata indexes still missing after wait: ${missing.join(', ')}`,
    );
  }

  return [];
}

async function runFullSync(syncUrl) {
  const syncScriptPath = fileURLToPath(
    new URL('./sync-content-rag.mjs', import.meta.url),
  );
  const args = [syncScriptPath, `--url=${syncUrl}`, '--full'];
  const retries = getFlagValue('--sync-retries');
  const delayMs = getFlagValue('--sync-delay-ms');
  if (retries) args.push(`--retries=${retries}`);
  if (delayMs) args.push(`--delay-ms=${delayMs}`);

  const { stdout } = await runCommand(process.execPath, args, {
    env: process.env,
  });

  return JSON.parse(stdout.trim() || '{}');
}

async function main() {
  const indexName = String(
    getFlagValue('--index') ||
      process.env.CONTENT_RAG_INDEX_NAME ||
      DEFAULT_INDEX_NAME,
  ).trim();
  const skipSync = isFlagEnabled('--skip-sync');
  const syncUrl = resolveSyncUrl();
  const existingIndexes = await listMetadataIndexes(indexName);
  const existingByName = new Map(
    existingIndexes.map((item) => [
      String(item?.propertyName || '').trim(),
      String(item?.indexType || '')
        .trim()
        .toLowerCase(),
    ]),
  );

  const created = [];
  const reused = [];

  for (const definition of REQUIRED_METADATA_INDEXES) {
    const existingType = existingByName.get(definition.propertyName);
    if (existingType === definition.type) {
      reused.push(definition.propertyName);
      continue;
    }
    await createMetadataIndex(indexName, definition);
    created.push(definition.propertyName);
  }

  const readyIndexes = await waitForMetadataIndexes(
    indexName,
    REQUIRED_METADATA_INDEXES.map((item) => item.propertyName),
  );

  let sync = {
    attempted: false,
    reason: 'no sync URL provided',
  };

  if (!skipSync && syncUrl) {
    if (!String(process.env.ADMIN_TOKEN || '').trim()) {
      sync = {
        attempted: false,
        reason: 'ADMIN_TOKEN missing',
      };
    } else {
      sync = {
        attempted: true,
        url: syncUrl,
        result: await runFullSync(syncUrl),
      };
    }
  } else if (skipSync) {
    sync = {
      attempted: false,
      reason: 'skipped via --skip-sync',
    };
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        indexName,
        requiredIndexes: REQUIRED_METADATA_INDEXES,
        created,
        reused,
        available: readyIndexes,
        sync,
      },
      null,
      2,
    ),
  );
}

await main();
