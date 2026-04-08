import { spawn } from 'node:child_process';
import path from 'node:path';

const wranglerBin = path.resolve(
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler',
);

const child = spawn(
  wranglerBin,
  ['d1', 'migrations', 'apply', 'DB_LIKES', '--local'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: '1',
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
