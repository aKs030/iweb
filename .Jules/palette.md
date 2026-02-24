# Palette's UX Journal

## 2026-03-04 - Initial Setup

**Learning:** Established baseline for UX improvements.
**Action:** Ready to improve contact form accessibility.

## 2026-03-04 - Contact Form Accessibility

**Learning:** Screen readers often lose context when content is replaced (like a success message replacing a form).
**Action:** Always use `ref.focus()` and `tabIndex="-1"` on the new container to guide focus immediately.
