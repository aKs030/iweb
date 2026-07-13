import { buildCspHeader, generateNonce } from "./csp-manager.js";
import { EdgeSpeculationRules, StaticSpeculationRemover } from "./edge-speculation.js";
import { buildResponseLinkHeaders } from "./early-hints.js";
import { HeaderInjector, FooterInjector } from "./esi-shell.js";
import { TemplateCommentHandler, NonceInjector, SeoMetaHandler } from "./streaming-handlers.js";
import { SectionInjector } from "./template-injector.js";

const TRANSFORMED_ENTITY_HEADERS = ["Content-Length", "ETag", "Expires", "Last-Modified"];
const VERSIONED_STYLESHEET_PREFIXES = ["/content/", "/pages/"];

class VersionedStylesheetHandler {
  /**
   * @param {string} deployVersion
   */
  constructor(deployVersion = "") {
    this.deployVersion = String(deployVersion || "").trim();
  }

  element(element) {
    if (!this.deployVersion) return;

    const href = element.getAttribute("href") || "";
    if (!href || href.includes("?")) return;
    if (!VERSIONED_STYLESHEET_PREFIXES.some(prefix => href.startsWith(prefix))) return;

    element.setAttribute("href", `${href}?v=${this.deployVersion}`);
  }
}

/**
 * @param {Headers} headers
 */
function stripTransformedEntityHeaders(headers) {
  for (const headerName of TRANSFORMED_ENTITY_HEADERS) {
    headers.delete(headerName);
  }
}

/**
 * @param {Headers} headers
 * @param {string} value
 */
function appendVary(headers, value) {
  const current = headers.get("Vary");
  if (!current) {
    headers.set("Vary", value);
    return;
  }

  const normalized = current
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

  if (normalized.some(item => item.toLowerCase() === value.toLowerCase())) {
    return;
  }

  normalized.push(value);
  headers.set("Vary", normalized.join(", "));
}

/**
 * @param {Headers} headers
 * @param {string} directive
 */
function appendCacheControlDirective(headers, directive) {
  const normalizedDirective = String(directive || "").trim();
  if (!normalizedDirective) return;

  const current = headers.get("Cache-Control");
  if (!current) {
    headers.set("Cache-Control", normalizedDirective);
    return;
  }

  const normalized = current
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

  if (normalized.some(item => item.toLowerCase() === normalizedDirective.toLowerCase())) {
    return;
  }

  normalized.push(normalizedDirective);
  headers.set("Cache-Control", normalized.join(", "));
}

/**
 * @param {boolean} isLocal
 * @returns {{ cspHeader: string, cspReportOnlyHeader: string, nonce: string | null }}
 */
export function createHtmlSecurityContext(isLocal) {
  const nonce = isLocal ? null : generateNonce();
  return {
    cspHeader: nonce ? buildCspHeader(nonce) : "",
    cspReportOnlyHeader: "",
    nonce,
  };
}

/**
 * @param {Response} cachedResponse
 * @param {{ cspHeader: string, cspReportOnlyHeader?: string, deployVersion: string, nonce: string }} options
 * @returns {Response}
 */
export function buildCacheHitHtmlResponse(cachedResponse, options) {
  const nonceHandler = new NonceInjector(options.nonce);
  const rewriter = new HTMLRewriter();
  rewriter.on("script", nonceHandler);
  rewriter.on("style", nonceHandler);

  const withNonce = rewriter.transform(cachedResponse);
  const headers = new Headers(withNonce.headers);
  stripTransformedEntityHeaders(headers);
  appendVary(headers, "Accept-Language");
  appendCacheControlDirective(headers, "no-transform");
  headers.set("X-Deploy-Version", options.deployVersion);
  headers.delete("Content-Security-Policy-Report-Only");
  headers.set("Content-Security-Policy", options.cspHeader);
  if (options.cspReportOnlyHeader) {
    headers.set("Content-Security-Policy-Report-Only", options.cspReportOnlyHeader);
  }

  return new Response(withNonce.body, {
    status: withNonce.status,
    headers,
  });
}

