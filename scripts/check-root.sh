#!/usr/bin/env bash
# Check that root.css exists
ROOT="content/webentwicklung/root.css"
if [ ! -f "$ROOT" ]; then
  echo "ERROR: $ROOT not found"
  exit 2
fi

# 1) Find HTML files that include index.css but not root.css before it
FAIL=0
HTML_FILES=$(grep -rl "content/webentwicklung/index.css" . --include="*.html" || true)
for f in $HTML_FILES; do
  # check order: root.css should appear before index.css
  idx_root=$(grep -n "content/webentwicklung/root.css" "$f" | head -1 | cut -d: -f1 || true)
  idx_index=$(grep -n "content/webentwicklung/index.css" "$f" | head -1 | cut -d: -f1 || true)
  if [ -z "$idx_root" ]; then
    echo "MISSING root.css in: $f"
    FAIL=1
  elif [ -n "$idx_index" ] && [ "$idx_root" -gt "$idx_index" ]; then
    echo "WRONG ORDER in: $f (root.css appears after index.css)"
    FAIL=1
  fi
done

# 2) Ensure no other CSS files contain a :root{ block (except root.css)
OTHER_ROOTS=$(grep -R --line-number ":root{\|:root {" --exclude-dir=.git content | grep -v "content/webentwicklung/root.css" || true)
if [ -n "$OTHER_ROOTS" ]; then
  echo "Found local :root declarations in files:" 
  echo "$OTHER_ROOTS"
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  echo "CHECK FAILED"
  exit 1
fi

echo "All checks passed"
exit 0
