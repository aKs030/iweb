// Central site configuration used across the site.
// Put host-specific values here (GTM/GA4/Ads IDs, feature flags, defaults, ...) and import
// `SITE_CONFIG` from modules that need them (e.g., head-inline.js).
// Keep keys lowercased (hostnames) and add a `default` entry to fall back to.

const PROD_CONFIG = {
  gtm: 'GTM-5F5ZSTTL',
  ga4: 'G-757KWG0PG4',
  aw: 'AW-1036079663',
  aw_label: 'AW-CONV-LABEL',
};

export const SITE_CONFIG = {
  default: PROD_CONFIG,
  'abdulkerimsesli.de': PROD_CONFIG,
  'www.abdulkerimsesli.de': PROD_CONFIG,

  // Local / dev
  'meine-webseite.local': {
    gtm: 'GT-TQTFN4NN',
    ga4: 'G-S0587RQ4CN',
    aw: 'AW-17819941793',
    aw_label: 'AW-CONV-LABEL-DEV',
  },

  // Example for adding feature flags or global defaults in the future
  // "_meta": { "featureFlags": { "newHeader": false } },
};

// Asset URLs (use root-relative paths where possible)
export const FAVICON_512 = '/content/assets/img/icons/favicon-512.png';
