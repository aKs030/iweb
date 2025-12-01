import { CONFIG } from './config.js';
import { createLogger, getElementById } from '../../shared-utilities.js';

const log = createLogger('EarthStars');

export class StarManager {
  constructor(THREE, scene, camera, renderer) {
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.starField = null;
    this.isDisposed = false;

    this.transition = {
      active: false,
      startTime: 0,
      duration: CONFIG.STARS.ANIMATION.DURATION,
      startValue: 0,
      targetValue: 0,
      rafId: null
    };

    this.isMobileDevice = window.matchMedia('(max-width: 768px)').matches;
    this.scrollUpdateEnabled = false;
    this.boundScrollHandler = null;
    this.needsUpdate = false;

    // Optimization: Reusable temporary vector
    this.tempVector = new this.THREE.Vector3();
  }

  createStarField() {
    if (this.isDisposed) return null;

    const starCount = this.isMobileDevice ? CONFIG.STARS.COUNT / 2 : CONFIG.STARS.COUNT;
    const positions = new Float32Array(starCount * 3);
    const targetPositions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    // Stable offsets for star spread to prevent flickering
    this.starOffsets = new Float32Array(starCount * 3);

    const color = new this.THREE.Color();

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;

      this.starOffsets[i3] = Math.random() - 0.5;
      this.starOffsets[i3 + 1] = Math.random() - 0.5;
      this.starOffsets[i3 + 2] = Math.random() - 0.5;

      const radius = 100 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

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
    starGeometry.setAttribute(
      'aTargetPosition',
      new this.THREE.BufferAttribute(targetPositions, 3)
    );
    starGeometry.setAttribute('color', new this.THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute('size', new this.THREE.BufferAttribute(sizes, 1));

    const starMaterial = new this.THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        twinkleSpeed: { value: CONFIG.STARS.TWINKLE_SPEED },
        uTransition: { value: 0.0 }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 aTargetPosition;
        uniform float uTransition;
        varying vec3 vColor;
        
        void main() {
          vColor = color;
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
    if (!this.camera || this.isDisposed) return [];

    const featuresSection = getElementById('features');
    if (!featuresSection) return [];

    const cards = featuresSection.querySelectorAll('.card');
    if (cards.length === 0) return [];

    const positions = [];
    const width = this.renderer ? this.renderer.domElement.clientWidth : window.innerWidth;
    const height = this.renderer ? this.renderer.domElement.clientHeight : window.innerHeight;

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const perimeterPositions = this.getCardPerimeterPositions(rect, width, height, -2);
      positions.push(...perimeterPositions);
    });

    return positions;
  }

  getCardPerimeterPositions(rect, viewportWidth, viewportHeight, targetZ) {
    const positions = [];
    const starsPerEdge = Math.floor(CONFIG.STARS.COUNT / 3 / 4);

    const screenToWorld = (x, y) => {
      const ndcX = (x / viewportWidth) * 2 - 1;
      const ndcY = -((y / viewportHeight) * 2 - 1);

      // Reuse tempVector
      this.tempVector.set(ndcX, ndcY, 0);
      this.tempVector.unproject(this.camera);

      // direction = vector.sub(camera.position).normalize()
      this.tempVector.sub(this.camera.position).normalize();

      // distance = (targetZ - camera.z) / direction.z
      const distance = (targetZ - this.camera.position.z) / this.tempVector.z;

      // result = camera + direction * distance
      return {
        x: this.camera.position.x + this.tempVector.x * distance,
        y: this.camera.position.y + this.tempVector.y * distance,
        z: targetZ
      };
    };

    for (let i = 0; i < starsPerEdge; i++) {
      const t = i / Math.max(1, starsPerEdge - 1);
      const worldPos = screenToWorld(rect.left + t * rect.width, rect.top);
      positions.push({ x: worldPos.x, y: worldPos.y, z: targetZ });
    }

    for (let i = 0; i < starsPerEdge; i++) {
      const t = i / Math.max(1, starsPerEdge - 1);
      const worldPos = screenToWorld(rect.right, rect.top + t * rect.height);
      positions.push({ x: worldPos.x, y: worldPos.y, z: targetZ });
    }

    for (let i = 0; i < starsPerEdge; i++) {
      const t = i / Math.max(1, starsPerEdge - 1);
      const worldPos = screenToWorld(rect.right - t * rect.width, rect.bottom);
      positions.push({ x: worldPos.x, y: worldPos.y, z: targetZ });
    }

    for (let i = 0; i < starsPerEdge; i++) {
      const t = i / Math.max(1, starsPerEdge - 1);
      const worldPos = screenToWorld(rect.left, rect.bottom - t * rect.height);
      positions.push({ x: worldPos.x, y: worldPos.y, z: targetZ });
    }

    return positions;
  }

