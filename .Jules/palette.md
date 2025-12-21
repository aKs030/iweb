## 2024-10-24 - Accessibility for Custom Chat Interfaces
**Learning:** Custom chat widgets often lack basic accessibility features like ARIA labels on inputs/buttons and `aria-live` regions for messages, making them invisible to screen readers. Also, keyboard users expect Escape to close modals/overlays.
**Action:** Always audit custom interactive components for ARIA labels, live regions for dynamic content, and standard keyboard shortcuts (Esc to close).
