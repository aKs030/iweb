/**
 * Template Injection Utility
 * Shared logic for injecting base templates across different environments
 * @version 1.0.0
 */

import { createLogger } from './logger.js';

const log = createLogger('TemplateInjector');

/**
 * Template cache for performance
 */
const templateCache = new Map();

/**
 * Inject templates into HTML content
 * @param {string} html - HTML content
 * @param {Object} templates - Template content
 * @param {string} templates.head - Head template content
 * @param {string} templates.loader - Loader template content
 * @returns {string} HTML with injected templates
 */
export function injectTemplates(html, templates = {}) {
  const { head = '', loader = '' } = templates;

  let result = html;

  if (head) {
    result = result.replace(/<!--\s*INJECT:BASE-HEAD\s*-->/g, head);
  }

  if (loader) {
    result = result.replace(/<!--\s*INJECT:BASE-LOADER\s*-->/g, loader);
  }

  return result;
}

/**
 * Load template from URL (Browser/Cloudflare)
 * @param {Object} context - Context object with fetch capability
 * @param {string} path - Template path
 * @returns {Promise<string>} Template content
 */
export async function loadTemplateFromURL(context, path) {
  if (templateCache.has(path)) {
    return templateCache.get(path);
  }

  try {
    const url = new URL(path, context.request.url);
    const res = await context.env.ASSETS.fetch(url.href);

    if (!res.ok) {
      log.warn(`Template not found: ${path} (${res.status})`);
      return '';
    }

    const text = await res.text();
    templateCache.set(path, text);
    return text;
  } catch (error) {
    log.warn(`Failed to load template: ${path}`, error);
    return '';
  }
}