  animateStarsToCards() {
    if (!this.starField || this.isDisposed) return;

    const cards = document.querySelectorAll('#features .card');
    cards.forEach((card) => {
      card.style.opacity = '0';
      card.style.pointerEvents = 'none';
    });

    const cardPositions = this.getCardPositions();
    if (cardPositions.length === 0) return;

    this.updateTargetBuffer(cardPositions);
    this.startTransition(1.0);
    this.enableScrollUpdates();

    setTimeout(() => {
      if (!this.isDisposed && this.transition.targetValue === 1.0) {
        const refinedPositions = this.getCardPositions();
        if (refinedPositions.length > 0) this.updateTargetBuffer(refinedPositions);
      }
    }, CONFIG.STARS.ANIMATION.CAMERA_SETTLE_DELAY);
  }

  resetStarsToOriginal() {
    if (!this.starField || this.isDisposed) return;
    this.disableScrollUpdates();
    this.startTransition(0.0);
  }

  enableScrollUpdates() {
    if (this.scrollUpdateEnabled || this.isDisposed) return;
    this.scrollUpdateEnabled = true;
    this.boundScrollHandler = this.handleScroll.bind(this);
    window.addEventListener('scroll', this.boundScrollHandler, { passive: true });
  }

  disableScrollUpdates() {
    if (!this.scrollUpdateEnabled) return;
    this.scrollUpdateEnabled = false;
    if (this.boundScrollHandler) {
      window.removeEventListener('scroll', this.boundScrollHandler);
      this.boundScrollHandler = null;
    }
  }

  handleScroll() {
    if (!this.scrollUpdateEnabled || this.isDisposed || this.transition.active) return;
    this.needsUpdate = true;
  }

  updateTargetBuffer(cardPositions) {
    if (this.isDisposed || !this.starField || !this.starOffsets) return;

    const attr = this.starField.geometry.attributes.aTargetPosition;
    const array = attr.array;
    const count = array.length / 3;
    const spreadXY = CONFIG.STARS.ANIMATION.SPREAD_XY;
    const spreadZ = CONFIG.STARS.ANIMATION.SPREAD_Z;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const target = cardPositions[i % cardPositions.length];

      array[i3] = target.x + this.starOffsets[i3] * spreadXY;
      array[i3 + 1] = target.y + this.starOffsets[i3 + 1] * spreadXY;
      array[i3 + 2] = target.z + this.starOffsets[i3 + 2] * spreadZ;
    }

