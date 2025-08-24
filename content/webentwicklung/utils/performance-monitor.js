// Performance Monitoring Enhancement
// Erweitert das bestehende __particleStats System um umfassende Metriken

(() => {
  if (window.PerformanceMonitor) return;

  // Basis-Statistiken erweitern
  const stats = window.__particleStats = window.__particleStats || { 
    fps: 0, 
    count: 0,
    renderTime: 0,
    frameDrops: 0,
    memoryUsage: 0,
    intersectionEvents: 0,
    sectionLoads: 0
  };

  // Performance Observer für Web Vitals
  let performanceObserver;
  const vitals = {
    lcp: 0, // Largest Contentful Paint
    fid: 0, // First Input Delay
    cls: 0  // Cumulative Layout Shift
  };

  // Memory Usage Monitoring
  function updateMemoryStats() {
    if ('memory' in performance) {
      stats.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }
  }

  // Intersection Observer Performance
  let intersectionCallbacks = 0;
  const originalIntersectionObserver = window.IntersectionObserver;
  if (originalIntersectionObserver) {
    window.IntersectionObserver = class extends originalIntersectionObserver {
      constructor(callback, options) {
        const wrappedCallback = (entries, observer) => {
          intersectionCallbacks++;
          stats.intersectionEvents = intersectionCallbacks;
          return callback(entries, observer);
        };
        super(wrappedCallback, options);
      }
    };
  }

  // Fetch Performance für Section Loading
  let sectionLoadCount = 0;
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const start = performance.now();
    const response = await originalFetch(...args);
    const end = performance.now();
    
    // Track nur HTML-Dateien (wahrscheinlich Sections)
    if (args[0] && args[0].includes('.html')) {
      sectionLoadCount++;
      stats.sectionLoads = sectionLoadCount;
      stats.avgSectionLoadTime = ((stats.avgSectionLoadTime || 0) + (end - start)) / 2;
    }
    
    return response;
  };

  // Performance Entries überwachen
  function initPerformanceObserver() {
    if (!('PerformanceObserver' in window)) return;

    try {
      performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          switch (entry.entryType) {
            case 'largest-contentful-paint':
              vitals.lcp = Math.round(entry.startTime);
              break;
            case 'first-input':
              vitals.fid = Math.round(entry.processingStart - entry.startTime);
              break;
            case 'layout-shift':
              if (!entry.hadRecentInput) {
                vitals.cls += entry.value;
              }
              break;
          }
        }
      });

      performanceObserver.observe({ 
        entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] 
      });
    } catch (e) {
      console.warn('[PerformanceMonitor] Observer init failed:', e);
    }
  }

  // Debug Overlay Enhancement
  function createDebugOverlay() {
    if (document.getElementById('perf-debug-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'perf-debug-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 4px;
      z-index: 10000;
      line-height: 1.4;
      pointer-events: none;
      max-width: 250px;
    `;

    document.body.appendChild(overlay);

    // Update-Schleife
    function updateOverlay() {
      updateMemoryStats();
      overlay.innerHTML = `
        <div>🚀 Performance Monitor</div>
        <div>FPS: ${stats.fps}</div>
        <div>Particles: ${stats.count}</div>
        <div>Render: ${stats.renderTime}ms</div>
        <div>Frame Drops: ${stats.frameDrops}</div>
        <div>Memory: ${stats.memoryUsage}MB</div>
        <div>Intersections: ${stats.intersectionEvents}</div>
        <div>Section Loads: ${stats.sectionLoads}</div>
        <div>LCP: ${vitals.lcp}ms</div>
        <div>FID: ${vitals.fid}ms</div>
        <div>CLS: ${vitals.cls.toFixed(3)}</div>
      `;
      requestAnimationFrame(updateOverlay);
    }

    updateOverlay();
    return overlay;
  }

  // API für externe Nutzung
  window.PerformanceMonitor = {
    getStats: () => ({ ...stats, vitals: { ...vitals } }),
    showDebugOverlay: createDebugOverlay,
    hideDebugOverlay: () => {
      const overlay = document.getElementById('perf-debug-overlay');
      if (overlay) overlay.remove();
    },
    exportReport: () => ({
      timestamp: new Date().toISOString(),
      stats: { ...stats },
      vitals: { ...vitals },
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    })
  };

  // Auto-Start wenn DEBUG flag gesetzt
  if (window.DEBUG || localStorage.getItem('debug-performance') === 'true') {
    initPerformanceObserver();
    setTimeout(createDebugOverlay, 1000); // Nach dem Page Load
  }

  // Keyboard Shortcut für Toggle (Ctrl+Shift+P)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyP') {
      e.preventDefault();
      const overlay = document.getElementById('perf-debug-overlay');
      if (overlay) {
        window.PerformanceMonitor.hideDebugOverlay();
      } else {
        window.PerformanceMonitor.showDebugOverlay();
      }
    }
  });

  console.warn('[PerformanceMonitor] Initialized. Press Ctrl+Shift+P to toggle debug overlay.');
})();
