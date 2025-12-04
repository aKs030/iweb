# Development helpers

This repository includes a `dev` script to start a static HTTP server and a WebSocket test server concurrently. It helps with testing Live Preview/WebSocket issues and with reconnect logic.

## Setup

Install dev dependencies:

```bash
npm ci
```

## Run dev servers

Start both the static file server and the websocket test server:

```bash
npm run dev
```

- Static site: http://127.0.0.1:8081
- WebSocket test server (echo): ws://127.0.0.1:3001

## Debugging & Tests

Use the query string `?debug` on any page to enable the development reconnecting WebSocket inside the app:

You should see console logs about the reconnecting WebSocket attempting to open a connection to `ws://127.0.0.1:3001`.

### Test WebSocket with wscat (optional)

```bash
npx wscat -c ws://127.0.0.1:3001
# Type some text and you should see the server echo back 'echo:...'
```

## Notes

The reconnecting WebSocket helper is in `content/shared/reconnecting-websocket.js`. It listens to `visibilitychange` and `online` events to avoid aggressive reconnection when the page is suspended by the browser. Use this class for persistent WebSocket connections in dev or production, but ensure you adjust heartbeat/ping strategy for real-world servers.

## CSS cleanup (completed)

Note: Playwright-based automated tests were removed from this repository. Use the `dev` script for local testing and manual verification.

- `pages/about/about.css` contains a temporary `/* stylelint-disable no-duplicate-selectors */` directive for staged cleanup; recommended follow-up: remove after a targeted cleanup focusing on deduplication and BEM class normalization.
- If you want stricter policies (BEM enforcement), incrementally enable additional `stylelint` rules and fix files in small batches.

## Shared Head usage

- This project uses a central `content/head/head.html` injected at runtime via `content/head/head-complete.js` (loader).
- To add page-specific meta data that should override the shared head defaults, place those meta tags BEFORE the loader script in the page's `<head>`:
	```html
	<!-- Example - per-page meta overrides -->
	<meta name="description" content="Project-specific description" />
	<meta property="og:image" content="https://example.com/content/img/og/og-projects.svg" />
	<!-- Loader script will pick those up and replace placeholders in the shared head -->
	<script src="/content/head/head-complete.js" type="module"></script>
	```
- Alternatively, use data attributes on `<html>` or `<body>` before the loader:
	```html
	<html data-page-description="Project-specific description" data-og-image="/content/img/og/custom-og.png">
	```
- Fallback: the loader will also parse JSON-LD (`<script type="application/ld+json">`) for `description` and `image` fields if no meta/data are present.

This lets you centralize global assets (fonts, CSS, analytics) while keeping the ability to override SEO and social previews per page.

If you'd like, I can open a PR with these changes and include a checklist for follow-up items (e.g., de-duplicate `about.css`, normalize color vars, re-enable `selector-class-pattern` stricter settings).

- `pages/about/about.css` contains a temporary `/* stylelint-disable no-duplicate-selectors */` directive for staged cleanup; recommended follow-up: remove after a targeted cleanup focusing on deduplication and BEM class normalization.
