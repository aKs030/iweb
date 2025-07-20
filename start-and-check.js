#!/usr/bin/env node

/**
 * Start Server and Check Security Headers
 * Startet einen lokalen Server und führt dann den Security Check aus
 */

const { spawn } = require('child_process');
const http = require('http');

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
 * Hauptfunktion
 */
async function main() {
  console.log('🚀 Starte lokalen Server...');
  
  // Server starten
  const serverProcess = spawn('npx', ['serve', '-l', PORT.toString(), '-s', '.'], {
    stdio: 'pipe',
    shell: true
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data.toString().trim()}`);
  });

  // Cleanup bei Exit
  process.on('exit', () => {
    serverProcess.kill();
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 Beende Server...');
    serverProcess.kill();
    process.exit(0);
  });

  // Warte auf Server
  const serverReady = await waitForServer(PORT);
  
  if (!serverReady) {
    console.error('❌ Server konnte nicht gestartet werden');
    serverProcess.kill();
    process.exit(1);
  }

  console.log('✅ Server läuft auf Port ' + PORT);
  console.log('🔍 Führe Security Header Check aus...\n');

  // Security Check ausführen
  const checkProcess = spawn('node', ['scripts/check-security-headers.js', `http://localhost:${PORT}`], {
    stdio: 'inherit',
    shell: true
  });

  checkProcess.on('exit', (code) => {
    console.log('\n🏁 Security Check abgeschlossen');
    serverProcess.kill();
    process.exit(code || 0);
  });
}

// Script ausführen
main().catch(error => {
  console.error('Fehler:', error);
  process.exit(1);
});
