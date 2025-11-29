import { CONFIG } from './config.js';
import { createLogger, getElementById } from '../../shared-utilities.js';

const log = createLogger('EarthStars');

export class StarManager {
  constructor(THREE, scene, camera) {
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;
    this.starField = null;
    
    // Animation State for Shader-Transition
    this.transition = {
      active: false,
      startTime: 0,
      duration: CONFIG.STARS.ANIMATION.DURATION,
      startValue: 0,
      targetValue: 0
    };

    this.isMobileDevice = window.matchMedia('(max-width: 768px)').matches;
  }

  createStarField() {
    const starCount = this.isMobileDevice ? CONFIG.STARS.COUNT / 2 : CONFIG.STARS.COUNT;
    
    // Buffer Arrays
    const positions = new Float32Array(starCount * 3);
    const targetPositions = new Float32Array(starCount * 3); // New: Target positions for GPU
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const color = new this.THREE.Color();

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const radius = 100 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      // Spherical distribution (Start)
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      // Initialize targets to same position to avoid glitches
      targetPositions[i3] = x;
      targetPositions[i3 + 1] = y;
      targetPositions[i3 + 2] = z;

      color.setHSL(Math.random() * 0.1 + 0.5, 0.8, 0.8 + Math.random() * 0.2);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      sizes[i] = Math.random() * 1.5 + 0.5;
    }

    const starGeometry = new this.THREE.BufferGeometry();
    starGeometry.setAttribute('position', new this.THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('aTargetPosition', new this.THREE.BufferAttribute(targetPositions, 3));
    starGeometry.setAttribute('color', new this.THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute('size', new this.THREE.BufferAttribute(sizes, 1));

    const starMaterial = new this.THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        twinkleSpeed: { value: CONFIG.STARS.TWINKLE_SPEED },
        uTransition: { value: 0.0 } // 0.0 = Sphere, 1.0 = Cards
      },
      vertexShader: `
        attribute float size;
        attribute vec3 aTargetPosition;
        uniform float uTransition;
        varying vec3 vColor;
        
        void main() {
          vColor = color;
          
          // GPU-based interpolation
          // mix performs linear interpolation between start (position) and end (aTargetPosition)
          vec3 currentPos = mix(position, aTargetPosition, uTransition);
          
          vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float twinkleSpeed;
        varying vec3 vColor;
        void main() {
          float strength = (sin(time * twinkleSpeed + gl_FragCoord.x * 0.5) + 1.0) / 2.0 * 0.5 + 0.5;
          gl_FragColor = vec4(vColor, strength);
        }
      `,
      blending: this.THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      vertexColors: true
    });

    this.starField = new this.THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.starField);

    return this.starField;
  }

  getCardPositions() {
    if (!this.camera) return [];

    const featuresSection = getElementById('features');
    if (!featuresSection) return [];

    // Select actual cards, fallback to empty if none found
    const cards = featuresSection.querySelectorAll('.card');
    if (cards.length === 0) return [];

    const positions = [];
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      
      // Calculate Normalized Device Coordinates (NDC) for center of card
      const ndcX = ((rect.left + rect.width / 2) / viewportWidth) * 2 - 1;
      const ndcY = -(((rect.top + rect.height / 2) / viewportHeight) * 2 - 1);

      const targetZ = -2; // Distance from camera
      const vector = new this.THREE.Vector3(ndcX, ndcY, 0);
      vector.unproject(this.camera);

      const direction = vector.sub(this.camera.position).normalize();
      const distance = (targetZ - this.camera.position.z) / direction.z;
      const worldPos = this.camera.position.clone().add(direction.multiplyScalar(distance));

      positions.push({ x: worldPos.x, y: worldPos.y, z: targetZ });
    });

    return positions;
  }

  animateStarsToCards() {
    if (!this.starField) return;

    // Hide cards initially (they will fade in)
    const cards = document.querySelectorAll('#features .card');
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.pointerEvents = 'none';
    });

    // 1. Calculate Targets
    const cardPositions = this.getCardPositions();
    if (cardPositions.length === 0) return;

    // 2. Update GPU Buffer
    this.updateTargetBuffer(cardPositions);

    // 3. Start Transition to 1.0 (Cards)
    this.startTransition(1.0);

    // Optional: Re-calculate once camera settled for precision
    setTimeout(() => {
        if (this.transition.targetValue === 1.0) {
            const refinedPositions = this.getCardPositions();
            if (refinedPositions.length > 0) this.updateTargetBuffer(refinedPositions);
        }
    }, CONFIG.STARS.ANIMATION.CAMERA_SETTLE_DELAY);
  }

  resetStarsToOriginal() {
    if (!this.starField) return;
    
    // Start Transition to 0.0 (Sphere)
    this.startTransition(0.0);
  }

  updateTargetBuffer(cardPositions) {
    const attr = this.starField.geometry.attributes.aTargetPosition;
    const array = attr.array;
    const count = array.length / 3;
    const cfg = CONFIG.STARS.ANIMATION;

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const target = cardPositions[i % cardPositions.length];
        
        // Add spread to form a cloud around the card
        array[i3] = target.x + (Math.random() - 0.5) * cfg.SPREAD_XY;
        array[i3 + 1] = target.y + (Math.random() - 0.5) * cfg.SPREAD_XY;
        array[i3 + 2] = target.z + (Math.random() - 0.5) * cfg.SPREAD_Z;
    }
    
    attr.needsUpdate = true;
  }

  startTransition(targetValue) {
      const current = this.starField.material.uniforms.uTransition.value;
      if (current === targetValue) return;

      this.transition.active = true;
      this.transition.startTime = performance.now();
      this.transition.startValue = current;
      this.transition.targetValue = targetValue;

      this.animateTransitionLoop();
  }

  animateTransitionLoop() {
      if (!this.transition.active) return;

      const now = performance.now();
      const elapsed = now - this.transition.startTime;
      let progress = elapsed / this.transition.duration;

      if (progress >= 1) {
          progress = 1;
          this.transition.active = false;
      }

      const eased = this.easeInOutCubic(progress);
      
      // Interpolate uniform
      const val = this.transition.startValue + (this.transition.targetValue - this.transition.startValue) * eased;
      this.starField.material.uniforms.uTransition.value = val;

      // Sync DOM Cards Opacity
      this.updateCardOpacity(val);

      if (this.transition.active) {
          requestAnimationFrame(() => this.animateTransitionLoop());
      }
  }

  updateCardOpacity(transitionValue) {
      // Logic: Fade in cards when stars are almost there
      const cfg = CONFIG.STARS.ANIMATION;
      // If going to cards (1.0), fade in. If going to sphere (0.0), fade out.
      // We assume transitionValue 0->1 maps to sequence.
      
      let opacity = 0;
      if (transitionValue > cfg.CARD_FADE_START) {
          opacity = (transitionValue - cfg.CARD_FADE_START) / (cfg.CARD_FADE_END - cfg.CARD_FADE_START);
          opacity = Math.min(Math.max(opacity, 0), 1);
      }

      const cards = document.querySelectorAll('#features .card');
      cards.forEach(card => {
          card.style.opacity = opacity.toString();
          card.style.pointerEvents = opacity > 0.8 ? 'auto' : 'none';
      });
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  update(elapsedTime) {
    if (this.starField) {
      this.starField.material.uniforms.time.value = elapsedTime;
    }
  }
}

