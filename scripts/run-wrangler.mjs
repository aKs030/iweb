import { spawn } from 'node:child_process';

const WRANGLER_VERSION = '4.80.0';
const NPX_BIN = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const WRANGLER_PACKAGE = `wrangler@${WRANGLER_VERSION}`;

function spawnWrangler(args, options = {}) {
  return spawn(NPX_BIN, ['--yes', WRANGLER_PACKAGE, ...args], {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    stdio: options.stdio || 'inherit',
  });
}

/**
 * @param {string[]} args
 * @param {{
 *   cwd?: string,
 *   env?: NodeJS.ProcessEnv,
 *   stdio?: import('node:child_process').StdioOptions,
 * }} [options]
 */
export function runWrangler(args, options = {}) {
  return spawnWrangler(args, options);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const child = runWrangler(process.argv.slice(2));

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}
