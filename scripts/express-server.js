// scripts/express-server.js
// Vollständiger Express-Server für statische Dateien mit Security-Headern, Logging und Fallbacks
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 8000;
const ROOT = path.resolve(__dirname, '../');
const USE_HTTPS = process.env.HTTPS === '1' || process.env.HTTPS === 'true';

// Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${res.statusCode} ${req.method} ${req.url} (${ms}ms)`);
  });
  next();
});

// Security Headers Middleware (wie dev-server.js)
app.use((req, res, next) => {
  res.removeHeader('Server');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '0'); // Deaktiviert, CSP wird bevorzugt
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; object-src 'none'; base-uri 'none'"
  );
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

// Keine Directory-Listings
app.use((req, res, next) => {
  if (req.url.endsWith('/')) {
    // Versuche docs/index.html
    const indexPath = path.join(ROOT, req.url, 'docs/index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    return res.status(404).send('404 Not Found');
  }
  next();
});

// Caching-Header für statische docs
app.use((req, res, next) => {
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|webp|svg|ico)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
});

// Statische Dateien
app.use(
  express.static(ROOT, {
    extensions: ['html', 'htm'],
    fallthrough: true,
  })
);

// 404 für nicht gefundene Dateien, außer bei SPA (Fallback auf docs/index.html)
app.use((req, res, next) => {
  const accept = req.headers.accept || '';
  if (accept.includes('text/html')) {
    // SPA-Fallback
    return res.sendFile(path.join(ROOT, 'docs/index.html'));
  }
  res.status(404).send('404 Not Found');
});

// Start HTTP oder HTTPS
if (USE_HTTPS) {
  const certPath = path.join(ROOT, 'cert', 'localhost-cert.pem');
  const keyPath = path.join(ROOT, 'cert', 'localhost-key.pem');
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const options = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
    https.createServer(options, app).listen(PORT, () => {
      console.log(`Express-Server (HTTPS) läuft auf https://localhost:${PORT}`);
    });
  } else {
    console.error('HTTPS aktiviert, aber Zertifikate fehlen! Fallback auf HTTP.');
    app.listen(PORT, () => {
      console.log(`Express-Server läuft auf http://localhost:${PORT}`);
    });
  }
} else {
  app.listen(PORT, () => {
    console.log(`Express-Server läuft auf http://localhost:${PORT}`);
  });
}
