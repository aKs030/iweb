# Performance workflow (local)

This repo includes small helpers to run Lighthouse locally and compare metrics between runs.

Commands:

- `npm run lh:run` — runs Lighthouse (headless) against http://127.0.0.1:8081 and stores a JSON report in `./reports/lighthouse-<ts>.json`.
- `npm run lh:diff` — compares the latest two reports in `./reports` and prints metric deltas (FCP/LCP/TTI/SpeedIndex/TBT/CLS).

Usage:
1. Start a local server: `npm run serve` (this uses http-server on port 8081).
2. Run `npm run lh:run` a couple times to produce baseline and new report.
4. Run `npm run lh:diff` to see the change and check for regressions.

Quick E2E checks:
- `npm run test:preload` runs a Playwright test that asserts the LCP image (`og-home@1600.avif`) and the subset font (`InterVariable-subset.woff2`) are requested within ~3s of page load. Make sure `npm run serve` is running before executing this test.

CI Integration (optional):
- You can add a GitHub Action that runs `npm run lh:run` and uploads the report as an artifact. A separate job can download the previous artifact and run `npm run lh:diff <old> <new>` to assert no regressions.
