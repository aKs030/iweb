import { CONFIG } from './config.js';
import { createLogger, getElementById } from '../../shared-utilities.js';

const log = createLogger('EarthStars');

export class StarManager {
  constructor(THREE, scene, camera) {
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;
    this.starField = null;
    this.starOriginalPositions = null;
    this.starTargetPositions = null;
    this.starAnimationState = {
      active: false,
      startTime: 0,
      positionsUpdated: false,
      updateScheduled: false
    };
    this.isMobileDevice = window.matchMedia('(max-width: 768px)').matches;
  }

  createStarField() {
    const starCount = this.isMobileDevice ? CONFIG.STARS.COUNT / 2 : CONFIG.STARS.COUNT;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const color = new this.THREE.Color();

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const radius = 100 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      color.setHSL(Math.random() * 0.1 + 0.5, 0.8, 0.8 + Math.random() * 0.2);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      sizes[i] = Math.random() * 1.5 + 0.5;
    }

    const starGeometry = new this.THREE.BufferGeometry();
    starGeometry.setAttribute('position', new this.THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new this.THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute('size', new this.THREE.BufferAttribute(sizes, 1));

    const starMaterial = new this.THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        twinkleSpeed: { value: CONFIG.STARS.TWINKLE_SPEED }
      },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
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
    this.starOriginalPositions = new Float32Array(positions);

    return this.starField;
  }

  getCardPositions() {
    if (!this.camera) return [];

    const featuresSection = getElementById('features');
    if (!featuresSection) return [];

    const cards = featuresSection.querySelectorAll('.card');
    const positions = [];

    if (cards.length === 0) {
      // Fallback grid
      for (let i = 0; i < 9; i++) {
        const row = Math.floor(i / 3);
        const col = i % 3;
        positions.push({
          x: (col - 1) * 8,
          y: (1 - row) * 6 + 2,
          z: -2
        });
      }
      return positions;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > viewportHeight) return;

      const ndcX = ((rect.left + rect.width / 2) / viewportWidth) * 2 - 1;
      const ndcY = -(((rect.top + rect.height / 2) / viewportHeight) * 2 - 1);

      const targetZ = -2;
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
    if (!this.starField || !this.starOriginalPositions || this.starAnimationState.active) {
      return;
    }

    // Hide cards initially
    const cards = document.querySelectorAll('#features .card');
    cards.forEach((card) => {
      card.style.transition = 'none';
      card.style.opacity = '0';
    });

    this.starAnimationState.active = true;
    this.starAnimationState.startTime = performance.now();
    this.starAnimationState.positionsUpdated = false;

    const initialPositions = this.getCardPositions();
    if (initialPositions.length === 0) {
      this.starAnimationState.active = false;
      return;
    }

    const positions = this.starField.geometry.attributes.position.array;
    const starCount = positions.length / 3;
    this.starTargetPositions = new Float32Array(starCount * 3);

    const calculateTargets = (cardPositions) => {
      const cfg = CONFIG.STARS.ANIMATION;
      for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        const targetCard = cardPositions[i % cardPositions.length];

        this.starTargetPositions[i3] = targetCard.x + (Math.random() - 0.5) * cfg.SPREAD_XY;
        this.starTargetPositions[i3 + 1] = targetCard.y + (Math.random() - 0.5) * cfg.SPREAD_XY;
        this.starTargetPositions[i3 + 2] = targetCard.z + (Math.random() - 0.5) * cfg.SPREAD_Z;
      }
    };

    calculateTargets(initialPositions);

    // Update positions after camera stabilizes
    setTimeout(() => {
      if (this.starAnimationState.active && !this.starAnimationState.positionsUpdated) {
        const updatedPositions = this.getCardPositions();
        if (updatedPositions.length > 0) {
          calculateTargets(updatedPositions);
          this.starAnimationState.positionsUpdated = true;
        }
      }
    }, CONFIG.STARS.ANIMATION.CAMERA_SETTLE_DELAY);

    this.animateStarTransformation(cards);
  }

  animateStarTransformation(cards) {
    const cfg = CONFIG.STARS.ANIMATION;

    const animate = () => {
      if (!this.starAnimationState.active || !this.starField || !this.starTargetPositions) {
        this.starAnimationState.active = false;
        return;
      }

      const elapsed = performance.now() - this.starAnimationState.startTime;
      const progress = Math.min(elapsed / cfg.DURATION, 1);
      const eased = this.easeInOutCubic(progress);

      const positions = this.starField.geometry.attributes.position.array;
      const starCount = positions.length / 3;

      for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        const targetX =
          this.starOriginalPositions[i3] + (this.starTargetPositions[i3] - this.starOriginalPositions[i3]) * eased;
        const targetY =
          this.starOriginalPositions[i3 + 1] +
          (this.starTargetPositions[i3 + 1] - this.starOriginalPositions[i3 + 1]) * eased;
        const targetZ =
          this.starOriginalPositions[i3 + 2] +
          (this.starTargetPositions[i3 + 2] - this.starOriginalPositions[i3 + 2]) * eased;

        positions[i3] += (targetX - positions[i3]) * cfg.LERP_FACTOR;
        positions[i3 + 1] += (targetY - positions[i3 + 1]) * cfg.LERP_FACTOR;
        positions[i3 + 2] += (targetZ - positions[i3 + 2]) * cfg.LERP_FACTOR;
      }

      this.starField.geometry.attributes.position.needsUpdate = true;

      // Fade in cards
      if (progress >= cfg.CARD_FADE_START && progress <= cfg.CARD_FADE_END) {
        const fadeProgress =
          (progress - cfg.CARD_FADE_START) / (cfg.CARD_FADE_END - cfg.CARD_FADE_START);
        const cardOpacity = this.easeInOutCubic(fadeProgress);
        cards.forEach((card) => (card.style.opacity = cardOpacity.toString()));
      } else if (progress > cfg.CARD_FADE_END) {
        cards.forEach((card) => (card.style.opacity = '1'));
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.starAnimationState.active = false;
        cards.forEach((card) => (card.style.transition = ''));
        log.info('Star transformation complete');
      }
    };

    animate();
  }

  resetStarsToOriginal() {
    if (!this.starField || !this.starOriginalPositions) return;

    this.starAnimationState.active = false;
    this.starAnimationState.positionsUpdated = false;

    const cards = document.querySelectorAll('#features .card');
    cards.forEach((card) => {
      card.style.opacity = '0';
      card.style.transition = 'opacity 0.5s ease';
    });

    const positions = this.starField.geometry.attributes.position.array;
    positions.set(this.starOriginalPositions);
    this.starField.geometry.attributes.position.needsUpdate = true;

    this.starTargetPositions = null;
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
