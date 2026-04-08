function collectQueryRoots() {
  /** @type {(Document|ShadowRoot)[]} */
  const roots = [document];
  /** @type {Set<Document|ShadowRoot>} */
  const visitedRoots = new Set(roots);

  for (let index = 0; index < roots.length; index += 1) {
    const root = roots[index];
    root.querySelectorAll('*').forEach((element) => {
      if (element.shadowRoot && !visitedRoots.has(element.shadowRoot)) {
        visitedRoots.add(element.shadowRoot);
        roots.push(element.shadowRoot);
      }
    });
  }

  return roots;
}

export function queryFirst(selectors) {
  if (!selectors) return null;

  const selectorList = String(selectors)
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean);

  const roots = collectQueryRoots();

  for (const selector of selectorList) {
    for (const root of roots) {
      const target = root.querySelector(selector);
      if (target) return target;
    }
  }

  return null;
}

export function getSiteMenuHost() {
  return /** @type {any} */ (document.querySelector('site-menu'));
}

export function getMenuToggleButton() {
  return queryFirst(
    '.site-menu__toggle, .menu-toggle, [data-menu-toggle], button[aria-label*="Menue"], button[aria-label*="Menu"], button[aria-label*="Menü"]',
  );
}

export function getRobotAvatarButton() {
  return /** @type {HTMLButtonElement|null} */ (queryFirst('.robot-avatar'));
}

export function getRobotChatWindow() {
  return /** @type {HTMLElement|null} */ (
    document.getElementById('robot-chat-window')
  );
}

export function getRobotImageUploadInput() {
  return /** @type {HTMLInputElement|null} */ (
    document.getElementById('robot-image-upload')
  );
}
