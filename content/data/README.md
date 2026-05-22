# Content Data

Runtime data that does not belong to core helpers or static config.

## Files

- `brand-data.json` - canonical brand identity and schema fields.
- `brand-data-loader.js` - normalization helper for brand schema data.
- `typewriter-quotes.json` - quote pool for the homepage typewriter.
- `locales/` - UI translation bundles.

## Notes

- Keep the data files in sync with the runtime loaders in `content/core/i18n.js`, `content/components/typewriter/TypeWriter.js` and `content/data/brand-data-loader.js`.
- `content/config/` remains the home for runtime and SEO configuration.
