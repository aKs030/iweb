#!/usr/bin/env node

/**
 * Start Server and Check Security Headers
 * Startet einen lokalen Server und führt dann den Security Check aus
 */

const { spawn } = require('child_process');
const http = require('http');
const https = require('https');

// Konfiguration
const PORT = 8000;
const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;

/**
 * Wartet bis der Server erreichbar ist
 */
async function waitForServer(port, maxRetries = MAX_RETRIES) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(1000);
      });
      return true;
    } catch (error) {
      console.log(`Warte auf Server... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  return false;
}

/**
 * Wartet bis der HTTPS-Server erreichbar ist
 */
async function waitForHttpsServer(port, maxRetries = MAX_RETRIES) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = https.get({
          hostname: 'localhost',
          port: port,
          rejectUnauthorized: false,
          timeout: 1000
        }, (res) => {
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(1000);
      });
      return true;
    } catch (error) {
      console.log(`Warte auf HTTPS-Server... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  return false;
}

/**
 * Führt den Security-Check mit mehreren Versuchen aus
 */
async function runSecurityCheckWithRetry(url, maxRetries = 10, delay = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await new Promise((resolve) => {
      const checkProcess = spawn('node', ['scripts/check-security-headers.js', url], {
        stdio: 'inherit',
        shell: true
      });
      checkProcess.on('exit', (code) => {
        resolve(code);
      });
    });
    if (result === 0) {
      return 0;
    } else {
      console.log(`Security-Check fehlgeschlagen, neuer Versuch in ${delay / 1000}s... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return 1;
}

/**
 * Hauptfunktion
 */
async function main() {
  // Server nur mit HTTPS starten
  const serverProcess = spawn('node', ['dev-server.js'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ONLY_HTTPS: '1' }
  });

  // Nur auf HTTPS-Server warten
  await waitForHttpsServer(8443);

  // Security Check mehrfach versuchen
  const code = await runSecurityCheckWithRetry('https://localhost:8443', 10, 2000);

  console.log('\n🏁 Security Check abgeschlossen');
  serverProcess.kill();
  process.exit(code || 0);
}

// Script ausführen
main().catch(error => {
  console.error('Fehler:', error);
  process.exit(1);
});
