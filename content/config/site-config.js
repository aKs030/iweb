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
  'meine-webseite.local': {
    gtm: 'GT-TQTFN4NN',
    ga4: 'G-S0587RQ4CN',
    aw: 'AW-17819941793',
    aw_label: 'AW-CONV-LABEL-DEV',
  },
};

export const FAVICON_512 = '/content/assets/img/icons/favicon-512.png';
