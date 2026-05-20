export { ensureFooterAndTrigger } from "./footer-hydration.js";
export { footerSignals, subscribeFooterState } from "./state.js";

let footerModulePromise = null;

function loadSiteFooter() {
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
