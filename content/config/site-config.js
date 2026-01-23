// Central site configuration used across the site.
// Put host-specific values here (GTM/GA4/Ads IDs, feature flags, defaults, ...) and import
// `SITE_CONFIG` from modules that need them (e.g., head-inline.js).
// Keep keys lowercased (hostnames) and add a `default` entry to fall back to.

export const SITE_CONFIG = {
  // Default values used when no host-specific entry exists
  default: {
    gtm: 'GTM-5F5ZSTTL',
    ga4: 'G-757KWG0PG4',
    aw: 'AW-1036079663',
    // Ads conversion label (optional)
    aw_label: 'AW-CONV-LABEL',
  },

  // Production
  'abdulkerimsesli.de': {
    gtm: 'GTM-5F5ZSTTL',
    ga4: 'G-757KWG0PG4',
    aw: 'AW-1036079663',
    aw_label: 'AW-CONV-LABEL',
  },
  'www.abdulkerimsesli.de': {
    gtm: 'GTM-5F5ZSTTL',
    ga4: 'G-757KWG0PG4',
    aw: 'AW-1036079663',
    aw_label: 'AW-CONV-LABEL',
  },

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
