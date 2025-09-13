// Hero Section Initialisierung (über SectionLoader geladen)
import { createLogger, safeCall } from '../../content/webentwicklung/utils/logger.js';
import { getElementById } from '../../content/webentwicklung/utils/common-utils.js';

const log = createLogger('hero');

// Re-Init hero-bezogene Features nach Laden
document.addEventListener('hero:loaded', async () => {
  // TypeWriter direkt laden und starten
  try {
    const typeWriterModule = await import('./TypeWriter.js');
    const lineMeasurerModule = await import('./lineMeasurer.js');
    const quotesModule = await import('./quotes-de.js');
    
    if (typeWriterModule.initHeroSubtitle) {
      await typeWriterModule.initHeroSubtitle({
        ensureHeroDataModule: async () => ({}),
        makeLineMeasurer: lineMeasurerModule.makeLineMeasurer,
        quotes: quotesModule.default,
        TypeWriterClass: typeWriterModule.default
      });
    }
  } catch (error) {
    log.error('Failed to initialize TypeWriter:', error);
  }
  
  // Particles
  if(typeof window.initParticles === 'function') {
    const canvas = getElementById('particleCanvas');
    if(canvas && !canvas.__initialized){ 
      safeCall(() => window.initParticles(), { logger: log, label: 'initParticles' }); 
      canvas.__initialized = true; 
    }
  }
});