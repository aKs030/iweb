cleanup-actions-caches.sh

Usage

1. Create a Personal Access Token (PAT) with the necessary repo permissions (for private repos include `repo` scope) or make sure you're authenticated with `gh`.
2. Export it in the environment as `GITHUB_TOKEN`:

   export GITHUB_TOKEN="ghp_..."

3. Dry-run by listing caches:

   curl -s -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/aKs030/iweb/actions/caches" | jq '.actions_caches[] | {id,key,size_in_bytes}'

4. Run the script and confirm when prompted:

   ./scripts/cleanup-actions-caches.sh

Notes

- The script will refuse to run if the API returns a non-200 status (e.g., bad credentials).
- It prompts for confirmation before deleting caches.
- Keep tokens secure and do not commit them.