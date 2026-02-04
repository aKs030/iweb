import { CONFIG } from './config.js';
import { createLogger } from '/content/core/logger.js';

const log = createLogger('EarthGrid');

export class GridManager {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.mesh = null;
    this.active = false;
    this.opacity = 0;
    this.targetOpacity = 0;
  }

  init() {
    if (!CONFIG.GRID.ENABLED) return;

    try {
      // Create a large plane
      const geometry = new this.THREE.PlaneGeometry(
        CONFIG.GRID.SIZE,
        CONFIG.GRID.SIZE,
        1,
        1,
      );

      // Custom shader for the cyber-grid effect
      const material = new this.THREE.ShaderMaterial({
        transparent: true,
        side: this.THREE.DoubleSide,
        depthWrite: false, // Don't block stars/earth behind it (though it's usually below)
        blending: this.THREE.AdditiveBlending, // Glowing effect
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new this.THREE.Color(CONFIG.GRID.COLOR) },
          uOpacity: { value: 0 }, // Master opacity
          uGridSize: { value: CONFIG.GRID.DIVISIONS },
          uSpeed: { value: CONFIG.GRID.SPEED },
          uFogNear: { value: CONFIG.GRID.FOG_NEAR },
          uFogFar: { value: CONFIG.GRID.FOG_FAR },
        },
        vertexShader: `
          varying vec2 vUv;
          varying float vDistance;

          void main() {
            vUv = uv;
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vec4 viewPosition = viewMatrix * worldPosition;
            vDistance = -viewPosition.z; // Distance from camera
            gl_Position = projectionMatrix * viewPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uGridSize;
          uniform float uSpeed;
          uniform float uFogNear;
          uniform float uFogFar;

          varying vec2 vUv;
          varying float vDistance;

          void main() {
            // Scrolling effect
            vec2 pos = vUv * uGridSize;
            pos.y += uTime * uSpeed;

            // Grid lines
            // Using smoothstep for anti-aliased lines
            vec2 grid = abs(fract(pos - 0.5) - 0.5) / fwidth(pos);
            float line = min(grid.x, grid.y);
            float strength = 1.0 - min(line, 1.0);

            // Distance fade (Fog)
            float fogFactor = smoothstep(uFogFar, uFogNear, vDistance);

            // Final alpha
            float alpha = strength * uOpacity * fogFactor;

            // Discard fully transparent pixels
            if (alpha < 0.01) discard;

            gl_FragColor = vec4(uColor, alpha);
          }
        `,
      });

      this.mesh = new this.THREE.Mesh(geometry, material);
      this.mesh.rotation.x = -Math.PI / 2; // Lie flat
      this.mesh.position.y = CONFIG.GRID.Y_POS;

      this.scene.add(this.mesh);
      this.active = true;
      log.info('Cyber-Grid initialized');
    } catch (err) {
      log.error('Failed to init grid', err);
    }
  }

  /**
   * Update animation loop
   * @param {number} time - Total elapsed time in seconds
   * @param {number} delta - Time since last frame
   */
  update(time, delta) {
    if (!this.active || !this.mesh) return;

    // Update time uniform for scrolling
    this.mesh.material.uniforms.uTime.value = time;

    // Smooth opacity transition (Frame-rate independent)
    if (Math.abs(this.opacity - this.targetOpacity) > 0.001) {
      const factor = Math.min(delta * CONFIG.GRID.FADE_SPEED * 60, 1.0);
      this.opacity += (this.targetOpacity - this.opacity) * factor;
      this.mesh.material.uniforms.uOpacity.value = this.opacity;
      this.mesh.visible = this.opacity > 0.001;
    }
  }

  /**
   * Fade grid in
   */
  show() {
    this.targetOpacity = CONFIG.GRID.OPACITY;
  }

  /**
   * Fade grid out
   */
  hide() {
    this.targetOpacity = 0;
  }

  cleanup() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
    this.active = false;
  }
}
