// Atmosphärisches Himmelssystem - Optimierte Version
import { getElementById, throttle } from '../utils/common-utils.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('atmosphericSky');

// ===== Globale Variablen =====
let isInitialized = false;
let cleanupFunctions = [];
let animationFrameId = null;
let isScrollListenerActive = false;
let handleParallax = null;
let currentSection = 'hero';
let sectionObserver = null;
let cloudTimeout = null;
let shootingStarTimeout = null;
let activeTimeouts = [];
let cloudFrequencyMultiplier = 1;

// ===== Atmospheric Sky System Manager =====
const AtmosphericSkyManager = (() => {
  
  const initAtmosphericSky = () => {
    if (isInitialized) {
      log.debug('Atmospheric sky system already initialized');
      return () => {};
    }

    const background = getElementById('atmosphericBackground');
    if (!background) {
      log.warn('Atmospheric background container not found');
      return () => {};
    }

    try {
      log.info('Initializing atmospheric sky system');
      
      // HTML-Struktur erstellen falls nicht vorhanden
      createAtmosphericHTML(background);
      
      // Container initialisieren
      const starsContainer = background.querySelector('.stars-container');
      const cloudsContainer = background.querySelector('.clouds');
      
      // Sterne generieren
      if (starsContainer) {
        createStars(starsContainer, background);
      }
      
      // Sternschnuppen-System starten
      if (starsContainer) {
        startShootingStars(starsContainer);
      }
      
      // Wolken-System starten
      if (cloudsContainer) {
        startClouds(cloudsContainer);
      }
      
      // Parallax-Effekt aktivieren
      setupParallaxEffect(background);
      
      // Section-Detection aktivieren
      setupSectionDetection(background);
      
      isInitialized = true;
      log.info('Atmospheric sky system initialized successfully');
      
      return cleanup;
    } catch (error) {
      log.error('Failed to initialize atmospheric sky system:', error);
      return () => {};
    }
  };

  const cleanup = () => {
    log.info('Cleaning up atmospheric sky system');
    
    // Alle cleanup-Funktionen aufrufen
    cleanupFunctions.forEach(fn => {
      try {
        fn();
      } catch (error) {
        log.error('Error during cleanup:', error);
      }
    });
    
    // Animation Frame stoppen
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    // Timeouts löschen
    if (cloudTimeout) {
      clearTimeout(cloudTimeout);
      cloudTimeout = null;
    }
    
    if (shootingStarTimeout) {
      clearTimeout(shootingStarTimeout);
      shootingStarTimeout = null;
    }
    
    activeTimeouts.forEach(timeout => clearTimeout(timeout));
    activeTimeouts = [];
    
    // Scroll Listener entfernen
    if (isScrollListenerActive && handleParallax) {
      window.removeEventListener('scroll', handleParallax);
      isScrollListenerActive = false;
    }
    
    // Observer disconnecten
    if (sectionObserver) {
      sectionObserver.disconnect();
      sectionObserver = null;
    }
    
    cleanupFunctions = [];
    isInitialized = false;
    currentSection = 'hero';
    cloudFrequencyMultiplier = 1;
  };

  return { initAtmosphericSky, cleanup };
})();

// ===== HTML-Struktur erstellen =====
function createAtmosphericHTML(background) {
  log.debug('Creating atmospheric HTML elements');
  
  // Atmosphäre erstellen falls nicht vorhanden
  if (!background.querySelector('.atmosphere')) {
    const atmosphere = document.createElement('div');
    atmosphere.className = 'atmosphere';
    atmosphere.innerHTML = `
      <div class="atmospheric-glow"></div>
      <div class="aurora"></div>
      <div class="clouds"></div>
    `;
    background.appendChild(atmosphere);
  }
  
  // Sterne-Container erstellen falls nicht vorhanden
  if (!background.querySelector('.stars-container')) {
    const starsContainer = document.createElement('div');
    starsContainer.className = 'stars-container';
    background.appendChild(starsContainer);
  }
  
  // Mond erstellen falls nicht vorhanden
  if (!background.querySelector('.moon')) {
    const moon = document.createElement('div');
    moon.className = 'moon';
    moon.innerHTML = `
      <div class="moon-surface"></div>
      <div class="moon-shadow"></div>
    `;
    background.appendChild(moon);
  }
  
  // Earth-Globe erstellen falls nicht vorhanden
  if (!background.querySelector('.earth-globe')) {
    const earthGlobe = document.createElement('div');
    earthGlobe.className = 'earth-globe';
    earthGlobe.innerHTML = `
      <div class="earth-sphere">
        <div class="earth-surface"></div>
        <div class="earth-atmosphere"></div>
        <div class="earth-shadow"></div>
      </div>
    `;
    background.appendChild(earthGlobe);
  }
}

