import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = process.env.PORT || '8080';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const LOG_PATH = 'server.log';
const STARTUP_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 1_000;

const ENDPOINTS = [
  '/',
  '/pages/about/index.html',
  '/pages/projekte/index.html',
];

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const logStream = createWriteStream(LOG_PATH, { flags: 'w' });

const server = spawn(npmCmd, ['run', 'dev:sim'], {
  env: { ...process.env, PORT },
  stdio: ['ignore', 'pipe', 'pipe'],
});

server.stdout.pipe(logStream);
server.stderr.pipe(logStream);

async function stopServer() {
  if (server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), delay(2_000)]);
  }

  if (server.exitCode === null && server.signalCode === null) {
    server.kill('SIGKILL');
    await Promise.race([once(server, 'exit'), delay(1_000)]);
  }
}

async function closeLogStream() {
  await new Promise((resolve) => {
    logStream.end(resolve);
  });
}

async function fetchStatus(pathname) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${pathname}`, {
      signal: controller.signal,
    });
    return response.status;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForServer() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`dev server exited early (code: ${server.exitCode})`);
    }

    try {
      const status = await fetchStatus('/');
      if (status >= 200 && status < 500) return;
    } catch {
      // ignore and retry until timeout
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(
    `dev server did not become reachable within ${STARTUP_TIMEOUT_MS / 1000}s`,
  );
}

async function assertEndpoints() {
  for (const endpoint of ENDPOINTS) {
    const status = await fetchStatus(endpoint);
    if (status < 200 || status >= 400) {
      throw new Error(`smoke check failed for ${endpoint} (status: ${status})`);
    }
    process.stdout.write(`✓ ${endpoint} (${status})\n`);
  }
}

async function printServerLogTail() {
  const content = await readFile(LOG_PATH, 'utf8').catch(() => '');
  if (!content.trim()) return;

  const tail = content.split('\n').slice(-40).join('\n');
  process.stderr.write('\n--- server.log (tail) ---\n');
  process.stderr.write(tail);
  process.stderr.write('\n--- end server.log ---\n');
}

let failed = false;

try {
  await waitForServer();
  await assertEndpoints();
  process.stdout.write('Smoke test passed.\n');
} catch (error) {
  failed = true;
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Smoke test failed: ${message}\n`);
} finally {
  await stopServer();
  await closeLogStream();
  if (failed) await printServerLogTail();
}

if (failed) process.exit(1);
