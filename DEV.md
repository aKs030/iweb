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

- Open: http://127.0.0.1:8081/?debug

You should see console logs about the reconnecting WebSocket attempting to open a connection to `ws://127.0.0.1:3001`.

### Test WebSocket with wscat (optional)

```bash
npx wscat -c ws://127.0.0.1:3001
# Type some text and you should see the server echo back 'echo:...'
```

## Notes

The reconnecting WebSocket helper is in `content/webentwicklung/shared/reconnecting-websocket.js`. It listens to `visibilitychange` and `online` events to avoid aggressive reconnection when the page is suspended by the browser. Use this class for persistent WebSocket connections in dev or production, but ensure you adjust heartbeat/ping strategy for real-world servers.
