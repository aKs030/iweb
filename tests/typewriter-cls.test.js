const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'https://abdulkerimsesli.de';
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);

  // Capture CLS via PerformanceObserver in page context
  const cls = await page.evaluate(async (targetEventName) => {
    return new Promise(async (resolve) => {
      let cumulativeCLS = 0;
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) cumulativeCLS += entry.value;
        }
      });
      try { po.observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* not supported */ }

      // Listen for hero typing end or wait 6s
      const timeout = setTimeout(() => {
        try { po.disconnect(); } catch (e) {}
        resolve(cumulativeCLS);
      }, 6000);

      try {
        await new Promise(res => setTimeout(res, 250));
        await Promise.all([
          page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(()=>{}),
          (async () => {
            // Wait up to 5s for hero:typingEnd event
            let resolved = false;
            const handler = () => {
              if (resolved) return;
              resolved = true; clearTimeout(timeout); try { po.disconnect(); } catch (e) {}
              resolve(cumulativeCLS);
            };
            try { window.addEventListener('hero:typingEnd', handler, { once: true }); } catch (e) {}
            setTimeout(() => { if (!resolved) handler(); }, 5000);
          })()
        ]).catch(() => {});
      } catch (e) { try { po.disconnect(); } catch (e) {} resolve(cumulativeCLS); }
    });
  }, 'hero:typingEnd');

  console.log('CLS detected:', cls);
  await browser.close();
  if (cls >= 0.1) process.exit(2);
  process.exit(0);
})();