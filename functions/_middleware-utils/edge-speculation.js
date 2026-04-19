/**
 * Edge-Side Speculation Rules Injection
 *
 * Injects route-aware Speculation Rules directly into the HTML stream
 * at the edge, so prefetch/prerender starts during HTML parsing —
 * ~500ms before client-side JS would compute the same rules.
 *
 * Falls back gracefully: the client-side ResourceHintsManager will
 * detect existing <script type="speculationrules"> and skip injection.
 *
 * @version 1.0.0
 */

/**
 * Route → prefetch URLs mapping.
 * Key: pathname prefix, Value: array of URLs to prefetch.
 */
const ROUTE_PREFETCH_MAP = {
  '/': ['/projekte/', '/about/', '/blog/', '/gallery/', '/videos/'],
  '/about': ['/projekte/', '/blog/', '/gallery/'],
  '/blog': ['/projekte/', '/about/', '/videos/'],
  '/projekte': ['/about/', '/blog/', '/gallery/'],
  '/gallery': ['/about/', '/projekte/', '/videos/'],
  '/videos': ['/blog/', '/projekte/', '/gallery/'],
  '/contact': ['/about/', '/projekte/'],
  '/impressum': ['/datenschutz/', '/about/'],
  '/datenschutz': ['/impressum/', '/about/'],
};

/**
 * Resolve prefetch URLs for a given pathname.
 * @param {string} pathname
 * @returns {string[]}
 */
function resolvePrefetchRoutes(pathname) {
  // Exact match first
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (ROUTE_PREFETCH_MAP[normalized]) {
    return ROUTE_PREFETCH_MAP[normalized];
  }

  // Prefix match (e.g. /blog/some-post → /blog)
  for (const [prefix, routes] of Object.entries(ROUTE_PREFETCH_MAP)) {
    if (prefix !== '/' && normalized.startsWith(prefix)) {
      return routes;
    }
  }

  // Default fallback
  return ['/projekte/', '/about/', '/blog/'];
}

/**
 * Build a complete Speculation Rules JSON block.
 * @param {string[]} prefetchUrls
 * @returns {string} JSON string
 */
function buildSpeculationRulesJson(prefetchUrls) {
  const rules = {
    prefetch: [
      {
        source: 'list',
        urls: prefetchUrls,
        eagerness: 'moderate',
      },
    ],
    prerender: [
      {
        source: 'document',
        where: {
          and: [
            { href_matches: '/*' },
            { not: { href_matches: '/api/*' } },
            { not: { href_matches: '/functions/*' } },
            {
              not: {
                selector_matches:
                  'a[download],a[href^="#"],a[href*="?"],a[target="_blank"],a[href$=".pdf"],a[href$=".zip"],a[href$=".mp4"],a[data-no-speculate],a[data-no-prerender]',
              },
            },
          ],
        },
        eagerness: 'conservative',
      },
    ],
  };

  return JSON.stringify(rules);
}

/**
 * HTMLRewriter handler that injects route-aware Speculation Rules
 * before </head>.
 *
 * This replaces the static speculation rules from the global head template with
 * route-specific prefetch targets computed at the edge.
 *
 * Usage:
 *   rewriter.on('head', new EdgeSpeculationRules(url.pathname));
 */
export class EdgeSpeculationRules {
  /**
   * @param {string} pathname - Current request pathname
   * @param {string | null} [nonce]
   */
  constructor(pathname, nonce = null) {
    this.pathname = pathname;
    this.nonce = nonce;
    this._injected = false;
  }

  /** @param {Element} el */
  element(el) {
    if (el.tagName !== 'head') return;

    el.onEndTag((endTag) => {
      if (this._injected) return;
      this._injected = true;

      const routes = resolvePrefetchRoutes(this.pathname);
      const rulesJson = buildSpeculationRulesJson(routes);

      endTag.before(
        `<script type="speculationrules" data-injected-by="edge-middleware"${buildNonceAttribute(this.nonce)}>${rulesJson}</script>\n`,
        { html: true },
      );
    });
  }
}

/**
 * HTMLRewriter handler that removes static speculation rules from
 * global-head.html — since the edge now injects route-specific rules.
 *
 * Usage:
 *   rewriter.on('script[type="speculationrules"]', new StaticSpeculationRemover());
 */
export class StaticSpeculationRemover {
  /** @param {Element} el */
  element(el) {
    // Only remove the static baseline rules from the global head template
    const injectedBy = el.getAttribute('data-injected-by');
    if (injectedBy === 'resource-hints') {
      el.remove();
    }
  }
}

function buildNonceAttribute(nonce) {
  if (!nonce) return '';
  return ` nonce="${escapeHtmlAttribute(nonce)}"`;
}

function escapeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}
