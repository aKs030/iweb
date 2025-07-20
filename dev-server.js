#!/usr/bin/env node

/**
 * Development Server with Security Headers
 * Ein Express-Server, der Security Headers für lokale Tests setzt
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const https = require('https');

const app = express();

// Entferne X-Powered-By Header (Express-Standard)
app.disable('x-powered-by');

// Security Header Middleware — VOR express.static!
// Security Header Middleware — VOR express.static!
app.use((req, res, next) => {
  // Entfernt Server-Header komplett
  res.removeHeader('Server');
  // Strikte Transport-Sicherheit (nur über HTTPS wirksam)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  // MIME-Sniffing verhindern
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Clickjacking verhindern
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Content Security Policy: erlaubt eigene Skripte, Styles, Fonts und keine externen Ressourcen
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.abdulkerimsesli.de; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
  // Referrer-Policy: nur Ursprungsdomain bei Cross-Origin
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // X-XSS-Protection (veraltet, aber für Kompatibilität)
  res.setHeader('X-XSS-Protection', '0');
  // Permissions-Policy restriktiv (keine Features erlaubt)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // Cross-Domain-Policies für Flash/Adobe blockieren
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  // Moderne Cross-Origin-Header (optional, für maximale Sicherheit)
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

const PORT = process.env.PORT || 8000;

// HTTPS-Konfiguration für lokale Entwicklung
const useHttps = true; // auf false setzen, falls nicht gewünscht
const httpsPort = 8443;
const certDir = path.join(__dirname, 'cert');
const certPath = path.join(certDir, 'localhost-cert.pem');
const keyPath = path.join(certDir, 'localhost-key.pem');

function ensureSelfSignedCert() {
  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir);
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    // Zertifikat generieren (openssl muss installiert sein)
    const { execFileSync } = require('child_process');
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', keyPath, '-out', certPath,
      '-days', '365', '-subj', '/CN=localhost'
    ], { stdio: 'inherit' });
    console.log('Selbstsigniertes Zertifikat für HTTPS generiert.');
  }
}

// Statische Dateien servieren
app.use(express.static(__dirname, {
  dotfiles: 'ignore',
  etag: true,
  extensions: ['html', 'htm'],
  index: 'index.html',
  maxAge: '1d',
  redirect: false
}));

// 404 Handler
app.use((req, res) => {
  const notFoundPath = path.join(__dirname, '../pages/komponente/404.html');
  if (fs.existsSync(notFoundPath)) {
    res.status(404).sendFile(notFoundPath);
  } else {
    res.status(404).send('404 - Not Found');
// HTTP-zu-HTTPS-Weiterleitung (wenn beide Protokolle aktiv)
if (useHttps && !onlyHttps && !onlyHttp) {
  app.use((req, res, next) => {
    if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
      // Redirect to HTTPS
      const host = req.headers.host ? req.headers.host.replace(/:.*/, ':' + httpsPort) : 'localhost:' + httpsPort;
      return res.redirect(301, 'https://' + host + req.originalUrl);
    }
    next();
  });
}
  }
});

// Server starten

// Ermöglicht expliziten Start nur eines Protokolls
const onlyHttps = process.env.ONLY_HTTPS === '1';
const onlyHttp = process.env.ONLY_HTTP === '1';

let httpReady = false;
let httpsReady = !useHttps;
let server, httpsServer;

function onReady() {
  if ((httpReady || onlyHttps) && (httpsReady || onlyHttp)) {
    console.log('🔒 Security headers are active');
  }
}

if (!onlyHttps) {
  server = app.listen(PORT, () => {
    console.log(`✅ Development server with security headers running on http://localhost:${PORT}`);
    httpReady = true;
    onReady();
  });
}

if (useHttps && !onlyHttp) {
  ensureSelfSignedCert();
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  httpsServer = https.createServer(options, app).listen(httpsPort, () => {
    console.log(`✅ Secure development server running on https://localhost:${httpsPort}`);
    httpsReady = true;
    onReady();
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  let closed = 0;
  const total = (server ? 1 : 0) + (httpsServer ? 1 : 0);
  function done() {
    closed++;
    if (closed >= total) {
      console.log('Server closed');
      process.exit(0);
    }
  }
  if (server) server.close(done);
  if (httpsServer) httpsServer.close(done);
  if (!server && !httpsServer) process.exit(0);
});
