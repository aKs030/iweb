import {CONFIG} from './config.js'
import {createLogger, getElementById} from '../../../utils/shared-utilities.js'

const log = createLogger('EarthStars')

export class StarManager {
  constructor(THREE, scene, camera, renderer) {
    this.THREE = THREE
    this.scene = scene
    this.camera = camera
    this.renderer = renderer
    this.starField = null
    this.isDisposed = false

    this.transition = {
      active: false,
      startTime: 0,
      duration: CONFIG.STARS.ANIMATION.DURATION,
      startValue: 0,
      targetValue: 0,
      rafId: null
    }

    this.isMobileDevice = window.matchMedia('(max-width: 768px)').matches
    this.scrollUpdateEnabled = false
    this.lastScrollUpdate = 0
    this.scrollUpdateThrottle = 150
    this.boundScrollHandler = null

    // Cache for resize calculations
    this.areStarsFormingCards = false

    // Virtual Camera for calculating stable target positions
    this.virtualCamera = new this.THREE.PerspectiveCamera(CONFIG.CAMERA.FOV, 1, CONFIG.CAMERA.NEAR, CONFIG.CAMERA.FAR)
  }

  createStarField() {
    if (this.isDisposed) return null

    const starCount = this.isMobileDevice ? CONFIG.STARS.COUNT / 2 : CONFIG.STARS.COUNT
    const positions = new Float32Array(starCount * 3)
    const targetPositions = new Float32Array(starCount * 3)
    const colors = new Float32Array(starCount * 3)
    const sizes = new Float32Array(starCount)
    const color = new this.THREE.Color()

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3
      const radius = 100 + Math.random() * 200
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      const x = radius * Math.sin(phi) * Math.cos(theta)
      const y = radius * Math.sin(phi) * Math.sin(theta)
      const z = radius * Math.cos(phi)

      positions[i3] = x
      positions[i3 + 1] = y
      positions[i3 + 2] = z

      targetPositions[i3] = x // Initialize target as current pos
      targetPositions[i3 + 1] = y
      targetPositions[i3 + 2] = z

      color.setHSL(Math.random() * 0.1 + 0.5, 0.8, 0.8 + Math.random() * 0.2)
      colors[i3] = color.r
      colors[i3 + 1] = color.g
      colors[i3 + 2] = color.b

      sizes[i] = Math.random() * 1.5 + 0.5
    }

    const starGeometry = new this.THREE.BufferGeometry()
    starGeometry.setAttribute('position', new this.THREE.BufferAttribute(positions, 3))
    starGeometry.setAttribute('aTargetPosition', new this.THREE.BufferAttribute(targetPositions, 3))
    starGeometry.setAttribute('color', new this.THREE.BufferAttribute(colors, 3))
    starGeometry.setAttribute('size', new this.THREE.BufferAttribute(sizes, 1))

