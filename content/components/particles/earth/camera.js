import {CONFIG} from './config.js'
import {createLogger, TimerManager} from '../../../utils/shared-utilities.js'

const log = createLogger('EarthCamera')
const earthTimers = new TimerManager()

export class CameraManager {
  constructor(THREE, camera) {
    this.THREE = THREE
    this.camera = camera
    this.cameraTarget = {x: 0, y: 0, z: 10}
    this.cameraPosition = {x: 0, y: 0, z: 10}
    this.mouseState = {zoom: 10}
    this.cameraOrbitAngle = 0
    this.targetOrbitAngle = 0
    this.cameraTransition = null
  }

  setupCameraSystem() {
    this.updateCameraForSection('hero')
  }

  updateCameraForSection(sectionName) {
    // Map certain section ids to existing preset keys
    const presetKey = sectionName === 'site-footer' ? 'contact' : sectionName === 'section3' ? 'about' : sectionName
    const preset = CONFIG.CAMERA.PRESETS[presetKey]
    if (preset) {
      this.flyToPreset(presetKey)
    } else {
      log.warn(`No preset for '${sectionName}', using hero`)
      this.flyToPreset('hero')
    }
  }

  flyToPreset(presetName) {
    const preset = CONFIG.CAMERA.PRESETS[presetName]
    if (!preset) return

    if (this.cameraTransition) {
      earthTimers.clearTimeout(this.cameraTransition)
      this.cameraTransition = null
    }

    const startPos = {...this.cameraTarget}
    const startZoom = this.mouseState.zoom
    const startLookAt = this.camera.userData.currentLookAt || new this.THREE.Vector3(0, 0, 0)
    const endLookAt = new this.THREE.Vector3(preset.lookAt.x, preset.lookAt.y, preset.lookAt.z)

    const duration = CONFIG.CAMERA.TRANSITION_DURATION * 1000
    const startTime = performance.now()

    const transitionStep = () => {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = progress < 0.5 ? 8 * progress * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 4) / 2

      this.cameraTarget.x = startPos.x + (preset.x - startPos.x) * eased
      this.cameraTarget.y = startPos.y + (preset.y - startPos.y) * eased
      this.mouseState.zoom = startZoom + (preset.z - startZoom) * eased

      if (this.camera) {
        const blendedLookAt = new this.THREE.Vector3().lerpVectors(startLookAt, endLookAt, eased)
        this.camera.lookAt(blendedLookAt)
        this.camera.userData.currentLookAt = blendedLookAt.clone()
      }

      if (progress < 1) {
        this.cameraTransition = earthTimers.setTimeout(transitionStep, 16)
      } else {
        this.cameraTransition = null
        if (this.camera) this.camera.userData.currentLookAt = endLookAt.clone()
      }
    }

    transitionStep()
  }

  updateCameraPosition() {
    const lerpFactor = CONFIG.CAMERA.LERP_FACTOR
    const angleDiff = this.targetOrbitAngle - this.cameraOrbitAngle
    const progress = Math.min(Math.abs(angleDiff) / Math.PI, 1)
    const eased = 1 - Math.pow(1 - progress, 4)
    const easingFactor = 0.06 + eased * 0.12

    this.cameraOrbitAngle += angleDiff * easingFactor

    const radius = this.mouseState.zoom
    const finalX = this.cameraTarget.x + Math.sin(this.cameraOrbitAngle) * radius * 0.75
    const finalY = this.cameraTarget.y
    const finalZ = Math.cos(this.cameraOrbitAngle) * radius

    this.cameraPosition.x += (finalX - this.cameraPosition.x) * lerpFactor
    this.cameraPosition.y += (finalY - this.cameraPosition.y) * lerpFactor
    this.cameraPosition.z += (finalZ - this.cameraPosition.z) * lerpFactor
    this.camera.position.set(this.cameraPosition.x, this.cameraPosition.y, this.cameraPosition.z)

    const currentLookAt = this.camera.userData.currentLookAt || new this.THREE.Vector3(0, 0, 0)
    this.camera.lookAt(currentLookAt)
  }

  handleWheel(e) {
    this.mouseState.zoom -= e.deltaY * 0.01
    this.mouseState.zoom = Math.max(CONFIG.CAMERA.ZOOM_MIN, Math.min(CONFIG.CAMERA.ZOOM_MAX, this.mouseState.zoom))
  }

  setTargetOrbitAngle(angle) {
    this.targetOrbitAngle = angle
  }

  cleanup() {
    earthTimers.clearAll()
    if (this.cameraTransition) {
      clearTimeout(this.cameraTransition)
      this.cameraTransition = null
    }
  }
}
