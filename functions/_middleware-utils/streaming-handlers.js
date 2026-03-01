/**
 * Edge-Streaming HTMLRewriter Handlers
 *
 * Replaces the buffered string-replacement pipeline with streaming
 * HTMLRewriter handlers. This allows the browser to receive
 * the <head> (CSS, import-map) immediately while the body is still
 * being generated at the edge — improving FCP significantly.
 *
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// Template Comment Handler (replaces string-based template injection)
// ---------------------------------------------------------------------------

/**
 * HTMLRewriter handler that replaces <!-- INJECT:BASE-HEAD --> and
 * <!-- INJECT:BASE-LOADER --> comment nodes with pre-loaded template HTML.
 *
 * Because HTMLRewriter processes the stream chunk-by-chunk, this avoids
 * buffering the entire document.
 */
export class TemplateCommentHandler {
  /**
   * @param {{ head: string, loader: string }} templates
   */
  constructor(templates) {
    this.templates = templates;
  }

  /** @param {Comment} comment */
  comments(comment) {
    const text = comment.text.trim();
    if (text === 'INJECT:BASE-HEAD' && this.templates.head) {
      comment.replace(this.templates.head, { html: true });
    } else if (text === 'INJECT:BASE-LOADER' && this.templates.loader) {
      comment.replace(this.templates.loader, { html: true });
    }
  }
}

// ---------------------------------------------------------------------------
// CSP Nonce Handler (replaces regex-based nonce injection)
// ---------------------------------------------------------------------------

/**
 * Adds a `nonce` attribute to inline <script> and <style> elements
 * that don't already have one, using HTMLRewriter streaming.
 */
export class NonceInjector {
  /** @param {string} nonce */
  constructor(nonce) {
    this.nonce = nonce;
  }

  /** @param {Element} el */
  element(el) {
    // Skip if already has nonce
    if (el.getAttribute('nonce')) return;

    const tag = el.tagName.toLowerCase();

    if (tag === 'script') {
      // Only add nonce to inline scripts (no src attribute)
      if (!el.getAttribute('src')) {
        el.setAttribute('nonce', this.nonce);
      }
    } else if (tag === 'style') {
      el.setAttribute('nonce', this.nonce);
    }
  }
}

// ---------------------------------------------------------------------------
// SEO Meta Handler (streaming version of applyRouteMeta)
// ---------------------------------------------------------------------------

/**
 * Streaming SEO meta injector.
 * Upserts title, meta[name], meta[property], link[rel=canonical], and
 * appends JSON-LD / partial-meta scripts before </head>.
 *
 * The handler tracks which metas were *replaced* during the stream. Any
 * remaining metas that weren't found in the existing HTML are appended
 * right before the closing </head> tag.
 */
export class SeoMetaHandler {
  /**
   * @param {Object} meta - Route meta data from buildRouteMeta()
   */
  constructor(meta) {
    this.meta = meta;
    /** @type {Set<string>} Track which fields were already upserted in-place */
    this._handledKeys = new Set();
    /** @type {string[]} Extra tags to append before </head> */
    this._pendingAppend = [];
  }

  /** @param {Element} el */
  element(el) {
    const tag = el.tagName.toLowerCase();
    const m = this.meta;

    if (tag === 'title' && m.title) {
      el.setInnerContent(escapeForHtml(m.title));
      this._handledKeys.add('title');
      return;
    }

    if (tag === 'meta') {
      const name = el.getAttribute('name');
      const prop = el.getAttribute('property');

      if (name) this._handleMetaName(el, name);
      if (prop) this._handleMetaProp(el, prop);
      return;
    }

    if (tag === 'link') {
      const rel = el.getAttribute('rel');
      if (rel === 'canonical' && m.canonicalUrl) {
        el.setAttribute('href', m.canonicalUrl);
        this._handledKeys.add('canonical');
      }
      return;
    }

    // Append remaining tags before </head>
    if (tag === 'head') {
      // onEndTag is called when the </head> closing tag is encountered
      el.onEndTag((endTag) => {
        const remaining = this._buildRemainingTags();
        if (remaining) {
          endTag.before(remaining, { html: true });
        }
      });
    }
  }

  /** @private */
  _handleMetaName(el, name) {
    const m = this.meta;
    const map = {
      description: m.description,
      robots: m.robots || 'index, follow, max-image-preview:large',
      keywords: m.keywords,
      'twitter:card': m.twitterCard || 'summary_large_image',
      'twitter:title': m.title,
      'twitter:description': m.description,
      'twitter:url': m.canonicalUrl,
      'twitter:image': m.image,
    };

    if (name in map && map[name]) {
      el.setAttribute('content', map[name]);
      this._handledKeys.add(`name:${name}`);
    }
  }

  /** @private */
  _handleMetaProp(el, prop) {
    const m = this.meta;
    const map = {
      'og:type': m.ogType || 'website',
      'og:title': m.title,
      'og:description': m.description,
      'og:url': m.canonicalUrl,
      'og:image': m.image,
      'article:published_time': m.publishedTime,
    };

    if (prop in map && map[prop]) {
      el.setAttribute('content', map[prop]);
      this._handledKeys.add(`prop:${prop}`);
    }
  }

  /** @private */
  _buildRemainingTags() {
    const m = this.meta;
    const parts = [];

    if (m.title && !this._handledKeys.has('title')) {
      parts.push(`<title>${escapeForHtml(m.title)}</title>`);
    }
    if (m.canonicalUrl && !this._handledKeys.has('canonical')) {
      parts.push(
        `<link rel="canonical" href="${escapeForHtml(m.canonicalUrl)}" />`,
      );
    }

    // Meta name tags
    const nameDefaults = {
      description: m.description,
      robots: m.robots || 'index, follow, max-image-preview:large',
      'twitter:card': m.twitterCard || 'summary_large_image',
      'twitter:title': m.title,
      'twitter:description': m.description,
      'twitter:url': m.canonicalUrl,
      'twitter:image': m.image,
    };
    if (m.keywords) nameDefaults.keywords = m.keywords;

    for (const [name, content] of Object.entries(nameDefaults)) {
      if (content && !this._handledKeys.has(`name:${name}`)) {
        parts.push(
          `<meta name="${escapeForHtml(name)}" content="${escapeForHtml(content)}" />`,
        );
      }
    }

    // Meta property tags
    const propDefaults = {
      'og:type': m.ogType || 'website',
      'og:title': m.title,
      'og:description': m.description,
      'og:url': m.canonicalUrl,
      'og:image': m.image,
    };
    if (m.publishedTime) {
      propDefaults['article:published_time'] = m.publishedTime;
    }

    for (const [prop, content] of Object.entries(propDefaults)) {
      if (content && !this._handledKeys.has(`prop:${prop}`)) {
        parts.push(
          `<meta property="${escapeForHtml(prop)}" content="${escapeForHtml(content)}" />`,
        );
      }
    }

    // JSON-LD schema
    if (m.schema && typeof m.schema === 'object') {
      parts.push(
        `<script type="application/ld+json" id="edge-route-schema">${JSON.stringify(m.schema)}</script>`,
      );
    }

    // Partial meta
    if (m.partialMeta && typeof m.partialMeta === 'object') {
      parts.push(
        `<script type="application/json" id="edge-partial-meta" data-partial-meta>${JSON.stringify(m.partialMeta)}</script>`,
      );
    }

    return parts.length ? '\n  ' + parts.join('\n  ') + '\n' : '';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeForHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
