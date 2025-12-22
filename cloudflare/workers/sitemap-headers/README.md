Sitemap headers Cloudflare Worker

Purpose
- Add `X-Robots-Tag: noindex, noarchive` to `/sitemap.xml` and `/sitemap-videos.xml` responses so they are crawlable but not shown as HTML search results.

Deploy (recommended)
1. Set a Cloudflare API token with **Workers Scripts** (edit/publish) scope and account-level access. Save it to the repository secrets as `CF_API_TOKEN`.
2. Fill in your `account_id` in `wrangler.toml` (Cloudflare dashboard -> Overview -> Account ID).
3. Option A (auto): Push to `main` — the GitHub Action will run and publish the worker using the `cloudflare/wrangler-action`.
4. Option B (manual): Install `wrangler` locally and run `wrangler publish --config wrangler.toml`.
5. Add a route in Cloudflare dashboard (Workers -> Routes) matching `abdulkerimsesli.de/sitemap*` to this worker.

Testing
- After publish, `curl -I https://abdulkerimsesli.de/sitemap.xml` should show `X-Robots-Tag: noindex, noarchive` header.

Notes
- The worker forwards all requests and only mutates the response headers for the two sitemap paths.
- Keep `wrangler.toml` account_id/private values out of source control (the file here is a template).