/**
 * Zentralisierte Partikel-Konfiguration mit Performance-Optimierungen
 * @author Abdulkerim Sesli
 */

export class ParticleConfig {
  constructor(bgRoot) {
    this.bgRoot = bgRoot;
    this.cache = new Map();
    this.lastUpdate = 0;
    this.updateThreshold = 100; // Cache für 100ms
    
    // Default-Konfiguration
    this.defaults = {
      gradient: 'radial',
      alphaScale: 1.15,
      trails: true,
      trailFade: 0.08,
      glow: true,
      blend: 'lighter',
      connSkip: 2,
      connCap: 8,
      quadtree: true,
      autoQuality: true,
      sortDepth: true,
      dof: true
    };
    
    this.observer = null;
    this.setupObserver();
  }

  setupObserver() {
    if (!this.bgRoot) return;
    
    this.observer = new MutationObserver((mutations) => {
      let hasDataAttributeChange = false;
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && 
            mutation.attributeName?.startsWith('data-particle-')) {
          hasDataAttributeChange = true;
          break;
        }
      }
      
      if (hasDataAttributeChange) {
        this.invalidateCache();
        this.dispatchConfigChange();
      }
    });
    
    this.observer.observe(this.bgRoot, { 
      attributes: true, 
      attributeFilter: this.getAttributeFilter()
    });
  }

  getAttributeFilter() {
    return [
      'data-particle-gradient',
      'data-particle-alpha-scale',
      'data-particle-trails',
      'data-particle-trail-fade',
      'data-particle-glow',
      'data-particle-blend',
      'data-particle-conn-skip',
      'data-particle-conn-cap',
      'data-particle-quadtree',
      'data-particle-auto-quality',
      'data-particle-sort-depth',
      'data-particle-dof',
      'data-particle-gravity',
      'data-particle-collisions',
      'data-particle-bounce'
    ];
  }

  get(key) {
    const now = performance.now();
    const cacheKey = `data-particle-${key}`;
    
    // Cache-Check mit Zeitstempel
    if (this.cache.has(cacheKey) && 
        (now - this.lastUpdate) < this.updateThreshold) {
      return this.cache.get(cacheKey);
    }
    
    // Wert aus DOM lesen
    const value = this.bgRoot?.getAttribute(cacheKey);
    const processed = this.processValue(key, value);
    
    // Cache aktualisieren
    this.cache.set(cacheKey, processed);
    this.lastUpdate = now;
    
    return processed;
  }

  processValue(key, value) {
    if (!value) return this.defaults[key];
    
    switch (key) {
      case 'alphaScale':
        return Math.max(0.2, Math.min(2, parseFloat(value)));
      case 'trailFade':
        return Math.max(0.005, Math.min(0.5, parseFloat(value)));
      case 'connSkip':
        return Math.max(1, parseInt(value));
      case 'connCap':
        return Math.max(1, parseInt(value));
      case 'trails':
      case 'glow':
      case 'quadtree':
      case 'autoQuality':
      case 'sortDepth':
      case 'dof':
        return value === 'true';
      case 'blend':
        return ['lighter', 'screen', 'source-over'].includes(value) ? 
          value : this.defaults[key];
      case 'gravity':
        try {
          return JSON.parse(value);
        } catch {
          return { x: 0, y: parseFloat(value) || 0 };
        }
      default:
        return value;
    }
  }

  invalidateCache() {
    this.cache.clear();
    this.lastUpdate = 0;
  }

  dispatchConfigChange() {
    if (this.bgRoot) {
      this.bgRoot.dispatchEvent(new CustomEvent('particle-config-change', {
        detail: { config: this }
      }));
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.cache.clear();
  }
}

/**
 * Performance-optimiertes Config-Caching
 */
export function createParticleConfig(bgRoot) {
  return new ParticleConfig(bgRoot);
}
