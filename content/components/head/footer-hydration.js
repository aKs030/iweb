import { whenFooterReady } from "#footer/state.js";
import { cancelIdleTask, scheduleIdleTask } from "#core/async-utils.js";
import { createLogger } from "#core/logger.js";
import { resourceHints } from "#core/resource-hints.js";

const log = createLogger("head-footer");

const FOOTER_MODULE_HREF = "/content/components/footer/index.js";
const FOOTER_TRIGGER_SELECTOR = '[data-footer-trigger], a[href="#footer"]';
const FOOTER_COOKIE_TRIGGER_SELECTOR = "[data-cookie-trigger]";
const FOOTER_CONSENT_ACTION_SELECTOR = "#accept-cookies, #reject-cookies";
const FOOTER_IDLE_HYDRATION_TIMEOUT_MS = 4000;

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

	<!-- Minimized State -->
	<div class="footer-min">
		<div class="footer-min-main">
			<span class="footer-copyright">
				© <span class="year">2026</span>
				<a href="/" class="brand-link" aria-label="Zur Startseite">
					<span class="full-name">Abdulkerim Sesli</span>
					<span class="short-name">aKs</span>
				</a>
			</span>

			<!-- Cookie Banner Inline -->
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

let footerModulePromise = null;
let footerHydrationAttached = false;

const getFooterTrigger = (target) => {
	if (!(target instanceof Element)) return null;
	return target.closest(FOOTER_TRIGGER_SELECTOR);
};

const getCookieTrigger = (target) => {
	if (!(target instanceof Element)) return null;
	return target.closest(FOOTER_COOKIE_TRIGGER_SELECTOR);
};

const getConsentActionTrigger = (target) => {
	if (!(target instanceof Element)) return null;
	return target.closest(FOOTER_CONSENT_ACTION_SELECTOR);
};

const preloadFooterModule = () => {
	resourceHints.modulePreload(FOOTER_MODULE_HREF);
};

const loadFooterModule = async () => {
	if (customElements.get("site-footer")) return null;
	if (footerModulePromise) return footerModulePromise;

	preloadFooterModule();
	footerModulePromise = import("#footer/index.js").catch((error) => {
		footerModulePromise = null;
		log.warn("failed to load footer module", error);
		return null;
	});

	return footerModulePromise;
};

const isFooterReady = () => {
	const footer = document.querySelector("site-footer");
	return Boolean(
		footer &&
			typeof (/** @type {any} */ (footer).open) === "function" &&
			footer.querySelector("footer.site-footer"),
	);
};

const waitForFooterReady = () =>
	new Promise((resolve) => {
		if (isFooterReady()) {
			resolve(document.querySelector("site-footer"));
			return;
		}

		whenFooterReady({ timeout: 1500 })
			.catch(() => null)
			.finally(() => {
				resolve(document.querySelector("site-footer"));
			});
	});

