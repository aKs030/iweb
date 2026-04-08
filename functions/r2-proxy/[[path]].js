import {
  buildR2Url,
  R2_PROXY_BASE_PATH,
} from '../../content/config/media-urls.js';
import { isLocalDevRuntime } from '../../content/core/runtime-env.js';
import {
  decodeProxyPath,
  normalizeEncodedProxyPath,
} from '../_shared/asset-proxy.js';
import { createAssetProxyHandlers } from '../_shared/asset-proxy-route.js';
import { ACCEPT_ANY_HEADERS } from '../_shared/http-headers.js';
import { PROXY_MEDIA_CONTENT_TYPES } from '../_shared/media-assets.js';

const CACHE_HEADER_NAME = 'X-R2-Proxy-Cache';
const PROXY_PATH_PATTERN = new RegExp(`^${R2_PROXY_BASE_PATH}\\/?(.*)$`);

function normalizeProxyPath(pathname) {
  const match = String(pathname || '').match(PROXY_PATH_PATTERN);
  return normalizeEncodedProxyPath(match ? match[1] : '');
}

async function getBucketMedia(bucket, key) {
  if (!bucket || !key) return null;

  try {
    return await bucket.get(key);
  } catch (error) {
    console.warn('r2-proxy local bucket lookup failed:', error);
    return null;
  }
}

async function getBucketMediaHead(bucket, key) {
  if (!bucket || !key || typeof bucket.head !== 'function') return null;

  try {
    return await bucket.head(key);
  } catch (error) {
    console.warn('r2-proxy local bucket head lookup failed:', error);
    return null;
  }
}

const handlers = createAssetProxyHandlers({
  buildUpstreamUrl({ proxyPath, requestUrl }) {
    return buildR2Url(proxyPath, requestUrl.search);
  },
  cacheHeaderName: CACHE_HEADER_NAME,
  contentTypes: PROXY_MEDIA_CONTENT_TYPES,
  errorMessage: 'R2 proxy failed',
  invalidPathMessage: 'Invalid R2 media path',
  isLocalRequest(requestUrl) {
    return isLocalDevRuntime(requestUrl);
  },
  normalizePath(pathname) {
    return normalizeProxyPath(pathname);
  },
  notFoundMessage: 'R2 media not found',
  requestHeaders: ACCEPT_ANY_HEADERS,
  async resolveLocalAsset({ context, includeBody, proxyPath }) {
    const bucketKey = decodeProxyPath(proxyPath);
    const localMedia = includeBody
      ? await getBucketMedia(context.env?.GALLERY_BUCKET, bucketKey)
      : (await getBucketMediaHead(context.env?.GALLERY_BUCKET, bucketKey)) ||
        (await getBucketMedia(context.env?.GALLERY_BUCKET, bucketKey));

    if (!localMedia) {
      return null;
    }

    return {
      body: localMedia.body,
      cacheStatus: 'BYPASS',
      populateHeaders(headers) {
        localMedia.writeHttpMetadata(headers);
        if (localMedia.httpEtag) {
          headers.set('ETag', localMedia.httpEtag);
        }
      },
    };
  },
});

export const { onRequestGet, onRequestHead } = handlers;
