/**
 * Three.js Earth System - Orchestrator
 * Modularized architecture for better maintainability.
 * @version 11.0.0 - REFACTOR: Pure WebGL Implementation
 */

import {createLogger, getElementById, onResize, TimerManager} from '../../utils/shared-utilities.js'
import {
  getSharedState,
  loadThreeJS,
  registerParticleSystem,
  unregisterParticleSystem,
  sharedCleanupManager,
  sharedParallaxManager
} from './shared-particle-system.js'

import {CONFIG} from './earth/config.js'
import {setupScene, setupLighting, createAtmosphere} from './earth/scene.js'
import {createEarthSystem, createMoonSystem, createCloudLayer} from './earth/assets.js'
import {CameraManager} from './earth/camera.js'
import {StarManager, ShootingStarManager} from './earth/stars.js'
import {CardManager} from './earth/cards.js'
import {showErrorState, PerformanceMonitor} from './earth/ui.js'

const log = createLogger('ThreeEarthSystem')
const earthTimers = new TimerManager()

// Global instances for this module scope
let scene, camera, renderer, THREE_INSTANCE
let earthMesh, moonMesh, cloudMesh
let dayMaterial, nightMaterial
let directionalLight, ambientLight

// Sub-systems
let cameraManager, starManager, shootingStarManager, performanceMonitor, cardManager

// State
let sectionObserver, viewportObserver, animationFrameId
let currentSection = 'hero'
let currentQualityLevel = 'HIGH'
let isMobileDevice = false
let isSystemVisible = true
let deviceCapabilities = null

// Flag to prevent zombie execution after cleanup
let isSystemActive = false

// ===== Main Manager =====

