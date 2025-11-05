# Proposal: menu.css — typography & branding !important

This proposal collects the `!important` occurrences in `content/webentwicklung/menu/menu.css` that affect typography, font-weight, color and positioning. These are high-risk for automated removal because they impact branding and visual identity.

Goal
- Provide a conservative, reviewer-friendly proposal to remove or narrow `!important` usage while preserving visual identity.

What I propose (draft)
- Do NOT apply direct code changes in this branch. Instead, this proposal contains suggested hunks and rationale so reviewers can visually test before any commit is merged.

Suggested hunks (examples)

1) Replace `color: var(--dynamic-menu-label-primary) !important;` with the same rule without `!important` and add a more specific selector if needed (e.g. `.site-header .site-logo { color: var(--dynamic-menu-label-primary); }`).

Hunk (example):
```diff
-  color: var(--dynamic-menu-label-primary) !important;
+  /* consider: */
+  color: var(--dynamic-menu-label-primary);
```

2) Replace forced `font-weight: 700 !important;` by removing `!important` and, if necessary, using a component-specific class (`.site-logo.bold`) to increase specificity.

Rationale
- Typography and brand colours are often intentionally forced to avoid accidental overrides. Any change must be visually reviewed across themes.

Testing notes for reviewers
- Load the branch into a deployed review app or locally and inspect the header in Desktop and Mobile breakpoints.
- Compare fonts, weights, and link colors with the baseline (main). Use screenshots or the PR comment thread.

If you want, I can create a second branch that includes the actual conservative hunks (one small removal per PR) after you review this proposal.

---
Files referenced:
- `content/webentwicklung/menu/menu.css` (lines with `!important` near typography and color)

Signed-off-by: automation
