/**
 * Template Injection Utilities
 * @version 1.0.0
 */

/**
 * Load template from URL
 * @param {Object} context - Cloudflare Pages context
 * @param {string} path - Template path
 * @returns {Promise<string>} Template content
 */
export async function loadTemplateFromURL(context, path) {
  try {
    const url = new URL(path, context.request.url);
    const response = await context.env.ASSETS.fetch(url);
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  }
}

/**
 * HTMLRewriter handler for Edge-Side Includes
 */
export class SectionInjector {
  constructor(context) {
    this.context = context;
  }
  async element(el) {
    const src = el.getAttribute('data-section-src');
    if (!src) return;

    // Only inject specific partials to avoid edge bloat
    if (src.endsWith('/hero') || src.endsWith('/section3')) {
      const htmlStr = await loadTemplateFromURL(this.context, src + '.html');
      if (htmlStr) {
        el.setInnerContent(htmlStr, { html: true });
        el.setAttribute('data-ssr-loaded', 'true');
      }
    }
  }
}