const setupFooterModuleHydration = (siteFooter) => {
	if (
		footerHydrationAttached ||
		!siteFooter ||
		customElements.get("site-footer")
	) {
		return;
	}

	footerHydrationAttached = true;

	let observer = null;
	let idleHandle = null;

	const cleanup = () => {
		document.removeEventListener("pointerover", handleTriggerIntent);
		document.removeEventListener("focusin", handleTriggerIntent);
		document.removeEventListener("click", handleTriggerClick, true);

		if (observer) {
			observer.disconnect();
			observer = null;
		}

		cancelIdleTask(idleHandle);
		idleHandle = null;
	};

	const hydrateFooterModule = async () => {
		try {
			await loadFooterModule();
		} finally {
			cleanup();
		}
	};

	const handleTriggerIntent = (event) => {
		if (
			!getFooterTrigger(event.target) &&
			!getCookieTrigger(event.target) &&
			!getConsentActionTrigger(event.target)
		) {
			return;
		}
		preloadFooterModule();
	};

	const handleTriggerClick = async (event) => {
		if (customElements.get("site-footer") && isFooterReady()) return;
		const footerTrigger = getFooterTrigger(event.target);
		const cookieTrigger = getCookieTrigger(event.target);
		const consentActionTrigger = getConsentActionTrigger(event.target);
		if (!footerTrigger && !cookieTrigger && !consentActionTrigger) return;

		event.preventDefault();

		const footerModule = await loadFooterModule();
		const footer = await waitForFooterReady();

		try {
			if (
				consentActionTrigger instanceof HTMLElement &&
				consentActionTrigger.id
			) {
				const hydratedConsentTrigger = footer?.querySelector?.(
					`#${consentActionTrigger.id}`,
				);
				if (hydratedConsentTrigger instanceof HTMLButtonElement) {
					hydratedConsentTrigger.click();
					return;
				}
			}

			if (cookieTrigger) {
				const hydratedCookieTrigger = footer?.querySelector?.(
					FOOTER_COOKIE_TRIGGER_SELECTOR,
				);
				if (
					hydratedCookieTrigger instanceof HTMLButtonElement ||
					hydratedCookieTrigger instanceof HTMLAnchorElement
				) {
					hydratedCookieTrigger.click();
					return;
				}
			}

			footerModule?.openFooter?.();
			/** @type {any} */ (footer)?.open?.();
		} catch (error) {
			log.warn("failed to open lazily hydrated footer", error);
		}
	};

	document.addEventListener("pointerover", handleTriggerIntent, {
		passive: true,
	});
	document.addEventListener("focusin", handleTriggerIntent);
	document.addEventListener("click", handleTriggerClick, true);

	if ("IntersectionObserver" in globalThis) {
		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						void hydrateFooterModule();
					}
				});
			},
			{ rootMargin: "600px 0px" },
		);
		observer.observe(siteFooter);
	}

	idleHandle = scheduleIdleTask(
		() => {
			void hydrateFooterModule();
		},
		{
			timeout: FOOTER_IDLE_HYDRATION_TIMEOUT_MS,
			fallbackDelay: FOOTER_IDLE_HYDRATION_TIMEOUT_MS,
		},
	);
};

export function ensureFooterAndTrigger() {
	try {
		const run = () => {
			if (!document.body) return;

			let siteMenu = document.querySelector("site-menu");
			if (!siteMenu) {
				let headerEl = document.querySelector("header.site-header");
				if (!headerEl) {
					headerEl = document.createElement("header");
					headerEl.className = "site-header";
					document.body.insertBefore(headerEl, document.body.firstChild);
				}

				const oldContainer = document.getElementById("menu-container");
				if (oldContainer) oldContainer.remove();

				siteMenu = document.createElement("site-menu");
				try {
					const params = new URLSearchParams(globalThis.location.search || "");
					if (params.get("menuShadow") === "1") {
						siteMenu.setAttribute("data-shadow-dom", "true");
					}
				} catch {
					/* ignore */
				}
				/** @type {any} */ (siteMenu).dataset.injectedBy = "head-inline";
				/** @type {any} */ (siteMenu).dataset.shell = "true";
				siteMenu.innerHTML = MENU_SHELL_MARKUP;
				headerEl.appendChild(siteMenu);
			}

			let siteFooter = document.querySelector("site-footer");
			if (!siteFooter) {
				siteFooter = document.createElement("site-footer");
				/** @type {any} */ (siteFooter).dataset.shell = "true";
				siteFooter.innerHTML = FOOTER_SHELL_MARKUP;
				document.body.appendChild(siteFooter);
			}

			setupFooterModuleHydration(siteFooter);
		};

		if (document.body) {
			run();
			return;
		}

		const observer = new MutationObserver(() => {
			if (!document.body) return;
			observer.disconnect();
			run();
		});
		observer.observe(document.documentElement, { childList: true });
	} catch (error) {
		log.warn("ensure footer/trigger setup failed", error);
	}
}
