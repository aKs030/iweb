import { runWrangler } from './run-wrangler.mjs';

const child = runWrangler(
  ['d1', 'migrations', 'apply', 'DB_LIKES', '--local'],
  {
    env: {
      ...process.env,
      CI: '1',
    },
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
