import {
  getMenuShellMarkup,
  getFooterShellMarkup,
} from '../../content/core/html-shells.js';
/**
 * Edge Side Includes (ESI) - Shell Injector
 *
 * Injects the global Header (Site Menu) and Footer directly into
 * the HTML stream at the edge. The client-side logic in
 * `footer-hydration.js` detects these and skips client-side rendering.
 *
 * @version 1.0.0
 */

/**
 * Handles injecting the header right after the skip-link.
 */
export class HeaderInjector {
  constructor(url) {
    // Some routes (e.g. ?menuShadow=1) need shadow dom marker
    let shadowDom = false;
    try {
      if (url.searchParams.get('menuShadow') === '1') {
        shadowDom = true;
      }
    } catch {
      /* ignore */
    }
    this.markup = `
<header class="site-header">
  <site-menu data-injected-by="edge-middleware" data-shell="true" ${shadowDom ? 'data-shadow-dom="true"' : ''}>
    ${getMenuShellMarkup()}
  </site-menu>
</header>
`;
    this.injected = false;
  }

  element(el) {
    if (this.injected) return;
    this.injected = true;
    el.after(this.markup, { html: true });
  }
}

/**
 * Handles injecting the footer right before </body>.
 * (If element matches body, we append it inside the body at the end).
 */
export class FooterInjector {
  constructor() {
    this.markup = `
<site-footer src="/content/components/footer/footer" data-shell="true" data-injected-by="edge-middleware">
  ${getFooterShellMarkup()}
</site-footer>
`;
  }

  element(el) {
    el.append(this.markup, { html: true });
  }
}
