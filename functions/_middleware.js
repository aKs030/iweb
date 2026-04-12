import { buildRouteMeta } from './_middleware-utils/route-seo.js';
import {
  isLocalhost,
  normalizeLocalDevHeaders,
} from './_middleware-utils/dev-utils.js';
import {
  preloadCriticalCss,
  buildCacheHitHtmlResponse,
  buildFinalHtmlResponse,
  createHtmlRewriter,
  createHtmlSecurityContext,
} from './_middleware-utils/html-transform.js';
import {
  matchEdgeCache,
  storeInEdgeCache,
} from './_middleware-utils/edge-cache.js';
import {
  prepareDocumentUpstreamRequest,
  resolveRequestRedirect,
} from './_middleware-utils/request-policy.js';
import {
  applyBuildVersion,
  DEPLOY_VERSION,
  KV_KEYS,
  loadTemplateWithCache,
} from './_middleware-utils/template-cache.js';

/**
 * Middleware entry point — runs on every request.
 *
 * @param {any} context
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const upstreamRequest = prepareDocumentUpstreamRequest(context.request, url);

  // Skip API routes
  if (url.pathname.startsWith('/api/')) {
    return await context.next();
  }

  const redirectResponse = resolveRequestRedirect(url);
  if (redirectResponse) {
    return redirectResponse;
  }

  const isLocal = isLocalhost(url.hostname);

  // -----------------------------------------------------------------------
  // Edge HTML Cache: skip entire pipeline on cache hit
  // -----------------------------------------------------------------------
  if (!isLocal) {
    const cachedResponse = await matchEdgeCache(context.request);
    if (cachedResponse) {
      const { cspHeader, nonce } = createHtmlSecurityContext(isLocal);
      return buildCacheHitHtmlResponse(cachedResponse, {
        cspHeader,
        deployVersion: DEPLOY_VERSION,
        nonce: /** @type {string} */ (nonce),
      });
    }
  }

  // -----------------------------------------------------------------------
  // Parallel: upstream + templates + route meta + critical CSS
  // -----------------------------------------------------------------------
  const baseUrl = `${url.protocol}//${url.host}`;

  const [upstreamResult, globalHeadTemplate, routeMeta, criticalCssMap] =
    await Promise.all([
      context.next(upstreamRequest).catch(() => null),
      loadTemplateWithCache(
        context.env,
        KV_KEYS.GLOBAL_HEAD,
        `${baseUrl}/content/templates/global-head.html`,
        context,
      ),
      buildRouteMeta(context, url).catch(() => null),
      preloadCriticalCss(context),
    ]);

  if (!upstreamResult) {
    return new Response('Internal Server Error', { status: 500 });
  }

  const response = upstreamResult;
  const resolvedGlobalHeadTemplate = globalHeadTemplate
    ? applyBuildVersion(globalHeadTemplate)
    : '';

  // Only process HTML
  const initialHeaders = new Headers(response.headers);
  const localHeaderAdjusted = normalizeLocalDevHeaders(
    initialHeaders,
    url.hostname,
  );
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    if (!localHeaderAdjusted) return response;
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: initialHeaders,
    });
  }

  const { cspHeader, nonce, rewriter } = createHtmlRewriter(context, url, {
    criticalCssMap,
    isLocal,
    resolvedGlobalHeadTemplate,
    routeMeta,
  });
  const transformedResponse = rewriter.transform(response);
  const finalResponse = buildFinalHtmlResponse(response, transformedResponse, {
    criticalCssMap,
    cspHeader,
    deployVersion: DEPLOY_VERSION,
    initialHeaders,
    nonce,
    pathname: url.pathname,
    resolvedGlobalHeadTemplate,
    routeMeta,
  });

  // -----------------------------------------------------------------------
  // Store in Edge Cache (async, non-blocking)
  // -----------------------------------------------------------------------
  if (!isLocal) {
    storeInEdgeCache(context.request, finalResponse.clone(), context);
  }

  return finalResponse;
}
