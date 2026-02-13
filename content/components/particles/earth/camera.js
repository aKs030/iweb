import { CONFIG } from './config.js';
import { createLogger } from '../../../core/logger.js';

const log = createLogger('EarthCamera');

export class CameraManager {
  constructor(THREE, camera) {
    this.THREE = THREE;
    this.camera = camera;
    this.cameraTarget = { x: 0, y: 0, z: 10 };
    this.cameraPosition = { x: 0, y: 0, z: 10 };
    this.mouseState = { zoom: 10 };
    this.cameraOrbitAngle = 0;
    this.targetOrbitAngle = 0;

    // Transition state (replacing setTimeout)
    this.transition = {
      active: false,
      startTime: 0,
      duration: 0,
      startPos: null,
      startZoom: 0,
      startLookAt: null,
      endPos: null,
      endLookAt: null,
      presetZ: 0,
    };

    // Drag & Inertia State
    this.interaction = {
      isDragging: false,
      lastX: 0,
      velocityX: 0,
      autoRotateDelayTimer: 0,
      isAutoRotating: true,
      enabled: false,
    };

    // Bind handlers
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
  }

  setupCameraSystem() {
    this.updateCameraForSection('hero');
  }

  enableDragRotation(container) {
    if (this.interaction.enabled) return;
    this.container = container;
    container.style.touchAction = 'none'; // Prevent scrolling while dragging globe

    container.addEventListener('pointerdown', this.onPointerDown, {
      passive: false,
    });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointermove', this.onPointerMove, {
      passive: false,
    }); // Passive false needed if we want to prevent default

    this.interaction.enabled = true;
  }

  onPointerDown(e) {
    if (!this.interaction.enabled) return;
    this.interaction.isDragging = true;
    this.interaction.lastX = e.clientX;
    this.interaction.velocityX = 0;
    this.interaction.isAutoRotating = false;
    this.container.style.cursor = 'grabbing';

    // Stop any active transitions if user grabs
    // this.transition.active = false;
  }

  onPointerMove(e) {
    if (!this.interaction.isDragging) return;

    const deltaX = e.clientX - this.interaction.lastX;
    this.interaction.lastX = e.clientX;

    // Calculate velocity
    const sensitivity = CONFIG.INTERACTION?.DRAG_SENSITIVITY || 0.005;
    this.interaction.velocityX = deltaX * sensitivity;

    // Apply immediate rotation
    this.targetOrbitAngle -= this.interaction.velocityX;
    this.cameraOrbitAngle -= this.interaction.velocityX; // Direct mapping for responsiveness
  }

  onPointerUp() {
    if (!this.interaction.isDragging) return;
    this.interaction.isDragging = false;
    this.container.style.cursor = 'grab';

    // Start auto-rotate timer
    const delay = CONFIG.INTERACTION?.AUTO_ROTATE_DELAY || 3000;
    this.interaction.autoRotateDelayTimer = performance.now() + delay;
  }

  updateCameraForSection(sectionName) {
    // Map certain section ids to existing preset keys
    const presetKey =
      sectionName === 'site-footer' || sectionName === 'section4'
        ? 'contact'
        : sectionName === 'section3'
          ? 'about'
          : sectionName;
    const preset = CONFIG.CAMERA.PRESETS[presetKey];
    if (preset) {
      this.flyToPreset(presetKey);
    } else {
      log.warn(`No preset for '${sectionName}', using hero`);
      this.flyToPreset('hero');
    }
  }

  // New method for markers
  flyToCoordinates(lat, lon) {
    // Convert lat/lon to camera position or lookAt
    // Simplified: Rotate globe so lat/lon is in front
    // Longitude maps to rotation Y (orbit angle)

    // Reset auto-rotate
    this.interaction.isAutoRotating = false;
    this.interaction.autoRotateDelayTimer = performance.now() + 5000;

    // Calculate target angle
    // -Lon because rotation is counter-clockwise? Needs testing.
    // Normalized to 0..2PI
    const targetAngle = (lon * Math.PI) / 180;

    // Find shortest path
    // const current = this.targetOrbitAngle;
    // const target = targetAngle;

    // Normalize angles
    // ...implementation omitted for brevity, simple assignment for now
    this.targetOrbitAngle = targetAngle;
  }

  flyToPreset(presetName) {
    const preset = CONFIG.CAMERA.PRESETS[presetName];
    if (!preset) return;

    // Start transition
    this.transition.active = true;
    this.transition.startTime = performance.now(); // We will use accumulated time or performance.now
    this.transition.duration = CONFIG.CAMERA.TRANSITION_DURATION * 1000;

    this.transition.startPos = { ...this.cameraTarget };
    this.transition.startZoom = this.mouseState.zoom;
    this.transition.startLookAt = this.camera.userData.currentLookAt
      ? this.camera.userData.currentLookAt.clone()
      : new this.THREE.Vector3(0, 0, 0);

    this.transition.endPos = { x: preset.x, y: preset.y }; // z is zoom
    this.transition.presetZ = preset.z;
    this.transition.endLookAt = new this.THREE.Vector3(
      preset.lookAt.x,
      preset.lookAt.y,
      preset.lookAt.z,
    );
  }

  // UPDATED: Now accepts delta time for frame-rate independence
  updateCameraPosition(delta = 0.016) {
    // 1. Handle Active Transition (Priority High)
    if (this.transition.active) {
      const elapsed = performance.now() - this.transition.startTime;
      const progress = Math.min(elapsed / this.transition.duration, 1);

      const eased =
        progress < 0.5
          ? 8 * progress * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 4) / 2;

      // Interpolate Targets
      this.cameraTarget.x =
        this.transition.startPos.x +
        (this.transition.endPos.x - this.transition.startPos.x) * eased;
      this.cameraTarget.y =
        this.transition.startPos.y +
        (this.transition.endPos.y - this.transition.startPos.y) * eased;
      this.mouseState.zoom =
        this.transition.startZoom +
        (this.transition.presetZ - this.transition.startZoom) * eased;

      if (this.camera) {
        const blendedLookAt = new this.THREE.Vector3().lerpVectors(
          this.transition.startLookAt,
          this.transition.endLookAt,
          eased,
        );
        this.camera.lookAt(blendedLookAt);
        this.camera.userData.currentLookAt = blendedLookAt.clone();
      }

      if (progress >= 1) {
        this.transition.active = false;
        // Snap to final values to avoid floating point errors
        if (this.camera)
          this.camera.userData.currentLookAt =
            this.transition.endLookAt.clone();
      }
    }

    // 2. Handle Inertia & Drag
    if (
      !this.interaction.isDragging &&
      Math.abs(this.interaction.velocityX) > 0.0001
    ) {
      // Apply inertia
      this.targetOrbitAngle -= this.interaction.velocityX;

      const damping = CONFIG.INTERACTION?.INERTIA_DAMPING || 0.95;
      this.interaction.velocityX *= damping;

      // Force update to keep in sync
      // this.cameraOrbitAngle = this.targetOrbitAngle;
    }

    // 3. Auto Rotate Resume check
    if (!this.interaction.isDragging && !this.interaction.isAutoRotating) {
      if (
        Math.abs(this.interaction.velocityX) < 0.0001 &&
        performance.now() > this.interaction.autoRotateDelayTimer
      ) {
        this.interaction.isAutoRotating = true;
      }
    }

    // Note: If isAutoRotating is true, `targetOrbitAngle` is managed externally by `ThreeEarthSystem` or sections.
    // However, if we dragged, we offset `targetOrbitAngle`.
    // The existing code below lerps `cameraOrbitAngle` towards `targetOrbitAngle`.
    // So modifying `targetOrbitAngle` is the correct way to rotate the camera.

    // 4. Handle Orbit & Smoothing (Frame-Rate Independent)

    // Normalize delta to 60fps (approx 16.6ms)
    // If delta is 0.016, timeScale is 1. If delta is 0.033 (30fps), timeScale is 2.
    const timeScale = delta * 60;

    const angleDiff = this.targetOrbitAngle - this.cameraOrbitAngle;
    const orbitProgress = Math.min(Math.abs(angleDiff) / Math.PI, 1);
    const orbitEased = 1 - Math.pow(1 - orbitProgress, 4);

    // Original base factor was 0.06 + eased * 0.12 (approx 0.06 to 0.18) per 60hz frame
    const baseFactor = 0.06 + orbitEased * 0.12;

    // Frame-independent dampening: 1 - (1 - rate)^timeScale
    const adjustedFactor = 1 - Math.pow(1 - baseFactor, timeScale);

    this.cameraOrbitAngle += angleDiff * adjustedFactor;

    const radius = this.mouseState.zoom;
    const finalX =
      this.cameraTarget.x + Math.sin(this.cameraOrbitAngle) * radius * 0.75;
    const finalY = this.cameraTarget.y;
    const finalZ = Math.cos(this.cameraOrbitAngle) * radius;

    // Apply similar dampening to position lerp
    // Original: CONFIG.CAMERA.LERP_FACTOR (0.06)
    const posLerpFactor =
      1 - Math.pow(1 - CONFIG.CAMERA.LERP_FACTOR, timeScale);

    this.cameraPosition.x += (finalX - this.cameraPosition.x) * posLerpFactor;
    this.cameraPosition.y += (finalY - this.cameraPosition.y) * posLerpFactor;
    this.cameraPosition.z += (finalZ - this.cameraPosition.z) * posLerpFactor;

    this.camera.position.set(
      this.cameraPosition.x,
      this.cameraPosition.y,
      this.cameraPosition.z,
    );

    const currentLookAt =
      this.camera.userData.currentLookAt || new this.THREE.Vector3(0, 0, 0);
    this.camera.lookAt(currentLookAt);
  }

  handleWheel(e) {
    this.mouseState.zoom -= e.deltaY * 0.01;
    this.mouseState.zoom = Math.max(
      CONFIG.CAMERA.ZOOM_MIN,
      Math.min(CONFIG.CAMERA.ZOOM_MAX, this.mouseState.zoom),
    );
  }

  setTargetOrbitAngle(angle) {
    // Only allow external override if not dragging
    if (!this.interaction.isDragging) {
      this.targetOrbitAngle = angle;
    }
  }

  cleanup() {
    this.transition.active = false;
    if (this.interaction.enabled) {
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointermove', this.onPointerMove);
    }
  }
}
