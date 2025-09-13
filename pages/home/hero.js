// Hero Section Initialisierung (über SectionLoader geladen)
import { createLogger, safeCall } from '../../content/webentwicklung/utils/logger.js';
import { getElementById } from '../../content/webentwicklung/utils/common-utils.js';

const log = createLogger('hero');

// Re-Init hero-bezogene Features nach Laden
document.addEventListener('hero:loaded', async () => {
  // TypeWriter wird zentral über hero-manager.js initialisiert
  // Hier nur noch Particles initialisieren
  if(typeof window.initParticles === 'function') {
    const canvas = getElementById('particleCanvas');
    if(canvas && !canvas.__initialized){ 
      safeCall(() => window.initParticles(), { logger: log, label: 'initParticles' }); 
      canvas.__initialized = true; 
    }
  }
});