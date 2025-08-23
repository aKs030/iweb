#!/bin/sh
# Portable script: scan for CSS custom properties outside of root.css and produce a report.
# Usage:
#   ./scripts/consolidate-tokens.sh           -> produce report; exit 0 if none found; exit 4 if externals found
#   ./scripts/consolidate-tokens.sh --apply   -> append placeholders to root.css (destructive)
#   ./scripts/consolidate-tokens.sh --patch   -> do not modify files; create unified patch file `consolidation-changes.patch`

MODE="report"
if [ "$1" = "--apply" ]; then MODE="apply"; fi
if [ "$1" = "--patch" ]; then MODE="patch"; fi

ROOT_FILE="content/webentwicklung/root.css"
if [ ! -f "$ROOT_FILE" ]; then
  echo "ERROR: $ROOT_FILE not found. Aborting." >&2
  exit 2
fi

TMPROOT="/tmp/root_vars_$$.txt"
TMPALL="/tmp/all_vars_$$.txt"
REPORT="consolidation-report.txt"
PATCHFILE="consolidation-changes.patch"

# extract variables from root.css safely
grep -E -o -e "--[a-zA-Z0-9_-]+" "$ROOT_FILE" | sed -E 's/.*(--[a-zA-Z0-9_-]+).*/\1/' | sort -u > "$TMPROOT"

# search all files except .git and root file
find . -type f \( -name "*.css" -o -name "*.html" -o -name "*.js" \) -not -path "./.git/*" -not -path "./content/webentwicklung/root.css" -print0 |
  xargs -0 grep -Hn -E -e "--[a-zA-Z0-9_-]+" 2>/dev/null | sed -E 's/.*(--[a-zA-Z0-9_-]+).*/\1|&/' | sort -u > "$TMPALL" || true

rm -f "$REPORT" "$PATCHFILE"
echo "Consolidation Report - $(date)" > "$REPORT"
echo "Root tokens: $(wc -l < "$TMPROOT" 2>/dev/null)" >> "$REPORT"
echo "" >> "$REPORT"

FOUND=0

# iterate over unique vars found in TMPALL
cut -d'|' -f1 "$TMPALL" | sort -u | while read -r var; do
  # skip empty
  [ -z "$var" ] && continue
  if grep -F -x "$var" "$TMPROOT" >/dev/null 2>&1; then
    continue
  fi
  FOUND=1
  echo "Variable: $var" >> "$REPORT"
  # list files/lines containing it
  find . -type f \( -name "*.css" -o -name "*.html" -o -name "*.js" \) -not -path "./.git/*" -not -path "./content/webentwicklung/root.css" -print0 |
    xargs -0 grep -Hn -F -- "$var" 2>/dev/null >> "$REPORT" || true
  echo "---" >> "$REPORT"
done

if [ "$FOUND" -eq 1 ]; then
  echo "Report generated: $REPORT"
  if [ "$MODE" = "apply" ]; then
    echo "Applying missing tokens to $ROOT_FILE (appending with empty default)"
    printf "\n/* Auto-appended tokens (%s) */\n" "$(date)" >> "$ROOT_FILE"
    cut -d'|' -f1 "$TMPALL" | sort -u | while read -r var; do
      [ -z "$var" ] && continue
      if grep -F -x "$var" "$TMPROOT" >/dev/null 2>&1; then continue; fi
      printf "  %s: /* TODO: set value */;\n" "$var" >> "$ROOT_FILE"
    done
    echo "Applied. Please review $ROOT_FILE.";
  elif [ "$MODE" = "patch" ]; then
    # create a temporary new root file with appended placeholders
    NEWROOT="/tmp/root_new_$$.css"
    cp "$ROOT_FILE" "$NEWROOT"
    printf "\n/* Auto-appended tokens (%s) */\n" "$(date)" >> "$NEWROOT"
    cut -d'|' -f1 "$TMPALL" | sort -u | while read -r var; do
      [ -z "$var" ] && continue
      if grep -F -x "$var" "$TMPROOT" >/dev/null 2>&1; then continue; fi
      printf "  %s: /* TODO: set value */;\n" "$var" >> "$NEWROOT"
    done
    # produce unified diff
    if command -v diff >/dev/null 2>&1; then
      diff -u "$ROOT_FILE" "$NEWROOT" > "$PATCHFILE" || true
      if [ -s "$PATCHFILE" ]; then
        echo "Patch generated: $PATCHFILE"
      else
        rm -f "$PATCHFILE"
        echo "No patch produced."
      fi
    else
      echo "diff not available; cannot create patch." >&2
    fi
    rm -f "$NEWROOT"
  fi
else
  echo "No external tokens found. Nothing to report."
fi

rm -f "$TMPROOT" "$TMPALL"

# exit code: 0 when none found; 4 when externals found (so CI can fail), 0 if apply/patch performed but externals existed
if [ "$FOUND" -eq 1 ]; then
  # if we applied changes in-place, return 0 to indicate action taken; if in patch/report-only mode, return non-zero to signal attention
  if [ "$MODE" = "apply" ]; then
    exit 0
  fi
  exit 4
fi

exit 0