const ThreeEarthManager = (() => {
  const initThreeEarth = async () => {
    const sharedState = getSharedState()
    if (sharedState.systems.has('three-earth')) {
      log.debug('System already initialized')
      return cleanup
    }

    const container = getElementById('threeEarthContainer')
    if (!container) {
      log.warn('Container not found')
      return () => {}
    }

    // Set Active Flag
    isSystemActive = true

    try {
      log.info('Initializing Three.js Earth System v11.0.0 (Pure WebGL)')

      // Device Detection & optimized config
      try {
        deviceCapabilities = detectDeviceCapabilities()
        const optimizedConfig = getOptimizedConfig(deviceCapabilities)
        Object.assign(CONFIG, optimizedConfig)
      } catch (e) {
        log.debug('Device detection failed, using defaults', e)
      }

      registerParticleSystem('three-earth', {type: 'three-earth'})

      // Register as a potentially blocking module while initializing
      try {
        AppLoadManager.block('three-earth')
      } catch {
        /* ignore */
      }

      // Watchdog: if Three.js doesn't load within this time, unblock to avoid blocking page loader
      const THREE_LOAD_WATCH = 8000
      let threeLoadWatchTimer = null
      try {
        threeLoadWatchTimer = earthTimers.setTimeout(() => {
          if (!THREE_INSTANCE) {
            log.warn('Three.js load taking too long — unblocking three-earth to avoid blocking global loader')
            try {
              AppLoadManager.unblock('three-earth')
            } catch {
              /* ignore */
            }
            try {
              showErrorState(container, new Error('Three.js load timeout'), () => {
                cleanup()
                initThreeEarth()
              })
            } catch {
              /* ignore */
            }
          }
        }, THREE_LOAD_WATCH)
      } catch {
        /* ignore */
      }

      // Load Three.js
      THREE_INSTANCE = await loadThreeJS()

      // Clear watchdog if load completed
      try {
        if (threeLoadWatchTimer) earthTimers.clearTimeout(threeLoadWatchTimer)
      } catch {
        /* ignore */
      }

      // CRITICAL CHECK: Did cleanup happen while awaiting ThreeJS?
      if (!isSystemActive) return cleanup

      // Loading UI removed — set non-visual diagnostic flag for external UIs
      if (container) container.dataset.threeEarthLoading = 'true'

      // Scene Setup
      isMobileDevice = !!deviceCapabilities?.isMobile || window.matchMedia('(max-width: 768px)').matches

      const sceneObjects = setupScene(THREE_INSTANCE, container)
      scene = sceneObjects.scene
      camera = sceneObjects.camera
      renderer = sceneObjects.renderer

      if (renderer && CONFIG.PERFORMANCE?.PIXEL_RATIO) {
        renderer.setPixelRatio(CONFIG.PERFORMANCE.PIXEL_RATIO)
      }

      const loadingManager = new THREE_INSTANCE.LoadingManager()
      loadingManager.onProgress = (_url, _itemsLoaded, _itemsTotal) => {
        if (!isSystemActive) return
        if (container) container.dataset.threeEarthLoading = 'true'
      }

      loadingManager.onLoad = () => {
        if (!isSystemActive) return
        try {
          AppLoadManager.unblock('three-earth')
        } catch {
          /* ignore */
        }
        if (container) delete container.dataset.threeEarthLoading
      }

      loadingManager.onError = url => {
        log.warn('Error loading texture:', url)
        try {
          AppLoadManager.unblock('three-earth')
        } catch {
          /* ignore */
        }
      }

      // Stars
      starManager = new StarManager(THREE_INSTANCE, scene, camera, renderer)
      const starField = starManager.createStarField()
      const parallaxHandler = progress => {
        if (!starField || !starManager || (starManager.transition && starManager.transition.active)) return
        starField.rotation.y = progress * Math.PI * 0.2
        starField.position.z = Math.sin(progress * Math.PI) * 15
      }
      sharedParallaxManager.addHandler(parallaxHandler, 'three-earth-stars')

      // Lighting
      const lights = setupLighting(THREE_INSTANCE, scene)
      directionalLight = lights.directionalLight
      ambientLight = lights.ambientLight

      // Assets Loading
      const [earthAssets, moonLOD, cloudObj] = await Promise.all([
        createEarthSystem(THREE_INSTANCE, scene, renderer, isMobileDevice, loadingManager),
        createMoonSystem(THREE_INSTANCE, scene, renderer, isMobileDevice, loadingManager),
        createCloudLayer(THREE_INSTANCE, renderer, loadingManager, isMobileDevice)
      ])

      // CRITICAL CHECK
      if (!isSystemActive) {
        if (earthAssets.dayMaterial) earthAssets.dayMaterial.dispose()
        return cleanup
      }

      earthMesh = earthAssets.earthMesh
      dayMaterial = earthAssets.dayMaterial
      nightMaterial = earthAssets.nightMaterial
      moonMesh = moonLOD
      cloudMesh = cloudObj

      // Final Scene Assembly
      if (cloudMesh) {
        cloudMesh.position.copy(earthMesh.position)
        cloudMesh.scale.copy(earthMesh.scale)
        scene.add(cloudMesh)
      }

      const atmosphereMesh = createAtmosphere(THREE_INSTANCE, isMobileDevice)
      earthMesh.add(atmosphereMesh)

      // Managers
      cameraManager = new CameraManager(THREE_INSTANCE, camera)
      cameraManager.setupCameraSystem()

      const onWheel = e => {
        if (cameraManager && isSystemActive) cameraManager.handleWheel(e)
      }
      container.addEventListener('wheel', onWheel, {passive: true})
      sharedCleanupManager.addCleanupFunction('three-earth', () => container.removeEventListener('wheel', onWheel), 'wheel control')
      setupSectionDetection()
      setupViewportObserver(container)

      // Mark system as active for CSS
      document.body.classList.add('three-earth-active')

      performanceMonitor = new PerformanceMonitor(container, renderer, level => {
        currentQualityLevel = level
        const levelCfg = CONFIG.QUALITY_LEVELS[currentQualityLevel]
        if (cloudMesh) cloudMesh.visible = levelCfg.cloudLayer
        if (shootingStarManager) shootingStarManager.disabled = !levelCfg.meteorShowers
        try {
          if (renderer && CONFIG.PERFORMANCE?.PIXEL_RATIO) {
            renderer.setPixelRatio(CONFIG.PERFORMANCE.PIXEL_RATIO)
          }
        } catch (e) {
          log.debug('Unable to set PIXEL_RATIO during quality apply', e)
        }
      })

      shootingStarManager = new ShootingStarManager(scene, THREE_INSTANCE)

      // Cards (Pure WebGL)
      cardManager = new CardManager(THREE_INSTANCE, scene, camera, renderer)

      // Listen for dynamic section loading to init cards (read DOM for content)
      const onSectionLoaded = e => {
        if (e.detail?.id === 'features' && cardManager) {
          cardManager.initFromDOM(e.detail.section)
        }
      }
      document.addEventListener('section:loaded', onSectionLoaded)
      sharedCleanupManager.addCleanupFunction(
        'three-earth',
        () => document.removeEventListener('section:loaded', onSectionLoaded),
        'section listener'
      )

      // Check if already loaded
      const featuresSection = document.getElementById('features')
      if (featuresSection && featuresSection.dataset.state === 'loaded') {
        cardManager.initFromDOM(featuresSection)
      }

      // Start Loops
      startAnimationLoop()
      setupResizeHandler()
      setupInteraction()

      log.info('Initialization complete')
      return cleanup
    } catch (error) {
      log.error('Initialization failed:', error)
      try {
        if (renderer) renderer.dispose()
      } catch {
        /* ignore */
      }
      sharedCleanupManager.cleanupSystem('three-earth')
      showErrorState(container, error, () => {
        cleanup()
        initThreeEarth()
      })
      return () => {}
    }
  }

  const cleanup = () => {
    isSystemActive = false
    log.info('Cleaning up Earth system')

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    document.removeEventListener('visibilitychange', handleVisibilityChange)

    performanceMonitor?.cleanup()
    shootingStarManager?.cleanup()
    cameraManager?.cleanup()
    starManager?.cleanup()
    sectionObserver?.disconnect()
    viewportObserver?.disconnect()
    earthTimers.clearAll()
    sharedCleanupManager.cleanupSystem('three-earth')

    if (scene) {
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => disposeMaterial(m))
          } else {
            disposeMaterial(obj.material)
          }
        }
      })
      scene.clear()
    }

    if (renderer) {
      renderer.dispose()
    }

    ;[dayMaterial, nightMaterial].forEach(disposeMaterial)

    scene = camera = renderer = null
    earthMesh = moonMesh = cloudMesh = null
    dayMaterial = nightMaterial = null
    directionalLight = ambientLight = null

    if (cardManager) cardManager.cleanup()
    cardManager = starManager = shootingStarManager = performanceMonitor = null
    cameraManager = null

    unregisterParticleSystem('three-earth')
    document.body.classList.remove('three-earth-active')
    log.info('Cleanup complete')
  }

  function disposeMaterial(material) {
    if (!material) return
    const textureProps = ['map', 'normalMap', 'bumpMap', 'envMap', 'emissiveMap', 'alphaMap']
    textureProps.forEach(prop => {
      if (material[prop]?.dispose) {
        material[prop].dispose()
        material[prop] = null
      }
    })
    if (material.uniforms) {
      Object.values(material.uniforms).forEach(uniform => {
        if (uniform && uniform.value && typeof uniform.value.dispose === 'function') {
          uniform.value.dispose()
        }
      })
    }
    material.dispose()
  }

  return {initThreeEarth, cleanup}
})()

