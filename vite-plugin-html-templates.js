/**
 * Vite Plugin: HTML Templates Injection
 * Automatically injects shared HTML templates into all pages
 * Eliminates code duplication across HTML files
 *
 * @author Abdulkerim Sesli
 * @version 1.1.0
 */

import { readFileSync } from 'fs';
import { resolve, relative, dirname, sep } from 'path';

/**
 * Load template file content
 */
function loadTemplate(templatePath) {
  try {
    return readFileSync(resolve(process.cwd(), templatePath), 'utf-8');
  } catch {
    console.warn(`[html-templates] Could not load template: ${templatePath}`);
    return '';
  }
}

/**
 * Vite plugin to inject HTML templates
 */
export default function htmlTemplatesPlugin(options = {}) {
  const {
    templates = {
      head: 'content/templates/base-head.html',
      loader: 'content/templates/base-loader.html',
    },
  } = options;

  // Load templates once at build time
  let headTemplate = '';
  let loaderTemplate = '';

  return {
    name: 'vite-plugin-html-templates',

    configResolved() {
      // Load templates when config is resolved
      headTemplate = loadTemplate(templates.head);
      loaderTemplate = loadTemplate(templates.loader);

      if (headTemplate) {
        console.log('[html-templates] ✓ Loaded base-head.html');
      }
      if (loaderTemplate) {
        console.log('[html-templates] ✓ Loaded base-loader.html');
      }
    },

    transformIndexHtml: {
      order: 'pre', // Run before Vite's built-in transforms to allow asset resolution
      handler(html, ctx) {
        let transformed = html;
        let headInjected = false;
        let loaderInjected = false;

        // Inject head template (handle whitespace variations)
        if (headTemplate) {
          const headMarkerRegex = /<!--\s*INJECT:BASE-HEAD\s*-->/g;
          if (headMarkerRegex.test(html)) {
            transformed = transformed.replace(headMarkerRegex, headTemplate);
            headInjected = true;
            console.log(
              `[html-templates] ✓ Injected base-head into ${ctx.filename || 'HTML'}`,
            );
          }
        }

        // Inject loader template (handle whitespace variations)
        if (loaderTemplate) {
          const loaderMarkerRegex = /<!--\s*INJECT:BASE-LOADER\s*-->/g;
          if (loaderMarkerRegex.test(html)) {
            transformed = transformed.replace(
              loaderMarkerRegex,
              loaderTemplate,
            );
            loaderInjected = true;
            console.log(
              `[html-templates] ✓ Injected base-loader into ${ctx.filename || 'HTML'}`,
            );
          }
        }

        // Auto-inject if markers not found
        if (!headInjected && headTemplate) {
          transformed = transformed.replace(
            '</head>',
            `${headTemplate}\n  </head>`,
          );
          console.log(
            `[html-templates] ⚠ Auto-injected base-head (no marker found)`,
          );
        }

        if (!loaderInjected && loaderTemplate) {
          transformed = transformed.replace(
            /<body([^>]*)>/,
            `<body$1>\n    ${loaderTemplate}\n`,
          );
          console.log(
            `[html-templates] ⚠ Auto-injected base-loader (no marker found)`,
          );
        }

        // --- PATH CORRECTION ---
        // Calculate relative root path based on current file location
        let rootPath = './';
        if (ctx.filename) {
          const currentDir = dirname(ctx.filename);
          const relativePath = relative(currentDir, process.cwd());
          if (relativePath) {
            // Join with forward slash for URLs and ensure trailing slash
            rootPath = relativePath.split(sep).join('/') + '/';
          }
        }

        // Replace absolute paths with relative paths to support nested pages and file:// protocol
        // Targets: content/, pages/, assets/, manifest.json, sitemap.xml, sw.js
        const pathRegex =
          /(href|src)=(["'])\/(content|pages|assets|manifest\.json|sitemap\.xml|sw\.js)/g;

        transformed = transformed.replace(
          pathRegex,
          (match, attr, quote, path) => {
            return `${attr}=${quote}${rootPath}${path}`;
          },
        );

        return transformed;
      },
    },
  };
}