// ===== Sterne generieren =====
function createStars(starsContainer, background) {
  log.debug('Creating stars');
  
  // Basis-Stern-Konfiguration
  const density = background?.getAttribute('data-stars-density') || 'normal';
  
  const densityMultipliers = {
    low: 0.5,
    normal: 1,
    high: 1.5,
    adaptive: 1
  };
  
  const multiplier = densityMultipliers[density] || 1;
  
  const starTypes = [
    { className: 'star-small', count: Math.floor(80 * multiplier), colors: ['', 'star-blue', 'star-red'] },
    { className: 'star-medium', count: Math.floor(50 * multiplier), colors: ['', 'star-yellow', 'star-blue'] },
    { className: 'star-large', count: Math.floor(20 * multiplier), colors: ['', 'star-yellow', 'star-red'] }
  ];
  
  // DocumentFragment für bessere Performance
  const fragment = document.createDocumentFragment();
  
  starTypes.forEach(type => {
    for (let i = 0; i < type.count; i++) {
      const star = document.createElement('div');
      star.className = `star ${type.className}`;
      
      // Zufällige Farbe hinzufügen (30% Chance)
      if (Math.random() < 0.3 && type.colors.length > 1) {
        const colorClass = type.colors[Math.floor(Math.random() * type.colors.length)];
        if (colorClass) star.classList.add(colorClass);
      }
      
      // Realistische Verteilung
      let x, y;
      if (Math.random() < 0.4) {
        // Milchstraße-Band
        x = Math.random() * 100;
        y = (x * 0.3 + Math.random() * 30) % 100;
      } else {
        // Gleichmäßig verteilt
        x = Math.random() * 100;
        y = Math.random() * 100;
      }
      
      star.style.left = x + '%';
      star.style.top = y + '%';
      star.style.animationDelay = Math.random() * 4 + 's';
      
      fragment.appendChild(star);
    }
  });
  
  starsContainer.appendChild(fragment);
  log.debug(`Created ${starTypes.reduce((sum, type) => sum + type.count, 0)} stars with ${density} density`);
}

// ===== Sternschnuppen-System =====
function startShootingStars(starsContainer) {
  log.debug('Starting shooting stars system');
  
  function addShootingStar() {
    const shootingStar = document.createElement('div');
    shootingStar.className = 'shooting-star';
    
    const startX = Math.random() * 50;
    const startY = Math.random() * 50;
    
    shootingStar.style.left = startX + '%';
    shootingStar.style.top = startY + '%';
    shootingStar.style.animation = 'shooting 2s linear forwards';
    
    starsContainer.appendChild(shootingStar);
    
    // Sternschnuppe nach Animation entfernen
    const removeTimeout = setTimeout(() => {
      if (shootingStar.parentNode) {
        shootingStar.remove();
      }
    }, 2000);
    
    activeTimeouts.push(removeTimeout);
  }
  
  function scheduleNextShootingStar() {
    const delay = Math.random() * 7000 + 8000; // 8-15 Sekunden
    shootingStarTimeout = setTimeout(() => {
      addShootingStar();
      scheduleNextShootingStar();
    }, delay);
  }
  
  // Erste Sternschnuppe nach kurzer Verzögerung
  shootingStarTimeout = setTimeout(() => {
    addShootingStar();
    scheduleNextShootingStar();
  }, 5000);
  
  // Cleanup-Funktion registrieren
  cleanupFunctions.push(() => {
    if (shootingStarTimeout) {
      clearTimeout(shootingStarTimeout);
      shootingStarTimeout = null;
    }
  });
}

// ===== Wolken-System =====
function startClouds(cloudsContainer) {
  log.debug('Starting clouds system');
  
  function addCloud() {
    const cloud = document.createElement('div');
    cloud.className = 'cloud';
    
    const width = Math.random() * 150 + 100;
    const height = width * 0.6;
    const top = Math.random() * 40 + 10;
    const duration = Math.random() * 40 + 60; // 60-100 Sekunden
    
    cloud.style.width = width + 'px';
    cloud.style.height = height + 'px';
    cloud.style.top = top + '%';
    cloud.style.left = '-200px';
    cloud.style.animationDuration = duration + 's';
    cloud.style.animationDelay = Math.random() * 10 + 's';
    
    cloudsContainer.appendChild(cloud);
    
    // Cloud nach Animation entfernen
    const removeTimeout = setTimeout(() => {
      if (cloud.parentNode) {
        cloud.remove();
      }
    }, (duration + 10) * 1000);
    
    activeTimeouts.push(removeTimeout);
  }
  
  function scheduleNextCloud() {
    const baseDelay = Math.random() * 15000 + 10000; // 10-25 Sekunden
    const adjustedDelay = baseDelay / cloudFrequencyMultiplier;
    
    cloudTimeout = setTimeout(() => {
      addCloud();
      scheduleNextCloud();
    }, adjustedDelay);
  }
  
  // Erste Wolken mit gestaffelten Zeiten
  for (let i = 0; i < 3; i++) {
    const initialTimeout = setTimeout(() => addCloud(), i * 5000);
    activeTimeouts.push(initialTimeout);
  }
  
  scheduleNextCloud();
  
  // Cleanup-Funktion registrieren
  cleanupFunctions.push(() => {
    if (cloudTimeout) {
      clearTimeout(cloudTimeout);
      cloudTimeout = null;
    }
  });
}