// ===== Helpers =====

function detectDeviceCapabilities() {
  try {
    const ua = (navigator.userAgent || '').toLowerCase()
    const isMobile = /mobile|tablet|android|ios|iphone|ipad/i.test(ua)
    const isLowEnd = /android 4|android 5|cpu iphone os 9|cpu iphone os 10/i.test(ua) || (navigator.hardwareConcurrency || 4) <= 2
    return {isMobile, isLowEnd, recommendedQuality: isLowEnd ? 'LOW' : isMobile ? 'MEDIUM' : 'HIGH'}
  } catch {
    return {isMobile: false, isLowEnd: false, recommendedQuality: 'MEDIUM'}
  }
}

function getOptimizedConfig(capabilities) {
  if (!capabilities) return {}
  if (capabilities.isLowEnd) {
    return {
      EARTH: {...CONFIG.EARTH, SEGMENTS: 24, SEGMENTS_MOBILE: 16},
      STARS: {...CONFIG.STARS, COUNT: 1000},
      PERFORMANCE: {...CONFIG.PERFORMANCE, PIXEL_RATIO: 1.0, TARGET_FPS: 30},
      CLOUDS: {...CONFIG.CLOUDS, OPACITY: 0}
    }
  }
  if (capabilities.isMobile) {
    return {
      EARTH: {...CONFIG.EARTH, SEGMENTS_MOBILE: 32},
      STARS: {...CONFIG.STARS, COUNT: 2000},
      PERFORMANCE: {...CONFIG.PERFORMANCE, PIXEL_RATIO: Math.min(window.devicePixelRatio || 1, 2.0)}
    }
  }
  return {}
}

