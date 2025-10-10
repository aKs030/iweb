#!/usr/bin/env node

/**
 * Lighthouse Audit Runner
 *
 * Führt Lighthouse-Audits für Desktop und Mobile durch und generiert
 * detaillierte HTML/JSON Reports mit Web Vitals Metriken.
 *
 * Usage:
 *   npm run lighthouse          # Beide Reports (Desktop + Mobile)
 *   npm run lighthouse:desktop  # Nur Desktop
 *   npm run lighthouse:mobile   # Nur Mobile
 *
 * Reports werden gespeichert in: ./reports/lighthouse/
 */

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Konfiguration
const CONFIG = {
  url: 'http://localhost:8080', // Lokaler Dev-Server
  outputDir: path.join(__dirname, '..', 'reports', 'lighthouse'),

  // Desktop Konfiguration
  desktop: {
    formFactor: 'desktop',
    screenEmulation: {
      mobile: false,
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      disabled: false,
    },
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
  },

  // Mobile Konfiguration
  mobile: {
    formFactor: 'mobile',
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      disabled: false,
    },
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
  },
};

// Web Vitals Thresholds (Core Web Vitals)
const THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  FID: { good: 100, needsImprovement: 300 }, // First Input Delay
  CLS: { good: 0.1, needsImprovement: 0.25 }, // Cumulative Layout Shift
  FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
  TTI: { good: 3800, needsImprovement: 7300 }, // Time to Interactive
  TBT: { good: 200, needsImprovement: 600 }, // Total Blocking Time
};

/**
 * Erstellt Output-Verzeichnis falls nicht vorhanden
 */
function ensureOutputDir() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
}

/**
 * Formatiert Millisekunden in lesbare Zeit
 */
