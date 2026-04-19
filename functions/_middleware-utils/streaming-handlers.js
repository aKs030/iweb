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
 * HTMLRewriter handler that replaces template comment nodes with pre-loaded
 * template HTML.
 *
 * Because HTMLRewriter processes the stream chunk-by-chunk, this avoids
 * buffering the entire document.
 */
export class TemplateCommentHandler {
  /**
   * @param {{ globalHead?: string, nonce?: string | null }} templates
   */
  constructor(templates) {
    this.templates = templates;
  }

  /** @param {Comment} comment */
  comments(comment) {
    const payload = parseTemplateComment(comment.text);

    if (payload.name === 'INJECT:GLOBAL-HEAD' && this.templates.globalHead) {
      comment.replace(
        renderGlobalHeadTemplate(
          this.templates.globalHead,
          payload,
          this.templates.nonce || null,
        ),
        {
          html: true,
        },
      );
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
    const tag = el.tagName.toLowerCase();

    if (tag === 'script') {
      el.setAttribute('nonce', this.nonce);
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
   * @param {string | null} [nonce]
   * @param {(() => string) | string | null} [extraHeadEndHtml]
   */
  constructor(meta, nonce = null, extraHeadEndHtml = null) {
    this.meta = meta;
    this.nonce = nonce;
    this.extraHeadEndHtml = extraHeadEndHtml;
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
        const extra =
          typeof this.extraHeadEndHtml === 'function'
            ? this.extraHeadEndHtml()
            : this.extraHeadEndHtml || '';
        const html = `${remaining || ''}${extra || ''}`;
        if (html) {
          endTag.before(html, { html: true });
        }
      });
    }
  }

  /** @private */
  _handleMetaName(el, name) {
    const map = buildSeoMetaNameMap(this.meta);

    if (name in map && map[name]) {
      el.setAttribute('content', map[name]);
      this._handledKeys.add(`name:${name}`);
    }
  }

