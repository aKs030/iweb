import { CONFIG } from './config.js';
import { createLogger } from '../../../core/logger.js';

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
      rafId: null,
    };

    this.isMobileDevice = window.matchMedia('(max-width: 768px)').matches;
    this.scrollUpdateEnabled = false;
    this.lastScrollUpdate = 0;
    this.scrollUpdateThrottle = 150;
    this.boundScrollHandler = null;

    // Cache for resize calculations
    this.areStarsFormingCards = false;
    this.tempVector = new this.THREE.Vector3(); // Reuse for calculations
    this._combinedMatrix = new this.THREE.Matrix4(); // Optimization: Reuse matrix
    this.randomOffsets = null; // Optimization: Stable randomness
  }

  createStarField() {
    if (this.isDisposed) return null;

    const starCount = this.isMobileDevice
      ? CONFIG.STARS.COUNT / 2
      : CONFIG.STARS.COUNT;
    const positions = new Float32Array(starCount * 3);
    const targetPositions = new Float32Array(starCount * 3);
    // OPTIMIZATION: Pre-calculate random offsets to avoid Math.random() in loop and stabilize visual jitter
    this.randomOffsets = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const color = new this.THREE.Color();

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const radius = 100 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const x = radius * sinPhi * Math.cos(theta);
      const y = radius * sinPhi * Math.sin(theta);
      const z = radius * cosPhi;

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      targetPositions[i3] = x; // Initialize target as current pos
      targetPositions[i3 + 1] = y;
      targetPositions[i3 + 2] = z;

      this.randomOffsets[i3] = Math.random() - 0.5;
      this.randomOffsets[i3 + 1] = Math.random() - 0.5;
      this.randomOffsets[i3 + 2] = Math.random() - 0.5;

      color.setHSL(Math.random() * 0.1 + 0.5, 0.8, 0.8 + Math.random() * 0.2);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      sizes[i] = Math.random() * 1.5 + 0.5;
    }

    const starGeometry = new this.THREE.BufferGeometry();
    starGeometry.setAttribute(
      'position',
      new this.THREE.BufferAttribute(positions, 3),
    );
    starGeometry.setAttribute(
      'aTargetPosition',
      new this.THREE.BufferAttribute(targetPositions, 3),
    );
    starGeometry.setAttribute(
      'color',
      new this.THREE.BufferAttribute(colors, 3),
    );
    starGeometry.setAttribute('size', new this.THREE.BufferAttribute(sizes, 1));

    const starMaterial = new this.THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        twinkleSpeed: { value: CONFIG.STARS.TWINKLE_SPEED },
        uTransition: { value: 0.0 },
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
      vertexColors: true,
    });

    this.starField = new this.THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.starField);

    return this.starField;
  }

  // NEW: Handle resize to keep stars aligned with DOM elements
  handleResize() {
    if (this.areStarsFormingCards && !this.transition.active) {
      const cardPositions = this.getCardPositions();
      if (cardPositions.length > 0) {
        this.updateTargetBuffer(cardPositions);
      }
    }
  }

  // Allow external managers (e.g., CardManager) to be used as the source of card rects
  setCardManager(cm) {
    this.cardManager = cm;
  }

  getCardPositions() {
    if (!this.camera || this.isDisposed) return [];

    // Only use CardManager rects (WebGL-driven)
    if (this.cardManager?.getCardScreenRects) {
      const rects = this.cardManager.getCardScreenRects();
      if (!rects || rects.length === 0) return [];

      const positions = [];
      const width = this.renderer
        ? this.renderer.domElement.clientWidth
        : window.innerWidth;
      const height = this.renderer
        ? this.renderer.domElement.clientHeight
        : window.innerHeight;

      rects.forEach((rect) => {
        if (rect.right - rect.left > 0 && rect.bottom - rect.top > 0) {
          const perimeterPositions = this.getCardPerimeterPositions(
            rect,
            width,
            height,
            -2,
            rects.length,
          );
          positions.push(...perimeterPositions);
        }
      });

      return positions;
    }

    // If no CardManager is present, don't attempt DOM queries (WebGL-only policy)
    return [];
  }

  getCardPerimeterPositions(
    rect,
    viewportWidth,
    viewportHeight,
    targetZ,
    cardCount = 3,
  ) {
    const positions = [];
    const totalStars = this.isMobileDevice
      ? CONFIG.STARS.COUNT / 2
      : CONFIG.STARS.COUNT;
    const starsPerCard = Math.floor(totalStars / cardCount);

    // Calculate distributions: 20% on perimeter, 80% inside
    const perimeterStars = Math.floor(starsPerCard * 0.2);
    const surfaceStars = starsPerCard - perimeterStars;
    const starsPerEdge = Math.floor(perimeterStars / 4);

    // OPTIMIZATION: Pre-calculate combined matrix to avoid matrix multiplication in loop
    // unproject = applyMatrix4(projInv).applyMatrix4(world)
    // We compute M = world * projInv once
    this._combinedMatrix.multiplyMatrices(
      this.camera.matrixWorld,
      this.camera.projectionMatrixInverse,
    );

    // Optimized screenToWorld: writes directly to an array or object to avoid allocation
    // We'll just return x,y,z components to push into a flat array
    const pushWorldPos = (x, y, outArray) => {
      const ndcX = (x / viewportWidth) * 2 - 1;
      const ndcY = -((y / viewportHeight) * 2 - 1);

      this.tempVector.set(ndcX, ndcY, 0);
      // OPTIMIZATION: Use pre-calculated matrix instead of unproject()
      // Reduces 2 matrix multiplications per point to 1
      this.tempVector.applyMatrix4(this._combinedMatrix);
      this.tempVector.sub(this.camera.position).normalize();

      const distance = (targetZ - this.camera.position.z) / this.tempVector.z;

      outArray.push(
        this.camera.position.x + this.tempVector.x * distance,
        this.camera.position.y + this.tempVector.y * distance,
        this.camera.position.z + this.tempVector.z * distance,
      );
    };

    // 1. Perimeter (Border)
    const addLine = (startX, startY, endX, endY) => {
      for (let i = 0; i < starsPerEdge; i++) {
        const t = i / Math.max(1, starsPerEdge - 1);
        const x = startX + (endX - startX) * t;
        const y = startY + (endY - startY) * t;
        pushWorldPos(x, y, positions);
      }
    };

    addLine(rect.left, rect.top, rect.right, rect.top);
    addLine(rect.right, rect.top, rect.right, rect.bottom);
    addLine(rect.right, rect.bottom, rect.left, rect.bottom);
    addLine(rect.left, rect.bottom, rect.left, rect.top);

    // 2. Surface (Inside)
    for (let i = 0; i < surfaceStars; i++) {
      const x = rect.left + Math.random() * rect.width;
      const y = rect.top + Math.random() * rect.height;
      pushWorldPos(x, y, positions);
    }

    return positions;
  }

  animateStarsToCards() {
    if (!this.starField || this.isDisposed) return;
    this.areStarsFormingCards = true;

    // When using WebGL cards, prefer card mesh rects instead of manipulating DOM
    const cardPositions = this.getCardPositions();
    if (cardPositions.length === 0) return;

    this.updateTargetBuffer(cardPositions);
    this.startTransition(1.0);
    this.enableScrollUpdates();

    setTimeout(() => {
      if (!this.isDisposed && this.transition.targetValue === 1.0) {
        // Refine once settled
        const refinedPositions = this.getCardPositions();
        if (refinedPositions.length > 0)
          this.updateTargetBuffer(refinedPositions);
      }
    }, CONFIG.STARS.ANIMATION.CAMERA_SETTLE_DELAY);
  }

  resetStarsToOriginal() {
    if (!this.starField || this.isDisposed) return;
    this.areStarsFormingCards = false;
    this.disableScrollUpdates();
    this.startTransition(0.0);
    // No DOM manipulations when using WebGL card meshes
  }

  enableScrollUpdates() {
    if (this.scrollUpdateEnabled || this.isDisposed) return;
    this.scrollUpdateEnabled = true;
    this.boundScrollHandler = this.handleScroll.bind(this);
    window.addEventListener('scroll', this.boundScrollHandler, {
      passive: true,
    });
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
    if (!this.scrollUpdateEnabled || this.isDisposed || this.transition.active)
      return;

    const now = performance.now();
    if (now - this.lastScrollUpdate < this.scrollUpdateThrottle) return;
    this.lastScrollUpdate = now;

    // Recalculate because scroll changes screen position relative to camera
    const cardPositions = this.getCardPositions();
    if (cardPositions.length > 0) this.updateTargetBuffer(cardPositions);
  }

  updateTargetBuffer(cardPositions) {
    if (this.isDisposed || !this.starField) return;
    if (!cardPositions || cardPositions.length === 0) return;
    // Validate flat array structure: must be multiple of 3 (x,y,z triplets)
    if (cardPositions.length % 3 !== 0) {
      log.warn('Invalid cardPositions array length, must be divisible by 3');
      return;
    }

    const attr = this.starField.geometry.attributes.aTargetPosition;
    const array = attr.array;
    const count = array.length / 3;
    const numPositions = cardPositions.length / 3; // Flat array [x,y,z...]

    if (numPositions === 0) return;

    // Validate spread factors once before loop to avoid redundant checks (O(1) vs O(n))
    let spreadXY = CONFIG.STARS.ANIMATION.SPREAD_XY;
    if (!isFinite(spreadXY) || spreadXY < 0) {
      log.warn('Invalid SPREAD_XY config, using default 2');
      spreadXY = 2;
    }

    let spreadZ = CONFIG.STARS.ANIMATION.SPREAD_Z;
    if (!isFinite(spreadZ) || spreadZ < 0) {
      log.warn('Invalid SPREAD_Z config, using default 2');
      spreadZ = 2;
    }

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Wrap around if we have more stars than card-points.
      // No need for bounds checking: array length is guaranteed to be % 3 by validation above.
      const positionIndex = i % numPositions;
      const targetIndex = positionIndex * 3;

      // Type safety: Validate that positions are finite numbers (prevent NaN/Infinity)
      const tx = cardPositions[targetIndex];
      const ty = cardPositions[targetIndex + 1];
      const tz = cardPositions[targetIndex + 2];

      if (!isFinite(tx) || !isFinite(ty) || !isFinite(tz)) {
        // Throttle warning to avoid log spam (only warn once per update cycle)
        if (i === 0) {
          log.warn(
            'Invalid position values detected in cardPositions, skipping affected stars',
          );
        }
        continue;
      }

      // OPTIMIZATION: Use pre-calculated offsets
      // 1. Removes 9000 Math.random() calls per update
      // 2. Stabilizes visual appearance (no jitter during scroll/resize)
      array[i3] = tx + this.randomOffsets[i3] * spreadXY;
      array[i3 + 1] = ty + this.randomOffsets[i3 + 1] * spreadXY;
      array[i3 + 2] = tz + this.randomOffsets[i3 + 2] * spreadZ;
    }

    attr.needsUpdate = true;
  }

  startTransition(targetValue) {
    if (this.isDisposed) return;

    const current = this.starField.material.uniforms.uTransition.value;
    if (Math.abs(current - targetValue) < 0.01) return;

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
    const progress = Math.min(elapsed / this.transition.duration, 1);

    if (progress >= 1) this.transition.active = false;

    const eased = this.easeInOutCubic(progress);

    if (this.starField && this.starField.material) {
      const val =
        this.transition.startValue +
        (this.transition.targetValue - this.transition.startValue) * eased;
      this.starField.material.uniforms.uTransition.value = val;
      this.updateCardOpacity(val);
    }

    if (this.transition.active) {
      this.transition.rafId = requestAnimationFrame(() =>
        this.animateTransitionLoop(),
      );
    }
  }

  updateCardOpacity(transitionValue) {
    // WebGL-only: use CardManager progress API if available
    if (
      this.cardManager &&
      typeof this.cardManager.setProgress === 'function'
    ) {
      this.cardManager.setProgress(transitionValue);
    }
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  update(elapsedTime) {
    if (this.starField && !this.isDisposed) {
      this.starField.material.uniforms.time.value = elapsedTime;
    }
  }

  cleanup() {
    this.isDisposed = true;
    this.disableScrollUpdates();
    this.transition.active = false;
    this.areStarsFormingCards = false;

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
    this.pool = []; // Object pool for meshes
    this.isShowerActive = false;
    this.showerTimer = 0;
    this.showerCooldownTimer = 0;
    this.disabled = false;
    this.isDisposed = false;

    this.sharedGeometry = new this.THREE.SphereGeometry(0.05, 8, 8);
    this.sharedMaterial = new this.THREE.MeshBasicMaterial({
      color: 0xfffdef,
      transparent: true,
      opacity: 1.0,
    });
  }

  createShootingStar() {
    if (
      this.isDisposed ||
      this.activeStars.length >= CONFIG.SHOOTING_STARS.MAX_SIMULTANEOUS
    )
      return;

    try {
      let star;
      let isNew = false;
      if (this.pool.length > 0) {
        star = this.pool.pop();
        star.material.opacity = 1.0;
        star.visible = true;
      } else {
        const material = this.sharedMaterial.clone();
        star = new this.THREE.Mesh(this.sharedGeometry, material);
        isNew = true;
      }

      const startPos = {
        x: (Math.random() - 0.5) * 100,
        y: 20 + Math.random() * 20,
        z: -50 - Math.random() * 50,
      };
      const velocity = new this.THREE.Vector3(
        (Math.random() - 0.9) * 0.2,
        (Math.random() - 0.6) * -0.2,
        0,
      );

      star.position.set(startPos.x, startPos.y, startPos.z);
      star.scale.set(1, 1, 2 + Math.random() * 3);
      star.lookAt(star.position.clone().add(velocity));

      this.activeStars.push({
        mesh: star,
        velocity,
        lifetime: 300 + Math.random() * 200,
        age: 0,
      });

      if (isNew) {
        this.scene.add(star);
      }
    } catch (error) {
      log.error('Failed to create shooting star:', error);
    }
  }

  update(delta) {
    if (this.disabled || this.isDisposed) return;

    // Normalize speed to 60Hz ticks to preserve config values
    const timeScale = (delta || 0.016) * 60;

    if (this.isShowerActive) {
      this.showerTimer += timeScale;
      if (this.showerTimer >= CONFIG.SHOOTING_STARS.SHOWER_DURATION) {
        this.isShowerActive = false;
        this.showerCooldownTimer = CONFIG.SHOOTING_STARS.SHOWER_COOLDOWN;
      }
    }

    if (this.showerCooldownTimer > 0) this.showerCooldownTimer -= timeScale;

    const spawnChance = this.isShowerActive
      ? CONFIG.SHOOTING_STARS.SHOWER_FREQUENCY
      : CONFIG.SHOOTING_STARS.BASE_FREQUENCY;

    // Adjust probability for time step
    if (Math.random() < spawnChance * timeScale) this.createShootingStar();

    for (let i = this.activeStars.length - 1; i >= 0; i--) {
      const star = this.activeStars[i];
      star.age += timeScale;

      // Scale velocity by timeScale (optimized to avoid allocation)
      star.mesh.position.addScaledVector(star.velocity, timeScale);

      const fadeStart = star.lifetime * 0.7;
      if (star.age > fadeStart) {
        const fadeProgress =
          (star.age - fadeStart) / (star.lifetime - fadeStart);
        star.mesh.material.opacity = 1 - fadeProgress;
      }

      if (star.age > star.lifetime) {
        star.mesh.visible = false;
        // star.mesh.material.dispose(); // Don't dispose, reuse!
        this.pool.push(star.mesh);
        this.activeStars.splice(i, 1);
      }
    }
  }

  triggerShower() {
    if (this.isDisposed || this.isShowerActive || this.showerCooldownTimer > 0)
      return;
    this.isShowerActive = true;
    this.showerTimer = 0;
    log.info('🌠 Meteor shower triggered!');
  }

  cleanup() {
    this.isDisposed = true;
    this.activeStars.forEach((star) => {
      this.scene.remove(star.mesh);
      if (star.mesh.material) star.mesh.material.dispose();
    });
    this.activeStars = [];

    // Dispose pooled stars
    this.pool.forEach((mesh) => {
      if (mesh.material) mesh.material.dispose();
      this.scene.remove(mesh);
    });
    this.pool = [];

    // Dispose shared resources
    if (this.sharedGeometry) this.sharedGeometry.dispose();
    if (this.sharedMaterial) this.sharedMaterial.dispose();
  }
}
