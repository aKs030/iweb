#!/usr/bin/env node
/**
 * Lightweight dev server (HTTP) mit robusten Security Headers
 * -----------------------------------------------------------
 * • Keine optionalen HTTPS‑Spielereien – CI braucht nur http://localhost:8000
 * • Kein externes openssl, keine Self‑Signed Certs ⇒ läuft überall
 * • Nur dependendcy: express (Dev‑Dep in package.json)
 */

/* eslint-disable import/no-commonjs */
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// --- Security Headers (set once per request) ------------------------------
app.disable('x-powered-by');
app.use((_, res, next) => {
  res.removeHeader('Server');
  res.set({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'none'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  next();
});

// --- Static files ---------------------------------------------------------
app.use(express.static(path.resolve(__dirname, '..'), {
  extensions: ['html', 'htm'],
  index: 'index.html',
  maxAge: '1d'
}));

// --- 404 fallback ---------------------------------------------------------
app.use((_, res) => res.status(404).send('404 – Not Found'));

// --- Start ----------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Dev server mit Security Headers auf http://localhost:${PORT}`);
});
