Maintenance & housekeeping

✅ Quick commands

- npm run images:build — regenerate canonical OG WebP images, regenerate image sitemap, and inject video JSON‑LD
- npm run images:sitemap — regenerate only the image sitemap
- npm run videos:schema — generate VideoObject JSON‑LD and inject into /pages/videos/index.html
- npm run videos:pages — create per‑video landing pages and update sitemap-videos.xml
- npm run videos:links — insert visible per‑video links into /pages/videos/index.html
- npm run videos:check-urls — run reachability checks and produce tmp/video-urls.csv
- npm run format — run Prettier across the repo
- npm run lint — run ESLint and auto‑fix

⚠️ Notes

- The generated assets (content/assets/img/og/\*) are currently committed in the repo. Consider moving generation into CI and ignoring generated files if you prefer lighter repo commits.
- Submitting sitemaps to Google Search Console can be automated but requires OAuth and a service account. We recommend doing the first submission manually and adding automation later if needed.
- Temporary artifacts are written to the tmp/ folder and should be ignored (tmp/ is already present in .gitignore).

💡 Tip

Add a GitHub Actions workflow that runs on push to main:

- Runs `npm ci` → `npm run images:build` → commits updated sitemap & metadata (if any) and optionally opens a PR.

If you want, I can scaffold a minimal GitHub Actions workflow for this repo.
