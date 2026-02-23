import { BASE_URL, BASE_URL_DEV } from './constants.js';

const ENV_DEFAULTS = Object.freeze({
  BASE_URL,
  GTM_ID: 'GTM-5F5ZSTTL',
  GA4_ID: 'G-757KWG0PG4',
  AW_ID: 'AW-1036079663',
  AW_LABEL: 'AW-CONV-LABEL',
  YOUTUBE_API_KEY: '',
  YOUTUBE_CHANNEL_ID: 'UCTGRherjM4iuIn86xxubuPg',
});

const ENV_DEV = Object.freeze({
  BASE_URL: BASE_URL_DEV,
  GTM_ID: 'GT-TQTFN4NN',
  GA4_ID: 'G-S0587RQ4CN',
  AW_ID: 'AW-17819941793',
  AW_LABEL: 'AW-CONV-LABEL-DEV',
});

const DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1']);
const PREVIEW_SUFFIXES = ['.pages.dev', '.netlify.app'];

function getRuntimeWindow() {
  return typeof window !== 'undefined' ? window : null;
}

function getHostname() {
  const hostname = getRuntimeWindow()?.location?.hostname;
  return String(hostname || '').toLowerCase();
}

function isDevHostname(hostname) {
  return DEV_HOSTNAMES.has(hostname);
}

function isPreviewHostname(hostname) {
  return PREVIEW_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

function readRuntimeEnv(key) {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return undefined;

  if (
    runtimeWindow.ENV &&
    Object.prototype.hasOwnProperty.call(runtimeWindow.ENV, key)
  ) {
    return runtimeWindow.ENV[key];
  }

  if (
    runtimeWindow.__ENV__ &&
    Object.prototype.hasOwnProperty.call(runtimeWindow.__ENV__, key)
  ) {
    return runtimeWindow.__ENV__[key];
  }

  return undefined;
}

function getEnv(key) {
  const runtimeValue = readRuntimeEnv(key);
  if (runtimeValue !== undefined && runtimeValue !== null) {
    return runtimeValue;
  }

  const hostname = getHostname();
  return isDevHostname(hostname)
    ? ENV_DEV[key] || ENV_DEFAULTS[key]
    : ENV_DEFAULTS[key];
}

export const ENV = Object.freeze({
  BASE_URL: getEnv('BASE_URL'),
  GTM_ID: getEnv('GTM_ID'),
  GA4_ID: getEnv('GA4_ID'),
  AW_ID: getEnv('AW_ID'),
  AW_LABEL: getEnv('AW_LABEL'),
  YOUTUBE_API_KEY: getEnv('YOUTUBE_API_KEY'),
  YOUTUBE_CHANNEL_ID: getEnv('YOUTUBE_CHANNEL_ID'),

  get isDev() {
    return isDevHostname(getHostname());
  },

  get isProd() {
    return !this.isDev && !this.isPreview;
  },

  get isPreview() {
    return isPreviewHostname(getHostname());
  },
});