    attr.needsUpdate = true;
  }

  startTransition(targetValue) {
    if (this.isDisposed) return;

    const current = this.starField.material.uniforms.uTransition.value;
    if (current === targetValue) return;

    this.transition.active = true;
    this.transition.startTime = performance.now();
    this.transition.startValue = current;
    this.transition.targetValue = targetValue;

    if (this.transition.rafId) cancelAnimationFrame(this.transition.rafId);
    this.animateTransitionLoop();
  }

  animateTransitionLoop() {
    if (!this.transition.active || this.isDisposed) return;

    const now = performance.now();
    const elapsed = now - this.transition.startTime;
    let progress = Math.min(elapsed / this.transition.duration, 1);

    if (progress >= 1) this.transition.active = false;

    const eased = this.easeInOutCubic(progress);

    if (this.starField && this.starField.material) {
      const val = this.transition.startValue + 
                  (this.transition.targetValue - this.transition.startValue) * eased;
      this.starField.material.uniforms.uTransition.value = val;
      this.updateCardOpacity(val);
    }

    if (this.transition.active) {
      this.transition.rafId = requestAnimationFrame(() => this.animateTransitionLoop());
    }
  }

  updateCardOpacity(transitionValue) {
    const cfg = CONFIG.STARS.ANIMATION;
    let opacity = 0;

    if (transitionValue > cfg.CARD_FADE_START) {
      opacity = (transitionValue - cfg.CARD_FADE_START) / (cfg.CARD_FADE_END - cfg.CARD_FADE_START);
      opacity = Math.min(Math.max(opacity, 0), 1);
    }

    const cards = document.querySelectorAll('#features .card');
    cards.forEach((card) => {
      card.style.opacity = opacity.toString();
      card.style.pointerEvents = opacity > 0.8 ? 'auto' : 'none';
    });
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  update(elapsedTime) {
    if (this.starField && !this.isDisposed) {
      this.starField.material.uniforms.time.value = elapsedTime;

      if (this.needsUpdate) {
        const cardPositions = this.getCardPositions();
        if (cardPositions.length > 0) this.updateTargetBuffer(cardPositions);
        this.needsUpdate = false;
      }
    }
  }

  cleanup() {
    this.isDisposed = true;
    this.disableScrollUpdates();
    this.transition.active = false;
    if (this.transition.rafId) {
      cancelAnimationFrame(this.transition.rafId);
      this.transition.rafId = null;
    }

    if (this.starField) {
      if (this.scene) this.scene.remove(this.starField);
      if (this.starField.geometry) this.starField.geometry.dispose();
      if (this.starField.material) this.starField.material.dispose();
      this.starField = null;
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
    this.isDisposed = false;

    this.sharedGeometry = new this.THREE.SphereGeometry(0.05, 8, 8);
    this.sharedMaterial = new this.THREE.MeshBasicMaterial({
      color: 0xfffdef,
      transparent: true,
      opacity: 1.0
    });

    // Object Pool
    this.starPool = [];
    this.maxPoolSize = CONFIG.SHOOTING_STARS.MAX_SIMULTANEOUS + 2;
    this.initializePool();
  }

  initializePool() {
    for (let i = 0; i < this.maxPoolSize; i++) {
      const material = this.sharedMaterial.clone();
      const mesh = new this.THREE.Mesh(this.sharedGeometry, material);
      mesh.visible = false;
      this.scene.add(mesh);
      this.starPool.push({
        mesh,
        active: false,
        velocity: new this.THREE.Vector3(),
        lifetime: 0,
        age: 0
      });
    }
  }

  createShootingStar() {
    if (this.isDisposed) return;

    // Find available star in pool
    const star = this.starPool.find((s) => !s.active);
    if (!star) return; // Pool exhausted

    try {
      star.active = true;
      star.age = 0;
      star.lifetime = 300 + Math.random() * 200;
      star.mesh.material.opacity = 1.0;
      star.mesh.visible = true;

      const startPos = {
        x: (Math.random() - 0.5) * 100,
        y: 20 + Math.random() * 20,
        z: -50 - Math.random() * 50
      };

      star.velocity.set(
        (Math.random() - 0.9) * 0.2,
        (Math.random() - 0.6) * -0.2,
        0
      );

      star.mesh.position.set(startPos.x, startPos.y, startPos.z);
      star.mesh.scale.set(1, 1, 2 + Math.random() * 3);

      // Re-orient mesh
      const lookTarget = star.mesh.position.clone().add(star.velocity);
      star.mesh.lookAt(lookTarget);

    } catch (error) {
      log.error('Failed to create shooting star:', error);
      star.active = false;
      star.mesh.visible = false;
    }
  }

  update() {
    if (this.disabled || this.isDisposed) return;

    if (this.isShowerActive) {
      this.showerTimer++;
      if (this.showerTimer >= CONFIG.SHOOTING_STARS.SHOWER_DURATION) {
        this.isShowerActive = false;
        this.showerCooldownTimer = CONFIG.SHOOTING_STARS.SHOWER_COOLDOWN;
      }
    }

    if (this.showerCooldownTimer > 0) this.showerCooldownTimer--;

    const spawnChance = this.isShowerActive
      ? CONFIG.SHOOTING_STARS.SHOWER_FREQUENCY
      : CONFIG.SHOOTING_STARS.BASE_FREQUENCY;

    if (Math.random() < spawnChance) this.createShootingStar();

    // Update active stars
    for (let i = 0; i < this.starPool.length; i++) {
      const star = this.starPool[i];
      if (!star.active) continue;

      star.age++;
      star.mesh.position.add(star.velocity);

      const fadeStart = star.lifetime * 0.7;
      if (star.age > fadeStart) {
        const fadeProgress = (star.age - fadeStart) / (star.lifetime - fadeStart);
        star.mesh.material.opacity = Math.max(0, 1 - fadeProgress);
      }

      if (star.age > star.lifetime) {
        star.active = false;
        star.mesh.visible = false;
      }
    }
  }

  triggerShower() {
    if (this.isDisposed || this.isShowerActive || this.showerCooldownTimer > 0) return;
    this.isShowerActive = true;
    this.showerTimer = 0;
    log.info('🌠 Meteor shower triggered!');
  }

  cleanup() {
    this.isDisposed = true;

    // Clean up pool
    if (this.starPool) {
      this.starPool.forEach((star) => {
        if (star.mesh) {
          this.scene.remove(star.mesh);
          if (star.mesh.material) star.mesh.material.dispose();
        }
      });
      this.starPool = [];
    }

    // Dispose shared resources
    this.sharedGeometry?.dispose();
    this.sharedMaterial?.dispose();
  }
}