function setupSectionDetection() {
  const sections = Array.from(document.querySelectorAll('section[id], div#footer-trigger-zone'))
  if (sections.length === 0) return

  const mapId = id => (id === 'footer-trigger-zone' ? 'site-footer' : id)
  const OBSERVER_THRESHOLDS = Array.from({length: 21}, (_, i) => i / 20)

  sectionObserver = new IntersectionObserver(
    entries => {
      let best = null
      for (const entry of entries) {
        if (!best || entry.intersectionRatio > best.intersectionRatio) {
          best = entry
        }
      }

      if (!best || !best.isIntersecting) return

      // Sync feature cards entrance progress to how much the section intersects
      if (best.target.id === 'features' && cardManager) {
        cardManager.setProgress(best.intersectionRatio || 0)
      }

      const newSection = mapId(best.target.id || '')
      if (!newSection) return

      if (newSection !== currentSection) {
        const previousSection = currentSection
        currentSection = newSection

        if (cameraManager) cameraManager.updateCameraForSection(newSection)

        const isFeaturesToAbout = previousSection === 'features' && newSection === 'about'
        updateEarthForSection(newSection, {allowModeSwitch: isFeaturesToAbout})

        if (newSection === 'features') {
          if (cardManager) cardManager.setProgress(1)
        } else {
          if (previousSection === 'features') {
            if (cardManager) cardManager.setProgress(0)
          }
        }

        const container = document.querySelector('.three-earth-container')
        if (container) container.setAttribute('data-section', newSection)
      }
    },
    {rootMargin: '-20% 0px -20% 0px', threshold: OBSERVER_THRESHOLDS}
  )

  sections.forEach(section => sectionObserver.observe(section))
}

function setupViewportObserver(container) {
  viewportObserver = new IntersectionObserver(
    entries => {
      const entry = entries[0]
      isSystemVisible = entry.isIntersecting
      if (isSystemVisible) {
        if (!animationFrameId && animate) {
          log.debug('Container visible: resuming render loop')
          animate()
        }
      } else {
        if (animationFrameId) {
          log.debug('Container hidden: pausing render loop')
          cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }
      }
    },
    {threshold: 0}
  )
  viewportObserver.observe(container)
}

