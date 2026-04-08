import { GITHUB_CONFIG } from '../../../pages/projekte/config/github.config.js';
import { isLocalDevRuntime } from '../../../content/core/runtime-env.js';
import { normalizeEncodedProxyPath } from '../../_shared/asset-proxy.js';
import { createAssetProxyHandlers } from '../../_shared/asset-proxy-route.js';
import { ACCEPT_ANY_HEADERS } from '../../_shared/http-headers.js';
import { PROJECT_APP_CONTENT_TYPES } from '../../_shared/media-assets.js';

const RAW_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.appsPath}`;
const CACHE_HEADER_NAME = 'X-Project-Apps-Cache';

function normalizePath(pathname) {
  const match = String(pathname || '').match(/^\/api\/project-apps\/?(.*)$/);
  return normalizeEncodedProxyPath(match ? match[1] : '', {
    defaultDocument: 'index.html',
    filterEmptySegments: false,
  });
}

const handlers = createAssetProxyHandlers({
  buildUpstreamUrl({ proxyPath }) {
    return new URL(`${RAW_BASE_URL}/${proxyPath}`);
  },
  cacheHeaderName: CACHE_HEADER_NAME,
  contentTypes: PROJECT_APP_CONTENT_TYPES,
  errorMessage: 'Project app proxy failed',
  extraHeaders: {
    'X-Robots-Tag': 'noindex, nofollow',
  },
  invalidPathMessage: 'Invalid project app path',
  isLocalRequest(requestUrl) {
    return isLocalDevRuntime(requestUrl);
  },
  normalizePath(pathname) {
    return normalizePath(pathname);
  },
  notFoundMessage: 'Project app asset not found',
  requestHeaders: ACCEPT_ANY_HEADERS,
});

export const { onRequestGet, onRequestHead } = handlers;
