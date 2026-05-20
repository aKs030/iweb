export { ensureFooterAndTrigger } from "./footer-hydration.js";
export { footerSignals, subscribeFooterState, whenFooterReady } from "./state.js";

let footerModulePromise = null;

export function loadSiteFooter() {
  footerModulePromise ||= import("./footer.js");
  return footerModulePromise;
}

export async function openFooter() {
  const footerModule = await loadSiteFooter();
  return footerModule.openFooter();
}

export async function closeFooter() {
  const footerModule = await loadSiteFooter();
  return footerModule.closeFooter();
}

export async function getSiteFooterElement() {
  const footerModule = await loadSiteFooter();
  return footerModule.SiteFooter;
}
