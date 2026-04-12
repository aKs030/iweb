import { createLogger } from '../../content/core/logger.js';

const log = createLogger('asset-proxy-route');
import {
  buildConditionalProxyRequestHeaders,
  buildNotModifiedHeaders,
  buildProxyErrorResponse,
  buildProxyNotFoundResponse,
  buildProxyResponseHeaders,
  matchAssetProxyCache,
  maybeBuildNotModifiedResponse,
  storeAssetProxyCache,
} from './asset-proxy.js';

/**
 * @param {Headers | Record<string, string> | undefined | null} source
 * @returns {Record<string, string>}
 */
function toHeaderRecord(source) {
  if (!source) return {};
  if (source instanceof Headers) {
    return Object.fromEntries(source.entries());
  }

  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, String(value)]),
  );
}

/**
 * @param {Record<string, string> | ((context: {
 *   context: any,
 *   includeBody: boolean,
 *   isLocal: boolean,
 *   proxyPath: string,
 *   requestUrl: URL,
 *   upstreamResponse?: Response,
 * }) => Record<string, string> | undefined | null) | undefined} resolver
 * @param {object} args
 * @returns {Record<string, string>}
 */
function resolveExtraHeaders(resolver, args) {
  if (typeof resolver === 'function') {
    return toHeaderRecord(resolver(args));
  }

  return toHeaderRecord(resolver);
}

/**
 * @param {Record<string, string>} extraHeaders
 * @param {Headers} headers
 */
