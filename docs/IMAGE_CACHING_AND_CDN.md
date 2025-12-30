# Image Caching & CDN Recommendations

Quick notes to improve delivery of large hero/OG images used as LCP candidates.

- Serve images from a CDN (e.g., Cloudflare, Fastly, BunnyCDN) to reduce latency and improve cache hit rates.
- Use far-future cache headers for immutable static assets (images, fonts): `Cache-Control: public, max-age=31536000, immutable`.
- Ensure fonts have similar cache headers.
- Prefer modern formats (AVIF/WebP) and make sure `preload` points to the same final resource.
- Consider using Cloudflare Image Resizing or similar to serve properly sized images per device.
- Validate cache headers and CDN response headers in production (curl -I) and via CDN dashboard.
