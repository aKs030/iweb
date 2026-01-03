Developer Logging Guide

🚧 Purpose

This project uses a small, centralized logging pattern for client and server scripts to keep messages consistent and easy to control.

Client-side

- Use the shared utility: `import { createLogger } from './content/utils/shared-utilities.js'` and then `const log = createLogger('Category')`.
- For non-module contexts or simple fallbacks, the project exposes `window.iwebLogger` which provides `info`, `warn`, `error`, and `debug`.
- You can disable logs at runtime by setting `window.IWEB_LOGGING_ENABLED = false` before modules load.

Server-side (Node scripts in `scripts/`)

- Use the small logger: `const { info, warn, error } = require('./log');`
- `scripts/log.js` prints structured messages and is used by automation scripts.

Notes

- Do not modify vendor files (e.g. `content/vendor/*`).
- If you want to add a new module and need logging, prefer `createLogger('MyModule')` so logs are categorized.
