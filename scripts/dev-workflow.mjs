#!/usr/bin/env node
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const NODE_BIN = process.execPath;
const NPX_BIN = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function parsePort() {
  const args = process.argv.slice(2);
  let port = process.env.DEV_PORT || '8080';

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--port' || arg === '-p') {
      const value = args[i + 1];
      if (value) {
        port = value;
        i += 1;
      }
      continue;
    }
    if (arg.startsWith('--port=')) {
      const value = arg.split('=')[1];
      if (value) port = value;
    }
  }

  return String(port);
}

function getLanIPv4() {
  const interfaces = os.networkInterfaces();
  for (const records of Object.values(interfaces)) {
    if (!records || !records.length) continue;
    for (const record of records) {
      if (!record) continue;
      const familyV4Value = record.family === 'IPv4' || record.family === 4;
      if (familyV4Value && !record.internal && record.address) {
        return record.address;
      }
    }
  }
  return null;
}

const DEV_PORT = parsePort();
const LAN_IP = getLanIPv4();

let shuttingDown = false;

/**
 * @param {string} label
 * @param {string} command
 * @param {string[]} args
 * @param {boolean} persistent
 * @returns {Promise<number> | import('node:child_process').ChildProcess}
 */
function run(label, command, args, persistent = false) {
  if (persistent) {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', (err) => {
      if (shuttingDown) return;
      console.error(`[${label}] failed to start:`, err);
      shutdown(1);
    });

    child.on('exit', (code, signal) => {
      if (shuttingDown) return;
      if (signal) {
        console.warn(`[${label}] exited via signal ${signal}`);
        shutdown(1);
        return;
      }
      if (code && code !== 0) {
        console.error(`[${label}] exited with code ${code}`);
        shutdown(code);
        return;
      }
      console.log(`[${label}] exited`);
      shutdown(0);
    });

    return child;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 120);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  console.log('[dev] preflight: generating tokens + utilities');
  let code = await run(
    'tokens:generate:all',
    NODE_BIN,
    [path.join(ROOT_DIR, 'scripts/generate-tokens-css.mjs'), '--all'],
    false,
  );
  if (code !== 0) process.exit(code);

  code = await run(
    'utilities:generate',
    NODE_BIN,
    [path.join(ROOT_DIR, 'scripts/generate-utilities.mjs')],
    false,
  );
  if (code !== 0) process.exit(code);

  console.log(`[dev] starting watcher + app (port ${DEV_PORT})`);
  console.log(`[dev] local:   http://localhost:${DEV_PORT}`);
  if (LAN_IP) {
    console.log(`[dev] network: http://${LAN_IP}:${DEV_PORT}`);
  }

  const tokenWatcher =
    /** @type {import('node:child_process').ChildProcess} */ (
      run(
        'tokens:watch',
        NODE_BIN,
        [
          path.join(ROOT_DIR, 'scripts/generate-tokens-css.mjs'),
          '--watch',
          '--all',
        ],
        true,
      )
    );
  children.push(tokenWatcher);

  const appDev = /** @type {import('node:child_process').ChildProcess} */ (
    run(
      'wrangler:dev',
      NPX_BIN,
      ['wrangler', 'pages', 'dev', '.', '--port', DEV_PORT],
      true,
    )
  );
  children.push(appDev);
}

await main();
