# PurgeCSS Run Report

Date: 2025-12-28

## Overview
I ran PurgeCSS over project CSS files with expanded content globs and a safelist for known dynamic classes.

Command:
```
npx purgecss --css content/styles/*.css content/components/**/*.css \
  --content index.html pages/**/*.html content/**/*.js scripts/**/*.mjs \
  --output tmp/purged --rejected --rejected-css \
  --safelist three-earth-active,features-cards,features-content,card,btn,hidden
```

## Output
- Purged files written to: `tmp/purged/` (one file per original CSS file)
- PurgeCSS **did not** remove large swaths of selectors; most files remained largely identical in size.
- Per-file `rejected` lists were produced (i.e., selectors identified as unused by PurgeCSS for the given content globs). Examples (not exhaustive):
  - `tmp/purged/three-earth.css` rejected: `.three-earth-container canvas`, `.three-earth-error .retry-btn`
  - `tmp/purged/typewriter.css` rejected: `.typewriter-title .typed-text .typed-line:last-child::after`, `.is-locked`
  - `tmp/purged/robot-companion.css` rejected a long list of selectors referencing robot UI internals.
  - `tmp/purged/main.css` rejected: `.snap-container`, `.section-error-box`, `.section-retry`, `.footer-trigger-zone`
  - `tmp/purged/cards.css` rejected: `body.three-earth-active #features .features-cards` and related 3D mode selectors

> Note: A rejection by PurgeCSS means the selector was not observed in the provided content globs - it may still be used dynamically (e.g., added/removed by JS), or be part of state-specific UI.

## Visual Smoke Tests
- I served the repo locally on port 8082 and created a test page `tmp/index-test.html` that uses the purged CSS files.
- Headless Chromium (Playwright) tests checked that the `.features-cards` element is present and has non-zero bounding box in both baseline (`/`) and purged (`/tmp/index-test.html`) pages.
- Results: bounding boxes are effectively identical; screenshots saved to:
  - `tmp/screenshots/baseline.png`
  - `tmp/screenshots/purged.png`
  (No visible regression for the features/cards section.)

## Recommendation
- The PurgeCSS run is **safe to proceed** for further manual inspection: rejected selectors should be reviewed for dynamic usage before removal. In particular: robot-companion and menu selectors are likely dynamically added and should be safelisted if removal is intended.
- Next step: create a PR that either:
  - (A) removes the safe-to-remove selectors (none obvious without manual review), or
  - (B) adds appropriate safelists for dynamic selectors and runs PurgeCSS again, followed by a full visual regression test suite.

---

Files produced during the run are available under `tmp/purged/` and `tmp/screenshots/` if you want to inspect them locally.
