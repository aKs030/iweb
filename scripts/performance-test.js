#!/usr/bin/env node

/**
 * Performance Test Script für Static Site
 * Testet Ladezeiten, Dateigröße und Core Web Vitals
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.TEST_URL || 'http://localhost:8000';
const PAGES_TO_TEST = [
  '/',
  '/pages/ubermich.html',
  '/pages/album.html',
  '/pages/index-game.html'
];

// Performance Thresholds
const THRESHOLDS = {
  responseTime: 2000, // ms
  maxFileSize: 500 * 1024, // 500KB
  totalPageSize: 2 * 1024 * 1024 // 2MB
};

class PerformanceTest {
  constructor() {
    this.results = [];
    this.errors = [];
  }

  async testPagePerformance(url) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      
      const req = client.get(url, (res) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        let data = '';
        let totalSize = 0;
        
        res.on('data', (chunk) => {
          data += chunk;
          totalSize += chunk.length;
        });
        
        res.on('end', () => {
          const result = {
            url,
            statusCode: res.statusCode,
            responseTime,
            contentLength: totalSize,
            headers: res.headers,
            passed: responseTime < THRESHOLDS.responseTime && totalSize < THRESHOLDS.maxFileSize
          };
          
          resolve(result);
        });
      });
      
      req.on('error', (error) => {
        reject({ url, error: error.message });
      });
      
      req.setTimeout(5000, () => {
        req.destroy();
        reject({ url, error: 'Request timeout' });
      });
    });
  }

  async checkStaticFilesSizes() {
    const staticDirs = ['css', 'js', 'img'];
    const fileSizes = {};
    
    for (const dir of staticDirs) {
      if (fs.existsSync(dir)) {
        const files = this.getAllFiles(dir);
        fileSizes[dir] = files.map(file => ({
          file,
          size: fs.statSync(file).size,
          sizeKB: Math.round(fs.statSync(file).size / 1024)
        }));
      }
    }
    
    return fileSizes;
  }

  getAllFiles(dirPath, files = []) {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      if (fs.statSync(fullPath).isDirectory()) {
        this.getAllFiles(fullPath, files);
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  async runTests() {
    console.log('🚀 Starting Performance Tests...\n');
    
    // Test page performance
    for (const page of PAGES_TO_TEST) {
      const url = BASE_URL + page;
      try {
        console.log(`⏱️  Testing: ${url}`);
        const result = await this.testPagePerformance(url);
        this.results.push(result);
        
        const status = result.passed ? '✅' : '❌';
        console.log(`   ${status} ${result.responseTime}ms | ${Math.round(result.contentLength/1024)}KB | Status: ${result.statusCode}`);
      } catch (error) {
        this.errors.push(error);
        console.log(`   ❌ Error: ${error.error}`);
      }
    }
    
    // Check static file sizes
    console.log('\n📁 Checking static file sizes...');
    const fileSizes = await this.checkStaticFilesSizes();
    
    for (const [dir, files] of Object.entries(fileSizes)) {
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const totalSizeKB = Math.round(totalSize / 1024);
      
      console.log(`   📂 ${dir}/: ${files.length} files, ${totalSizeKB}KB total`);
      
      // Warn about large files
      const largeFiles = files.filter(file => file.size > 100 * 1024); // >100KB
      if (largeFiles.length > 0) {
        console.log(`   ⚠️  Large files in ${dir}/:`);
        largeFiles.forEach(file => {
          console.log(`      - ${file.file}: ${file.sizeKB}KB`);
        });
      }
    }
    
    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 Performance Test Summary');
    console.log('═'.repeat(50));
    
    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    
    console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
    console.log(`❌ Errors: ${this.errors.length}`);
    
    if (this.results.length > 0) {
      const avgResponseTime = Math.round(
        this.results.reduce((sum, r) => sum + r.responseTime, 0) / this.results.length
      );
      console.log(`⏱️  Average Response Time: ${avgResponseTime}ms`);
      
      const slowestPage = this.results.reduce((prev, current) => 
        prev.responseTime > current.responseTime ? prev : current
      );
      console.log(`🐌 Slowest Page: ${slowestPage.url} (${slowestPage.responseTime}ms)`);
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(error => {
        console.log(`   - ${error.url}: ${error.error}`);
      });
    }
    
    // Performance recommendations
    console.log('\n💡 Recommendations:');
    const slowPages = this.results.filter(r => r.responseTime > 1000);
    if (slowPages.length > 0) {
      console.log('   - Consider optimizing slow loading pages');
    }
    
    console.log('   - Run Lighthouse CI for detailed performance metrics');
    console.log('   - Check Core Web Vitals in production environment');
    
    // Exit with error code if tests failed
    const hasCriticalErrors = this.errors.length > 0 || this.results.some(r => !r.passed);
    process.exit(hasCriticalErrors ? 1 : 0);
  }
}

// Run tests
const tester = new PerformanceTest();
tester.runTests().catch(console.error);