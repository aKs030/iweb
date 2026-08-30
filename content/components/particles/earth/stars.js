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
      const isGalacticBand = Math.random() < 0.33;
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
      if (temperature < 0.04) {
        // M-type: rare red giants
        color.setRGB(1, 0.36 + Math.random() * 0.18, 0.2 + Math.random() * 0.12);
      } else if (temperature < 0.18) {
        // K-type: orange stars
        color.setRGB(1, 0.68 + Math.random() * 0.16, 0.52 + Math.random() * 0.14);
      } else if (temperature > 0.78) {
        // B/O-type: blue-white stars
        color.setRGB(0.6 + Math.random() * 0.14, 0.78 + Math.random() * 0.14, 1);
      } else {
        // F/G-type: near-white (majority)
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
          float shimmer = 0.88 + 0.12 * sin(time * twinkleSpeed + phase);
          vAlpha = brightness * shimmer;
          gl_PointSize = clamp(size * (280.0 / -mvPosition.z), 1.0, 5.0);
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
            exp(-abs(centered.y) * 28.0) +
            exp(-abs(centered.x + centered.y) * 42.0) * 0.38 +
            exp(-abs(centered.x - centered.y) * 42.0) * 0.38
          ) * (1.0 - smoothstep(0.1, 0.5, distanceToCenter)) * vFlare;
          float alpha = (core * 0.78 + halo * 0.20 + diffraction * 0.22) * vAlpha;
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
    this.starField.frustumCulled = false;
    this.scene.add(this.starField);

    return this.starField;
  }

  update(elapsedTime) {
    if (this.starField && !this.isDisposed) {
      this.starField.material.uniforms.time.value = elapsedTime;
    }
  }

  syncToCamera(camera) {
    if (this.starField && camera && !this.isDisposed) {
      this.starField.position.copy(camera.position);
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
    this.pool = [];
    this.disabled = false;
    this.isDisposed = false;

    // Tapered aerodynamic luminous streak geometry (points along Y axis)
    this.sharedGeometry = new this.THREE.CylinderGeometry(0.012, 0.065, 2.4, 8, 1, true);
    this.sharedGeometry.translate(0, 1.2, 0); // Origin at tail

    this.sharedMaterial = new this.THREE.MeshBasicMaterial({
      color: 0xebf6ff,
      transparent: true,
      opacity: 0,
      blending: this.THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: this.THREE.DoubleSide,
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
        star.material.opacity = 0;
        star.visible = true;
      } else {
        const material = this.sharedMaterial.clone();
        star = new this.THREE.Mesh(this.sharedGeometry, material);
        isNew = true;
      }

      // Choose a pleasant star tint: pure diamond white, icy cyan, or pale champagne gold
      const palette = [0xffffff, 0xc7ecff, 0xfff0d0, 0x90e0ef];
      const starColor = palette[Math.floor(Math.random() * palette.length)];
      star.material.color.setHex(starColor);

      // Spawn in upper quadrant of the visible viewport background
      const spawnX = (Math.random() - 0.45) * 36;
      const spawnY = 8 + Math.random() * 16;
      const spawnZ = -10 - Math.random() * 18;

      // Realistic meteor entry angle (streaking diagonally downward)
      const speed = 0.6 + Math.random() * 0.5;
      const angle = -Math.PI * 0.22 + (Math.random() - 0.5) * 0.35;
      const velocity = new this.THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        (Math.random() - 0.5) * 0.15
      );

      star.position.set(spawnX, spawnY, spawnZ);
      const streakLength = 1.0 + Math.random() * 0.8;
      star.scale.set(1, streakLength, 1);

      const direction = velocity.clone().normalize();
      star.quaternion.setFromUnitVectors(new this.THREE.Vector3(0, 1, 0), direction);

      this.activeStars.push({
        mesh: star,
        velocity,
        lifetime: 40 + Math.random() * 30, // in frames
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

    const timeScale = (delta || 0.016) * 60;

    if (Math.random() < CONFIG.SHOOTING_STARS.BASE_FREQUENCY * timeScale) {
      this.createShootingStar();
    }

    for (let i = this.activeStars.length - 1; i >= 0; i--) {
      const star = this.activeStars[i];
      star.age += timeScale;

      star.mesh.position.addScaledVector(star.velocity, timeScale);

      // Smooth fade-in during the first 20% of life, peak at 1.0, fade-out after 70%
      const lifeProgress = star.age / star.lifetime;
      let currentOpacity;
      if (lifeProgress < 0.2) {
        currentOpacity = lifeProgress / 0.2;
      } else if (lifeProgress < 0.7) {
        currentOpacity = 1.0;
      } else {
        currentOpacity = Math.max(0, 1.0 - (lifeProgress - 0.7) / 0.3);
      }
      star.mesh.material.opacity = currentOpacity * 0.92;

      if (star.age >= star.lifetime) {
        star.mesh.visible = false;
        star.mesh.material.opacity = 0;
        this.pool.push(star.mesh);
        this.activeStars.splice(i, 1);
      }
    }
  }

  cleanup() {
    this.isDisposed = true;
    this.activeStars.forEach(star => {
      this.scene.remove(star.mesh);
      if (star.mesh.material) star.mesh.material.dispose();
    });
    this.activeStars = [];

    this.pool.forEach(mesh => {
      if (mesh.material) mesh.material.dispose();
      this.scene.remove(mesh);
    });
    this.pool = [];

    if (this.sharedGeometry) this.sharedGeometry.dispose();
    if (this.sharedMaterial) this.sharedMaterial.dispose();
  }
}