// ===== Section Detection für adaptive Atmosphäre =====
function setupSectionDetection(background) {
  log.debug('Setting up section detection');
  
  const sections = document.querySelectorAll('section[id]');
  if (sections.length === 0) {
    log.warn('No sections found for detection');
    return;
  }
  
  const observerOptions = {
    root: null,
    rootMargin: '-20% 0px -20% 0px',
    threshold: 0.3
  };
  
  sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const newSection = entry.target.id;
        if (newSection !== currentSection) {
          currentSection = newSection;
          updateSectionAtmosphere(background, newSection);
        }
      }
    });
  }, observerOptions);
  
  // Alle Sektionen observieren
  sections.forEach(section => {
    sectionObserver.observe(section);
  });
  
  // Initiale Section-Detection
  setTimeout(() => {
    const initialSection = document.querySelector('#hero') || sections[0];
    if (initialSection) {
      currentSection = initialSection.id;
      updateSectionAtmosphere(background, currentSection);
      log.debug(`Initial section detected: ${currentSection}`);
    }
  }, 100);
  
  // Cleanup-Funktion registrieren
  cleanupFunctions.push(() => {
    if (sectionObserver) {
      sectionObserver.disconnect();
      sectionObserver = null;
    }
  });
}

// ===== Sektion-spezifische Atmosphären-Updates =====
function updateSectionAtmosphere(background, sectionName) {
  log.debug(`Updating atmosphere for section: ${sectionName}`);
  
  const sectionConfigs = {
    hero: {
      starOpacity: 1,
      atmosphereIntensity: 0.8,
      moonVisibility: 0.3,
      cloudFrequency: 0.5,
      landscapeHeight: '0px',
      landscapeOpacity: 0
    },
    features: {
      starOpacity: 0.7,
      atmosphereIntensity: 0.9,
      moonVisibility: 0.6,
      cloudFrequency: 0.8,
      landscapeHeight: '50px',
      landscapeOpacity: 0.3
    },
    about: {
      starOpacity: 0.4,
      atmosphereIntensity: 1,
      moonVisibility: 1,
      cloudFrequency: 0.6,
      landscapeHeight: '150px',
      landscapeOpacity: 1
    }
  };
  
  const config = sectionConfigs[sectionName] || sectionConfigs.hero;
  
  // CSS Custom Properties aktualisieren
  background.style.setProperty('--star-opacity', config.starOpacity);
  background.style.setProperty('--atmosphere-intensity', config.atmosphereIntensity);
  background.style.setProperty('--moon-visibility', config.moonVisibility);
  background.style.setProperty('--cloud-frequency', config.cloudFrequency);
  background.style.setProperty('--landscape-height', config.landscapeHeight);
  background.style.setProperty('--landscape-opacity', config.landscapeOpacity || 0);
  
  // Data-Attribute für CSS-Selektoren aktualisieren
  background.setAttribute('data-section', sectionName);
  background.setAttribute('data-transitioning', 'true');
  
  // Übergang-Flag nach Verzögerung entfernen
  setTimeout(() => {
    if (background.getAttribute('data-section') === sectionName) {
      background.setAttribute('data-transitioning', 'false');
    }
  }, 800);
  
  // Mond-Größe basierend auf Sektion anpassen
  updateMoonForSection(background, sectionName);
  
  // Wolken-Frequenz anpassen
  cloudFrequencyMultiplier = config.cloudFrequency;
}

