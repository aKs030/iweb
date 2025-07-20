#!/usr/bin/env node

/**
 * Development Server with Security Headers
 * Ein Express-Server, der Security Headers für lokale Tests setzt
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8000;

// Security Headers Middleware
app.use((req, res, next) => {
  // Headers aus .htaccess
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.abdulkerimsesli.de; frame-ancestors 'none'; base-uri 'self'; form-action 'self';");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-XSS-Protection', '0');
  
  next();
});

// Statische Dateien servieren
app.use(express.static(path.join(__dirname, '../'), {
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
  }
});

// Server starten
const server = app.listen(PORT, () => {
  console.log(`✅ Development server with security headers running on http://localhost:${PORT}`);
  console.log('🔒 Security headers are active');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
