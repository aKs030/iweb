#!/usr/bin/env node

/**
 * Security Headers Checker
 * Überprüft wichtige Sicherheits-Header in der Webseite
 * 
 * Verwendung: node scripts/check-security-headers.js [URL]
 * Standard-URL: http://localhost:8000
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs').promises;
const path = require('path');

// Farbcodes für Terminal-Ausgabe
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Sicherheits-Header Definitionen
const SECURITY_HEADERS = {
  'strict-transport-security': {
    required: true,
    description: 'Erzwingt HTTPS-Verbindungen',
    recommendedValue: 'max-age=31536000; includeSubDomains; preload',
    validator: (value) => {
      const maxAge = value.match(/max-age=(\d+)/);
      return maxAge && parseInt(maxAge[1]) >= 31536000;
    }
  },
  'x-content-type-options': {
    required: true,
    description: 'Verhindert MIME-Type Sniffing',
    recommendedValue: 'nosniff',
    validator: (value) => value.toLowerCase() === 'nosniff'
  },
  'x-frame-options': {
    required: true,
    description: 'Schutz vor Clickjacking',
    recommendedValue: 'DENY oder SAMEORIGIN',
    validator: (value) => ['deny', 'sameorigin'].includes(value.toLowerCase())
  },
  'x-xss-protection': {
    required: false, // Veraltet in modernen Browsern
    description: 'XSS-Filter (veraltet, CSP bevorzugen)',
    recommendedValue: '0', // Deaktiviert wegen möglicher Vulnerabilities
    validator: (value) => value === '0'
  },
  'content-security-policy': {
    required: true,
    description: 'Definiert erlaubte Ressourcen-Quellen',
    recommendedValue: 'Siehe CSP-Dokumentation',
    validator: (value) => {
      // Prüft ob wichtige Direktiven vorhanden sind
      const requiredDirectives = ['default-src', 'script-src', 'style-src'];
      return requiredDirectives.some(directive => value.includes(directive));
    }
  },
  'referrer-policy': {
    required: true,
    description: 'Kontrolliert Referrer-Informationen',
    recommendedValue: 'strict-origin-when-cross-origin',
    validator: (value) => {
      const validPolicies = [
        'no-referrer',
        'no-referrer-when-downgrade',
        'origin',
        'origin-when-cross-origin',
        'same-origin',
        'strict-origin',
        'strict-origin-when-cross-origin',
        'unsafe-url'
      ];
      return validPolicies.includes(value.toLowerCase());
    }
  },
  'permissions-policy': {
    required: false,
    description: 'Kontrolliert Browser-Features',
    recommendedValue: 'geolocation=(), microphone=(), camera=()',
    validator: (value) => value.length > 0
  },
  'x-permitted-cross-domain-policies': {
    required: false,
    description: 'Adobe Flash/PDF Cross-Domain Policy',
    recommendedValue: 'none',
    validator: (value) => value.toLowerCase() === 'none'
  }
};

// Zusätzliche Sicherheitsprüfungen
const ADDITIONAL_CHECKS = {
  cookies: {
    description: 'Cookie-Sicherheit',
    check: (headers) => {
      const setCookie = headers['set-cookie'];
      if (!setCookie) return { pass: true, message: 'Keine Cookies gesetzt' };
      
      const issues = [];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      
      cookies.forEach(cookie => {
        if (!cookie.toLowerCase().includes('secure')) {
          issues.push('Cookie ohne Secure-Flag');
        }
        if (!cookie.toLowerCase().includes('httponly')) {
          issues.push('Cookie ohne HttpOnly-Flag');
        }
        if (!cookie.toLowerCase().includes('samesite')) {
          issues.push('Cookie ohne SameSite-Attribut');
        }
      });
      
      return {
        pass: issues.length === 0,
        message: issues.length > 0 ? issues.join(', ') : 'Alle Cookies sicher konfiguriert'
      };
    }
  },
  server: {
    description: 'Server-Information',
    check: (headers) => {
      const serverHeader = headers['server'];
      const poweredBy = headers['x-powered-by'];
      
      const issues = [];
      // Use optional chaining and a safe regex to avoid ReDoS
      if (serverHeader?.match(/\d+\.\d{1,3}/)) {
        issues.push('Server-Version wird preisgegeben');
      }
      if (poweredBy) {
        issues.push('X-Powered-By Header vorhanden');
      }
      
      return {
        pass: issues.length === 0,
        message: issues.length > 0 ? issues.join(', ') : 'Keine sensiblen Server-Infos'
      };
    }
  }
};

// HTTP(S) Request durchführen
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'HEAD',
      timeout: 10000
    };
    
    const req = protocol.request(options, (res) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// Header-Analyse
function analyzeHeaders(headers) {
  const results = {
    passed: [],
    failed: [],
    warnings: [],
    score: 0,
    maxScore: 0
  };
  
  // Sicherheits-Header prüfen
  for (const [header, config] of Object.entries(SECURITY_HEADERS)) {
    const value = headers[header];
    const headerName = header.charAt(0).toUpperCase() + header.slice(1);
    
    if (config.required) {
      results.maxScore += 10;
    } else {
      results.maxScore += 5;
    }
    
    if (!value) {
      if (config.required) {
        results.failed.push({
          header: headerName,
          message: `Fehlender Header: ${config.description}`,
          recommendation: `Fügen Sie hinzu: ${header}: ${config.recommendedValue}`
        });
      } else {
        results.warnings.push({
          header: headerName,
          message: `Optionaler Header fehlt: ${config.description}`,
          recommendation: `Erwägen Sie: ${header}: ${config.recommendedValue}`
        });
      }
    } else {
      const isValid = config.validator(value);
      if (isValid) {
        results.passed.push({
          header: headerName,
          value: value,
          message: config.description
        });
        results.score += config.required ? 10 : 5;
      } else {
        results.failed.push({
          header: headerName,
          value: value,
          message: `Ungültiger Wert: ${config.description}`,
          recommendation: `Empfohlen: ${config.recommendedValue}`
        });
      }
    }
  }
  
  // Zusätzliche Checks
  for (const config of Object.values(ADDITIONAL_CHECKS)) {
    const result = config.check(headers);
    results.maxScore += 5;
    
    if (result.pass) {
      results.passed.push({
        header: config.description,
        message: result.message
      });
      results.score += 5;
    } else {
      results.warnings.push({
        header: config.description,
        message: result.message
      });
    }
  }
  
  results.percentage = Math.round((results.score / results.maxScore) * 100);
  return results;
}

// Report generieren
async function generateReport(url, results) {
  const timestamp = new Date().toISOString();
  const report = {
    url: url,
    timestamp: timestamp,
    score: results.score,
    maxScore: results.maxScore,
    percentage: results.percentage,
    passed: results.passed,
    failed: results.failed,
    warnings: results.warnings
  };
  
  // JSON Report speichern
  const reportDir = path.join(process.cwd(), 'security-reports');
  await fs.mkdir(reportDir, { recursive: true });
  
  const reportFile = path.join(reportDir, `security-headers-${Date.now()}.json`);
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  
  return reportFile;
}

// Terminal-Ausgabe
function printResults(url, results) {
  console.log('\n' + colors.bright + '🔒 Security Headers Check' + colors.reset);
  console.log('=' + '='.repeat(50));
  console.log(`URL: ${colors.cyan}${url}${colors.reset}`);
  console.log(`Zeitpunkt: ${new Date().toLocaleString()}`);
  console.log('=' + '='.repeat(50) + '\n');
  
  // Score
  const scoreColor = results.percentage >= 80 ? colors.green : 
                    results.percentage >= 60 ? colors.yellow : colors.red;
  console.log(`${colors.bright}Gesamtbewertung:${colors.reset} ${scoreColor}${results.percentage}%${colors.reset} (${results.score}/${results.maxScore} Punkte)\n`);
  
  // Bestandene Checks
  if (results.passed.length > 0) {
    console.log(`${colors.green}✓ Bestanden (${results.passed.length}):${colors.reset}`);
    results.passed.forEach(item => {
      console.log(`  • ${item.header}: ${item.message}`);
      if (item.value) {
        console.log(`    Wert: ${colors.cyan}${item.value.substring(0, 60)}${item.value.length > 60 ? '...' : ''}${colors.reset}`);
      }
    });
    console.log();
  }
  
  // Fehlgeschlagene Checks
  if (results.failed.length > 0) {
    console.log(`${colors.red}✗ Fehlgeschlagen (${results.failed.length}):${colors.reset}`);
    results.failed.forEach(item => {
      console.log(`  • ${colors.red}${item.header}${colors.reset}: ${item.message}`);
      if (item.value) {
        console.log(`    Aktuell: ${item.value.substring(0, 60)}${item.value.length > 60 ? '...' : ''}`);
      }
      console.log(`    ${colors.yellow}→ ${item.recommendation}${colors.reset}`);
    });
    console.log();
  }
  
  // Warnungen
  if (results.warnings.length > 0) {
    console.log(`${colors.yellow}⚠ Warnungen (${results.warnings.length}):${colors.reset}`);
    results.warnings.forEach(item => {
      console.log(`  • ${item.header}: ${item.message}`);
      if (item.recommendation) {
        console.log(`    ${colors.yellow}→ ${item.recommendation}${colors.reset}`);
      }
    });
    console.log();
  }
  
  // Empfehlungen
  console.log(`${colors.bright}📋 Empfehlungen:${colors.reset}`);
  if (results.percentage < 80) {
    console.log('  1. Implementieren Sie alle erforderlichen Sicherheits-Header');
    console.log('  2. Überprüfen Sie die CSP-Richtlinien auf Vollständigkeit');
    console.log('  3. Aktivieren Sie HSTS für HTTPS-Verbindungen');
  } else {
    console.log('  ✓ Gute Sicherheitskonfiguration! Regelmäßige Überprüfung empfohlen.');
  }
  
  console.log('\n' + '='.repeat(52) + '\n');
}

// Hauptfunktion
async function main() {
  const url = process.argv[2] || 'http://localhost:8000';
  
  console.log(`${colors.blue}Prüfe Sicherheits-Header für: ${url}${colors.reset}\n`);
  
  try {
    // Request durchführen
    const response = await makeRequest(url);
    
    if (response.statusCode >= 400) {
      console.error(`${colors.red}Fehler: Server antwortete mit Status ${response.statusCode}${colors.reset}`);
      process.exit(1);
    }
    
    // Header analysieren
    const results = analyzeHeaders(response.headers);
    
    // Ergebnisse ausgeben
    printResults(url, results);
    
    // Report generieren
    const reportFile = await generateReport(url, results);
    console.log(`${colors.green}Report gespeichert:${colors.reset} ${reportFile}`);
    
    // Exit-Code basierend auf Score
    if (results.percentage < 60) {
      console.log(`\n${colors.red}❌ Sicherheits-Check fehlgeschlagen!${colors.reset}`);
      process.exit(1);
    } else if (results.percentage < 80) {
      console.log(`\n${colors.yellow}⚠️  Sicherheit kann verbessert werden!${colors.reset}`);
      process.exit(0);
    } else {
      console.log(`\n${colors.green}✅ Sicherheits-Check bestanden!${colors.reset}`);
      process.exit(0);
    }
    
  } catch (error) {
    console.error(`${colors.red}Fehler beim Prüfen der Header:${colors.reset}`);
    if (error && error.message) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    if (error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Script ausführen
if (require.main === module) {
  main();
}

module.exports = { analyzeHeaders, SECURITY_HEADERS };