// ===== Mond-Update für Sektionen =====
function updateMoonForSection(background, sectionName) {
  const moon = background.querySelector('.moon');
  if (!moon) return;
  
  const moonConfigs = {
    hero: { 
      size: 3, 
      position: { top: '15%', left: '50%' },
      transform: 'translateX(-50%) scale(0.3)',
      isBasicStar: true 
    },
    features: { 
      size: 20, 
      position: { top: '12%', left: '65%' },
      transform: 'translateX(-50%) scale(0.6)',
      isBasicStar: false 
    },
    about: { 
      size: 80, 
      position: { top: '10%', left: '50%' },
      transform: 'translateX(-50%) scale(1)',
      isBasicStar: false 
    }
  };
  
  const moonConfig = moonConfigs[sectionName] || moonConfigs.hero;
  
  // Mond-Position und -Transformation
  moon.style.top = moonConfig.position.top;
  moon.style.left = moonConfig.position.left;
  moon.style.transform = moonConfig.transform;
  moon.style.width = moonConfig.size + 'px';
  moon.style.height = moonConfig.size + 'px';
  
  if (moonConfig.isBasicStar) {
    // Als einfacher Stern
    moon.style.background = 'white';
    moon.style.boxShadow = '0 0 5px rgba(255, 255, 255, 0.8)';
    moon.style.setProperty('--surface-opacity', '0');
    moon.style.setProperty('--shadow-opacity', '0');
    moon.style.setProperty('--before-opacity', '0');
    moon.style.setProperty('--after-opacity', '0');
  } else {
    // Als detaillierter Mond
    const progress = (moonConfig.size - 3) / 97;
    const moonHue = 45 + progress * 10;
    const moonSaturation = progress * 40;
    const moonLightness = 85 - progress * 10;
    
    moon.style.background = `radial-gradient(circle at 30% 30%, 
      hsl(${moonHue}, ${moonSaturation}%, ${moonLightness}%), 
      hsl(${moonHue - 5}, ${moonSaturation - 10}%, ${moonLightness - 15}%))`;
    moon.style.boxShadow = `0 0 ${15 + progress * 50}px hsla(${moonHue}, ${moonSaturation}%, ${moonLightness}%, ${0.4 + progress * 0.4}),
                            inset 0 0 ${5 + progress * 15}px rgba(0, 0, 0, 0.1)`;
    
    const surfaceOpacity = Math.min(1, Math.max(0, (progress - 0.25) * 4));
    const shadowOpacity = Math.min(0.8, Math.max(0, (progress - 0.3) * 3));
    
    moon.style.setProperty('--surface-opacity', surfaceOpacity);
    moon.style.setProperty('--shadow-opacity', shadowOpacity);
    moon.style.setProperty('--before-opacity', Math.min(1, Math.max(0, (progress - 0.4) * 3)));
    moon.style.setProperty('--after-opacity', Math.min(1, Math.max(0, (progress - 0.5) * 3)));
  }
}

// ===== Parallax-Effekt beim Scrollen =====
function setupParallaxEffect(background) {
  log.debug('Setting up parallax effect');
  
  handleParallax = throttle(() => {
    try {
      const scrollY = window.pageYOffset;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollProgress = Math.min(1, Math.max(0, scrollY / Math.max(1, documentHeight - windowHeight)));
      
      // CSS Variables setzen
      document.documentElement.style.setProperty('--global-scroll-progress', scrollProgress);
      background.style.setProperty('--scroll-progress', scrollProgress);
      
      // Earth-Globe Skalierung
      const earthGlobes = document.querySelectorAll('.earth-globe');
      earthGlobes.forEach((earthGlobe) => {
        const scaleValue = 1 - scrollProgress * 0.7;
        earthGlobe.style.setProperty('--earth-scale', scaleValue);
        earthGlobe.style.transform = `translateX(-50%) scale(${scaleValue})`;
      });
      
      // Sanfte Parallax-Bewegung für Wolken
      const clouds = background.querySelectorAll('.cloud');
      clouds.forEach((cloud, index) => {
        const speed = 0.5 + (index % 3) * 0.2;
        const yOffset = scrollY * speed * 0.1;
        cloud.style.transform = `translateY(${yOffset}px)`;
      });
      
      // Sanfte Parallax für Sterne
      const stars = background.querySelectorAll('.star');
      stars.forEach((star, index) => {
        const speed = 0.1 + (index % 5) * 0.05;
        const yOffset = scrollY * speed * 0.05;
        star.style.transform = `translateY(${yOffset}px)`;
      });
      
    } catch (error) {
      log.error('Error in parallax handler:', error);
    }
  }, 16); // ~60fps
  
  window.addEventListener('scroll', handleParallax, { passive: true });
  isScrollListenerActive = true;
  
  // Initiale Berechnung
  handleParallax();
  
  // Cleanup-Funktion registrieren
  cleanupFunctions.push(() => {
    if (handleParallax) {
      window.removeEventListener('scroll', handleParallax);
      isScrollListenerActive = false;
    }
  });
}

// ===== Public API & Module Export =====
export function initAtmosphericSky() {
  log.debug('Initializing atmospheric sky system');
  
  const background = getElementById('atmosphericBackground');
  if (!background) {
    log.warn('Atmospheric background element not found');
    return () => {};
  }
  
  return AtmosphericSkyManager.initAtmosphericSky();
}

export const cleanup = AtmosphericSkyManager.cleanup;

// Default Export für Kompatibilität
export default {
  initAtmosphericSky,
  cleanup
};