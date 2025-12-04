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

If you'd like, I can open a PR with these changes and include a checklist for follow-up items (e.g., de-duplicate `about.css`, normalize color vars, re-enable `selector-class-pattern` stricter settings).

- `pages/about/about.css` contains a temporary `/* stylelint-disable no-duplicate-selectors */` directive for staged cleanup; recommended follow-up: remove after a targeted cleanup focusing on deduplication and BEM class normalization.
