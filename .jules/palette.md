## 2026-03-01 - [Accessible Custom Toggles in Cookie Banner]

**Learning:** Custom toggle switches built with `<input type="checkbox">` and CSS often rely on adjacent `<label>` elements or sibling headings for visual context, but lack semantic connection for screen readers if `aria-labelledby` or `aria-describedby` isn't used. Specifically, the cookie setting toggles had headings describing the setting, but the inputs themselves had no accessible name.
**Action:** When creating custom `<label>` based toggles where the descriptive text is outside the label itself, always ensure the `<input>` element uses `aria-labelledby` (pointing to the setting title ID) and `aria-describedby` (pointing to the setting description ID) to provide full context to screen reader users.
