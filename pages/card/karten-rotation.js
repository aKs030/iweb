// ===== Shared Utilities Import =====
import {
  createLogger,
  EVENTS,
  fire,
  getElementById,
  shuffle as shuffleArray,
} from '../../content/webentwicklung/shared-utilities.js';

(() => {
  'use strict';
  if (window.FeatureRotation) return;

  const log = createLogger('FeatureRotation');

  const SECTION_ID = 'features';
  const TEMPLATE_IDS = [
    'template-features-2',
    'template-features-3',
    'template-features-4',
    'template-features-5',
  ];
  const TEMPLATE_URL = '/pages/card/karten.html';

  // Animation Configuration
  const THRESHOLDS = [0, 0.1, 0.25, 0.5, 0.65, 0.75, 1];
  const SNAP_THRESHOLD = 0.75; // Forward Animation bei 75% Sichtbarkeit
  const REVERSE_THRESHOLD = 0.65; // Reverse Animation bei <65%

  // Module State
  let order = [];
  let i = 0;
  let loaded = false;
  let hasAnimated = false;
  let isReversing = false;
  let io = null;
  let observerCleanup = null;

  // Starfield Animation State
  let starfieldCanvas = null;
  let starfieldContext = null;
  let starfieldParticles = [];
  let starfieldAnimationId = null;
  let starfieldStartTime = null;

  // Starfield Configuration (inspiriert von three-earth-system.js)
  const STARFIELD_CONFIG = {
    PARTICLE_COUNT_DESKTOP: 150,
    PARTICLE_COUNT_MOBILE: 60,
    TWINKLE_SPEED: 0.25, // Wie Earth's CONFIG.STARS.TWINKLE_SPEED
    ANIMATION_DURATION: 1400, // Synchron mit Earth's TRANSITION_DURATION
    REVERSE_DURATION: 1000, // Reverse schneller für snappier feel
    EASING: [0.22, 1, 0.36, 1], // Earth's ease-out-expo
    PARTICLE_COLOR: 'rgba(9, 139, 255, 0.8)',
    PARTICLE_GLOW: 'rgba(255, 255, 255, 0.9)',
  };

  // ===== Template Loading & Management =====

  /**
   * Lädt Card-Templates aus karten.html
   * Templates werden ins DOM injiziert und gecacht
   */
  async function ensureTemplates(section) {
    if (loaded) {
      log.debug('Templates already loaded');
      return;
    }

    const url = section?.dataset.featuresSrc || TEMPLATE_URL;
    log.debug(`Loading templates from: ${url}`);

    // Check if templates already exist
    const existing = TEMPLATE_IDS.filter((id) => getElementById(id));
    if (existing.length > 0) {
      log.info(`Found ${existing.length} existing templates`);
      loaded = true;
      fire(EVENTS.FEATURES_TEMPLATES_LOADED);
      return;
    }

    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const wrap = document.createElement('div');
      wrap.style.display = 'none';
      wrap.innerHTML = await res.text();
      document.body.appendChild(wrap);

      const foundAfterLoad = TEMPLATE_IDS.filter((id) => getElementById(id));
      log.info(`Templates loaded: ${foundAfterLoad.length} templates`);

      loaded = true;
      fire(EVENTS.FEATURES_TEMPLATES_LOADED);
    } catch (error) {
      log.error(`Failed to load templates: ${error.message}`);
      fire(EVENTS.FEATURES_TEMPLATES_ERROR, { error, url });
    }
  }

  /**
   * Erstellt ARIA Live Region für Screen Reader Announcements
   */
  function createLiveRegion(section, templateId, LIVE_LABEL_PREFIX) {
    let live = section.querySelector('[data-feature-rotation-live]');
    if (!live) {
      live = document.createElement('div');
      live.setAttribute('data-feature-rotation-live', '');
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      live.style.cssText =
        'position:absolute;width:1px;height:1px;margin:-1px;border:0;padding:0;clip:rect(0 0 0 0);overflow:hidden;';
      section.appendChild(live);
    }
    live.textContent = `${LIVE_LABEL_PREFIX}: ${templateId}`;
    return live;
  }

  // ===== Starfield Animation System =====
  // Inspiriert von three-earth-system.js
  // Canvas-basierte Partikel-Animation mit synchroner Card-Materialisierung

  /**
   * Erstellt Canvas für Starfield-Partikel
   * DPR-aware, responsive, GPU-optimiert
   */
  function createStarfieldCanvas(section) {
    const canvas = document.createElement('canvas');
    canvas.className = 'starfield-canvas';

    const rect = section.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Max 2x für Performance

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    section.appendChild(canvas);

    starfieldCanvas = canvas;
    starfieldContext = ctx;

    log.debug(`Starfield canvas: ${rect.width}x${rect.height}, DPR: ${dpr}`);
    return canvas;
  }

  /**
   * Initialisiert Forward-Animation Partikel
   * Start: Random positions → Ziel: Card-Konturen
   */
  function initializeParticles(section) {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const particleCount = isMobile
      ? STARFIELD_CONFIG.PARTICLE_COUNT_MOBILE
      : STARFIELD_CONFIG.PARTICLE_COUNT_DESKTOP;

    const rect = section.getBoundingClientRect();
    const cards = section.querySelectorAll('.card');

    starfieldParticles = [];

    for (let i = 0; i < particleCount; i++) {
      // Random Start-Position über gesamte Section
      const startX = Math.random() * rect.width;
      const startY = Math.random() * rect.height;

      // Ziel: Random Card-Position (Formation zu Card-Konturen)
      const targetCard = cards[Math.floor(Math.random() * cards.length)];
      const cardRect = targetCard.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();

      // Relative Position innerhalb der Card
      const targetX =
        cardRect.left - sectionRect.left + Math.random() * cardRect.width;
      const targetY =
        cardRect.top - sectionRect.top + Math.random() * cardRect.height;

      // Partikel-Properties (inspiriert von Earth's StarField)
      starfieldParticles.push({
        x: startX,
        y: startY,
        targetX,
        targetY,
        size: Math.random() * 1.5 + 0.5, // 0.5-2.0px
        opacity: Math.random() * 0.5 + 0.5, // 0.5-1.0
        twinkleOffset: Math.random() * Math.PI * 2, // Random phase
        hue: 200 + Math.random() * 20, // 200-220 (blue range)
        saturation: 80 + Math.random() * 20, // 80-100%
        lightness: 80 + Math.random() * 20, // 80-100%
      });
    }

    log.info(`Initialized ${particleCount} particles (mobile: ${isMobile})`);
  }

  /**
   * Zeichnet einzelnen Partikel mit Twinkle-Effekt
   * Inspiriert von Earth's fragmentShader
   */
  function drawParticle(ctx, particle, progress, time) {
    // Easing: ease-out-cubic (approximation von Earth's ease-out-expo)
    const eased = 1 - Math.pow(1 - progress, 3);

    // Interpoliere Position (start → target)
    const x = particle.x + (particle.targetX - particle.x) * eased;
    const y = particle.y + (particle.targetY - particle.y) * eased;

    // Twinkle-Effekt (sin-based mit twinkleSpeed)
    const twinkle =
      (Math.sin(
        time * STARFIELD_CONFIG.TWINKLE_SPEED + particle.twinkleOffset
      ) +
        1) /
      2;
    const opacity = particle.opacity * (0.5 + twinkle * 0.5);

    // Größe nimmt ab während Formation (Sterne konvergieren)
    const size = particle.size * (1 - progress * 0.3); // -30% am Ende

    // HSL Color System (wie Earth)
    ctx.fillStyle = `hsla(${particle.hue}, ${particle.saturation}%, ${particle.lightness}%, ${opacity})`;

    // Glow-Effekt (Additive Blending Simulation)
    ctx.shadowBlur = size * 3;
    ctx.shadowColor = STARFIELD_CONFIG.PARTICLE_GLOW;

    // Zeichne Partikel (Kreis)
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Reset Shadow für Performance
    ctx.shadowBlur = 0;
  }

  /**
   * Animation Loop - zeichnet alle Partikel
   * Inspiration: Earth's startAnimationLoop()
   */
  function animateStarfield(section) {
    if (!starfieldContext || !starfieldCanvas) return;

    const now = performance.now();
    if (!starfieldStartTime) starfieldStartTime = now;

    const elapsed = now - starfieldStartTime;
    const progress = Math.min(elapsed / STARFIELD_CONFIG.ANIMATION_DURATION, 1);

    // Clear Canvas
    const rect = section.getBoundingClientRect();
    starfieldContext.clearRect(0, 0, rect.width, rect.height);

    // Zeichne alle Partikel
    starfieldParticles.forEach((particle) => {
      drawParticle(starfieldContext, particle, progress, now / 1000);
    });

    // Continue Animation oder beenden
    if (progress < 1) {
      starfieldAnimationId = requestAnimationFrame(() =>
        animateStarfield(section)
      );
    } else {
      // Animation complete - Cards sind bereits durch CSS-Animation sichtbar
      log.info('✨ Starfield formation complete');
      section.classList.remove('starfield-animating');
      section.classList.add('cards-visible');
      cleanupStarfield();

      section.dispatchEvent(
        new CustomEvent(EVENTS.TEMPLATE_MOUNTED, {
          detail: { templateId: section.dataset.currentTemplate },
          bubbles: true,
        })
      );
    }
  }

  /**
   * Startet Starfield-Animation
   * @param {HTMLElement} section - Features Section
   */
  function applyStarfieldAnimation(section) {
    log.info('🌟 Starting Starfield Constellation Animation');

    // Bereite Section vor
    section.classList.add('starfield-animating');

    // Erstelle Canvas
    createStarfieldCanvas(section);

    // Initialisiere Partikel
    initializeParticles(section);

    // Starte Animation Loop
    starfieldStartTime = null; // Reset für neue Animation
    animateStarfield(section);
  }

  /**
   * Cleanup: Canvas entfernen, Animation stoppen
   */
  function cleanupStarfield() {
    if (starfieldAnimationId) {
      cancelAnimationFrame(starfieldAnimationId);
      starfieldAnimationId = null;
    }

    if (starfieldCanvas && starfieldCanvas.parentNode) {
      starfieldCanvas.parentNode.removeChild(starfieldCanvas);
    }

    starfieldCanvas = null;
    starfieldContext = null;
    starfieldParticles = [];
    starfieldStartTime = null;

    log.debug('Starfield cleanup complete');
  }

  // ===== Reverse Animation: Cards → Starfield =====

  /**
   * Initialisiert Partikel für Reverse Animation
   * Start: Card-Positionen → Ziel: Random verteilt
   */
  function initializeReverseParticles(section) {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const particleCount = isMobile
      ? STARFIELD_CONFIG.PARTICLE_COUNT_MOBILE
      : STARFIELD_CONFIG.PARTICLE_COUNT_DESKTOP;

    const rect = section.getBoundingClientRect();
    const cards = section.querySelectorAll('.card');

    starfieldParticles = [];

    for (let i = 0; i < particleCount; i++) {
      // Start: Card-Positionen (reversed von Forward)
      const startCard = cards[Math.floor(Math.random() * cards.length)];
      const cardRect = startCard.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();

      const startX =
        cardRect.left - sectionRect.left + Math.random() * cardRect.width;
      const startY =
        cardRect.top - sectionRect.top + Math.random() * cardRect.height;

      // Ziel: Random über Section verteilt (wie Forward Start)
      const targetX = Math.random() * rect.width;
      const targetY = Math.random() * rect.height;

      starfieldParticles.push({
        x: startX,
        y: startY,
        targetX,
        targetY,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.5,
        twinkleOffset: Math.random() * Math.PI * 2,
        hue: 200 + Math.random() * 20,
        saturation: 80 + Math.random() * 20,
        lightness: 80 + Math.random() * 20,
      });
    }

    log.info(
      `Initialized ${particleCount} particles for REVERSE (mobile: ${isMobile})`
    );
  }

  /**
   * Reverse Animation Loop - Partikel bewegen sich von Cards weg
   */
  function animateReverseStarfield(section) {
    if (!starfieldContext || !starfieldCanvas) return;

    const now = performance.now();
    if (!starfieldStartTime) starfieldStartTime = now;

    const elapsed = now - starfieldStartTime;
    const progress = Math.min(elapsed / STARFIELD_CONFIG.REVERSE_DURATION, 1);

    // Clear Canvas
    const rect = section.getBoundingClientRect();
    starfieldContext.clearRect(0, 0, rect.width, rect.height);

    // Zeichne alle Partikel (mit ease-in für Reverse)
    starfieldParticles.forEach((particle) => {
      // Easing: ease-in-cubic (beschleunigt zum Ende)
      const eased = progress * progress * progress;

      const x = particle.x + (particle.targetX - particle.x) * eased;
      const y = particle.y + (particle.targetY - particle.y) * eased;

      // Twinkle-Effekt
      const twinkle =
        (Math.sin(
          (now / 1000) * STARFIELD_CONFIG.TWINKLE_SPEED + particle.twinkleOffset
        ) +
          1) /
        2;
      const opacity =
        particle.opacity * (0.5 + twinkle * 0.5) * (1 - progress * 0.3); // Fade out

      // Größe wächst während Reverse (Partikel → Sterne)
      const size = particle.size * (1 + progress * 0.5); // +50% am Ende

      starfieldContext.fillStyle = `hsla(${particle.hue}, ${particle.saturation}%, ${particle.lightness}%, ${opacity})`;
      starfieldContext.shadowBlur = size * 3;
      starfieldContext.shadowColor = STARFIELD_CONFIG.PARTICLE_GLOW;

      starfieldContext.beginPath();
      starfieldContext.arc(x, y, size, 0, Math.PI * 2);
      starfieldContext.fill();

      starfieldContext.shadowBlur = 0;
    });

    // Continue oder beenden
    if (progress < 1) {
      starfieldAnimationId = requestAnimationFrame(() =>
        animateReverseStarfield(section)
      );
    } else {
      // Reverse complete
      log.info('🔄 Reverse starfield complete');
      cleanupStarfield();

      // Reset State
      hasAnimated = false;
      isReversing = false;

      // Section zurück zu initial State
      section.classList.remove(
        'starfield-animating',
        'cards-materializing',
        'cards-visible'
      );
      section.classList.add('cards-hidden');
    }
  }

  /**
   * Startet Reverse Animation (Cards verschwinden → Starfield)
   */
  function applyReverseStarfieldAnimation(section) {
    if (isReversing) {
      log.debug('Reverse animation already running, skipping');
      return; // Guard gegen mehrfache Aufrufe
    }

    log.info('🔄 Starting REVERSE Starfield Animation (Cards → Stars)');
    isReversing = true;

    // Cards sofort unsichtbar
    section.classList.remove('cards-materializing', 'cards-visible');
    section.classList.add('starfield-animating');

    // Canvas erstellen
    createStarfieldCanvas(section);

    // Reverse Partikel initialisieren
    initializeReverseParticles(section);

    // Starte Reverse Animation Loop
    starfieldStartTime = null;
    animateReverseStarfield(section);
  }

  function mountInitialCards() {
    const section = getElementById(SECTION_ID);
    if (!section) {
      log.warn('Section not found for initial cards');
      return;
    }

    if (section.dataset.currentTemplate) {
      log.debug('Cards already mounted');
      return;
    }

    if (!order.length) {
      log.warn('No templates in order array');
      return;
    }

    const tpl = getElementById(order[i]);
    if (!tpl) {
      log.warn(`Template ${order[i]} not found`);
      return;
    }

    const LIVE_LABEL_PREFIX = section.dataset.liveLabel || 'Feature';
    const frag = tpl.content ? document.importNode(tpl.content, true) : null;

    section.replaceChildren(frag || tpl.cloneNode(true));
    createLiveRegion(section, order[i], LIVE_LABEL_PREFIX);
    section.dataset.currentTemplate = order[i];

    // Initial: Cards versteckt, bereit für Starfield-Animation
    section.classList.add('cards-hidden');

    log.info(`Cards mounted (hidden): ${order[i]}`);
    fire(EVENTS.FEATURES_CHANGE, { index: i, total: order.length });
  }

  function observe() {
    const section = getElementById(SECTION_ID);
    if (!section) return;
    if (io) io.disconnect();

    io = new IntersectionObserver(
      (ents) => {
        for (const e of ents) {
          if (e.target !== section) continue;

          const ratio = e.intersectionRatio.toFixed(3);
          const isVisible = e.isIntersecting;

          log.debug(
            `📊 Intersection: visible=${isVisible}, ratio=${ratio}, hasAnimated=${hasAnimated}, isReversing=${isReversing}`
          );

          // Reverse Animation: Section verlässt Viewport
          if (
            hasAnimated &&
            !isReversing &&
            (!isVisible || parseFloat(ratio) < REVERSE_THRESHOLD)
          ) {
            log.info(
              `🔄 Section leaving (ratio=${ratio}) - triggering reverse animation`
            );
            applyReverseStarfieldAnimation(section);
            return; // Stop weitere Checks
          }

          // Forward Animation bei hohem Threshold (Section fast komplett sichtbar)
          if (isVisible && parseFloat(ratio) >= SNAP_THRESHOLD) {
            if (
              !hasAnimated &&
              !isReversing &&
              section.dataset.currentTemplate
            ) {
              log.info(
                `🚀 Snap complete (${ratio}) - starting starfield animation!`
              );
              hasAnimated = true;

              // Starte Starfield Constellation Animation
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  applyStarfieldAnimation(section);
                });
              });
            }
          }
        }
      },
      { threshold: THRESHOLDS }
    );

    io.observe(section);

    // Scroll Event Listener für frühe Reverse-Erkennung
    // Throttled auf 100ms für Performance
    let lastScrollCheck = 0;
    const handleScroll = () => {
      const now = performance.now();
      if (now - lastScrollCheck < 100) return; // Throttle
      lastScrollCheck = now;

      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const visibleRatio =
        Math.max(
          0,
          Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
        ) / rect.height;

      // Trigger Reverse während Scrollen (VOR IntersectionObserver)
      if (visibleRatio < REVERSE_THRESHOLD && hasAnimated && !isReversing) {
        log.info(`🔄 Scroll away detected (ratio: ${visibleRatio.toFixed(2)})`);
        applyReverseStarfieldAnimation(section);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup function registrieren
    return () => {
      io?.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }

  async function init() {
    log.info('Initializing FeatureRotation');

    const section = getElementById(SECTION_ID);
    if (!section) {
      log.error(`Features section '#${SECTION_ID}' not found!`);
      return;
    }

    // 1. Templates laden
    log.debug('Step 1: Loading templates...');
    if (!loaded) {
      await ensureTemplates(section);
    }

    // 2. Prüfe ob Templates geladen wurden
    log.debug('Step 2: Checking for available templates...');
    const availableTemplates = TEMPLATE_IDS.filter((id) => {
      const found = getElementById(id);
      log.debug(`  - ${id}: ${found ? '✅ found' : '❌ missing'}`);
      return found;
    });

    if (availableTemplates.length === 0) {
      log.error(`No templates found! Searched for: ${TEMPLATE_IDS.join(', ')}`);
      return;
    }

    // 3. Order shufflen mit verfügbaren Templates
    log.debug('Step 3: Shuffling template order...');
    order = shuffleArray([...availableTemplates]);
    log.info(`Template order: ${order.join(', ')} (${order.length} templates)`);

    // 4. Cards mounten
    log.debug('Step 4: Mounting initial cards...');
    if (section) {
      mountInitialCards();
    } else {
      log.warn('Features section not found');
    }

    // 5. Observer starten
    log.debug('Step 5: Starting observer...');
    observerCleanup = observe();

    log.info('✅ FeatureRotation initialized successfully');
  }

  window.FeatureRotation = {
    current: () => ({ index: i, id: order[i] }),
    destroy() {
      if (observerCleanup) {
        observerCleanup();
        observerCleanup = null;
      }
      io?.disconnect();
      io = null;
      cleanupStarfield(); // Cleanup Starfield Animation
      delete window.FeatureRotation;
    },
  };

  // Init starten
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init, { once: true })
    : init();
})();
