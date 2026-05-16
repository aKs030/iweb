import { CONFIG } from "./config.js";
import { createLogger } from "#core/logger.js";

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

		const starCount = this.isMobileDevice
			? CONFIG.STARS.COUNT / 2
			: CONFIG.STARS.COUNT;
		const positions = new Float32Array(starCount * 3);
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

			color.setHSL(Math.random() * 0.1 + 0.5, 0.8, 0.8 + Math.random() * 0.2);
			colors[i3] = color.r;
			colors[i3 + 1] = color.g;
			colors[i3 + 2] = color.b;

			sizes[i] = Math.random() * 1.5 + 0.5;
		}

		const starGeometry = new this.THREE.BufferGeometry();
		starGeometry.setAttribute(
			"position",
			new this.THREE.BufferAttribute(positions, 3),
		);
		starGeometry.setAttribute(
			"color",
			new this.THREE.BufferAttribute(colors, 3),
		);
		starGeometry.setAttribute("size", new this.THREE.BufferAttribute(sizes, 1));

		const starMaterial = new this.THREE.ShaderMaterial({
			uniforms: {
				time: { value: 0.0 },
				twinkleSpeed: { value: CONFIG.STARS.TWINKLE_SPEED },
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
		log.info("🌠 Meteor shower triggered!");
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