export class ShootingStarManager {
  constructor(scene, THREE) {
    this.scene = scene;
    this.THREE = THREE;
    this.activeStars = [];
    this.isShowerActive = false;
    this.showerTimer = 0;
    this.showerCooldownTimer = 0;
    this.disabled = false;
  }

  createShootingStar() {
    if (this.activeStars.length >= CONFIG.SHOOTING_STARS.MAX_SIMULTANEOUS) return;

    try {
      const geometry = new this.THREE.SphereGeometry(0.05, 8, 8);
      const material = new this.THREE.MeshBasicMaterial({
        color: 0xfffdef,
        transparent: true,
        opacity: 1.0
      });
      const star = new this.THREE.Mesh(geometry, material);

      const startPos = {
        x: (Math.random() - 0.5) * 100,
        y: 20 + Math.random() * 20,
        z: -50 - Math.random() * 50
      };
      const velocity = new this.THREE.Vector3(
        (Math.random() - 0.9) * 0.2,
        (Math.random() - 0.6) * -0.2,
        0
      );

      star.position.set(startPos.x, startPos.y, startPos.z);
      star.scale.set(1, 1, 2 + Math.random() * 3);
      star.lookAt(star.position.clone().add(velocity));

      this.activeStars.push({
        mesh: star,
        velocity,
        lifetime: 300 + Math.random() * 200,
        age: 0
      });

      this.scene.add(star);
    } catch (error) {
      log.error('Failed to create shooting star:', error);
    }
  }

  update() {
    if (this.disabled) return;

    // Shower logic
    if (this.isShowerActive) {
      this.showerTimer++;
      if (this.showerTimer >= CONFIG.SHOOTING_STARS.SHOWER_DURATION) {
        this.isShowerActive = false;
        this.showerCooldownTimer = CONFIG.SHOOTING_STARS.SHOWER_COOLDOWN;
      }
    }

    if (this.showerCooldownTimer > 0) {
      this.showerCooldownTimer--;
    }

    // Spawn new stars
    const spawnChance = this.isShowerActive
      ? CONFIG.SHOOTING_STARS.SHOWER_FREQUENCY
      : CONFIG.SHOOTING_STARS.BASE_FREQUENCY;

    if (Math.random() < spawnChance) {
      this.createShootingStar();
    }

    // Update existing stars
    for (let i = this.activeStars.length - 1; i >= 0; i--) {
      const star = this.activeStars[i];
      star.age++;
      star.mesh.position.add(star.velocity);

      // Fade out
      const fadeStart = star.lifetime * 0.7;
      if (star.age > fadeStart) {
        const fadeProgress = (star.age - fadeStart) / (star.lifetime - fadeStart);
        star.mesh.material.opacity = 1 - fadeProgress;
      }

      // Remove dead stars
      if (star.age > star.lifetime) {
        this.scene.remove(star.mesh);
        star.mesh.geometry.dispose();
        star.mesh.material.dispose();
        this.activeStars.splice(i, 1);
      }
    }
  }

  triggerShower() {
    if (this.isShowerActive || this.showerCooldownTimer > 0) return;
    this.isShowerActive = true;
    this.showerTimer = 0;
    log.info('🌠 Meteor shower triggered!');
  }

  cleanup() {
    this.activeStars.forEach((star) => {
      this.scene.remove(star.mesh);
      star.mesh.geometry?.dispose();
      star.mesh.material?.dispose();
    });
    this.activeStars = [];
  }
}