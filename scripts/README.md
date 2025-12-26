cleanup-actions-caches.sh

Usage

1. Create a Personal Access Token (PAT) with the necessary repo permissions (for private repos include `repo` scope) or make sure you're authenticated with `gh`.
2. Export it in the environment as `GITHUB_TOKEN`:

   export GITHUB_TOKEN="ghp_..."

3. Dry-run by listing caches (or use the script):

   curl -s -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/aKs030/iweb/actions/caches" | jq '.actions_caches[] | {id,key,size_in_bytes}'

Flags

- `--dry-run` — list only, do not delete (useful for scheduled checks).
- `--json-output FILE` — write the full API JSON response to FILE for inspection or artifact upload.
- `--yes` — skip interactive prompt (use with care). For automated deletion you can instead set `CONFIRM=DELETE`.

Examples

- Interactive delete:

   ./scripts/cleanup-actions-caches.sh

- Dry run (CI):

   ./scripts/cleanup-actions-caches.sh --dry-run --json-output caches.json

- Non-interactive delete (explicit confirmation):

   CONFIRM=DELETE ./scripts/cleanup-actions-caches.sh --yes

Notes

- The script will refuse to run if the API returns a non-200 status (e.g., bad credentials).
- For automated workflows we recommend using `--dry-run` on a schedule and a `workflow_dispatch` manual job that requires a confirmation input before running the deletion.
- Keep tokens secure and do not commit them.