    const starMaterial = new this.THREE.ShaderMaterial({
      uniforms: {
        time: {value: 0.0},
        twinkleSpeed: {value: CONFIG.STARS.TWINKLE_SPEED},
        uTransition: {value: 0.0}
      },
      vertexShader: `
        attribute float size;
        attribute vec3 aTargetPosition;
        uniform float uTransition;
        varying vec3 vColor;

        void main() {
          vColor = color;
          // Cubic ease-out for smoother arrival
          float t = uTransition;
          float ease = 1.0 - pow(1.0 - t, 3.0);

          vec3 currentPos = mix(position, aTargetPosition, ease);
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
      vertexColors: true
    })

    this.starField = new this.THREE.Points(starGeometry, starMaterial)
    this.scene.add(this.starField)

    return this.starField
  }

  // Handle resize to keep stars aligned with DOM elements
  handleResize(_width, _height) {
    if (this.areStarsFormingCards && !this.transition.active) {
      // Re-calculate using virtual camera to ensure stability
      const cardPositions = this.getCardPositions()
      if (cardPositions.length > 0) {
        this.updateTargetBuffer(cardPositions)
      }
    }
  }

  updateVirtualCamera() {
    if (!this.renderer || !this.virtualCamera) return

    // Ensure virtual camera matches current viewport aspect ratio
    const aspect = this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight
    this.virtualCamera.aspect = aspect
    this.virtualCamera.updateProjectionMatrix()

    // Set virtual camera to the "Features" preset destination
    // Logic must match CameraManager.updateCameraPosition for the 'features' preset (day mode/angle 0)
    const preset = CONFIG.CAMERA.PRESETS.features

    // In 'features' (Day mode), orbitAngle is 0
    // x = target.x + sin(0)*radius*0.75 = target.x
    // z = cos(0)*radius = radius

    const targetPos = new this.THREE.Vector3(
      preset.x,
      preset.y,
      preset.z // This serves as the radius/Z in the orbit logic
    )

    this.virtualCamera.position.copy(targetPos)

    const lookAtPos = new this.THREE.Vector3(
      preset.lookAt.x,
      preset.lookAt.y,
      preset.lookAt.z
    )
    this.virtualCamera.lookAt(lookAtPos)

    this.virtualCamera.updateMatrixWorld(true)
  }

  getCardPositions() {
    if (!this.virtualCamera || this.isDisposed) return []

    // Ensure virtual camera is up to date with screen size and target position
    this.updateVirtualCamera()

    const featuresSection = getElementById('features')
    if (!featuresSection) return []

    const cards = featuresSection.querySelectorAll('.card')
    if (cards.length === 0) return []

    const positions = []
    const width = this.renderer.domElement.clientWidth
    const height = this.renderer.domElement.clientHeight

    cards.forEach(card => {
      const rect = card.getBoundingClientRect()
      // Ensure element is actually somewhat visible/valid
      if (rect.width > 0 && rect.height > 0) {
        // Use virtual camera for projection
        const perimeterPositions = this.getCardPerimeterPositions(rect, width, height, -2, this.virtualCamera)
        positions.push(...perimeterPositions)
      }
    })

    return positions
  }

  getCardPerimeterPositions(rect, viewportWidth, viewportHeight, targetZ, camera) {
    const positions = []

    // VISUAL STYLE: Optimized Distribution & Jitter
    // We want a constant density of stars regardless of card size
    const perimeterLength = (rect.width + rect.height) * 2
    const starDensity = 0.6 // Stars per pixel (tune this for density)
    const totalStarsForCard = Math.floor(perimeterLength * starDensity)

    // Avoid having too many stars on one card if card is huge
    const maxStarsPerCard = this.isMobileDevice ? 400 : 800
    const finalStarCount = Math.min(totalStarsForCard, maxStarsPerCard)

    const screenToWorld = (x, y) => {
      // Standard NDC calculation
      const ndcX = (x / viewportWidth) * 2 - 1
      const ndcY = -((y / viewportHeight) * 2 - 1)
      const vector = new this.THREE.Vector3(ndcX, ndcY, 0)

      // Unproject using the VIRTUAL CAMERA
      vector.unproject(camera)

      const direction = vector.sub(camera.position).normalize()
      const distance = (targetZ - camera.position.z) / direction.z
      return camera.position.clone().add(direction.multiplyScalar(distance))
    }

    // Helper to interpolate along the perimeter
    const getPointOnPerimeter = (t) => {
        // t is 0..1 representing position along total perimeter (Top -> Right -> Bottom -> Left)
        const totalLen = (rect.width + rect.height) * 2
        const p = t * totalLen

        if (p < rect.width) {
            // Top edge
            return { x: rect.left + p, y: rect.top }
        } else if (p < rect.width + rect.height) {
            // Right edge
            return { x: rect.right, y: rect.top + (p - rect.width) }
        } else if (p < rect.width * 2 + rect.height) {
            // Bottom edge
            return { x: rect.right - (p - (rect.width + rect.height)), y: rect.bottom }
        } else {
            // Left edge
            return { x: rect.left, y: rect.bottom - (p - (rect.width * 2 + rect.height)) }
        }
    }

    for (let i = 0; i < finalStarCount; i++) {
        // Uniform distribution along perimeter
        const t = i / finalStarCount
        const point = getPointOnPerimeter(t)

        // VISUAL STYLE: Add random jitter for "magic dust" effect
        // Jitter should be in screen space to look consistent
        const jitterAmount = 4.0 // pixels
        const jX = (Math.random() - 0.5) * jitterAmount
        const jY = (Math.random() - 0.5) * jitterAmount

        const worldPos = screenToWorld(point.x + jX, point.y + jY)

        // Add slight depth variation for volumetric feel
        const zVar = (Math.random() - 0.5) * 0.15

        positions.push({
            x: worldPos.x,
            y: worldPos.y,
            z: targetZ + zVar
        })
    }

    return positions
  }

  animateStarsToCards() {
    if (!this.starField || this.isDisposed) return
    this.areStarsFormingCards = true

    const cards = document.querySelectorAll('#features .card')
    cards.forEach(card => {
      // Delay opacity change slightly to allow stars to arrive
      // card.style.opacity = '0'
      // Handled by updateCardOpacity
      card.style.pointerEvents = 'none'
    })

    const cardPositions = this.getCardPositions()
    if (cardPositions.length === 0) return

    this.updateTargetBuffer(cardPositions)
    this.startTransition(1.0)
    // No need for scroll updates if we use Virtual Camera (it's static relative to layout)!
    // Actually, we still need it if the user SCROLLS while in the section,
    // because the card DOM positions change on screen, so world positions must update.
    this.enableScrollUpdates()

    // Removed the setTimeout since Virtual Camera eliminates the drift wait time!
  }

  resetStarsToOriginal() {
    if (!this.starField || this.isDisposed) return
    this.areStarsFormingCards = false
    this.disableScrollUpdates()
    this.startTransition(0.0)
  }

  enableScrollUpdates() {
    if (this.scrollUpdateEnabled || this.isDisposed) return
    this.scrollUpdateEnabled = true
    this.boundScrollHandler = this.handleScroll.bind(this)
    window.addEventListener('scroll', this.boundScrollHandler, {passive: true})
  }

  disableScrollUpdates() {
    if (!this.scrollUpdateEnabled) return
    this.scrollUpdateEnabled = false
    if (this.boundScrollHandler) {
      window.removeEventListener('scroll', this.boundScrollHandler)
      this.boundScrollHandler = null
    }
  }

  handleScroll() {
    if (!this.scrollUpdateEnabled || this.isDisposed || this.transition.active) return

    const now = performance.now()
    if (now - this.lastScrollUpdate < this.scrollUpdateThrottle) return
    this.lastScrollUpdate = now

    // Recalculate using virtual camera to match new DOM positions
    const cardPositions = this.getCardPositions()
    if (cardPositions.length > 0) this.updateTargetBuffer(cardPositions)
  }

  updateTargetBuffer(cardPositions) {
    if (this.isDisposed || !this.starField) return

    const attr = this.starField.geometry.attributes.aTargetPosition
    const array = attr.array
    const count = array.length / 3
    const posCount = cardPositions.length

    if (posCount === 0) return

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      // Distribute stars evenly across available card positions
      const target = cardPositions[i % posCount]

      if (target) {
        array[i3] = target.x
        array[i3 + 1] = target.y
        array[i3 + 2] = target.z
      }
    }

    attr.needsUpdate = true
  }

  startTransition(targetValue) {
    if (this.isDisposed) return

    const current = this.starField.material.uniforms.uTransition.value
    if (Math.abs(current - targetValue) < 0.01) return

    this.transition.active = true
    this.transition.startTime = performance.now()
    this.transition.startValue = current
    this.transition.targetValue = targetValue

    if (this.transition.rafId) cancelAnimationFrame(this.transition.rafId)
    this.animateTransitionLoop()
  }

  animateTransitionLoop() {
    if (!this.transition.active || this.isDisposed) return

    const now = performance.now()
    const elapsed = now - this.transition.startTime
    const progress = Math.min(elapsed / this.transition.duration, 1)

    if (progress >= 1) this.transition.active = false

    // Standard easeInOutCubic
    const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

    if (this.starField && this.starField.material) {
      const val = this.transition.startValue + (this.transition.targetValue - this.transition.startValue) * eased
      this.starField.material.uniforms.uTransition.value = val
      this.updateCardOpacity(val)
    }

    if (this.transition.active) {
      this.transition.rafId = requestAnimationFrame(() => this.animateTransitionLoop())
    }
  }

  updateCardOpacity(transitionValue) {
    const cfg = CONFIG.STARS.ANIMATION
    let opacity = 0

    if (transitionValue > cfg.CARD_FADE_START) {
      opacity = (transitionValue - cfg.CARD_FADE_START) / (cfg.CARD_FADE_END - cfg.CARD_FADE_START)
      opacity = Math.min(Math.max(opacity, 0), 1)
    }

    const cards = document.querySelectorAll('#features .card')
    cards.forEach(card => {
      card.style.opacity = opacity.toString()
      card.style.pointerEvents = opacity > 0.8 ? 'auto' : 'none'
    })
  }

  update(elapsedTime) {
    if (this.starField && !this.isDisposed) {
      this.starField.material.uniforms.time.value = elapsedTime
    }
  }

  cleanup() {
    this.isDisposed = true
    this.disableScrollUpdates()
    this.transition.active = false
    this.areStarsFormingCards = false

    if (this.transition.rafId) {
      cancelAnimationFrame(this.transition.rafId)
      this.transition.rafId = null
    }

    if (this.starField) {
      if (this.scene) this.scene.remove(this.starField)
      if (this.starField.geometry) this.starField.geometry.dispose()
      if (this.starField.material) this.starField.material.dispose()
      this.starField = null
    }

    // Dispose virtual camera
    this.virtualCamera = null
  }
}

export class ShootingStarManager {
  constructor(scene, THREE) {
    this.scene = scene
    this.THREE = THREE
    this.activeStars = []
    this.pool = [] // Object pool for meshes
    this.isShowerActive = false
    this.showerTimer = 0
    this.showerCooldownTimer = 0
    this.disabled = false
    this.isDisposed = false

    this.sharedGeometry = new this.THREE.SphereGeometry(0.05, 8, 8)
    this.sharedMaterial = new this.THREE.MeshBasicMaterial({
      color: 0xfffdef,
      transparent: true,
      opacity: 1.0
    })
  }

  createShootingStar() {
    if (this.isDisposed || this.activeStars.length >= CONFIG.SHOOTING_STARS.MAX_SIMULTANEOUS) return

    try {
      let star
      if (this.pool.length > 0) {
        star = this.pool.pop()
        star.material.opacity = 1.0
        star.visible = true
      } else {
        const material = this.sharedMaterial.clone()
        star = new this.THREE.Mesh(this.sharedGeometry, material)
      }

      const startPos = {
        x: (Math.random() - 0.5) * 100,
        y: 20 + Math.random() * 20,
        z: -50 - Math.random() * 50
      }
      const velocity = new this.THREE.Vector3((Math.random() - 0.9) * 0.2, (Math.random() - 0.6) * -0.2, 0)

      star.position.set(startPos.x, startPos.y, startPos.z)
      star.scale.set(1, 1, 2 + Math.random() * 3)
      star.lookAt(star.position.clone().add(velocity))

      this.activeStars.push({
        mesh: star,
        velocity,
        lifetime: 300 + Math.random() * 200,
        age: 0
      })

      this.scene.add(star)
    } catch (error) {
      log.error('Failed to create shooting star:', error)
    }
  }

  update() {
    if (this.disabled || this.isDisposed) return

    if (this.isShowerActive) {
      this.showerTimer++
      if (this.showerTimer >= CONFIG.SHOOTING_STARS.SHOWER_DURATION) {
        this.isShowerActive = false
        this.showerCooldownTimer = CONFIG.SHOOTING_STARS.SHOWER_COOLDOWN
      }
    }

    if (this.showerCooldownTimer > 0) this.showerCooldownTimer--

    const spawnChance = this.isShowerActive ? CONFIG.SHOOTING_STARS.SHOWER_FREQUENCY : CONFIG.SHOOTING_STARS.BASE_FREQUENCY

    if (Math.random() < spawnChance) this.createShootingStar()

    for (let i = this.activeStars.length - 1; i >= 0; i--) {
      const star = this.activeStars[i]
      star.age++
      star.mesh.position.add(star.velocity)

      const fadeStart = star.lifetime * 0.7
      if (star.age > fadeStart) {
        const fadeProgress = (star.age - fadeStart) / (star.lifetime - fadeStart)
        star.mesh.material.opacity = 1 - fadeProgress
      }

      if (star.age > star.lifetime) {
        this.scene.remove(star.mesh)
        // star.mesh.material.dispose(); // Don't dispose, reuse!
        this.pool.push(star.mesh)
        this.activeStars.splice(i, 1)
      }
    }
  }

  triggerShower() {
    if (this.isDisposed || this.isShowerActive || this.showerCooldownTimer > 0) return
    this.isShowerActive = true
    this.showerTimer = 0
    log.info('🌠 Meteor shower triggered!')
  }

  cleanup() {
    this.isDisposed = true
    this.activeStars.forEach(star => {
      this.scene.remove(star.mesh)
      if (star.mesh.material) star.mesh.material.dispose()
    })
    this.activeStars = []

    // Dispose pooled stars
    this.pool.forEach(mesh => {
      if (mesh.material) mesh.material.dispose()
    })
    this.pool = []

    // Dispose shared resources
    if (this.sharedGeometry) this.sharedGeometry.dispose()
    if (this.sharedMaterial) this.sharedMaterial.dispose()
  }
}
