#!/usr/bin/env bash
set -euo pipefail

# Check whether it's safe to enable a global redirect rule that removes .html
# Strategy:
# 1. Find all .html files under repo (exclude components, assets, node_modules, test-results)
# 2. For each file, compute a candidate target URL path (remove .html; special-case index.html and /pages/<name>/<name>.html)
# 3. Consider a file safe if either:
#    - The target path corresponds to an existing folder with index.html
#    - OR there is an explicit mapping in `_redirects` mapping the .html to the target
# If all files are safe, exit 0. Otherwise list problematic files and exit 2.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REDIRECTS_FILE="$ROOT_DIR/_redirects"
echo "Checking .html removal safety in $ROOT_DIR"

REDIRECT_LINES=""
if [ -f "$REDIRECTS_FILE" ]; then
  # remove comments/empty lines
  REDIRECT_LINES=$(sed -n '/^[[:space:]]*[^#[:space:]]/p' "$REDIRECTS_FILE") || true
fi

# If a global .html removal rule is present, consider it safe by definition
if [ -n "$REDIRECT_LINES" ] ; then
  has_global=$(echo "$REDIRECT_LINES" | awk '($1=="/:splat.html"){found=1; print "yes"; exit} END{if(found) exit; print "no"}') || true
  if [ "$has_global" = "yes" ]; then
    echo "Global .html removal rule detected in _redirects — considered safe."
    exit 0
  fi
fi

unsafe=0
while IFS= read -r file; do
  rel="${file#$ROOT_DIR}"
  # ignore component internals and assets
  case "$rel" in
    /content/components/*|/content/assets/*|*/node_modules/*|*/test-results/*) continue ;;
  esac

  # compute candidate
  if [[ "$rel" =~ /index.html$ ]]; then
    candidate="${rel%index.html}"
  else
    # special-case: /pages/name/name.html -> /name/
    if [[ "$rel" =~ ^/pages/([^/]+)/([^/]+)\.html$ ]]; then
      if [ "${BASH_REMATCH[1]}" = "${BASH_REMATCH[2]}" ]; then
        name="${BASH_REMATCH[1]}"
        candidate="/${name}/"
      else
        candidate="${rel%.html}"
        case "$candidate" in
          */) ;;
          *) candidate="$candidate/" ;;
        esac
      fi
    else
      candidate="${rel%.html}"
      case "$candidate" in
        */) ;;
        *) candidate="$candidate/" ;;
      esac
    fi
  fi

  # normalize candidate path on filesystem (map to directory)
  fs_dir="$ROOT_DIR${candidate%/}"

  # check conditions
  ok=0
  if [ -d "$fs_dir" ] && [ -f "$fs_dir/index.html" ]; then
    ok=1
  fi

  # check explicit redirect exists from rel -> candidate
  if [ $ok -eq 0 ] && [ -n "$REDIRECT_LINES" ]; then
    src1="$rel"
    src2="${rel#/pages}"
    # consider any explicit redirect FROM the source as acceptable (target may differ)
    match1=$(echo "$REDIRECT_LINES" | awk -v s="$src1" '($1==s){print "yes"; found=1; exit} END{if(found) exit; print "no"}') || true
    match2=$(echo "$REDIRECT_LINES" | awk -v s="$src2" '($1==s){print "yes"; found=1; exit} END{if(found) exit; print "no"}') || true
    if [ "$match1" = "yes" ] || [ "$match2" = "yes" ]; then
      ok=1
    fi
  fi

  if [ $ok -eq 0 ]; then
    echo "UNSAFE: $rel -> candidate $candidate (no folder/index.html and no redirect)"
    unsafe=$((unsafe+1))
  fi

done < <(find "$ROOT_DIR" -type f -name '*.html' | sort)

if [ $unsafe -eq 0 ]; then
  echo "OK: safe to enable global .html removal rule"
  exit 0
else
  echo "Found $unsafe unsafe .html files. Fix mappings or add explicit redirects before enabling global rule."
  exit 2
fi
