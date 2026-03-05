## 2026-03-01 - [Accessible Custom Toggles in Cookie Banner]

**Learning:** Custom toggle switches built with `<input type="checkbox">` and CSS often rely on adjacent `<label>` elements or sibling headings for visual context, but lack semantic connection for screen readers if `aria-labelledby` or `aria-describedby` isn't used. Specifically, the cookie setting toggles had headings describing the setting, but the inputs themselves had no accessible name.
**Action:** When creating custom `<label>` based toggles where the descriptive text is outside the label itself, always ensure the `<input>` element uses `aria-labelledby` (pointing to the setting title ID) and `aria-describedby` (pointing to the setting description ID) to provide full context to screen reader users.

## 2026-03-05 - [Tooltips on Icon-Only Action Buttons]

**Learning:** Floating Action Buttons (FABs) or icon-only buttons often serve as primary or secondary actions (like 'Scroll to Top' or 'Share'). While an `aria-label` provides the necessary context for screen readers, sighted users unfamiliar with the icon's convention may remain confused. Adding a `title` attribute acts as a native, lightweight tooltip to clarify the action visually upon hover.
**Action:** When creating icon-only interactive elements, always pair `aria-label` (for a11y) with a native `title` (for visual UX) to ensure the intent is accessible to all user types without relying on custom tooltip components.