function formatTime(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Bewertet Metrik basierend auf Thresholds
 */
function getScoreStatus(value, threshold) {
  if (value <= threshold.good) return '✅ GOOD';
  if (value <= threshold.needsImprovement) return '⚠️  NEEDS IMPROVEMENT';
  return '❌ POOR';
}

/**
 * Extrahiert wichtige Metriken aus Lighthouse Report
 */
function extractMetrics(lhr) {
  const metrics = lhr.audits.metrics?.details?.items?.[0] || {};

  // Sicherstellen, dass alle Kategorie-Scores existieren
  const getScore = (category) => {
    const score = lhr.categories?.[category]?.score;
    return score !== undefined && score !== null ? Math.round(score * 100) : 0;
  };

  return {
    performance: getScore('performance'),
    accessibility: getScore('accessibility'),
    bestPractices: getScore('best-practices'),
    seo: getScore('seo'),
    pwa: getScore('pwa'),

    // Core Web Vitals (mit Fallback auf 0)
    lcp: metrics.largestContentfulPaint || 0,
    fcp: metrics.firstContentfulPaint || 0,
    cls: metrics.cumulativeLayoutShift || 0,
    tti: metrics.interactive || 0,
    tbt: metrics.totalBlockingTime || 0,
    si: metrics.speedIndex || 0,

    // Weitere Metriken
    firstMeaningfulPaint: metrics.firstMeaningfulPaint || 0,
    maxPotentialFID: metrics.maxPotentialFID || 0,
  };
}

/**
 * Generiert Konsolen-Report
 */
function printReport(formFactor, metrics) {
  console.log('\n' + '='.repeat(80));
  console.log(`📊 LIGHTHOUSE AUDIT - ${formFactor.toUpperCase()}`);
  console.log('='.repeat(80));

  console.log('\n🎯 SCORES:');
  console.log(`  Performance:     ${metrics.performance}/100`);
  console.log(`  Accessibility:   ${metrics.accessibility}/100`);
  console.log(`  Best Practices:  ${metrics.bestPractices}/100`);
  console.log(`  SEO:             ${metrics.seo}/100`);
  console.log(`  PWA:             ${metrics.pwa}/100`);

  console.log('\n⚡ CORE WEB VITALS:');
  console.log(`  LCP (Largest Contentful Paint): ${formatTime(metrics.lcp)}`);
  console.log(`       ${getScoreStatus(metrics.lcp, THRESHOLDS.LCP)}`);

  console.log(`  FCP (First Contentful Paint):   ${formatTime(metrics.fcp)}`);
  console.log(`       ${getScoreStatus(metrics.fcp, THRESHOLDS.FCP)}`);

  console.log(`  CLS (Cumulative Layout Shift):  ${metrics.cls.toFixed(3)}`);
  console.log(`       ${getScoreStatus(metrics.cls, THRESHOLDS.CLS)}`);

  console.log(`  TTI (Time to Interactive):      ${formatTime(metrics.tti)}`);
  console.log(`       ${getScoreStatus(metrics.tti, THRESHOLDS.TTI)}`);

  console.log(`  TBT (Total Blocking Time):      ${formatTime(metrics.tbt)}`);
  console.log(`       ${getScoreStatus(metrics.tbt, THRESHOLDS.TBT)}`);

  console.log(`  SI (Speed Index):               ${formatTime(metrics.si)}`);

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Speichert Reports als HTML und JSON
 */
function saveReports(formFactor, lhr, report) {
  const timestamp = new Date().toISOString().split('T')[0];
  const baseFilename = `lighthouse-${formFactor}-${timestamp}`;

  // HTML Report
  const htmlPath = path.join(CONFIG.outputDir, `${baseFilename}.html`);
  fs.writeFileSync(htmlPath, report);
  console.log(`✅ HTML Report saved: ${htmlPath}`);

  // JSON Report (für CI/CD)
  const jsonPath = path.join(CONFIG.outputDir, `${baseFilename}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(lhr, null, 2));
  console.log(`✅ JSON Report saved: ${jsonPath}`);

  return { htmlPath, jsonPath };
}

/**
 * Führt Lighthouse Audit durch
 */
async function runAudit(formFactor) {
  console.log(`\n🚀 Starting Lighthouse audit for ${formFactor}...`);

  let chrome;
  let browser;
  try {
    // Versuche Chrome zu finden, fallback zu Puppeteer's Chromium
    let chromeExecutable;
    try {
      chrome = await chromeLauncher.launch({
        chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox'],
      });
      chromeExecutable = chrome.port;
    } catch {
      console.log('⚠️  Chrome nicht gefunden, verwende Puppeteer Chromium...');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const browserURL = browser.wsEndpoint();
      const { port } = new URL(browserURL);
      chromeExecutable = parseInt(port);
    }

    const options = {
      logLevel: 'info',
      output: 'html',
      port: chromeExecutable,
      ...CONFIG[formFactor],
    };

    // Audit durchführen
    const runnerResult = await lighthouse(CONFIG.url, options);

    // Metriken extrahieren
    const metrics = extractMetrics(runnerResult.lhr);

    // Reports speichern
    const paths = saveReports(
      formFactor,
      runnerResult.lhr,
      runnerResult.report
    );

    // Konsolen-Report
    printReport(formFactor, metrics);

    return { success: true, metrics, paths };
  } catch (error) {
    console.error(`❌ Error during ${formFactor} audit:`, error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n⚠️  Lokaler Server läuft nicht!');
      console.error('   Bitte starte den Dev-Server mit:');
      console.error('   npx http-server -p 8080\n');
    }

    return { success: false, error: error.message };
  } finally {
    if (chrome) {
      await chrome.kill();
    }
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Main Funktion
 */
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'both'; // both, desktop, mobile

  ensureOutputDir();

  console.log('🔍 Lighthouse Audit Tool');
  console.log(`📍 Target URL: ${CONFIG.url}`);
  console.log(`📁 Output Directory: ${CONFIG.outputDir}\n`);

  const results = {};

  if (mode === 'desktop' || mode === 'both') {
    results.desktop = await runAudit('desktop');
  }

  if (mode === 'mobile' || mode === 'both') {
    results.mobile = await runAudit('mobile');
  }

  // Zusammenfassung
  console.log('\n' + '='.repeat(80));
  console.log('📋 AUDIT SUMMARY');
  console.log('='.repeat(80));

  for (const [formFactor, result] of Object.entries(results)) {
    if (result.success) {
      console.log(`\n${formFactor.toUpperCase()}:`);
      console.log(`  Performance: ${result.metrics.performance}/100`);
      console.log(`  LCP: ${formatTime(result.metrics.lcp)}`);
      console.log(`  Reports: ${result.paths.htmlPath}`);
    } else {
      console.log(`\n${formFactor.toUpperCase()}: ❌ Failed`);
      console.log(`  Error: ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

main().catch(console.error);
