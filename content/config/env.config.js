import { BASE_URL, BASE_URL_DEV } from './constants.js';

const ENV_DEFAULTS = {
  BASE_URL,
  GTM_ID: 'GTM-5F5ZSTTL',
  GA4_ID: 'G-757KWG0PG4',
  AW_ID: 'AW-1036079663',
  AW_LABEL: 'AW-CONV-LABEL',
  YOUTUBE_API_KEY: '',
  YOUTUBE_CHANNEL_ID: 'UCTGRherjM4iuIn86xxubuPg',
};

const ENV_DEV = {
  BASE_URL: BASE_URL_DEV,
  GTM_ID: 'GT-TQTFN4NN',
  GA4_ID: 'G-S0587RQ4CN',
  AW_ID: 'AW-17819941793',
  AW_LABEL: 'AW-CONV-LABEL-DEV',
};

function getEnv(key) {
  // Kein Vite mehr - direkt aus window oder defaults
  if (typeof window !== 'undefined' && window.ENV?.[key]) {
    return window.ENV[key];
  }

  if (typeof window !== 'undefined' && window.__ENV__?.[key]) {
    return window.__ENV__[key];
  }

  const isDev =
    typeof window !== 'undefined' &&
    (window.location?.hostname === 'localhost' ||
      window.location?.hostname === '127.0.0.1');

  return isDev ? ENV_DEV[key] || ENV_DEFAULTS[key] : ENV_DEFAULTS[key];
}

export const ENV = {
  BASE_URL: getEnv('BASE_URL'),
  GTM_ID: getEnv('GTM_ID'),
  GA4_ID: getEnv('GA4_ID'),
  AW_ID: getEnv('AW_ID'),
  AW_LABEL: getEnv('AW_LABEL'),
  YOUTUBE_API_KEY: getEnv('YOUTUBE_API_KEY'),
  YOUTUBE_CHANNEL_ID: getEnv('YOUTUBE_CHANNEL_ID'),

  get isDev() {
    return (
      typeof window !== 'undefined' &&
      (window.location?.hostname === 'localhost' ||
        window.location?.hostname === '127.0.0.1')
    );
  },

  get isProd() {
    return !this.isDev && !this.isPreview;
  },

  get isPreview() {
    return (
      typeof window !== 'undefined' &&
      (window.location?.hostname?.endsWith('.pages.dev') ||
        window.location?.hostname?.endsWith('.netlify.app'))
    );
  },
};
