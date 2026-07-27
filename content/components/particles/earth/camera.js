import { CONFIG } from "./config.js";
import { createLogger } from "../../../core/logger.js";

const log = createLogger("EarthCamera");
const lerp = (start, end, amount) => start + (end - start) * amount;
const smootherstep = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export class CameraManager {
  constructor(THREE, camera) {
    this.THREE = THREE;
    this.camera = camera;
    this.cameraTarget = { x: 0, y: 0, z: 10 };
    this.cameraPosition = { x: 0, y: 0, z: 10 };
    this.mouseState = { zoom: 10 };
    this.cameraOrbitAngle = 0;
    this.targetOrbitAngle = 0;
    this.scrollLinkedActive = false;

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
      startFov: CONFIG.CAMERA.FOV,
      endFov: CONFIG.CAMERA.FOV,
    };

    this._vLookAt = new this.THREE.Vector3();
    this._vCurrentLookAt = new this.THREE.Vector3();
  }

  setupCameraSystem() {
    this.updateCameraForSection("hero");
  }

  updateCameraForSection(sectionName) {
    if (sectionName !== "hero" && sectionName !== "features") {
      this.scrollLinkedActive = false;
    }
    const preset = CONFIG.CAMERA.PRESETS[sectionName];
    if (preset) {
      this.flyToPreset(sectionName);
    } else {
      log.warn(`No preset for '${sectionName}', using hero`);
      this.flyToPreset("hero");
    }
  }

  flyToPreset(presetName) {
    const preset = CONFIG.CAMERA.PRESETS[presetName];
    if (!preset) return;

    if (presetName === "features") {
      this.cameraOrbitAngle = 0;
      this.targetOrbitAngle = 0;
    }

    this.transition.active = true;
    this.transition.startTime = performance.now();
    this.transition.duration = CONFIG.CAMERA.TRANSITION_DURATION * 1000;

    this.transition.startPos = { ...this.cameraTarget };
    this.transition.startZoom = this.mouseState.zoom;
    this.transition.startLookAt = this.camera.userData.currentLookAt
      ? this.camera.userData.currentLookAt.clone()
      : new this.THREE.Vector3(0, 0, 0);

    this.transition.endPos = { x: preset.x, y: preset.y };
    this.transition.presetZ = preset.z;
    this.transition.startFov = this.camera.fov;
    this.transition.endFov = preset.fov ?? CONFIG.CAMERA.FOV;
    this.transition.endLookAt = new this.THREE.Vector3(
      preset.lookAt.x,
      preset.lookAt.y,
      preset.lookAt.z
    );
  }

  setScrollLinkedPresetProgress(startName, endName, progress) {
    const start = CONFIG.CAMERA.PRESETS[startName];
    const end = CONFIG.CAMERA.PRESETS[endName];
    if (!start || !end) return;

    const p = Math.max(0, Math.min(1, progress));
    const isHeroPerspectiveMove = startName === "hero" && endName === "features";
    const perspectiveArc = isHeroPerspectiveMove ? Math.sin(Math.PI * p) : 0;
    this.transition.active = false;
    this.scrollLinkedActive = true;
    this.cameraTarget.x = lerp(start.x, end.x, p) + perspectiveArc * 0.52;
    this.cameraTarget.y = lerp(start.y, end.y, p) + perspectiveArc * 0.18;
    this.mouseState.zoom = lerp(start.z, end.z, p);
    this.camera.fov = lerp(start.fov ?? CONFIG.CAMERA.FOV, end.fov ?? CONFIG.CAMERA.FOV, p);
    this.camera.updateProjectionMatrix();
    this._vLookAt.set(
      lerp(start.lookAt.x, end.lookAt.x, p) - perspectiveArc * 0.16,
      lerp(start.lookAt.y, end.lookAt.y, p) - perspectiveArc * 0.08,
      lerp(start.lookAt.z, end.lookAt.z, p)
    );
    if (!this.camera.userData.currentLookAt) {
      this.camera.userData.currentLookAt = new this.THREE.Vector3();
    }
    this.camera.userData.currentLookAt.copy(this._vLookAt);
  }

  updateCameraPosition(delta = 0.016) {
    const transitionWasActive = this.transition.active;
    if (this.transition.active) {
      const elapsed = performance.now() - this.transition.startTime;
      const progress = Math.min(elapsed / this.transition.duration, 1);
      const eased = smootherstep(progress);
      this.cameraTarget.x = lerp(this.transition.startPos.x, this.transition.endPos.x, eased);
      this.cameraTarget.y = lerp(this.transition.startPos.y, this.transition.endPos.y, eased);
      this.mouseState.zoom = lerp(this.transition.startZoom, this.transition.presetZ, eased);
      this._vLookAt.lerpVectors(this.transition.startLookAt, this.transition.endLookAt, eased);
      const nextFov = lerp(this.transition.startFov, this.transition.endFov, eased);
      if (Math.abs(this.camera.fov - nextFov) > 0.01) {
        this.camera.fov = nextFov;
        this.camera.updateProjectionMatrix();
      }

      if (this.camera) {
        this.camera.lookAt(this._vLookAt);
        if (!this.camera.userData.currentLookAt) {
          this.camera.userData.currentLookAt = new this.THREE.Vector3();
        }
        this.camera.userData.currentLookAt.copy(this._vLookAt);
      }

      if (progress >= 1) {
        this.transition.active = false;
        if (Number.isFinite(this.transition.endFov)) {
          this.camera.fov = this.transition.endFov;
          this.camera.updateProjectionMatrix();
        }
        if (this.camera && this.camera.userData.currentLookAt)
          this.camera.userData.currentLookAt.copy(this.transition.endLookAt);
      }
    }

    const timeScale = delta * 60;

    const angleDiff = this.targetOrbitAngle - this.cameraOrbitAngle;
    const orbitProgress = Math.min(Math.abs(angleDiff) / Math.PI, 1);
    const orbitEased = 1 - Math.pow(1 - orbitProgress, 4);

    const baseFactor = 0.06 + orbitEased * 0.12;
    const adjustedFactor = 1 - Math.pow(1 - baseFactor, timeScale);

    this.cameraOrbitAngle += angleDiff * adjustedFactor;

    const radius = this.mouseState.zoom;
    const finalX = this.cameraTarget.x + Math.sin(this.cameraOrbitAngle) * radius * 0.75;
    const finalY = this.cameraTarget.y;
    const finalZ = Math.cos(this.cameraOrbitAngle) * radius;

    if (transitionWasActive || this.scrollLinkedActive) {
      this.cameraPosition.x = finalX;
      this.cameraPosition.y = finalY;
      this.cameraPosition.z = finalZ;
    } else {
      const posLerpFactor = 1 - Math.pow(1 - CONFIG.CAMERA.LERP_FACTOR, timeScale);
      this.cameraPosition.x += (finalX - this.cameraPosition.x) * posLerpFactor;
      this.cameraPosition.y += (finalY - this.cameraPosition.y) * posLerpFactor;
      this.cameraPosition.z += (finalZ - this.cameraPosition.z) * posLerpFactor;
    }

    this.camera.position.set(this.cameraPosition.x, this.cameraPosition.y, this.cameraPosition.z);

    if (this.camera.userData.currentLookAt) {
      this.camera.lookAt(this.camera.userData.currentLookAt);
    } else {
      this._vCurrentLookAt.set(0, 0, 0);
      this.camera.lookAt(this._vCurrentLookAt);
    }
  }

  handleWheel(e) {
    this.mouseState.zoom -= e.deltaY * 0.01;
    this.mouseState.zoom = Math.max(
      CONFIG.CAMERA.ZOOM_MIN,
      Math.min(CONFIG.CAMERA.ZOOM_MAX, this.mouseState.zoom)
    );
  }

  setTargetOrbitAngle(angle) {
    this.targetOrbitAngle = angle;
  }

  cleanup() {
    this.transition.active = false;
  }
}
