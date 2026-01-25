/**
 * Environment Configuration
 * Centralized environment variable management with fallbacks
 * @version 3.0.0
 */

const ENV_DEFAULTS = {
  BASE_URL: 'https://www.abdulkerimsesli.de',
  GTM_ID: 'GTM-5F5ZSTTL',
  GA4_ID: 'G-757KWG0PG4',
  AW_ID: 'AW-1036079663',
  AW_LABEL: 'AW-CONV-LABEL',
  YOUTUBE_API_KEY: '',
  YOUTUBE_CHANNEL_ID: 'UCTGRherjM4iuIn86xxubuPg',
  YOUTUBE_CHANNEL_HANDLE: 'aks.030',
};

const ENV_DEV = {
  BASE_URL: 'http://localhost:8080',
  GTM_ID: 'GT-TQTFN4NN',
  GA4_ID: 'G-S0587RQ4CN',
  AW_ID: 'AW-17819941793',
  AW_LABEL: 'AW-CONV-LABEL-DEV',
};

/**
 * Get environment variable with fallback
 * @param {string} key - Environment variable key
 * @returns {string} Environment variable value
 */
function getEnv(key) {
  // Try Vite env first
  if (import.meta.env?.[`VITE_${key}`]) {
    return import.meta.env[`VITE_${key}`];
  }

  // Try window env (for runtime config)
  if (typeof window !== 'undefined' && window.__ENV__?.[key]) {
    return window.__ENV__[key];
  }

  // Detect environment
  const isDev =
    typeof window !== 'undefined' &&
    (window.location?.hostname === 'localhost' ||
      window.location?.hostname === '127.0.0.1');

  // Return dev or prod default
  return isDev ? ENV_DEV[key] || ENV_DEFAULTS[key] : ENV_DEFAULTS[key];
}

/**
 * Environment configuration object
 */
export const ENV = {
  BASE_URL: getEnv('BASE_URL'),
  GTM_ID: getEnv('GTM_ID'),
  GA4_ID: getEnv('GA4_ID'),
  AW_ID: getEnv('AW_ID'),
  AW_LABEL: getEnv('AW_LABEL'),
  YOUTUBE_API_KEY: getEnv('YOUTUBE_API_KEY'),
  YOUTUBE_CHANNEL_ID: getEnv('YOUTUBE_CHANNEL_ID'),
  YOUTUBE_CHANNEL_HANDLE: getEnv('YOUTUBE_CHANNEL_HANDLE'),

  // Environment detection
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

/**
 * Validate required environment variables
 * @throws {Error} If required variables are missing
 */
export function validateEnv() {
  const required = ['BASE_URL'];
  const missing = required.filter((key) => !ENV[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }
}

// Auto-validate in production
if (ENV.isProd) {
  try {
    validateEnv();
  } catch (error) {
    console.error('[ENV] Validation failed:', error);
  }
}