  /** @private */
  _handleMetaProp(el, prop) {
    const map = buildSeoMetaPropertyMap(this.meta);

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
    const nameDefaults = buildSeoMetaNameMap(m);

    for (const [name, content] of Object.entries(nameDefaults)) {
      if (content && !this._handledKeys.has(`name:${name}`)) {
        parts.push(
          `<meta name="${escapeForHtml(name)}" content="${escapeForHtml(content)}" />`,
        );
      }
    }

    // Meta property tags
    const propDefaults = buildSeoMetaPropertyMap(m);

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
        `<script type="application/ld+json" id="edge-route-schema"${buildNonceAttribute(this.nonce)}>${JSON.stringify(m.schema)}</script>`,
      );
    }

    // Partial meta
    if (m.partialMeta && typeof m.partialMeta === 'object') {
      parts.push(
        `<script type="application/json" id="edge-partial-meta" data-partial-meta${buildNonceAttribute(this.nonce)}>${JSON.stringify(m.partialMeta)}</script>`,
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

function buildSeoMetaNameMap(meta) {
  const m = meta || {};
  const map = {
    description: m.description,
    robots: m.robots || 'index, follow, max-image-preview:large',
    keywords: m.keywords,
    'apple-mobile-web-app-title': m.appTitle || m.title,
    'twitter:card': m.twitterCard || 'summary_large_image',
    'twitter:title': m.twitterTitle || m.title,
    'twitter:description': m.twitterDescription || m.description,
    'twitter:url': m.canonicalUrl,
    'twitter:image': m.image,
    'twitter:image:width': m.imageWidth,
    'twitter:image:height': m.imageHeight,
    'twitter:image:type': m.imageType,
    'twitter:image:alt': m.imageAlt,
  };

  if (!m.keywords) {
    delete map.keywords;
  }

  return map;
}

function buildSeoMetaPropertyMap(meta) {
  const m = meta || {};
  const map = {
    'og:type': m.ogType || 'website',
    'og:title': m.ogTitle || m.title,
    'og:description': m.ogDescription || m.description,
    'og:url': m.canonicalUrl,
    'og:image': m.image,
    'og:image:width': m.imageWidth,
    'og:image:height': m.imageHeight,
    'og:image:type': m.imageType,
    'og:image:alt': m.imageAlt,
    'og:site_name': m.siteName,
    'og:locale': m.locale,
    'article:published_time': m.publishedTime,
    'article:modified_time': m.modifiedTime,
  };

  if (!m.publishedTime) {
    delete map['article:published_time'];
  }
  if (!m.modifiedTime) {
    delete map['article:modified_time'];
  }

  return map;
}

function parseTemplateComment(value = '') {
  const text = String(value || '').trim();
  const [name = '', ...rest] = text.split(/\s+/);
  const attrs = {};
  const attrText = rest.join(' ');
  const attrPattern = /([a-zA-Z][\w-]*)=(?:"([^"]*)"|'([^']*)')/g;
  let match;

  while ((match = attrPattern.exec(attrText))) {
    attrs[match[1]] = match[2] ?? match[3] ?? '';
  }

  return { name, attrs };
}

function renderGlobalHeadTemplate(template, payload, nonce = null) {
  const attrs = payload?.attrs || {};
  const mode = attrs.mode === 'standalone' ? 'standalone' : 'base';
  const useRouteTitle = attrs['title-source'] === 'route';
  const useRouteAppTitle = attrs['app-title-source'] === 'route';
  const replacements = {
    TITLE: attrs.title || 'Standalone',
    THEME_COLOR: attrs['theme-color'] || '#030303',
    COLOR_SCHEME: attrs['color-scheme'] || 'dark',
    STATUS_BAR_STYLE: attrs['status-bar-style'] || 'black-translucent',
    APP_TITLE:
      attrs['app-title'] ||
      (mode === 'standalone' ? attrs.title || 'Standalone' : 'AKS Portfolio'),
  };

  const nextTemplate = template
    .replace(
      /<!-- GLOBAL-HEAD:BASE-ONLY:BEGIN -->([\s\S]*?)<!-- GLOBAL-HEAD:BASE-ONLY:END -->/g,
      (_match, block) => (mode === 'base' ? block : ''),
    )
    .replace(
      /<!-- GLOBAL-HEAD:STANDALONE-ONLY:BEGIN -->([\s\S]*?)<!-- GLOBAL-HEAD:STANDALONE-ONLY:END -->/g,
      (_match, block) => (mode === 'standalone' ? block : ''),
    );
  let routeManagedTemplate = nextTemplate;
  if (useRouteAppTitle) {
    routeManagedTemplate = routeManagedTemplate.replace(
      /\s*<meta name="apple-mobile-web-app-title" content="\{\{APP_TITLE\}\}" \/>\s*/g,
      '\n',
    );
  }
  if (useRouteTitle) {
    routeManagedTemplate = routeManagedTemplate.replace(
      /\s*<title>\{\{TITLE\}\}<\/title>\s*/g,
      '\n',
    );
  }

  const resolvedTemplate = routeManagedTemplate.replace(
    /\{\{([A-Z_]+)\}\}/g,
    (_match, key) => escapeForHtml(replacements[key] || ''),
  );

  return applyNonceToHtml(resolvedTemplate, nonce);
}

function applyNonceToHtml(html, nonce) {
  if (!nonce) return html;

  return String(html || '')
    .replace(/<script\b([^>]*)>/gi, (_match, attrs = '') => {
      const nextAttrs = stripNonceAttribute(attrs);
      return `<script${nextAttrs}${buildNonceAttribute(nonce)}>`;
    })
    .replace(/<style\b([^>]*)>/gi, (_match, attrs = '') => {
      const nextAttrs = stripNonceAttribute(attrs);
      return `<style${nextAttrs}${buildNonceAttribute(nonce)}>`;
    });
}

function stripNonceAttribute(attrs = '') {
  return String(attrs || '').replace(
    /\snonce\s*=\s*(?:"[^"]*"|'[^']*')/gi,
    '',
  );
}

function buildNonceAttribute(nonce) {
  if (!nonce) return '';
  return ` nonce="${escapeForHtml(nonce)}"`;
}
