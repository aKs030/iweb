/**
 * Atmospheric Sky System - CSS-basierte Himmel-Effekte
 * 
 * Erstellt atmosphärische Hintergrund-Effekte mit:
 * - Statische Sterne in verschiedenen Größen
 * - Animierte Sternschnuppen-Effekte
 * - Parallax-Scrolling für Tiefenwirkung
 * - Section-responsive Atmosphären-Übergänge
 * 
 * Nutzt shared-particle-system für Performance und Synchronisation.
 * 
 * @author Portfolio System  
 * @version 2.0.0 (migriert auf shared system)
 * @created 2025-10-02
 */

// Atmosphärisches Himmelssystem
import { getElementById } from "../utils/common-utils.js";
import { createLogger } from "../utils/logger.js";
import {
  sharedParallaxManager,
  sharedSectionDetector,
  sharedCleanupManager,
  getSharedState,
  registerParticleSystem,
  unregisterParticleSystem,
  addTimeout,
  SHARED_CONFIG
} from "./shared-particle-system.js";

const log = createLogger("atmosphericSky");
const LOCAL_CONFIG = {
  STARS: {
    LOW: { small: 40, medium: 25, large: 10 },
    NORMAL: { small: 80, medium: 50, large: 20 },
    HIGH: { small: 120, medium: 75, large: 30 },
  },
  SHOOTING_STARS: {
    MIN_DELAY: 8000,
    MAX_DELAY: 15000,
    DURATION: 2000,
  },
};

// Verwende SHARED_CONFIG für Performance-Settings

const state = {
  isInitialized: false,
  currentSection: "hero",
  isScrollListenerActive: false,
  cleanupFunctions: [],
  timeouts: {
    shootingStar: null,
    active: [],
  },
  sectionObserver: null,
  animationFrameId: null,
  parallaxHandler: null,
};

class AtmosphericSkyManager {
  constructor() {
    if (AtmosphericSkyManager.instance) {
      return AtmosphericSkyManager.instance;
    }
    AtmosphericSkyManager.instance = this;
  }

  async init() {
    const sharedState = getSharedState();
    if (sharedState.isInitialized && sharedState.systems.has('atmospheric-sky')) {
      log.debug("System already initialized");
      return this.cleanup.bind(this);
    }

    const background = getElementById("atmosphericBackground");
    if (!background) {
      log.warn("Background container not found");
      return () => {};
    }

    try {
      log.info("Initializing atmospheric sky system");

      // System registrieren
      registerParticleSystem('atmospheric-sky', this);

      this.createHTMLStructure(background);

      const starsContainer = background.querySelector(".stars-container");

      if (starsContainer) {
        this.createStarSystem(starsContainer, background);
        this.initShootingStars(starsContainer);
      }

      this.setupParallax(background);
      this.setupSectionDetection(background);

      log.info("System initialized successfully");

      return this.cleanup.bind(this);
    } catch (error) {
      log.error("Initialization failed:", error);
      this.cleanup();
      return () => {};
    }
  }