function appendHeaders(extraHeaders, headers) {
  Object.entries(extraHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
}

/**
 * @param {{
 *   body?: BodyInit | null,
 *   cacheStatus?: string,
 *   extraHeaders?: Headers | Record<string, string>,
 *   populateHeaders?: (headers: Headers) => void,
 *   sourceHeaders?: Headers | null,
 *   status?: number,
 * }} localAsset
 * @param {{
 *   cacheHeaderName: string,
 *   contentTypes: Map<string, string>,
 *   extraHeaders?: Record<string, string> | ((context: any) => Record<string, string> | undefined | null),
 *   includeBody: boolean,
 *   pathname: string,
 *   request: Request,
 *   resolverContext: object,
 * }} options
 * @returns {Response}
 */
function buildLocalAssetResponse(localAsset, options) {
  const headers = buildProxyResponseHeaders({
    pathname: options.pathname,
    contentTypes: options.contentTypes,
    sourceHeaders: localAsset.sourceHeaders || undefined,
    extraHeaders: resolveExtraHeaders(
      options.extraHeaders,
      options.resolverContext,
    ),
  });

  if (typeof localAsset.populateHeaders === 'function') {
    localAsset.populateHeaders(headers);
  }
  appendHeaders(toHeaderRecord(localAsset.extraHeaders), headers);

  const cacheStatus = String(localAsset.cacheStatus || 'BYPASS');
  headers.set(options.cacheHeaderName, cacheStatus);

  const notModified = maybeBuildNotModifiedResponse(
    options.request,
    headers,
    options.cacheHeaderName,
    cacheStatus,
  );
  if (notModified) {
    return notModified;
  }

  return new Response(options.includeBody ? (localAsset.body ?? null) : null, {
    status: localAsset.status || 200,
    headers,
  });
}

/**
 * @param {{
 *   buildUpstreamUrl: (context: {
 *     context: any,
 *     includeBody: boolean,
 *     isLocal: boolean,
 *     proxyPath: string,
 *     requestUrl: URL,
 *   }) => string | URL | Promise<string | URL>,
 *   cacheHeaderName: string,
 *   contentTypes: Map<string, string>,
 *   errorMessage?: string,
 *   extraHeaders?: Record<string, string> | ((context: {
 *     context: any,
 *     includeBody: boolean,
 *     isLocal: boolean,
 *     proxyPath: string,
 *     requestUrl: URL,
 *     upstreamResponse?: Response,
 *   }) => Record<string, string> | undefined | null),
 *   invalidPathMessage?: string,
 *   isLocalRequest: (requestUrl: URL, context: any) => boolean,
 *   normalizePath: (pathname: string, requestUrl: URL) => string,
 *   notFoundMessage: string,
 *   resolveLocalAsset?: (context: {
 *     context: any,
 *     includeBody: boolean,
 *     isLocal: boolean,
 *     proxyPath: string,
 *     requestUrl: URL,
 *   }) => Promise<{
 *     body?: BodyInit | null,
 *     cacheStatus?: string,
 *     extraHeaders?: Headers | Record<string, string>,
 *     populateHeaders?: (headers: Headers) => void,
 *     sourceHeaders?: Headers | null,
 *     status?: number,
 *   } | null> | ({
 *     body?: BodyInit | null,
 *     cacheStatus?: string,
 *     extraHeaders?: Headers | Record<string, string>,
 *     populateHeaders?: (headers: Headers) => void,
 *     sourceHeaders?: Headers | null,
 *     status?: number,
 *   } | null),
 *   requestHeaders?: Record<string, string> | ((context: {
 *     context: any,
 *     includeBody: boolean,
 *     isLocal: boolean,
 *     proxyPath: string,
 *     requestUrl: URL,
 *   }) => Record<string, string> | undefined | null),
 * }} options
 * @returns {{
 *   onRequestGet: (context: any) => Promise<Response>,
 *   onRequestHead: (context: any) => Promise<Response>,
 * }}
 */
export function createAssetProxyHandlers(options) {
  async function handle(context, includeBody) {
    const requestUrl = new URL(context.request.url);
    const proxyPath = options.normalizePath(requestUrl.pathname, requestUrl);
    const isLocal = options.isLocalRequest(requestUrl, context);
    const resolverContext = {
      context,
      includeBody,
      isLocal,
      proxyPath,
      requestUrl,
    };

    if (!proxyPath) {
      return new Response(
        options.invalidPathMessage || 'Invalid asset proxy path',
        { status: 400 },
      );
    }

    if (!isLocal) {
      const cachedResponse = await matchAssetProxyCache(requestUrl, {
        cacheHeaderName: options.cacheHeaderName,
        includeBody,
        request: context.request,
      });
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    if (typeof options.resolveLocalAsset === 'function') {
      const localAsset = await options.resolveLocalAsset(resolverContext);
      if (localAsset) {
        return buildLocalAssetResponse(localAsset, {
          cacheHeaderName: options.cacheHeaderName,
          contentTypes: options.contentTypes,
          extraHeaders: options.extraHeaders,
          includeBody,
          pathname: proxyPath,
          request: context.request,
          resolverContext,
        });
      }
    }

    try {
      const upstreamUrl = await options.buildUpstreamUrl(resolverContext);
      const upstreamResponse = await fetch(String(upstreamUrl), {
        method: includeBody ? 'GET' : 'HEAD',
        headers: buildConditionalProxyRequestHeaders(
          context.request,
          resolveExtraHeaders(options.requestHeaders, resolverContext),
        ),
      });

      const upstreamHeaderContext = {
        ...resolverContext,
        upstreamResponse,
      };
      if (upstreamResponse.status === 304) {
        const headers = buildProxyResponseHeaders({
          pathname: proxyPath,
          contentTypes: options.contentTypes,
          sourceHeaders: upstreamResponse.headers,
          extraHeaders: resolveExtraHeaders(
            options.extraHeaders,
            upstreamHeaderContext,
          ),
        });
        return new Response(null, {
          status: 304,
          headers: buildNotModifiedHeaders(
            headers,
            options.cacheHeaderName,
            'MISS',
          ),
        });
      }

      if (!upstreamResponse.ok) {
        return buildProxyNotFoundResponse(
          options.notFoundMessage,
          upstreamResponse.status,
        );
      }

      const headers = buildProxyResponseHeaders({
        pathname: proxyPath,
        contentTypes: options.contentTypes,
        sourceHeaders: upstreamResponse.headers,
        extraHeaders: resolveExtraHeaders(
          options.extraHeaders,
          upstreamHeaderContext,
        ),
      });
      headers.set(options.cacheHeaderName, 'MISS');

      const notModified = maybeBuildNotModifiedResponse(
        context.request,
        headers,
        options.cacheHeaderName,
        'MISS',
      );
      if (notModified) {
        return notModified;
      }

      const response = new Response(
        includeBody ? upstreamResponse.body : null,
        {
          status: upstreamResponse.status,
          headers,
        },
      );

      if (!isLocal && includeBody && upstreamResponse.status === 200) {
        storeAssetProxyCache(requestUrl, response.clone(), context);
      }

      return response;
    } catch (error) {
      log.error(options.errorMessage || 'asset proxy failed', error);
      return buildProxyErrorResponse(
        options.errorMessage || 'Asset proxy failed',
        502,
      );
    }
  }

  return {
    async onRequestGet(context) {
      return handle(context, true);
    },
    async onRequestHead(context) {
      const response = await handle(context, false);
      return new Response(null, {
        status: response.status,
        headers: response.headers,
      });
    },
  };
}
