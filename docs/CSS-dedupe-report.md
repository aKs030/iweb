# CSS Deduplication Report

Date: 2025-12-28

## Summary

I scanned the following CSS files for identical declaration blocks and consolidation opportunities:

- `content/styles/main.css`
- `content/styles/root.css`
- `content/styles/cards.css`
- `content/components/particles/three-earth.css`

Tools used: custom script to normalize declaration blocks, and PurgeCSS to detect unused selectors.

## Findings

- **Scrollbar rules**: A `::-webkit-scrollbar` rule existed in `main.css` and a mobile-scoped version in `root.css`. I consolidated by removing the standalone `::-webkit-scrollbar` from `main.css` and keeping the canonical mobile rule in `root.css` (added a comment).

- **Duplicate declaration groups (identical declarations across different selectors)**:
  1. Scrollbar group (merged):
     - `main.css`: `::-webkit-scrollbar { width:0; height:0; background:transparent }` (removed)
     - `root.css`: `html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar { ... }` (canonicalized)

  2. `display: none` occurrences (contextual — NO ACTION):
     - `main.css`: `button, .btn { display: none; }` (this is used in print media in `main.css`)
     - `cards.css`: `body.three-earth-active .features-content::before { display: none; }`
     - `root.css`: `.hidden { display: none !important; }`

     These have the same declaration but are semantically different contexts; **no automatic consolidation** done.

- PurgeCSS did not remove any selectors from `content/styles/cards.css` given the repo content globs, indicating the rules are likely used (possibly dynamically).

## Recommendations

- Keep the scrollbar rule in `root.css` as the canonical source (done).
- Do **not** consolidate `display: none` rules automatically — they are context-sensitive and merging would risk functional regressions.
- If you'd like further size reductions:
  - Run a broader PurgeCSS pass that includes server-side templates and any JS template strings; maintain a safelist for dynamic classes.
  - Run an automatic selector-level dedupe tool that merges identical declaration blocks into a shared rule file (I can prepare a PR + review list for each merge).
  - Minify CSS and check gzipped/brotli sizes to quantify wins.

## Changes made

- Removed `::-webkit-scrollbar` rule from `content/styles/main.css`.
- Added a "Canonical/centralized" comment above scrollbar rules in `content/styles/root.css`.

---

If you want, I can now:

- (A) Perform automated selector-level dedupe (merge identical blocks into `root.css` where safe) and produce a PR with a review list — I will skip contextually-sensitive merges unless you confirm.
- (B) Run an aggressive PurgeCSS with an expanded content set (requires a safelist strategy) and then do visual smoke tests (headless snapshots).

Tell me which option you prefer (A/B) or ask for a small sample PR for review first.
