## 2025-01-27 - Blog List Fetching Bottleneck
**Learning:** The blog architecture relies on static HTML files and client-side scraping. The blog list view fetches `sitemap.xml` and then *every single blog post page* (HTML) to parse metadata (title, excerpt) on the fly. This results in N+1 network requests on every page load.
**Action:** Implement client-side caching (e.g., in `localStorage`) or a build step to generate a `posts.json` manifest. Implemented `localStorage` caching with `lastmod` invalidation to mitigate this without changing the build process.
