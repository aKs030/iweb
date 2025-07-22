#!/usr/bin/env node
/**
 * Lightweight dev server (HTTP) mit robusten Security Headers
 * -----------------------------------------------------------
 * • Keine optionalen HTTPS‑Spielereien – CI braucht nur http://localhost:8000
 * • Kein externes openssl, keine Self‑Signed Certs ⇒ läuft überall
 * • Nur dependendcy: express (Dev‑Dep in package.json)
 */

const express = require('express');
const path = require('path');

const app = express();
const DEFAULT_PORT = 8000;
let PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;

// --- Security Headers (set once per request) ------------------------------
app.disable('x-powered-by');
app.use((_, res, next) => {
  res.removeHeader('Server');
  res.set({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '0', // Deaktiviert, CSP wird bevorzugt
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'none'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  next();
});

// --- Static files ---------------------------------------------------------
app.use(
  express.static(path.resolve(__dirname, '..'), {
    extensions: ['html', 'htm'],
    index: 'docs/index.html',
    maxAge: '1d',
  })
);

// --- 404 fallback ---------------------------------------------------------
app.use((_, res) => res.status(404).send('404 – Not Found'));

// --- Start mit automatischer Port-Auswahl ----------------------------------

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`✅ Dev server mit Security Headers auf http://localhost:${port}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      tryNextPort(port + 1);
    } else {
      throw err;
    }
  });
}

function tryNextPort(port) {
  const server = app.listen(port, () => {
    console.log(
      `⚠️  Port ${DEFAULT_PORT} war belegt. Server läuft jetzt auf http://localhost:${port}`
    );
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `❌ Auch Port ${port} ist belegt. Bitte beende den anderen Prozess oder wähle einen anderen Port (z.B. mit: PORT=8081 node scripts/dev-server.js)`
      );
      process.exit(1);
    } else {
      throw err;
    }
  });
}

startServer(PORT);