function updateEarthForSection(sectionName, options = {}) {
  if (!earthMesh || !isSystemActive) return
  const allowModeSwitch = !!options.allowModeSwitch
  const configs = {
    hero: {earth: {pos: {x: 1, y: -2.5, z: -1}, scale: 1.3, rotation: 0}, moon: {pos: {x: -45, y: -45, z: -90}, scale: 0.4}, mode: 'day'},
    features: {earth: {pos: {x: -7, y: -2, z: -4}, scale: 0.7, rotation: 0}, moon: {pos: {x: 1, y: 2, z: -5}, scale: 1.1}, mode: 'day'},
    about: {
      earth: {pos: {x: -1, y: -0.5, z: -1}, scale: 1.0, rotation: Math.PI},
      moon: {pos: {x: -45, y: -45, z: -90}, scale: 0.4},
      mode: 'night'
    },
    contact: {
      earth: {pos: {x: 0, y: -1.5, z: 0}, scale: 1.1, rotation: Math.PI / 2},
      moon: {pos: {x: -45, y: -45, z: -90}, scale: 0.4},
      mode: 'day'
    }
  }
  const config = configs[sectionName === 'site-footer' ? 'contact' : sectionName] || configs.hero

  earthMesh.userData.targetPosition = new THREE_INSTANCE.Vector3(config.earth.pos.x, config.earth.pos.y, config.earth.pos.z)
  earthMesh.userData.targetScale = config.earth.scale
  earthMesh.userData.targetRotation = config.earth.rotation

  if (moonMesh && config.moon) {
    moonMesh.userData.targetPosition = new THREE_INSTANCE.Vector3(config.moon.pos.x, config.moon.pos.y, config.moon.pos.z)
    moonMesh.userData.targetScale = config.moon.scale
  }

  if (allowModeSwitch) {
    const newMode = earthMesh.userData.currentMode === 'night' ? 'day' : 'night'
    earthMesh.material = newMode === 'day' ? dayMaterial : nightMaterial
    earthMesh.material.needsUpdate = true
    earthMesh.userData.currentMode = newMode
    if (cameraManager) cameraManager.setTargetOrbitAngle(newMode === 'day' ? 0 : Math.PI)
  }

  if (directionalLight && ambientLight) {
    const mode = earthMesh.userData.currentMode
    const lightingConfig = mode === 'day' ? CONFIG.LIGHTING.DAY : CONFIG.LIGHTING.NIGHT
    directionalLight.intensity = lightingConfig.SUN_INTENSITY
    ambientLight.intensity = lightingConfig.AMBIENT_INTENSITY
    ambientLight.color.setHex(lightingConfig.AMBIENT_COLOR)
  }
}

// Global Animation Loop Reference
let animate

function handleVisibilityChange() {
  if (document.hidden) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  } else {
    if (!animationFrameId && animate && isSystemVisible && isSystemActive) {
      animate()
    }
  }
}

