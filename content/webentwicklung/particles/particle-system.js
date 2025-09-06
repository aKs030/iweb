// Export: initParticles({ getElement, throttle, checkReducedMotion }) -> cleanup()
import { randomFloat } from '../utils/common-utils.js';

export function initParticles({ getElement, throttle, checkReducedMotion }) {
  
  const canvas = getElement('particleCanvas');
  if (!canvas) {
    console.warn('Particle canvas element not found');
    return () => {};
  }
  
  // Canvas-Bereitschaft prüfen
  if (!canvas.getContext) {
    console.warn('Canvas context not supported');
    return () => {};
  }
  
  canvas.setAttribute('aria-hidden','true');
  
  // Canvas Context erstellen mit Fehlerbehandlung
  let ctx;
  const useOffscreen = false;
  
  try {
    ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      console.warn('Failed to get 2D context');
      return () => {};
    }
    // OffscreenCanvas ist temporär deaktiviert - würde WebWorker erfordern
    // if (typeof OffscreenCanvas !== 'undefined' && 'transferControlToOffscreen' in canvas) {
    //   // Vollständige OffscreenCanvas-Implementation würde WebWorker erfordern
    // }
  } catch (error) {
    console.warn('Canvas context creation failed:', error);
    return () => {};
  }

  // ===== Perf-Grundlagen =====
  const DPR = Math.min(2, Math.max(1, Math.ceil(devicePixelRatio || 1)));
  const bgRoot = document.querySelector('.global-particle-background');

  // ===== Nur 2D Partikel - optimiertes System =====
  const particles = [];
  let rafId = 0, hidden = false;
  let lastTime = performance.now();
  const fpsSamples = [];
  const stats = (window.__particleStats = window.__particleStats || { fps:0, count:0 });

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
      updateScrollMax();
    } catch (error) {
      console.warn('Canvas resize failed:', error);
      // Fallback für robuste Behandlung
      try {
        ctx.setTransform(1,0,0,1,0,0);
      } catch (e) {
        console.error('Critical canvas error:', e);
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
      // Partikeltyp und erweiterte Eigenschaften
      this.type = this.assignParticleType();
      this.rotation = randomFloat(0, Math.PI * 2);
      this.rotationSpeed = randomFloat(-0.02, 0.02);
      this.pulsePhase = randomFloat(0, Math.PI * 2);
      this.pulseSpeed = randomFloat(0.01, 0.03);
      this.life = 1;
      this.maxLife = 1;
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
      // Schwerkraft anwenden
      this.vx += gravity.x;
      this.vy += gravity.y;
      
      // Typ-spezifische Updates
      this.rotation += this.rotationSpeed;
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
      const baseSize = this.s;
      
      ctx.save();
      ctx.translate(this.x, this.y);
      
      switch (this.type) {
        case 'triangle':
          this.drawTriangle(baseSize);
          break;
        case 'star':
          this.drawStar(baseSize);
          break;
        case 'star6':
          this.drawStar6(baseSize);
          break;
        case 'star8':
          this.drawStar8(baseSize);
          break;
        case 'sparkle':
          this.drawSparkle(baseSize);
          break;
        case 'pulse':
          this.drawPulse(baseSize);
          break;
        case 'square':
          this.drawSquare(baseSize);
          break;
        default: // circle
          this.drawCircle(baseSize);
      }
      
      ctx.restore();
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
    stats.count = targetCount;
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
    
    if (useQuadTree) {
      // Quad-Tree basierte Kollisionserkennung
      if (!quadTree) {
        quadTree = new QuadTree({x: 0, y: 0, width: innerWidth, height: innerHeight});
      }
      
      quadTree.clear();
      for (const particle of particles) {
        quadTree.insert(particle);
      }
      
      const returnObjects = [];
      for (const particle of particles) {
        returnObjects.length = 0;
        const possibleCollisions = quadTree.retrieve(returnObjects, particle);
        
        for (const other of possibleCollisions) {
          if (particle !== other) {
            checkParticleCollision(particle, other);
          }
        }
      }
    } else {
      // Original Grid-basierte Kollisionserkennung
      for (const [k, bucket] of grid) {
        const gy = (k >>> 16) & 0xFFFF, gx = k & 0xFFFF;
        const nb = collectNeighborIndices(gx, gy);
        
        for (const i of bucket) {
          const p1 = particles[i];
          
          // Selbst-Bucket
          for (const j of bucket) {
            if (i < j) { // Doppelte Checks vermeiden
              checkParticleCollision(p1, particles[j]);
            }
          }
          
          // Nachbar-Buckets
          for (const neighList of nb) {
            if (neighList === bucket) continue; // Schon bearbeitet
            for (const j of neighList) {
              if (i < j) {
                checkParticleCollision(p1, particles[j]);
              }
            }
          }
        }
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
  
  // ===== Debug & Erweiterte Konfiguration =====
  let debugMode = false;
  let showConnections = true;
  let showParticles = true;
  let connectionOpacity = 1;
  let particleOpacity = 1;
  let quadTree = null;
  let useQuadTree = false;
  
  const updateAdvancedSettings = () => {
    debugMode = bgRoot?.getAttribute('data-particle-debug') === 'true';
    showConnections = bgRoot?.getAttribute('data-particle-connections') !== 'false';
    showParticles = bgRoot?.getAttribute('data-particle-show') !== 'false';
    
    const connOpacity = bgRoot?.getAttribute('data-particle-connection-opacity');
    connectionOpacity = connOpacity ? Math.max(0, Math.min(1, parseFloat(connOpacity))) : 1;
    
    const partOpacity = bgRoot?.getAttribute('data-particle-opacity-scale');
    particleOpacity = partOpacity ? Math.max(0, Math.min(2, parseFloat(partOpacity))) : 1;
  };

  const drawDebugOverlay = () => {
    if (!debugMode) return;
    
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '12px monospace';
    
    const debugInfo = [
      `FPS: ${stats.fps.toFixed(1)}`,
      `Particles: ${particles.length}`,
      `Grid Cells: ${grid.size}`,
      `Physics: G[${gravity.x.toFixed(3)}, ${gravity.y.toFixed(3)}]`,
      `Collisions: ${enableCollisions ? 'ON' : 'OFF'}`,
      `Bounce: ${bounceEnabled ? 'ON' : 'OFF'}`,
      `QuadTree: ${useQuadTree ? 'ON' : 'OFF'}`,
      `OffScreen: ${useOffscreen ? 'ON' : 'OFF'}`
    ];
    
    debugInfo.forEach((line, i) => {
      ctx.fillText(line, 10, 20 + i * 16);
    });
    
    // Grid visualisieren
    if (bgRoot?.getAttribute('data-particle-debug-grid') === 'true') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      
      for (let x = 0; x < innerWidth; x += cell) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, innerHeight);
        ctx.stroke();
      }
      
      for (let y = 0; y < innerHeight; y += cell) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(innerWidth, y);
        ctx.stroke();
      }
    }
    
    ctx.restore();
  };

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

  // ===== Dynamische Faktoren (cached scrollMax) =====
  let densityFactor = 1, scrollFactor = 1;
  let scrollMax = 1;
  function updateScrollMax(){
    const doc = document.documentElement;
    scrollMax = Math.max(1, (doc.scrollHeight - innerHeight) | 0);
  }
  function computeDynamicFactors(){
    const bucketCount = grid.size || 1;
    let total = 0; for (const [,b] of grid) total += b.length;
    const avg = total / bucketCount;
    densityFactor = Math.min(1, (avg / (targetCount / 18)) );
    const y = window.scrollY / scrollMax;
    scrollFactor = 1 - y * 0.55;
  }

  // ===== Farblogik (gecached) =====
  let colorCurrent = { r:9, g:139, b:255, aFill:0.8, aStroke:0.25 };
  let colorTarget  = { ...colorCurrent };
  const reduceMotion = checkReducedMotion();
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
    if (reduceMotion) colorCurrent = { ...colorTarget };
    else colorTweenStart = performance.now();
    invalidateGradients();
  }
  function applyTween(now){
    if (reduceMotion) return;
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

  window.addEventListener('snapSectionChange', updateTargetColor, { passive:true });

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
      for (const p of particles) { p.update(); p.draw(); }
    } else {
      for (const p of particles) { p.update(); } // Nur update, kein draw
    }
  }

  function drawConnections(){
  // Baseline-Intensität (etwas kräftiger als vorher)
    if (!showConnections) return; // Verbindungen optional deaktivieren
    
    const baseAlpha = (colorCurrent.aStroke * (0.8 + 0.2 * densityFactor) * scrollFactor * connectionOpacity);
    const baseWidth = 1.1;   // Grunddicke
    const widthBoost = 1.3;  // Zusatzdicke bei sehr kurzer Distanz

    // Einmalige Stroke-Farbe ohne Alpha (Alpha wird pro Segment via globalAlpha gesetzt)
    const sr = colorCurrent.r | 0, sg = colorCurrent.g | 0, sb = colorCurrent.b | 0;
    ctx.strokeStyle = `rgb(${sr},${sg},${sb})`;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Optional sanfter Glow (deaktiviert; aktivieren = FPS-Kosten)

    // Helper: decide quickly if two particle indices form a visible connection
    function shouldConnect(i, j, p, q){
    // returns proximity in range 0..1 (0 = no connection)
      if (j <= i) return 0; // only draw pair once
      const dx = p.x - q.x, dy = p.y - q.y;
      const d2 = dx*dx + dy*dy;
      if (d2 >= maxD2) return 0;
      const proximity = 1 - (d2 * invMaxD2);
      return proximity > 0 ? proximity : 0;
    }

    // Helper: draw a single segment given proximity (0..1)
    function drawSegment(p, q, proximity){
      const segAlpha = Math.min(1, baseAlpha * (0.55 + 0.45 * proximity));
      ctx.globalAlpha = segAlpha;
      ctx.lineWidth = baseWidth + widthBoost * proximity;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }

    for (const [k, bucket] of grid){
      const gy = (k >>> 16) & 0xFFFF, gx = k & 0xFFFF;
      const nb = collectNeighborIndices(gx, gy);

      for (const i of bucket){
        const p = particles[i];
        for (const neighList of nb){
          for (const j of neighList){
            const q = particles[j];
            const proximity = shouldConnect(i, j, p, q);
            if (!proximity) continue;
            drawSegment(p, q, proximity);
          }
        }
      }
    }

    // Reset
    ctx.globalAlpha = 1;
  }

  // ===== Loop =====
  function animationLoop(){
    if (hidden) { rafId = requestAnimationFrame(animationLoop); return; }

    const now = performance.now();
    const dt = (now - lastTime) || 16.7; lastTime = now;
    const fps = 1000 / dt;
    fpsSamples.push(fps); if (fpsSamples.length > 20) fpsSamples.shift();
    if (fpsSamples.length === 20){
      const avg = fpsSamples.reduce((a,b) => a+b,0)/20;
      adaptParticleCount(avg);
      stats.fps = avg;
    }

    ctx.clearRect(0,0,canvas.width,canvas.height);

    applyTween(now);
    fillSpatialGrid();
    computeDynamicFactors();
    
    // Kollisionen verarbeiten (falls aktiviert)
    processCollisions();

    const dynFillA = colorCurrent.aFill * (0.65 + 0.35*scrollFactor) * (0.7 + 0.3*densityFactor);
    updateAndDrawParticles(dynFillA);
    drawConnections();
    
    // Debug-Overlay zeichnen
    drawDebugOverlay();

    rafId = requestAnimationFrame(animationLoop);
  }

  // ===== Init / Events =====
  const io = new IntersectionObserver(entries => {
    for (const e of entries) hidden = !e.isIntersecting || document.hidden;
  }, { threshold: 0 });
  io.observe(canvas);

  document.addEventListener('visibilitychange', () => { hidden = document.hidden; }, { passive:true });
  addEventListener('resize', throttle(() => { cancelAnimationFrame(rafId); resize(); ensureParticleCount(targetCount); animationLoop(); }, 180), { passive:true });

  // Start
  try {
    resize(); 
    ensureParticleCount(); 
    updateTargetColor(); 
    updateScrollMax(); 
    animationLoop();
  } catch (error) {
    console.error('Particle system initialization failed:', error);
    return () => {}; // Return empty cleanup function
  }

  // ===== API / Cleanup =====
  const api = {
    setColor(rgba){ if(bgRoot){ bgRoot.style.setProperty('--particle-color', rgba); updateTargetColor(); } },
    setGradientMode(mode){ if(bgRoot) bgRoot.setAttribute('data-particle-gradient', mode === 'radial' ? 'radial' : 'linear'); },
    setAlphaScale(f){ if(bgRoot) bgRoot.setAttribute('data-particle-alpha-scale', String(Math.min(2, Math.max(0.2, parseFloat(f))))); },
    setParticleTypes(types){ if(bgRoot) bgRoot.setAttribute('data-particle-types', JSON.stringify(types)); },
    setGravity(x, y){ if(bgRoot) { bgRoot.setAttribute('data-particle-gravity', JSON.stringify({x, y})); updatePhysicsSettings(); } },
    setCollisions(enabled){ if(bgRoot) { bgRoot.setAttribute('data-particle-collisions', String(enabled)); updatePhysicsSettings(); } },
    setBounce(enabled){ if(bgRoot) { bgRoot.setAttribute('data-particle-bounce', String(enabled)); updatePhysicsSettings(); } },
    setQuadTree(enabled){ if(bgRoot) { bgRoot.setAttribute('data-particle-quadtree', String(enabled)); updatePhysicsSettings(); } },
    setDebug(enabled){ if(bgRoot) { bgRoot.setAttribute('data-particle-debug', String(enabled)); updateAdvancedSettings(); } },
    setShowConnections(show){ if(bgRoot) { bgRoot.setAttribute('data-particle-connections', String(show)); updateAdvancedSettings(); } },
    setShowParticles(show){ if(bgRoot) { bgRoot.setAttribute('data-particle-show', String(show)); updateAdvancedSettings(); } },
    getStats(){ return { 
      ...stats, 
      debugMode, 
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
      // Canvas leeren
      ctx.clearRect(0,0,canvas.width,canvas.height);
    }
  };
  return api.stop;
}

// Legacy-Fallback
if (!window.initParticles) window.initParticles = (deps) => initParticles(deps);