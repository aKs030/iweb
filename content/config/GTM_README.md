GTM Container & site-config integration

## Purpose

This note explains how GTM containers in this repo obtain runtime IDs from the site config.

## How it works

- `content/config/site-config.js` contains per-host configuration (gtm, ga4, aw).
- `content/components/head/head-inline.js` reads `SITE_CONFIG` and pushes these values into `window.dataLayer` keys:
  - `ga4_measurement_id`
  - `ads_conversion_id`
  - `ads_conversion_label` (optional — AW conversion label, used for `send_to` formatting in some tags)
  - `gtm_id` (exposed via push that includes `gtm_id`/`gtm_autoconfig`)

## Container guidance

- Prefer using Data Layer variables in GTM (e.g., `ga4_measurement_id`, `ads_conversion_id`, `ads_conversion_label`) instead of hardcoded constants.
- Example: Use a `dataLayer` variable named `ga4_measurement_id` in GTM and use it in tags (this repository's `gtm-container-abdulkerimsesli.json` and `gtm-container-meine-webseite.json` are configured accordingly).
- To keep containers and `site-config.js` in sync, run:

```
npm run sync:gtm
```

This will update container names and variable mappings to reflect `site-config.js` entries.
Notes

---

- If you need different IDs for another host, update `content/config/site-config.js` (add a host entry). Do not edit multiple places.
- For local development, `head-inline.js` defaults to the `default` entry in `site-config` or falls back safely. Maintainers should keep `site-config.js` authoritative for site-wide IDs.