function startAnimationLoop() {
  const clock = new THREE_INSTANCE.Clock()
  const capabilities = deviceCapabilities || detectDeviceCapabilities()
  const frameSkip = capabilities.isLowEnd ? 2 : 1
  let frameCounter = 0

  animate = () => {
    if (!isSystemActive) return
    animationFrameId = requestAnimationFrame(animate)
    frameCounter++

    if (frameCounter % frameSkip !== 0) return

    const elapsedTime = clock.getElapsedTime()

    if (cloudMesh && frameCounter % 2 === 0) {
      cloudMesh.rotation.y += CONFIG.CLOUDS.ROTATION_SPEED
    }
    if (moonMesh && frameCounter % 3 === 0) {
      moonMesh.rotation.y += CONFIG.MOON.ORBIT_SPEED
    }
    if (starManager && !capabilities.isLowEnd) starManager.update(elapsedTime)

    if (earthMesh?.userData.currentMode === 'night' && !capabilities.isLowEnd && frameCounter % 2 === 0) {
      const baseIntensity = CONFIG.EARTH.EMISSIVE_INTENSITY * 4.0
      const pulseAmount = Math.sin(elapsedTime * CONFIG.EARTH.EMISSIVE_PULSE_SPEED) * CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE * 2
      if (earthMesh.material) earthMesh.material.emissiveIntensity = baseIntensity + pulseAmount
    }

    if (cameraManager) cameraManager.updateCameraPosition()
    updateObjectTransforms()

    // Card update (Raycasting restored via window.lastMousePos)
    if (cardManager && window.lastMousePos) {
      cardManager.update(elapsedTime * 1000, window.lastMousePos)
    }

    if (shootingStarManager && !capabilities.isLowEnd) shootingStarManager.update()
    if (performanceMonitor) performanceMonitor.update()

    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  if (document.visibilityState === 'visible') animate()
}

function setupInteraction() {
  window.lastMousePos = new THREE_INSTANCE.Vector2(-999, -999) // Default off-screen

  const onMove = event => {
    if (!isSystemActive) return
    window.lastMousePos.x = (event.clientX / window.innerWidth) * 2 - 1
    window.lastMousePos.y = -(event.clientY / window.innerHeight) * 2 + 1
  }

  const onClick = event => {
    if (!isSystemActive || !cardManager) return
    const mouse = new THREE_INSTANCE.Vector2()
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    cardManager.handleClick(mouse)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('click', onClick)

  sharedCleanupManager.addCleanupFunction(
    'three-earth',
    () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('click', onClick)
    },
    'interaction'
  )
}

function updateObjectTransforms() {
  if (!earthMesh) return
  if (earthMesh.userData.targetPosition) earthMesh.position.lerp(earthMesh.userData.targetPosition, 0.04)
  if (earthMesh.userData.targetScale) {
    earthMesh.scale.x += (earthMesh.userData.targetScale - earthMesh.scale.x) * 0.06
    earthMesh.scale.y = earthMesh.scale.z = earthMesh.scale.x
  }
  if (earthMesh.userData.targetRotation !== undefined) {
    const rotDiff = earthMesh.userData.targetRotation - earthMesh.rotation.y
    if (Math.abs(rotDiff) > 0.001) earthMesh.rotation.y += rotDiff * 0.06
  }
  if (cloudMesh && earthMesh) {
    cloudMesh.position.copy(earthMesh.position)
    cloudMesh.scale.copy(earthMesh.scale)
  }
  if (moonMesh) {
    if (moonMesh.userData.targetPosition) moonMesh.position.lerp(moonMesh.userData.targetPosition, 0.04)
    if (moonMesh.userData.targetScale) {
      moonMesh.scale.x += (moonMesh.userData.targetScale - moonMesh.scale.x) * 0.06
      moonMesh.scale.y = moonMesh.scale.z = moonMesh.scale.x
    }
  }
}

function setupResizeHandler() {
  const handleResize = () => {
    const container = getElementById('threeEarthContainer')
    if (!container || !camera || !renderer) return
    const width = container.clientWidth
    const height = container.clientHeight
    isMobileDevice = window.matchMedia('(max-width: 768px)').matches

    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)

    if (starManager) starManager.handleResize(width, height)
  }
  const resizeCleanup = onResize(handleResize, 100)
  sharedCleanupManager.addCleanupFunction('three-earth', resizeCleanup, 'resize handler')
}

// ===== Public API =====

export const {initThreeEarth, cleanup} = ThreeEarthManager
export const EarthSystemAPI = {
  flyToPreset: presetName => {
    if (cameraManager) cameraManager.flyToPreset(presetName)
  },
  triggerMeteorShower: () => {
    shootingStarManager?.triggerShower()
  },
  getConfig: () => CONFIG,
  updateConfig: updates => {
    Object.assign(CONFIG, updates)
  },
  get shootingStarManager() {
    return shootingStarManager
  }
}
export default ThreeEarthManager
export {detectDeviceCapabilities, getOptimizedConfig}
