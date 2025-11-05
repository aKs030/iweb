# Proposal: index.css — hide-section headers block

File: `content/webentwicklung/index.css` — the block that hides section headers uses multiple `!important` rules (display/visibility/opacity/height/margin/padding). This is a visual & accessibility sensitive rule and should be handled carefully.

Goal
- Propose a safer alternative to the `!important`-heavy hide-block, for example using a dedicated modifier class (e.g. `.page--embedded`) and more specific selectors instead of forcing via `!important`.

Suggested approach
- Replace the global `#hero .section-header, ... { display: none !important; visibility: hidden !important; ... }` with either:
  - an explicit page-level modifier that is applied only where needed, or
  - a small JS-based runtime toggle that adds/removes a scoped class, or
  - increase selector specificity without `!important` (e.g. `body.embed #hero .section-header { display:none; }`).

Draft Hunk (example, do not auto-apply):
```diff
-#hero .section-header, #hero .section-subtitle, #features .section-header, #features .section-subtitle, #about .section-header, #about .section-subtitle {
-  display: none !important;
-  visibility: hidden !important;
-  opacity: 0 !important;
-  height: 0 !important;
-  margin: 0 !important;
-  padding: 0 !important;
-}
+/* consider: scoped modifier to avoid !important */
+body.embed #hero .section-header,
+body.embed #hero .section-subtitle {
+  display: none;
+  visibility: hidden;
+  opacity: 0;
+  height: 0;
+  margin: 0;
+  padding: 0;
+}
```

Testing notes
- Apply the scoped modifier on a page and verify via a visual diff; ensure screen-reader behavior remains correct.

If you want, I can prepare a follow-up branch that applies the concrete conservative hunk (one selector at a time) so reviewers can test quickly.

Signed-off-by: automation