  cleanup() {
    log.info("Starting cleanup");

    // Shared cleanup ausführen
    sharedCleanupManager.cleanupSystem('atmospheric-sky');

    // Lokale cleanup-Funktionen ausführen
    state.cleanupFunctions.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        log.error("Cleanup function error:", error);
      }
    });

    if (state.animationFrameId) {
      cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = null;
    }

    if (state.timeouts.shootingStar) {
      clearTimeout(state.timeouts.shootingStar);
    }
    state.timeouts.active.forEach((timeout) => clearTimeout(timeout));

    // System deregistrieren
    unregisterParticleSystem('atmospheric-sky');

    this.resetState();
    log.info("Cleanup completed");
  }

  resetState() {
    state.cleanupFunctions = [];
    state.timeouts = { shootingStar: null, active: [] };
    state.isInitialized = false;
    state.currentSection = "hero";
  }

  createHTMLStructure(background) {
    if (!background.querySelector(".atmosphere")) {
      const atmosphere = document.createElement("div");
      atmosphere.className = "atmosphere";
      atmosphere.innerHTML = `
        <div class="atmospheric-glow"></div>
        <div class="aurora"></div>
      `;
      background.appendChild(atmosphere);
    }

    if (!background.querySelector(".stars-container")) {
      const starsContainer = document.createElement("div");
      starsContainer.className = "stars-container";
      background.appendChild(starsContainer);
    }

    if (!background.querySelector(".moon")) {
      const moon = document.createElement("div");
      moon.className = "moon";
      moon.innerHTML = `
        <div class="moon-surface"></div>
        <div class="moon-shadow"></div>
      `;
      background.appendChild(moon);
    }
  }

  createStarSystem(container, background) {
    const density = background?.getAttribute("data-stars-density") || "normal";
    const starCounts =
      LOCAL_CONFIG.STARS[density.toUpperCase()] || LOCAL_CONFIG.STARS.NORMAL;

    const starTypes = [
      {
        className: "star-small",
        count: starCounts.small,
        colors: ["", "star-blue", "star-red"],
      },
      {
        className: "star-medium",
        count: starCounts.medium,
        colors: ["", "star-yellow", "star-blue"],
      },
      {
        className: "star-large",
        count: starCounts.large,
        colors: ["", "star-yellow", "star-red"],
      },
    ];

    const fragment = document.createDocumentFragment();
    let totalStars = 0;

    starTypes.forEach((type) => {
      for (let i = 0; i < type.count; i++) {
        const star = this.createStar(type);
        fragment.appendChild(star);
        totalStars++;
      }
    });

    container.appendChild(fragment);
    log.debug(`Created ${totalStars} stars with ${density} density`);
  }

  createStar(type) {
    const star = document.createElement("div");
    star.className = `star ${type.className}`;

    // Farbe hinzufügen (30% Chance)
    if (Math.random() < 0.3 && type.colors.length > 1) {
      const colorClass =
        type.colors[Math.floor(Math.random() * type.colors.length)];
      if (colorClass) star.classList.add(colorClass);
    }

    // Position berechnen (Milchstraßen-Band oder gleichmäßig)
    let x, y;
    if (Math.random() < 0.4) {
      x = Math.random() * 100;
      y = (x * 0.3 + Math.random() * 30) % 100;
    } else {
      x = Math.random() * 100;
      y = Math.random() * 100;
    }

    star.style.left = `${x}%`;
    star.style.top = `${y}%`;
    star.style.animationDelay = `${Math.random() * 4}s`;

    return star;
  }

  initShootingStars(container) {
    const addShootingStar = () => {
      const shootingStar = document.createElement("div");
      shootingStar.className = "shooting-star";

      shootingStar.style.left = `${Math.random() * 50}%`;
      shootingStar.style.top = `${Math.random() * 50}%`;
      shootingStar.style.animation = "shooting 2s linear forwards";

      container.appendChild(shootingStar);

      const timeout = setTimeout(() => {
        shootingStar.remove();
      }, LOCAL_CONFIG.SHOOTING_STARS.DURATION);

      addTimeout(timeout);
    };

    const scheduleNext = () => {
      const delay =
        Math.random() *
          (LOCAL_CONFIG.SHOOTING_STARS.MAX_DELAY - LOCAL_CONFIG.SHOOTING_STARS.MIN_DELAY) +
        LOCAL_CONFIG.SHOOTING_STARS.MIN_DELAY;

      const timeoutId = setTimeout(() => {
        addShootingStar();
        scheduleNext();
      }, delay);
      
      addTimeout(timeoutId);
    };

    // Erste Sternschnuppe nach kurzer Verzögerung
    const initialTimeoutId = setTimeout(() => {
      addShootingStar();
      scheduleNext();
    }, 5000);
    
    addTimeout(initialTimeoutId);
  }

  setupSectionDetection(background) {
    // Section detection callback registrieren
    const sectionCallback = (sectionName) => {
      this.updateAtmosphere(background, sectionName);
    };

    sharedSectionDetector.addCallback(sectionCallback, 'atmospheric-sky');

    // Initial section setup
    setTimeout(() => {
      const sections = document.querySelectorAll("section[id]");
      if (sections.length > 0) {
        const initial = sections[0];
        this.updateAtmosphere(background, initial.id);
      }
    }, 100);

    sharedCleanupManager.addCleanupFunction(
      'atmospheric-sky',
      () => sharedSectionDetector.removeCallback(sectionCallback),
      'section detection'
    );
  }

  updateAtmosphere(background, section) {
    const configs = {
      hero: { starOpacity: 1, atmosphereIntensity: 0.8, moonVisibility: 0.3 },
      features: {
        starOpacity: 0.7,
        atmosphereIntensity: 0.9,
        moonVisibility: 0.6,
      },
      about: { starOpacity: 0.4, atmosphereIntensity: 1, moonVisibility: 1 },
    };

    const config = configs[section] || configs.hero;

    Object.entries(config).forEach(([key, value]) => {
      const cssVar = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      background.style.setProperty(`--${cssVar}`, value);
    });

    background.setAttribute("data-section", section);
    background.setAttribute("data-transitioning", "true");

    setTimeout(() => {
      if (background.getAttribute("data-section") === section) {
        background.setAttribute("data-transitioning", "false");
      }
    }, SHARED_CONFIG.PERFORMANCE.SECTION_TRANSITION_MS);

    this.updateMoon(background, section);
  }

  updateMoon(background, section) {
    const moon = background.querySelector(".moon");
    if (!moon) return;

    const configs = {
      hero: {
        size: 3,
        position: { top: "15%", left: "50%" },
        transform: "translateX(-50%) scale(0.3)",
        isBasicStar: true,
      },
      features: {
        size: 20,
        position: { top: "12%", left: "65%" },
        transform: "translateX(-50%) scale(0.6)",
        isBasicStar: false,
      },
      about: {
        size: 80,
        position: { top: "10%", left: "50%" },
        transform: "translateX(-50%) scale(1)",
        isBasicStar: false,
      },
    };

    const config = configs[section] || configs.hero;

    Object.assign(moon.style, {
      ...config.position,
      transform: config.transform,
      width: `${config.size}px`,
      height: `${config.size}px`,
    });

    if (config.isBasicStar) {
      moon.style.background = "white";
      moon.style.boxShadow = "0 0 5px rgba(255, 255, 255, 0.8)";
      ["surface", "shadow", "before", "after"].forEach((prop) => {
        moon.style.setProperty(`--${prop}-opacity`, "0");
      });
    } else {
      const progress = (config.size - 3) / 97;
      const hue = 45 + progress * 10;
      const sat = progress * 40;
      const light = 85 - progress * 10;

      moon.style.background = `radial-gradient(circle at 30% 30%, 
        hsl(${hue}, ${sat}%, ${light}%), 
        hsl(${hue - 5}, ${sat - 10}%, ${light - 15}%))`;
      moon.style.boxShadow = `0 0 ${15 + progress * 50}px hsla(${hue}, ${sat}%, ${light}%, ${0.4 + progress * 0.4})`;

      moon.style.setProperty(
        "--surface-opacity",
        Math.min(1, Math.max(0, (progress - 0.25) * 4))
      );
      moon.style.setProperty(
        "--shadow-opacity",
        Math.min(0.8, Math.max(0, (progress - 0.3) * 3))
      );
    }
  }

  setupParallax(background) {
    // Parallax-Handler zum shared system hinzufügen
    const parallaxHandler = (progress, scrollY) => {
      try {
        background.style.setProperty("--scroll-progress", progress);

        background.querySelectorAll(".star").forEach((star, i) => {
          const speed = 0.1 + (i % 5) * 0.05;
          star.style.transform = `translateY(${scrollY * speed * SHARED_CONFIG.SCROLL.PARALLAX_SPEED}px)`;
        });
      } catch (error) {
        log.error("Parallax error:", error);
      }
    };

    sharedParallaxManager.addHandler(parallaxHandler, 'atmospheric-sky');

    sharedCleanupManager.addCleanupFunction(
      'atmospheric-sky',
      () => sharedParallaxManager.removeHandler(parallaxHandler),
      'parallax handler'
    );
  }
}

const manager = new AtmosphericSkyManager();

/**
 * Initialisiert das Atmospheric Sky System mit CSS-basierten Stern-Effekten
 * @returns {Promise<Function>} Cleanup-Funktion für das System
 */
export function initAtmosphericSky() {
  return manager.init();
}

export function cleanup() {
  return manager.cleanup();
}

export default { initAtmosphericSky, cleanup };
