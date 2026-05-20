# Content Data

This folder contains site data that is consumed at runtime but does not belong to core runtime helpers or static config.

## Files

- `brand-data.json`: canonical brand identity and schema fields
- `brand-data-loader.js`: loader and normalization helper for brand schema data
- `typewriter-quotes.json`: quote pool for the homepage typewriter
- `locales/`: UI translation bundles

## Notes

- Keep these files in sync with the runtime loaders in `content/core/i18n.js`, `content/components/typewriter/TypeWriter.js`, and `content/data/brand-data-loader.js`.
- This folder is intentionally separate from `content/config/`, which remains for runtime and SEO configuration.