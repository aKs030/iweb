# Testing & QA

This project includes a small Playwright-based test suite for visual/layout smoke tests and basic accessibility checks.

Prerequisites
-------------
- Node.js (16+)
- npm

Install dev dependencies:

```bash
cd /Users/abdo/iweb
npm install
```

Run tests (starts a local static server and runs Playwright):

```bash
npm test
```

Helpful commands:

- Run tests in headed mode to see the browser:

  ```bash
  npm run test:headed
  ```

- Show test report after a run:

  ```bash
  npm run test:report
  ```

What the tests check
--------------------
- About-section responsive layout (desktop vs mobile stacked buttons)
- Footer cookie panel open/close behavior and aria-expanded toggling
- Placeholder analytics scripts exist prior to consent

Notes
-----
- Tests run a simple `http-server` to serve the repo root on port 8080. If that port is in use, stop the other service or modify `playwright.config.js`.
- The test suite is a smoke test and not a replacement for full accessibility audits (axe/lighthouse) or manual QA.