/**
 * @param {any} context
 * @param {URL} url
 * @param {{
 *   deployVersion?: string,
 *   isLocal: boolean,
 *   injectShell?: boolean,
 *   resolvedGlobalHeadTemplate: string,
 *   routeMeta: any,
 * }} options
 * @returns {{ cspHeader: string, cspReportOnlyHeader: string, nonce: string | null, rewriter: any }}
 */
export function createHtmlRewriter(context, url, options) {
  const { cspHeader, cspReportOnlyHeader, nonce } = createHtmlSecurityContext(options.isLocal);
  const rewriter = new HTMLRewriter();

  rewriter.on("section[data-section-src]", new SectionInjector(context));
  rewriter.on('link[rel="stylesheet"]', new VersionedStylesheetHandler(options.deployVersion));

  if (options.resolvedGlobalHeadTemplate) {
    rewriter.on(
      "*",
      new TemplateCommentHandler({
        globalHead: options.resolvedGlobalHeadTemplate,
        nonce,
      })
    );
  }

  rewriter.on('script[type="speculationrules"]', new StaticSpeculationRemover());
  const edgeSpeculationRules = new EdgeSpeculationRules(url.pathname, nonce);

  if (options.routeMeta) {
    const seoHandler = new SeoMetaHandler(options.routeMeta, nonce, () =>
      edgeSpeculationRules.renderHtml()
    );
    rewriter.on("title", seoHandler);
    rewriter.on("meta", seoHandler);
    rewriter.on('link[rel="canonical"]', seoHandler);
    rewriter.on("head", seoHandler);
  } else {
    rewriter.on("head", edgeSpeculationRules);
  }

  if (nonce) {
    const nonceHandler = new NonceInjector(nonce);
    rewriter.on("script", nonceHandler);
    rewriter.on("style", nonceHandler);
  }

  if (options.injectShell !== false) {
    rewriter.on("a.skip-link", new HeaderInjector(url));
    rewriter.on("body", new FooterInjector());
  }

  const acceptLanguage = String(context.request.headers.get("Accept-Language") || "").toLowerCase();
  if (acceptLanguage.startsWith("en")) {
    rewriter.on("html", {
      element(e) {
        /** @type {any} */ (e).setAttribute("lang", "en");
      },
    });
  }

  return { cspHeader, cspReportOnlyHeader, nonce, rewriter };
}

/**
 * @param {Response} response
 * @param {Response} transformedResponse
 * @param {{
 *   cspHeader: string,
 *   deployVersion: string,
 *   initialHeaders: Headers,
 *   pathname: string,
 *   resolvedGlobalHeadTemplate: string,
 *   routeMeta: any,
 *   nonce: string | null,
 * }} options
 * @returns {Response}
 */
export function buildFinalHtmlResponse(response, transformedResponse, options) {
  const newHeaders = new Headers(options.initialHeaders);
  stripTransformedEntityHeaders(newHeaders);
  appendVary(newHeaders, "Accept-Language");
  appendCacheControlDirective(newHeaders, "no-transform");

  const responseLinkHeaders = buildResponseLinkHeaders(options.pathname);
  for (const linkValue of responseLinkHeaders) {
    newHeaders.append("Link", linkValue);
  }

  newHeaders.set("X-Deploy-Version", options.deployVersion);
  if (options.cspHeader) {
    newHeaders.delete("Content-Security-Policy-Report-Only");
    newHeaders.set("Content-Security-Policy", options.cspHeader);
  }
  if (options.cspReportOnlyHeader) {
    newHeaders.set("Content-Security-Policy-Report-Only", options.cspReportOnlyHeader);
  }

  const timingParts = [];
  if (options.resolvedGlobalHeadTemplate) {
    timingParts.push('tpl;desc="html-templates"');
  }
  if (options.routeMeta) timingParts.push('seo;desc="route-meta"');
  if (options.nonce) timingParts.push('csp;desc="nonce"');
  timingParts.push('spec;desc="edge-speculation"');
  if (timingParts.length) {
    newHeaders.set("Server-Timing", timingParts.join(", "));
  }

  return new Response(transformedResponse.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
