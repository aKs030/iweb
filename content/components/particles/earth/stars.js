import { CONFIG } from "./config.js";
import { createLogger } from "../../../core/logger.js";

const log = createLogger("EarthStars");

export class StarManager {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.starField = null;
    this.isDisposed = false;
    this.isMobileDevice = window.innerWidth <= 768;
  }

  createStarField() {
    if (this.isDisposed) return null;

    const starCount = this.isMobileDevice ? CONFIG.STARS.COUNT / 2 : CONFIG.STARS.COUNT;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const phases = new Float32Array(starCount);
    const brightness = new Float32Array(starCount);
    const flares = new Float32Array(starCount);
    const color = new this.THREE.Color();

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const radius = 90 + Math.random() * 230;
      const theta = Math.random() * Math.PI * 2;
      // A restrained concentration around one plane suggests the Milky Way,
      // while most points remain distributed across the full celestial sphere.
      const isGalacticBand = Math.random() < 0.28;
      const phi = isGalacticBand
        ? Math.PI * 0.5 + (Math.random() + Math.random() + Math.random() - 1.5) * 0.24
        : Math.acos(2 * Math.random() - 1);

      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const x = radius * sinPhi * Math.cos(theta);
      const y = radius * sinPhi * Math.sin(theta);
      const z = radius * cosPhi;

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      const temperature = Math.random();
      if (temperature < 0.12) {
        color.setRGB(1, 0.72 + Math.random() * 0.13, 0.58 + Math.random() * 0.12);
      } else if (temperature > 0.82) {
        color.setRGB(0.62 + Math.random() * 0.12, 0.78 + Math.random() * 0.12, 1);
      } else {
        const neutral = 0.88 + Math.random() * 0.12;
        color.setRGB(neutral, neutral * 0.97, neutral);
      }
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      const rareBrightStar = Math.random() > 0.965;
      sizes[i] = rareBrightStar ? 3.2 + Math.random() * 2.2 : 1.1 + Math.random() * 1.9;
      phases[i] = Math.random() * Math.PI * 2;
      brightness[i] = rareBrightStar ? 0.9 + Math.random() * 0.1 : 0.38 + Math.random() * 0.48;
      flares[i] = rareBrightStar ? 0.55 + Math.random() * 0.45 : 0;
    }

    const starGeometry = new this.THREE.BufferGeometry();
    starGeometry.setAttribute("position", new this.THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute("color", new this.THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute("size", new this.THREE.BufferAttribute(sizes, 1));
    starGeometry.setAttribute("phase", new this.THREE.BufferAttribute(phases, 1));
    starGeometry.setAttribute("brightness", new this.THREE.BufferAttribute(brightness, 1));
    starGeometry.setAttribute("flare", new this.THREE.BufferAttribute(flares, 1));

    const starMaterial = new this.THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        twinkleSpeed: { value: CONFIG.STARS.TWINKLE_SPEED },
      },
      vertexShader: `
        uniform float time;
        uniform float twinkleSpeed;
        attribute float size;
        attribute float phase;
        attribute float brightness;
        attribute float flare;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vFlare;

        void main() {
          vColor = color;
          vFlare = flare;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float shimmer = 0.91 + 0.09 * sin(time * twinkleSpeed + phase);
          vAlpha = brightness * shimmer;
          gl_PointSize = clamp(size * (280.0 / -mvPosition.z), 0.8, 5.6);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vFlare;
        void main() {
          vec2 centered = gl_PointCoord - vec2(0.5);
          float distanceToCenter = length(centered);
          float core = 1.0 - smoothstep(0.0, 0.3, distanceToCenter);
          float halo = 1.0 - smoothstep(0.08, 0.5, distanceToCenter);
          float diffraction = (
            exp(-abs(centered.x) * 28.0) +
            exp(-abs(centered.y) * 28.0)
          ) * (1.0 - smoothstep(0.1, 0.5, distanceToCenter)) * vFlare;
          float alpha = (core * 0.76 + halo * 0.18 + diffraction * 0.16) * vAlpha;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.2), alpha);
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

  update(elapsedTime) {
    if (this.starField && !this.isDisposed) {
      this.starField.material.uniforms.time.value = elapsedTime;
    }
  }

  cleanup() {
    this.isDisposed = true;

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
    if (this.isDisposed || this.activeStars.length >= CONFIG.SHOOTING_STARS.MAX_SIMULTANEOUS)
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
        0
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
      log.error("Failed to create shooting star:", error);
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
        const fadeProgress = (star.age - fadeStart) / (star.lifetime - fadeStart);
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
    if (this.isDisposed || this.isShowerActive || this.showerCooldownTimer > 0) return;
    this.isShowerActive = true;
    this.showerTimer = 0;
    log.info("🌠 Meteor shower triggered!");
  }

  cleanup() {
    this.isDisposed = true;
    this.activeStars.forEach(star => {
      this.scene.remove(star.mesh);
      if (star.mesh.material) star.mesh.material.dispose();
    });
    this.activeStars = [];

    // Dispose pooled stars
    this.pool.forEach(mesh => {
      if (mesh.material) mesh.material.dispose();
      this.scene.remove(mesh);
    });
    this.pool = [];

    // Dispose shared resources
    if (this.sharedGeometry) this.sharedGeometry.dispose();
    if (this.sharedMaterial) this.sharedMaterial.dispose();
  }
}
