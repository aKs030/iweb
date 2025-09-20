/* eslint-disable indent */
// Export: initParticles({ getElement, throttle }) -> cleanup()
import { randomFloat, getElementById, throttle } from '../utils/common-utils.js';

// ===== Particles Module Manager =====
const ParticlesManager = (() => {
  const initParticles = () => {
    const canvas = getElementById('particleCanvas');
    if (!canvas) {
      return () => {};
    }
    return initParticlesImpl({ getElement: getElementById, throttle });
  };
  return { initParticles };
})();

function initParticlesImpl({ getElement, throttle }) {
  
  const canvas = getElement('particleCanvas');
  if (!canvas) {
    return () => {};
  }
  
  // Canvas-Bereitschaft prüfen
  if (!canvas.getContext) {
    return () => {};
  }
  
  canvas.setAttribute('aria-hidden','true');
  
  // Canvas Context erstellen mit Fehlerbehandlung
  let ctx;
  const useOffscreen = false;
  
  try {
    ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      return () => {};
    }
    // OffscreenCanvas ist temporär deaktiviert - würde WebWorker erfordern
    // if (typeof OffscreenCanvas !== 'undefined' && 'transferControlToOffscreen' in canvas) {
    //   // Vollständige OffscreenCanvas-Implementation würde WebWorker erfordern
    // }
  } catch (_error) {
    return () => {};
  }

  // ===== Perf-Grundlagen =====
  const DPR = Math.min(2, Math.max(1, Math.ceil(window.devicePixelRatio || 1)));
  const bgRoot = document.querySelector('.global-particle-background');

  // ===== Nur 2D Partikel - optimiertes System =====
  const particles = [];
  let rafId = 0, hidden = false;
  let lastTime = performance.now();
  const fpsSamples = [];
  // Parallax Stärke (Mausverfolgung entfernt; Offsets bleiben 0)
  let parallaxStrength = 0; // 0..0.3 via data-attribute (ohne Effekt auf Kamera)

  // ===== Partikel Creation =====
  function createParticle(x, y) {
    return {
      x: x || randomFloat(0, innerWidth),
      y: y || randomFloat(0, innerHeight),
      z: randomFloat(-100, 100),
      vx: randomFloat(-0.5, 0.5),
      vy: randomFloat(-0.5, 0.5),
      vz: randomFloat(-0.3, 0.3),
      size: randomFloat(1.5, 4.0),
      baseSize: randomFloat(1.5, 4.0),
      rotation: randomFloat(0, Math.PI * 2),
      rotationSpeed: randomFloat(-0.02, 0.02),
      life: 1.0,
      maxLife: randomFloat(8, 20),
      birthTime: performance.now()
    };
  }

  // ===== Physik-Eigenschaften =====
  const gravity = { x: 0, y: 0 };
  let enableCollisions = false;
  let bounceEnabled = false;

  // ===== Größe / DPR =====
  const resize = () => {
    const w = innerWidth|0, h = innerHeight|0;
    
    try {
      canvas.width = w * DPR; 
      canvas.height = h * DPR;
      canvas.style.width = w + 'px'; 
      canvas.style.height = h + 'px';
      ctx.setTransform(DPR,0,0,DPR,0,0);
      invalidateGradients();
    } catch (error) {
      // Fallback für robuste Behandlung
      try {
        ctx.setTransform(1,0,0,1,0,0);
      } catch (e) {
      }
    }
  };

  // ===== Partikel =====
  class Particle {
    constructor(x = randomFloat(0, innerWidth), y = randomFloat(0, innerHeight)) {
      this.x = x; this.y = y;
      this.s = randomFloat(0, 2) + 1;
      this.vx = (randomFloat(-1, 1)) * 0.6;
      this.vy = (randomFloat(-1, 1)) * 0.6;
      // 3D-Erweiterungen
      this.z = randomFloat(-200, 200); // Tiefe im 3D-Raum
      this.originalZ = this.z;
      this.vz = randomFloat(-0.3, 0.3);
      // Partikeltyp und erweiterte Eigenschaften
      this.type = this.assignParticleType();
      this.rotation = randomFloat(0, Math.PI * 2);
      this.rotationSpeed = randomFloat(-0.02, 0.02);
      this.pulsePhase = randomFloat(0, Math.PI * 2);
      this.pulseSpeed = randomFloat(0.01, 0.03);
      this.life = 1;
      this.maxLife = 1;
      // 3D-Rendering-Eigenschaften
      this.scale3D = 1;
      this.alpha3D = 1;
      this.depthBlur = 0;
    }
    
    assignParticleType() {
      const typeWeights = this.getParticleTypeWeights();
      const totalWeight = Object.values(typeWeights).reduce((sum, weight) => sum + weight, 0);
      let random = randomFloat(0, totalWeight);
      
      for (const [type, weight] of Object.entries(typeWeights)) {
        random -= weight;
        if (random <= 0) {
          // Erweiterte Star-Varianten
          if (type === 'star') {
            const starVariants = ['star', 'star6', 'star8', 'sparkle'];
            return starVariants[Math.floor(randomFloat(0, starVariants.length))];
          }
          return type;
        }
      }
      return 'circle'; // fallback
    }
    
    getParticleTypeWeights() {
      const typesAttr = bgRoot?.getAttribute('data-particle-types');
      if (!typesAttr) return { circle: 1 };
      
      try {
        return JSON.parse(typesAttr);
      } catch {
        // Fallback für einfache String-Liste: "circle,triangle,star"
        const types = typesAttr.split(',').map(t => t.trim());
        const weights = {};
        types.forEach(type => weights[type] = 1);
        return weights;
      }
    }
    
    update(){
      // 3D-Tiefe updaten
      this.z += this.vz;
      
      // Z-Wrapping für endlose Tiefe
      if (this.z > 300) {
        this.z = -300;
        this.x = randomFloat(0, innerWidth);
        this.y = randomFloat(0, innerHeight);
      } else if (this.z < -300) {
        this.z = 300;
        this.x = randomFloat(0, innerWidth);
        this.y = randomFloat(0, innerHeight);
      }
      
      // Einfache 3D-Perspektive ohne Kamera
      const focal = 600;
      const perspective = focal / (focal + this.z);
      this.scale3D = Math.max(0.1, perspective);
      
      // Depth-basierte Alpha und Blur
      const normalizedZ = Math.abs(this.z) / 300;
      this.alpha3D = Math.max(0.1, 1 - normalizedZ * 0.7);
      this.depthBlur = normalizedZ * 2;
      
      // Schwerkraft anwenden
      this.vx += gravity.x;
      this.vy += gravity.y;
      
      // Typ-spezifische Updates
      this.rotation += this.rotationSpeed * this.scale3D; // Langsamere Rotation in der Ferne
      this.pulsePhase += this.pulseSpeed;
      
      // Geschwindigkeit normalisieren
      const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
      const maxSpeed = 1.2;
      if (speed > maxSpeed) {
        this.vx = (this.vx / speed) * maxSpeed;
        this.vy = (this.vy / speed) * maxSpeed;
      }
      
      // Position updaten
      this.x += this.vx; 
      this.y += this.vy;
      
      // Bouncing an Bildschirmgrenzen oder wrapping
      if (bounceEnabled) {
        if (this.x <= this.s || this.x >= innerWidth - this.s) {
          this.vx *= -0.8; // Energy loss beim Bounce
          this.x = Math.max(this.s, Math.min(innerWidth - this.s, this.x));
        }
        if (this.y <= this.s || this.y >= innerHeight - this.s) {
          this.vy *= -0.8;
          this.y = Math.max(this.s, Math.min(innerHeight - this.s, this.y));
        }
      } else {
        // weich wrapen statt bouncen -> weniger Richtungs-Flackern
        if (this.x > innerWidth) this.x -= innerWidth;
        else if (this.x < 0) this.x += innerWidth;
        if (this.y > innerHeight) this.y -= innerHeight;
        else if (this.y < 0) this.y += innerHeight;
      }
    }
    
    draw(){
      const baseSize = this.s * this.scale3D;
      const finalAlpha = this.alpha3D;
      // Kleines Early-Culling für sehr kleine/weit entfernte Partikel
      if (finalAlpha < 0.08 && baseSize < 0.4) return;
      
      // Depth-of-Field Blur-Effekt
      if (enableDepthOfField && this.depthBlur > 0.3) {
        // Quantisierte Blur-Stufen (0.5er Schritte) für weniger State-Wechsel
        const q = Math.min(3, Math.round(this.depthBlur * 2) / 2);
        if (q > 0.25) ctx.filter = `blur(${q}px)`;
      }
      
      // Globale Alpha für Tiefe
      ctx.globalAlpha *= finalAlpha;
      
      ctx.save();
      ctx.translate(this.x, this.y);
      
      // Z-basierte Größenvariation für verschiedene Typen
      let sizeMultiplier = 1.0;
      if (this.type === 'sparkle') sizeMultiplier = 1.3;
      else if (this.type === 'pulse') sizeMultiplier = 1.2;
      else if (this.type === 'star') sizeMultiplier = 1.15;
      
      const finalSize = baseSize * sizeMultiplier;
      
      switch (this.type) {
        case 'triangle':
          this.drawTriangle(finalSize);
          break;
        case 'star':
          this.drawStar(finalSize);
          break;
        case 'star6':
          this.drawStar6(finalSize);
          break;
        case 'star8':
          this.drawStar8(finalSize);
          break;
        case 'sparkle':
          this.drawSparkle(finalSize);
          break;
        case 'pulse':
          this.drawPulse(finalSize);
          break;
        case 'square':
          this.drawSquare(finalSize);
          break;
        default: // circle
          this.drawCircle(finalSize);
      }
      
      ctx.restore();
      
      // Filter und Alpha zurücksetzen
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    }
    
    drawCircle(size) {
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    drawTriangle(size) {
      ctx.rotate(this.rotation);
      ctx.beginPath();
      const h = size * 1.5;
      ctx.moveTo(0, -h * 0.7);
      ctx.lineTo(-h * 0.6, h * 0.3);
      ctx.lineTo(h * 0.6, h * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    
    drawStar(size) {
      ctx.save();
      ctx.rotate(this.rotation);
      
      // Erweiterte Stern-Konfiguration
      const spikes = 5;
      const outerRadius = size * 1.4; // Größerer äußerer Radius
      const innerRadius = size * 0.5; // Kleinerer innerer Radius für schärfere Spitzen
      
      // Gradient für besseren visuellen Effekt
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outerRadius);
      gradient.addColorStop(0, `rgba(${colorCurrent.r}, ${colorCurrent.g}, ${colorCurrent.b}, ${colorCurrent.aFill})`);
      gradient.addColorStop(0.7, `rgba(${colorCurrent.r}, ${colorCurrent.g}, ${colorCurrent.b}, ${colorCurrent.aFill * 0.8})`);
      gradient.addColorStop(1, `rgba(${colorCurrent.r}, ${colorCurrent.g}, ${colorCurrent.b}, ${colorCurrent.aFill * 0.3})`);
      
      // Stern-Pfad erstellen mit besserer Geometrie
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        // Verbesserter Winkel für symmetrischere Sterne
        const angle = (i * Math.PI) / spikes - Math.PI / 2; // Start am oberen Punkt
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        
        // Leichte Rundung der Spitzen für organischeren Look
        const roundingFactor = i % 2 === 0 ? 0.95 : 1.0;
        const x = Math.cos(angle) * radius * roundingFactor;
        const y = Math.sin(angle) * radius * roundingFactor;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      
      // Gradient-Fill anwenden
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Optionaler Outline für bessere Definition
      if (colorCurrent.aStroke > 0.1) {
        ctx.strokeStyle = `rgba(${colorCurrent.r}, ${colorCurrent.g}, ${colorCurrent.b}, ${colorCurrent.aStroke})`;
        ctx.lineWidth = size * 0.1;
        ctx.stroke();
      }
      
      ctx.restore();
    }
    
    drawStar6(size) {
      ctx.save();
      ctx.rotate(this.rotation);
      
      // 6-zackiger Stern (David-Stern)
      const outerRadius = size * 1.3;
      const innerRadius = size * 0.65;
      
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6 - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    
    drawStar8(size) {
      ctx.save();
      ctx.rotate(this.rotation);
      
      // 8-zackiger Stern
      const outerRadius = size * 1.2;
      const innerRadius = size * 0.7;
      
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI) / 8 - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    
    drawSparkle(size) {
      ctx.save();
      ctx.rotate(this.rotation);
      
      // Funkelnder Stern mit 4 Hauptstrahlen
      const mainLength = size * 1.8;
      const secondaryLength = size * 1.0;
      const width = size * 0.15;
      
      // Gradienteffekt für Glitzer
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, mainLength);
      gradient.addColorStop(0, `rgba(${colorCurrent.r}, ${colorCurrent.g}, ${colorCurrent.b}, ${colorCurrent.aFill})`);
      gradient.addColorStop(0.3, `rgba(255, 255, 255, ${colorCurrent.aFill * 0.8})`);
      gradient.addColorStop(1, `rgba(${colorCurrent.r}, ${colorCurrent.g}, ${colorCurrent.b}, 0)`);
      ctx.fillStyle = gradient;
      
      // Hauptkreuz
      ctx.fillRect(-width/2, -mainLength, width, mainLength * 2);
      ctx.fillRect(-mainLength, -width/2, mainLength * 2, width);
      
      // Diagonales Kreuz (kleiner)
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-width/3, -secondaryLength, width * 2/3, secondaryLength * 2);
      ctx.fillRect(-secondaryLength, -width/3, secondaryLength * 2, width * 2/3);
      
      ctx.restore();
    }
    
    drawPulse(size) {
      const pulseSize = size * (1 + Math.sin(this.pulsePhase) * 0.3);
      ctx.globalAlpha *= (0.7 + Math.sin(this.pulsePhase) * 0.3);
      ctx.beginPath();
      ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    drawSquare(size) {
      ctx.rotate(this.rotation);
      const s = size * 1.2;
      ctx.fillRect(-s/2, -s/2, s, s);
    }
  }

  // dynamische Zielanzahl + sanfte Resize der Liste
  let targetCount = 0;
  function ensureParticleCount(target){
    target = target ?? Math.min(100, (innerWidth/10)|0);
    if (target === targetCount) return;
    if (target > particles.length) {
      for (let i = particles.length; i < target; i++) particles.push(new Particle());
    } else {
      particles.length = target;
    }
    targetCount = target;
  }

  // Kollisions-Check für zwei Partikel
  function checkParticleCollision(p1, p2) {
    if (!enableCollisions) return false;
    
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    const minDistance = p1.s + p2.s;
    
    if (distance < minDistance) {
      // Einfache elastische Kollision
      const angle = Math.atan2(dy, dx);
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      
      // Velocities in Kollisionsachse rotieren
      const v1 = p1.vx * cos + p1.vy * sin;
      const v2 = p2.vx * cos + p2.vy * sin;
      
      // Einfacher Impulsaustausch (gleiche Masse angenommen)
      p1.vx = p1.vx * cos + v2 * sin;
      p1.vy = p1.vy * sin + v2 * cos;
      p2.vx = p2.vx * cos + v1 * sin;
      p2.vy = p2.vy * sin + v1 * cos;
      
      // Partikel auseinander bewegen
      const overlap = minDistance - distance + 1;
      const separationX = (dx / distance) * overlap * 0.5;
      const separationY = (dy / distance) * overlap * 0.5;
      
      p1.x += separationX;
      p1.y += separationY;
      p2.x -= separationX;
      p2.y -= separationY;
      
      return true;
    }
    return false;
  }

  function processCollisions() {
    if (!enableCollisions) return;
    if (useQuadTree) processCollisionsQuadTree();
    else processCollisionsGrid();
  }

  function processCollisionsQuadTree(){
    if (!quadTree) {
      quadTree = new QuadTree({x: 0, y: 0, width: innerWidth, height: innerHeight});
    }
    quadTree.clear();
    for (const particle of particles) quadTree.insert(particle);
    const returnObjects = [];
    for (const particle of particles) {
      returnObjects.length = 0;
      const possible = quadTree.retrieve(returnObjects, particle);
      for (const other of possible) {
        if (particle !== other) checkParticleCollision(particle, other);
      }
    }
  }

  function processCollisionsGrid(){
    for (const [k, bucket] of grid) {
      const gy = (k >>> 16) & 0xFFFF, gx = k & 0xFFFF;
      const nb = collectNeighborIndices(gx, gy);
      for (const i of bucket) {
        const p1 = particles[i];
        handleSelfBucketCollisions(bucket, i, p1);
        handleNeighborBucketCollisions(i, p1, nb, bucket);
      }
    }
  }

  function handleSelfBucketCollisions(bucket, i, p1){
    for (const j of bucket) {
      if (i < j) checkParticleCollision(p1, particles[j]);
    }
  }

  function handleNeighborBucketCollisions(i, p1, nb, bucket){
    for (const neighList of nb) {
      if (neighList === bucket) continue;
      for (const j of neighList) {
        if (i < j) checkParticleCollision(p1, particles[j]);
      }
    }
  }

  // Physik-Settings updaten
  const updatePhysicsSettings = () => {
    const gravityAttr = bgRoot?.getAttribute('data-particle-gravity');
    if (gravityAttr) {
      try {
        const g = JSON.parse(gravityAttr);
        gravity.x = g.x || 0;
        gravity.y = g.y || 0;
      } catch {
        // Fallback: einfache Y-Schwerkraft "0.001"
        gravity.y = parseFloat(gravityAttr) || 0;
        gravity.x = 0;
      }
    }
    
    enableCollisions = bgRoot?.getAttribute('data-particle-collisions') === 'true';
    bounceEnabled = bgRoot?.getAttribute('data-particle-bounce') === 'true';
    useQuadTree = bgRoot?.getAttribute('data-particle-quadtree') === 'true';
  };

  function adaptParticleCount(fps){
    if (fps < 45 && targetCount > 25) {
      ensureParticleCount(Math.max(20, (targetCount*0.85)|0));
    } else if (fps > 58 && targetCount < 140) {
      ensureParticleCount(Math.min(140, ((targetCount*1.12 + 2)|0)));
    }
  }

  // ===== Spatial Grid & Quad-Tree =====
  const cell = 96;
  const maxD = 110, maxD2 = maxD*maxD, invMaxD2 = 1 / maxD2;
  // Key als 32bit-Integer: (gy<<16) | (gx & 0xFFFF)
  const grid = new Map();
  function keyOf(gx, gy){ return ((gy & 0xFFFF) << 16) | (gx & 0xFFFF); }

  // Quad-Tree für erweiterte Spatial-Optimierung
  class QuadTree {
    constructor(bounds, maxObjects = 10, maxLevels = 5, level = 0) {
      this.maxObjects = maxObjects;
      this.maxLevels = maxLevels;
      this.level = level;
      this.bounds = bounds;
      this.objects = [];
      this.nodes = [];
    }
    
    clear() {
      this.objects = [];
      for (const node of this.nodes) {
        if (node) node.clear();
      }
      this.nodes = [];
    }
    
    split() {
      const subWidth = this.bounds.width / 2;
      const subHeight = this.bounds.height / 2;
      const x = this.bounds.x;
      const y = this.bounds.y;
      
      this.nodes[0] = new QuadTree({x: x + subWidth, y, width: subWidth, height: subHeight}, this.maxObjects, this.maxLevels, this.level + 1);
      this.nodes[1] = new QuadTree({x, y, width: subWidth, height: subHeight}, this.maxObjects, this.maxLevels, this.level + 1);
      this.nodes[2] = new QuadTree({x, y: y + subHeight, width: subWidth, height: subHeight}, this.maxObjects, this.maxLevels, this.level + 1);
      this.nodes[3] = new QuadTree({x: x + subWidth, y: y + subHeight, width: subWidth, height: subHeight}, this.maxObjects, this.maxLevels, this.level + 1);
    }
    
    getIndex(obj) {
      const verticalMidpoint = this.bounds.x + (this.bounds.width / 2);
      const horizontalMidpoint = this.bounds.y + (this.bounds.height / 2);
      
      const topQuadrant = (obj.y < horizontalMidpoint && obj.y + obj.s < horizontalMidpoint);
      const bottomQuadrant = (obj.y > horizontalMidpoint);
      
      if (obj.x < verticalMidpoint && obj.x + obj.s < verticalMidpoint) {
        if (topQuadrant) return 1;
        else if (bottomQuadrant) return 2;
      } else if (obj.x > verticalMidpoint) {
        if (topQuadrant) return 0;
        else if (bottomQuadrant) return 3;
      }
      return -1;
    }
    
    insert(obj) {
      if (this.nodes.length) {
        const index = this.getIndex(obj);
        if (index !== -1) {
          this.nodes[index].insert(obj);
          return;
        }
      }
      
      this.objects.push(obj);
      
      if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
        if (!this.nodes.length) this.split();
        
        let i = 0;
        while (i < this.objects.length) {
          const index = this.getIndex(this.objects[i]);
          if (index !== -1) {
            this.nodes[index].insert(this.objects.splice(i, 1)[0]);
          } else {
            i++;
          }
        }
      }
    }
    
    retrieve(returnObjects, obj) {
      const index = this.getIndex(obj);
      if (index !== -1 && this.nodes.length) {
        this.nodes[index].retrieve(returnObjects, obj);
      }
      
      returnObjects.push(...this.objects);
      return returnObjects;
    }
  }
  
  // ===== Erweiterte Konfiguration =====
  let qualityLevel = 'auto';
  let showConnections = true;
  let showParticles = true;
  let connectionOpacity = 1;
  let particleOpacity = 1;
  let quadTree = null;
  let useQuadTree = false;
  // Visual-/Performance-Settings
  let enableTrails = false;
  let trailFade = 0.08; // 0.005 .. 0.5
  let enableGlow = false;
  let blendModeParticles = 'source-over';
  let connectionFrameSkip = 1;
  let connectionMaxPerParticle = 8;
  let frameCounter = 0;
  let edgeCounts = new Uint8Array(0);
  // DoF & Auto-Quality & Depth-Sort Basisschalter
  let enableDepthOfField = true;
  let autoQuality = true;
  let sortByDepth = true;
  let sortEveryNFrames = 8;
  // Quality Tier Verwaltung (low | medium | high | ultra)
  let qualityTier = 'high';
  function setQualityTier(tier, reason){
    if (tier === qualityTier) return;
    const prev = qualityTier; qualityTier = tier;
    try {
      window.dispatchEvent(new CustomEvent('particles:qualitychange', { detail: { prev, tier, reason }}));
    } catch { /* noop */ }
  }
  // Basiswerte für Auto-Quality
  let baseParallaxStrength = 0;
  let baseConnectionFrameSkip = 1;
  let baseConnectionMaxPerParticle = 8;
  let baseEnableGlow = false;
  let baseTrailFade = trailFade;
  
  const updateAdvancedSettings = () => {
    showConnections = bgRoot?.getAttribute('data-particle-connections') !== 'false';
    showParticles = bgRoot?.getAttribute('data-particle-show') !== 'false';
    
    const connOpacity = bgRoot?.getAttribute('data-particle-connection-opacity');
    connectionOpacity = connOpacity ? Math.max(0, Math.min(1, parseFloat(connOpacity))) : 1;

    const partOpacity = bgRoot?.getAttribute('data-particle-opacity-scale');
    particleOpacity = partOpacity ? Math.max(0, Math.min(2, parseFloat(partOpacity))) : 1;

    // Erweiterte Optik/Steuerung
    const par = bgRoot?.getAttribute('data-particle-parallax');
    parallaxStrength = par ? Math.max(0, Math.min(0.3, parseFloat(par))) : 0;
    baseParallaxStrength = parallaxStrength;
    enableTrails = bgRoot?.getAttribute('data-particle-trails') === 'true';
    const tf = bgRoot?.getAttribute('data-particle-trail-fade');
    trailFade = tf ? Math.max(0.005, Math.min(0.5, parseFloat(tf))) : 0.08;
    baseTrailFade = trailFade;
    enableGlow = bgRoot?.getAttribute('data-particle-glow') === 'true';
    baseEnableGlow = enableGlow;
    const bm = bgRoot?.getAttribute('data-particle-blend');
    blendModeParticles = (bm === 'lighter' || bm === 'screen' || bm === 'source-over') ? bm : 'source-over';
    const cfs = bgRoot?.getAttribute('data-particle-conn-skip');
    connectionFrameSkip = cfs ? Math.max(1, parseInt(cfs)) : 1;
    baseConnectionFrameSkip = connectionFrameSkip;
    const ccap = bgRoot?.getAttribute('data-particle-conn-cap');
    connectionMaxPerParticle = ccap ? Math.max(1, parseInt(ccap)) : 8;
    baseConnectionMaxPerParticle = connectionMaxPerParticle;

    // DoF & Auto-Quality & Depth-Sort
    enableDepthOfField = bgRoot?.getAttribute('data-particle-dof') !== 'false';
    autoQuality = bgRoot?.getAttribute('data-particle-auto-quality') !== 'false';
    sortByDepth = bgRoot?.getAttribute('data-particle-sort-depth') !== 'false';
    const sortInt = bgRoot?.getAttribute('data-particle-sort-interval');
    sortEveryNFrames = sortInt ? Math.max(2, Math.min(60, parseInt(sortInt))) : 8;
  };

  // Initial heuristische Qualitätsanpassung (einmalig) vor erster FPS Messung
  (function initialQualityHeuristics(){
    try {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const saveData = conn?.saveData === true;
      const eff = conn?.effectiveType || '';
      const lowNet = /(^|[^a-z])(2g|slow-2g)([^a-z]|$)/i.test(eff);
      const devMem = navigator.deviceMemory || 0; // in GB
      if (saveData || lowNet) {
        setQualityTier('low', saveData ? 'save-data' : 'low-network');
        // Sofort Parameter reduzieren
        autoQuality = true;
        baseConnectionMaxPerParticle = Math.min(baseConnectionMaxPerParticle, 4);
        baseConnectionFrameSkip = Math.max(baseConnectionFrameSkip, 3);
        baseParallaxStrength *= 0.4;
      } else if (devMem && devMem < 4) {
        setQualityTier('medium', 'low-device-memory');
        baseConnectionMaxPerParticle = Math.min(baseConnectionMaxPerParticle, 6);
        baseParallaxStrength *= 0.7;
      } else if (devMem && devMem >= 8 && !saveData && !lowNet) {
        setQualityTier('ultra', 'high-device-memory');
        // Raum für spätere Upgrades (Glow etc.)
      }
    } catch { /* ignore heuristic errors */ }
  })();

  

  function adjustQualityByFPS(avgFps){
    if (!autoQuality) return;
    if (avgFps >= 55) {
      parallaxStrength = baseParallaxStrength;
      enableGlow = baseEnableGlow;
      trailFade = baseTrailFade;
      connectionFrameSkip = baseConnectionFrameSkip;
      connectionMaxPerParticle = baseConnectionMaxPerParticle;
      setQualityTier(qualityTier === 'ultra' ? 'ultra' : 'high', 'fps>=55');
    } else if (avgFps >= 40) {
      parallaxStrength = baseParallaxStrength * 0.7;
      enableGlow = baseEnableGlow;
      trailFade = Math.min(0.25, baseTrailFade * 1.1);
      connectionFrameSkip = Math.max(baseConnectionFrameSkip, 2);
      connectionMaxPerParticle = Math.min(baseConnectionMaxPerParticle, 6);
      setQualityTier(qualityTier === 'low' ? 'low' : 'medium', 'fps>=40');
    } else if (avgFps >= 28) {
      parallaxStrength = baseParallaxStrength * 0.4;
      enableGlow = false;
      trailFade = Math.min(0.35, baseTrailFade * 1.3);
      connectionFrameSkip = Math.max(baseConnectionFrameSkip, 3);
      connectionMaxPerParticle = Math.min(baseConnectionMaxPerParticle, 4);
      setQualityTier('medium', 'fps>=28');
    } else {
      parallaxStrength = 0;
      enableGlow = false;
      trailFade = Math.min(0.45, 0.12);
      connectionFrameSkip = Math.max(baseConnectionFrameSkip, 4);
      connectionMaxPerParticle = Math.min(baseConnectionMaxPerParticle, 2);
      setQualityTier('low', 'fps<28');
    }
  }

  function fillSpatialGrid(){
    grid.clear();
    for (const [idx, p] of particles.entries()){
      const gx = (p.x / cell) | 0, gy = (p.y / cell) | 0;
      const key = keyOf(gx, gy);
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(idx); // speichere Index statt Objekt
    }
  }

  // Nachbarschaft sammeln (wiederverwendetes Array)
  const neighbors = [];
  function collectNeighborIndices(gx, gy){
    neighbors.length = 0;
    for (let yy=-1; yy<=1; yy++){
      for (let xx=-1; xx<=1; xx++){
        const b = grid.get(keyOf(gx+xx, gy+yy));
        if (b) neighbors.push(b);
      }
    }
    return neighbors;
  }

  // ===== Dynamische Faktoren =====
  let densityFactor = 1;
  function computeDynamicFactors(){
    const bucketCount = grid.size || 1;
    let total = 0; for (const [,b] of grid) total += b.length;
    const avg = total / bucketCount;
    densityFactor = Math.min(1, (avg / (targetCount / 18)) );
  }

  // ===== Farblogik (gecached) =====
  let colorCurrent = { r:9, g:139, b:255, aFill:0.8, aStroke:0.25 };
  let colorTarget  = { ...colorCurrent };
  let colorTweenStart = 0;
  const COLOR_TWEEN_MS = 420;

  function clamp(v,min,max){
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }
  function parseRGBA(str){
    if(!str) return null;
    const m = str.trim().match(/^rgba?\(([^)]+)\)/i);
    if(!m) return null;
    // avoid regex with backtracking by splitting on comma and trimming spaces
    const parts = m[1].split(',').map(s => Number(s.trim()));
    if (parts.length < 3) return null;
    const [r,g,b] = parts; const a = parts[3] !== null && parts[3] !== undefined ? parseFloat(parts[3]) : 1;
    if([r,g,b].some(n => Number.isNaN(n))) return null;
    return { r:clamp(r,0,255), g:clamp(g,0,255), b:clamp(b,0,255), a:clamp(a,0,1) };
  }
  function updateTargetColor(){
    if (!bgRoot) return;
    const css = getComputedStyle(bgRoot).getPropertyValue('--particle-color') || 'rgba(9,139,255,0.8)';
    const p = parseRGBA(css); if (!p) return;
    colorTarget = { r:p.r, g:p.g, b:p.b, aFill:p.a, aStroke: p.a * 0.32 };
    colorTweenStart = performance.now();
    invalidateGradients();
  }
  function applyTween(now){
    const t = clamp((now - colorTweenStart)/COLOR_TWEEN_MS,0,1);
    if (t >= 1) { colorCurrent = { ...colorTarget }; return; }
    const lerp = (a,b) => a + (b-a)*t;
    colorCurrent = {
      r: lerp(colorCurrent.r, colorTarget.r),
      g: lerp(colorCurrent.g, colorTarget.g),
      b: lerp(colorCurrent.b, colorTarget.b),
      aFill: lerp(colorCurrent.aFill, colorTarget.aFill),
      aStroke: lerp(colorCurrent.aStroke, colorTarget.aStroke),
    };
  }

  const observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'attributes' && m.attributeName.startsWith('data-')) { 
        updateTargetColor(); 
        updatePhysicsSettings();
        updateAdvancedSettings();
        break; 
      }
    }
  });
  if (bgRoot) observer.observe(bgRoot,{ attributes:true });

  // Event Listeners

  // ===== Verbindungen + Partikel zeichnen =====
  let gradLinear = null, gradRadial = null, gradMode = 'linear';
  let gradBaseW = 0, gradBaseH = 0, gradBaseR = -1, gradBaseG = -1, gradBaseB = -1;
  function invalidateGradients(){ gradLinear = gradRadial = null; }

  function ensureGradients(dynAlpha){
    const W = canvas.width, H = canvas.height;
    const needRebuild = !gradLinear || W!==gradBaseW || H!==gradBaseH ||
                        (colorCurrent.r|0)!==gradBaseR || (colorCurrent.g|0)!==gradBaseG || (colorCurrent.b|0)!==gradBaseB;

    if (!needRebuild) return;

    gradBaseW = W; gradBaseH = H;
    gradBaseR = colorCurrent.r|0; gradBaseG = colorCurrent.g|0; gradBaseB = colorCurrent.b|0;

    const lighten = (r,g,b,p) => [
      Math.min(255,(r+(255-r)*p))|0,
      Math.min(255,(g+(255-g)*p))|0,
      Math.min(255,(b+(255-b)*p))|0
    ];
    const [lr,lg,lb] = lighten(gradBaseR, gradBaseG, gradBaseB, 0.18);

    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, `rgba(${lr},${lg},${lb},${Math.min(1, dynAlpha*1.05).toFixed(3)})`);
    g.addColorStop(0.55, `rgba(${gradBaseR},${gradBaseG},${gradBaseB},${dynAlpha.toFixed(3)})`);
    g.addColorStop(1, `rgba(${gradBaseR},${gradBaseG},${gradBaseB},${(dynAlpha*0.55).toFixed(3)})`);
    gradLinear = g;

    const radius = Math.max(W, H) * 0.65;
    const rg = ctx.createRadialGradient(W/2,H/2,radius*0.05, W/2,H/2,radius);
    rg.addColorStop(0, `rgba(${gradBaseR},${gradBaseG},${gradBaseB},${Math.min(1,dynAlpha*1.05).toFixed(3)})`);
    rg.addColorStop(0.55, `rgba(${gradBaseR},${gradBaseG},${gradBaseB},${dynAlpha.toFixed(3)})`);
    rg.addColorStop(1, `rgba(${gradBaseR},${gradBaseG},${gradBaseB},${(dynAlpha*0.25).toFixed(3)})`);
    gradRadial = rg;
  }

  function updateAndDrawParticles(finalFillA){
    // Gradientwahl aus data-Attributen (einmal pro Frame)
    gradMode = (bgRoot?.getAttribute('data-particle-gradient') === 'radial') ? 'radial' : 'linear';
    const aScaleAttr = bgRoot?.getAttribute('data-particle-alpha-scale');
    const alphaScale = aScaleAttr ? Math.min(2, Math.max(0.2, parseFloat(aScaleAttr))) : 1;
    const dynA = finalFillA * alphaScale * particleOpacity;

    ensureGradients(dynA);
    ctx.fillStyle = (gradMode === 'radial') ? gradRadial : gradLinear;

    // Nur 2D Partikel zeichnen wenn aktiviert
    if (showParticles) {
      // Optional: Tiefensortierung (ferne zuerst)
      if (sortByDepth && (frameCounter % sortEveryNFrames === 0)) {
        try { particles.sort((a, b) => a.z - b.z); } catch { /* noop */ }
      }
      for (const p of particles) { p.update(); p.draw(); }
    } else {
      for (const p of particles) { p.update(); } // Nur update, kein draw
    }
  }

  function drawConnections(){
    if (!showConnections) return;
    setupConnectionStyle();
    prepareEdgeCounts();
    drawConnectionSegments();
    ctx.globalAlpha = 1;
  }

  function setupConnectionStyle(){
    // Baseline-Intensität
    // Einmalige Stroke-Farbe ohne Alpha (Alpha wird pro Segment via globalAlpha gesetzt)
    const sr = colorCurrent.r | 0, sg = colorCurrent.g | 0, sb = colorCurrent.b | 0;
    ctx.strokeStyle = `rgb(${sr},${sg},${sb})`;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function prepareEdgeCounts(){
    if (edgeCounts.length !== particles.length) edgeCounts = new Uint8Array(particles.length);
    else edgeCounts.fill(0);
  }

  function drawConnectionSegments(){
    const baseAlpha = (colorCurrent.aStroke * (0.8 + 0.2 * densityFactor) * connectionOpacity);
    const baseWidth = 1.1;
    const widthBoost = 1.3;

    const shouldConnect = (i, j, p, q) => {
      if (j <= i) return 0;
      const dx = p.x - q.x, dy = p.y - q.y;
      const d2 = dx*dx + dy*dy;
      if (d2 >= maxD2) return 0;
      const dz = Math.abs(p.z - q.z);
      const zFactor = Math.max(0.2, 1 - (dz / 150));
      const proximity = (1 - (d2 * invMaxD2)) * zFactor;
      return proximity > 0 ? proximity : 0;
    };

    const drawSegment = (p, q, proximity) => {
      const avgAlpha3D = (p.alpha3D + q.alpha3D) * 0.5;
      const segAlpha = Math.min(1, baseAlpha * (0.55 + 0.45 * proximity) * avgAlpha3D);
      const avgScale3D = (p.scale3D + q.scale3D) * 0.5;
      const lineWidth = (baseWidth + widthBoost * proximity) * Math.max(0.3, avgScale3D);
      ctx.globalAlpha = segAlpha;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    };

    for (const [k, bucket] of grid){
      const gy = (k >>> 16) & 0xFFFF, gx = k & 0xFFFF;
      const nb = collectNeighborIndices(gx, gy);
      for (const i of bucket){
        const p = particles[i];
        processIndexConnections(i, p, nb, bucket, shouldConnect, drawSegment);
      }
    }
  }

  function processIndexConnections(i, p, nb, bucket, shouldConnect, drawSegment){
    for (const neighList of nb){
      handleNeighborListConnections(i, p, neighList, shouldConnect, drawSegment);
    }
  }

  function handleNeighborListConnections(i, p, neighList, shouldConnect, drawSegment){
    for (const j of neighList){
      const q = particles[j];
      const proximity = shouldConnect(i, j, p, q);
      if (!proximity) continue;
      if (connectionMaxPerParticle > 0) {
        if (edgeCounts[i] >= connectionMaxPerParticle || edgeCounts[j] >= connectionMaxPerParticle) return;
      }
      drawSegment(p, q, proximity);
      if (connectionMaxPerParticle > 0) {
        edgeCounts[i]++;
        edgeCounts[j]++;
      }
    }
  }

  // ===== Performance-Optimierte Loop =====
  function animationLoop(){
    if (hidden) { 
      rafId = requestAnimationFrame(animationLoop); 
      return; 
    }
    
    const now = performance.now();
    frameCounter++;
    const dt = Math.min(33.33, now - lastTime) || 16.7; // Cap für sehr lange Frames
    lastTime = now;
    
    // FPS-Tracking optimiert - weniger Samples
    const fps = 1000 / dt;
    fpsSamples.push(fps); 
    if (fpsSamples.length > 10) fpsSamples.shift(); // Reduziert von 20 auf 10
    
    // Performance-Anpassung nur alle 2 Sekunden statt kontinuierlich
    if (fpsSamples.length === 10 && frameCounter % 120 === 0){
      const avg = fpsSamples.reduce((a,b) => a+b,0)/10;
      adaptParticleCount(avg);
      if (autoQuality) adjustQualityByFPS(avg);
    }

    // Optimierter Canvas-Clear
    if (enableTrails) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.5, Math.max(0.005, trailFade))})`;
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.restore();
    } else {
      ctx.clearRect(0,0,canvas.width,canvas.height);
    }

    // Batch-Updates für bessere Performance
    applyTween(now);
    fillSpatialGrid();
    computeDynamicFactors();
    
    // Kollisionen nur alle 2-3 Frames verarbeiten für bessere Performance
    if (frameCounter % 2 === 0) {
      processCollisions();
    }

    const dynFillA = colorCurrent.aFill * (0.65 + 0.35) * (0.7 + 0.3*densityFactor);
    
    // Blend-Mode für Partikel
    let mode = blendModeParticles;
    if (enableGlow && mode === 'source-over') mode = 'lighter';
    ctx.globalCompositeOperation = mode;
    updateAndDrawParticles(dynFillA);
    
    // Verbindungen noch weniger oft zeichnen für bessere Performance
    ctx.globalCompositeOperation = 'source-over';
    if (frameCounter % (connectionFrameSkip * 2) === 0) {
      drawConnections();
    }

    rafId = requestAnimationFrame(animationLoop);
  }

  // ===== Init / Events =====
  const io = new IntersectionObserver(entries => {
    for (const e of entries) hidden = !e.isIntersecting || document.hidden;
  }, { threshold: 0 });
  io.observe(canvas);

  // Maus-Parallax entfernt – keine Pointer-Listener mehr

  document.addEventListener('visibilitychange', () => { hidden = document.hidden; }, { passive:true });
  addEventListener('resize', throttle(() => { cancelAnimationFrame(rafId); resize(); ensureParticleCount(targetCount); animationLoop(); }, 180), { passive:true });

  // Start
  try {
    resize(); 
    ensureParticleCount(); 
  updateTargetColor(); 
  updatePhysicsSettings();
  updateAdvancedSettings();
    animationLoop();
  } catch (_error) {
    return () => {}; // Return empty cleanup function
  }

  // ===== API / Cleanup =====
  const api = {
    // setColor entfernt - respektiert Theme-System
    // setColor(rgba){ if(bgRoot){ bgRoot.style.setProperty('--particle-color', rgba); updateTargetColor(); } },
    setGradientMode(mode){ if(bgRoot) bgRoot.setAttribute('data-particle-gradient', mode === 'radial' ? 'radial' : 'linear'); },
    setAlphaScale(f){ if(bgRoot) bgRoot.setAttribute('data-particle-alpha-scale', String(Math.min(2, Math.max(0.2, parseFloat(f))))); },
    setParticleTypes(types){ if(bgRoot) bgRoot.setAttribute('data-particle-types', JSON.stringify(types)); },
    setGravity(x, y){ if(bgRoot) { bgRoot.setAttribute('data-particle-gravity', JSON.stringify({x, y})); updatePhysicsSettings(); } },
    setCollisions(enabled){ if(bgRoot) { bgRoot.setAttribute('data-particle-collisions', String(enabled)); updatePhysicsSettings(); } },
    setBounce(enabled){ if(bgRoot) { bgRoot.setAttribute('data-particle-bounce', String(enabled)); updatePhysicsSettings(); } },
    setQuadTree(enabled){ if(bgRoot) { bgRoot.setAttribute('data-particle-quadtree', String(enabled)); updatePhysicsSettings(); } },
    setDebug(enabled){ /* Debug entfernt - Funktion bleibt für Kompatibilität */ },
    setShowConnections(show){ if(bgRoot) { bgRoot.setAttribute('data-particle-connections', String(show)); updateAdvancedSettings(); } },
    setShowParticles(show){ if(bgRoot) { bgRoot.setAttribute('data-particle-show', String(show)); updateAdvancedSettings(); } },
    getStats(){ return { 
      useQuadTree, 
      useOffscreen, 
      enableCollisions, 
      bounceEnabled,
      particleTypes: particles.map(p => p.type).reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})
    }; },
    stop(){
      cancelAnimationFrame(rafId);
      particles.length = 0; grid.clear();
      if (quadTree) quadTree.clear();
      io.disconnect(); observer.disconnect();
  // keine Pointer-Listener zu entfernen
      // Canvas leeren
      ctx.clearRect(0,0,canvas.width,canvas.height);
    }
  };
  return api.stop;
}

// Exports
export { initParticlesImpl as initParticles };
export { ParticlesManager };