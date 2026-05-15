/**
 * Edge Side Includes (ESI) - Shell Injector
 *
 * Injects the global Header (Site Menu) and Footer directly into
 * the HTML stream at the edge. The client-side logic in
 * `footer-hydration.js` detects these and skips client-side rendering.
 *
 * @version 1.0.0
 */

const MENU_SHELL_MARKUP = `
<div class="site-logo__container">
	<span class="site-title">Abdulkerim Sesli</span>
	<span class="site-subtitle show">Portfolio</span>
</div>
<nav class="site-menu" aria-label="Hauptnavigation">
	<ul class="site-menu__list">
		<li><a href="/">Startseite</a></li>
		<li><a href="/projekte/">Projekte</a></li>
		<li><a href="/gallery/">Fotos</a></li>
		<li><a href="/videos/">Videos</a></li>
		<li><a href="/blog/">Blog</a></li>
		<li><a href="/about/">Über mich</a></li>
	</ul>
</nav>
<button
	type="button"
	class="site-menu__toggle"
	aria-label="Menü"
	aria-expanded="false"
>
	<div class="hamburger-container">
		<span class="hamburger-line hamburger-line--top"></span>
		<span class="hamburger-line hamburger-line--middle"></span>
		<span class="hamburger-line hamburger-line--bottom"></span>
	</div>
</button>
`;

const FOOTER_SHELL_MARKUP = `
<footer class="site-footer" role="contentinfo">
	<svg class="footer-icon-sprite" aria-hidden="true" focusable="false">
		<symbol id="footer-icon-cookie" viewBox="0 0 24 24">
			<path
				d="M21 12.8A9 9 0 1 1 11.2 3a4.8 4.8 0 0 0 5.6 5.6A4.8 4.8 0 0 0 21 12.8Z"
			/>
			<circle cx="9" cy="12" r="1" />
			<circle cx="15.5" cy="11" r="1" />
			<circle cx="12.5" cy="15" r="1" />
		</symbol>
		<symbol id="footer-icon-doc-check" viewBox="0 0 24 24">
			<path
				d="M7 3h8l5 5v13a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 21V4.5A1.5 1.5 0 0 1 7 3Z"
			/>
			<path d="M15 3v5h5" />
			<path d="m9 15 2 2 4-4" />
		</symbol>
		<symbol id="footer-icon-shield" viewBox="0 0 24 24">
			<path d="M12 22s7-3.5 7-9V6.2L12 3 5 6.2V13c0 5.5 7 9 7 9Z" />
		</symbol>
	</svg>

	<div class="footer-min">
		<div class="footer-min-main">
			<span class="footer-copyright">
				© <span class="year">2026</span>
				<a href="/" class="brand-link" aria-label="Zur Startseite">
					<span class="full-name">Abdulkerim Sesli</span>
					<span class="short-name">aKs</span>
				</a>
			</span>

			<div
				id="cookie-banner"
				class="cookie-inline hidden"
				role="dialog"
				aria-label="Cookie-Einstellungen"
			>
				<span class="cookie-emoji" aria-hidden="true">🍪</span>
				<span class="cookie-text">
					<span class="full" data-i18n="footer.cookie_banner.text"
						>Wir nutzen Analytics</span
					>
					<span class="short" data-i18n="footer.cookie_banner.text_short"
						>Analytics?</span
					>
				</span>
				<button
					id="accept-cookies"
					class="btn-accept"
					type="button"
					aria-label="Cookies akzeptieren"
				>
					<span class="full" data-i18n="footer.cookie_banner.accept"
						>Akzeptieren</span
					>
					<span class="short" data-i18n="footer.cookie_banner.accept_short"
						>✓</span
					>
				</button>
				<button
					id="reject-cookies"
					class="btn-reject"
					type="button"
					aria-label="Cookies ablehnen"
				>
					<span class="full" data-i18n="footer.cookie_banner.decline"
						>Ablehnen</span
					>
					<span class="short" data-i18n="footer.cookie_banner.decline_short"
						>✗</span
					>
				</button>
			</div>

			<nav class="footer-nav" aria-label="Footer Navigation">
				<button
					id="cookie-btn"
					class="nav-btn"
					type="button"
					data-cookie-trigger
					aria-label="Cookie-Einstellungen öffnen"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<use href="#footer-icon-cookie"></use>
					</svg>
					<span data-i18n="footer.legal.cookies">Cookies</span>
				</button>
				<a href="/impressum/" class="nav-btn" aria-label="Impressum">
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<use href="#footer-icon-doc-check"></use>
					</svg>
					<span data-i18n="footer.legal.impressum">Legal</span>
				</a>
				<a href="/datenschutz/" class="nav-btn" aria-label="Datenschutz">
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<use href="#footer-icon-shield"></use>
					</svg>
					<span data-i18n="footer.legal.privacy">Privacy</span>
				</a>
			</nav>
		</div>
		<button
			class="footer-expand-toggle"
			type="button"
			data-footer-trigger
			aria-expanded="false"
			aria-controls="footer-content"
			aria-label="Footer erweitern"
		>
			<span aria-hidden="true">+</span>
			<span class="visually-hidden">Footer erweitern</span>
		</button>
	</div>
</footer>
`;

/**
 * Handles injecting the header right after the skip-link.
 */
export class HeaderInjector {
	constructor(url) {
		// Some routes (e.g. ?menuShadow=1) need shadow dom marker
		let shadowDom = false;
		try {
			if (url.searchParams.get("menuShadow") === "1") {
				shadowDom = true;
			}
		} catch {
			/* ignore */
		}
		this.markup = `
<header class="site-header">
  <site-menu data-injected-by="edge-middleware" data-shell="true" ${shadowDom ? 'data-shadow-dom="true"' : ""}>
		${MENU_SHELL_MARKUP}
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
<site-footer data-shell="true" data-injected-by="edge-middleware">
  ${FOOTER_SHELL_MARKUP}
</site-footer>
`;
	}

	element(el) {
		el.append(this.markup, { html: true });
	}
}
