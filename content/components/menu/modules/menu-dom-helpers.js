/**
 * @param {Element|null} element
 * @returns {element is HTMLElement}
 */
export function isConnectedHTMLElement(element) {
  return element instanceof HTMLElement && element.isConnected;
}

/**
 * @param {HTMLElement|ShadowRoot} container
 * @param {HTMLElement|null} [host]
 * @returns {HTMLElement|null}
 */
export function resolveMenuHost(container, host = null) {
  const resolvedHost =
    host || (container instanceof ShadowRoot ? container.host : container);
  return resolvedHost instanceof HTMLElement ? resolvedHost : null;
}
