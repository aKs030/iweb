# Aggressive PurgeCSS Run & Visual Regression

Date: 2025-12-28

## Summary
I ran an aggressive PurgeCSS pass (expanded content globs + safelist) and performed a full visual smoke test across key pages. Outputs are in `tmp/purged-aggressive/` and visual diffs in `tmp/screenshots/aggressive/`.

## Size Changes (original -> purged-aggressive)

about.css: 0 -> 4626 bytes
blog.css: 0 -> 725 bytes
cards.css: 9603 -> 9603 bytes
cookie-consent.css: 11843 -> 2195 bytes
footer.css: 30305 -> 8183 bytes
gallery-styles.css: 0 -> 2300 bytes
hero.css: 0 -> 11939 bytes
legal-pages.css: 4102 -> 2235 bytes
main.css: 8016 -> 7510 bytes
menu.css: 17525 -> 17368 bytes
projekte.css: 0 -> 3316 bytes
robot-companion.css: 17575 -> 16420 bytes
root.css: 16426 -> 15361 bytes
three-earth.css: 1871 -> 1811 bytes
typewriter.css: 3523 -> 3362 bytes
videos.css: 0 -> 7458 bytes

Net size change: some files reduced in size; some new per-page styles were generated (pages with standalone CSS now have purged outputs in the directory).

## Visual Regression Results
Test pages: `/`, `/about/`, `/projekte/`, `/gallery/`, `/videos/`, `/blog/`.

- home: mismatched pixels = 11555 (see `tmp/screenshots/aggressive/home-diff.png`) — requires review. May be due to layout shifts or dynamic content differences on the home page (Three.js or hero CSS interplay).
- about: mismatched pixels = 0
- projekte: mismatched pixels = 0
- gallery: mismatched pixels = 0
- videos: mismatched pixels = 0
- blog: mismatched pixels = 0

Screenshots saved under `tmp/screenshots/aggressive/`:
- `home-base.png`, `home-purged.png`, `home-diff.png` (and similar for other pages)

## Observations & Next Steps
- The *home* page shows non-zero pixel differences; inspect `home-diff.png` to determine if differences are acceptable (minor anti-aliasing / shift) or require safelisting additional selectors (likely related to hero/Three.js / typewriter). I can do a pixel-level heatmap to see which areas differ, or run a headless DOM snapshot comparison.
- Many rejected selectors are from dynamic components (robot-companion, menu, footer). They were covered by the safelist, but some selectors still got flagged (check `tmp/purged-aggressive/*` and `--rejected` outputs if needed).

## Recommendation
- Manual review of `home` diff to decide whether to whitelist more selectors or accept the visual change.
- If accepted: prepare a PR that replaces the canonical CSS files with the purged outputs (or integrate a build step to produce purified CSS during build). If not accepted: add more safelist entries and re-run PurgeCSS.

---

If you want, I can:
- A) Investigate the `home` diff in detail and propose a small safelist to fix it, then re-run and re-test. (Recommended)
- B) Prepare a PR with the current purged outputs + docs for review.
- C) Automate Purge+Visual checks in CI and open a PR template.

Which action should I take next? (A / B / C)
