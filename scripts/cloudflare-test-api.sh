#!/usr/bin/env bash
set -euo pipefail

CF_API_TOKEN=${CF_API_TOKEN:-}
CF_ACCOUNT_ID=${CF_ACCOUNT_ID:-}
CF_ZONE_ID=${CF_ZONE_ID:-}
SCRIPT_NAME=${SCRIPT_NAME:-iweb-security-headers}
SCRIPT_FILE=${SCRIPT_FILE:-cloudflare/workers/headers.js}

usage() {
  cat <<EOF
Usage: $0 <command>
Commands:
  ping            - verify that credentials can access account and zone
  upload-script   - upload ${SCRIPT_FILE} as a Worker script named ${SCRIPT_NAME}
  create-route    - create a worker route (requires CF_ZONE_ID)

Environment vars accepted (overrides GitHub secrets when testing locally):
  CF_API_TOKEN, CF_ACCOUNT_ID, CF_ZONE_ID

EOF
}

if [ "$#" -lt 1 ]; then
  usage
  exit 1
fi

cmd="$1"

if [ -z "$CF_API_TOKEN" ]; then
  echo "Error: CF_API_TOKEN is not set. Export CF_API_TOKEN or use GitHub Actions to supply it." >&2
  exit 2
fi

common_curl() {
  curl -sS -H "Authorization: Bearer ${CF_API_TOKEN}" -H "Content-Type: application/json" "$@"
}

case "$cmd" in
  ping)
    echo "Checking account access..."
    common_curl "https://api.cloudflare.com/client/v4/accounts" | jq || echo "(jq not available, raw output above)"

    if [ -n "$CF_ACCOUNT_ID" ]; then
      echo "Checking account details for $CF_ACCOUNT_ID..."
      common_curl "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}" | jq || true
    fi

    if [ -n "$CF_ZONE_ID" ]; then
      echo "Checking zone details for $CF_ZONE_ID..."
      common_curl "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}" | jq || true
    else
      echo "CF_ZONE_ID not set; skipping zone check. To check a zone by name, set CF_ZONE_ID or query zones?name=example.com"
    fi
    ;;

  upload-script)
    if [ ! -f "$SCRIPT_FILE" ]; then
      echo "Error: script file $SCRIPT_FILE not found." >&2
      exit 3
    fi
    if [ -z "$CF_ACCOUNT_ID" ]; then
      echo "Error: CF_ACCOUNT_ID is required to upload script." >&2
      exit 4
    fi
    echo "Uploading $SCRIPT_FILE as Worker $SCRIPT_NAME to account $CF_ACCOUNT_ID..."
    # Note: this uses multipart/form-data; for complex builds use wrangler
    curl -sS -X PUT "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -F "metadata={\"main\":\"${SCRIPT_FILE}\"};type=application/json" \
      -F "script=@${SCRIPT_FILE}" | jq || true
    ;;

  create-route)
    if [ -z "$CF_ZONE_ID" ]; then
      echo "Error: CF_ZONE_ID is required to create a route." >&2
      exit 5
    fi
    if [ -z "$SCRIPT_NAME" ]; then
      echo "Error: SCRIPT_NAME is empty" >&2
      exit 6
    fi
    read -r -p "Enter route pattern (e.g. *abdulkerimsesli.de/*): " ROUTE
    if [ -z "$ROUTE" ]; then
      echo "No route provided; aborting." >&2
      exit 7
    fi
    echo "Creating route $ROUTE -> $SCRIPT_NAME in zone $CF_ZONE_ID..."
    curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/workers/routes" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "{\"pattern\":\"${ROUTE}\",\"script\":\"${SCRIPT_NAME}\"}" | jq || true
    ;;

  *)
    usage
    exit 1
    ;;
esac
