import {createLogger} from '../../../utils/shared-utilities.js'

const log = createLogger('CardManager')

export class CardManager {
  constructor(THREE, scene, camera, renderer) {
    this.THREE = THREE
    this.scene = scene
    this.camera = camera
    this.renderer = renderer
    this.cards = []
    this.raycaster = new THREE.Raycaster()
    this.isVisible = false

    // State for Zero-G Animation
    this.animationState = 'IDLE' // IDLE, ENTERING, EXITING
    this.animationDirection = 'down' // 'down' (from hero), 'up' (from about)
    this.animationStartTime = 0

    // Group to hold all cards
    this.cardGroup = new THREE.Group()
    this.scene.add(this.cardGroup)
    this.cardGroup.visible = false
  }

  initFromDOM(sectionElement) {
    if (this.cards.length > 0) return

    const originalCards = sectionElement.querySelectorAll('.features-cards .card')
    if (!originalCards.length) return

    log.debug(`Found ${originalCards.length} cards to convert to WebGL`)

    // Compute positions dynamically so cards fit the viewport and don't overlap
    const cardCount = originalCards.length
    // Base geometry width/height in world units (smaller than before)
    const baseW = 2.2
    const baseH = 2.8
    // Spacing between card centers (proportional to width)
    const spacing = baseW * (cardCount > 2 ? 1.4 : 1.25)
    const centerOffset = (cardCount - 1) / 2

    const positions = Array.from({length: cardCount}).map((_, i) => {
      return {
        x: (i - centerOffset) * spacing,
        y: 0,
        z: 0,
        color: ['#07a1ff', '#a107ff', '#ff07a1'][i] || '#ffffff'
      }
    })

    originalCards.forEach((cardEl, index) => {
      // Extract Data
      const title = cardEl.querySelector('.card-title')?.innerText || 'Title'
      const subtitle = cardEl.querySelector('.card-title')?.getAttribute('data-eyebrow') || 'INFO'
      const text = cardEl.querySelector('.card-text')?.innerText || ''
      const link = cardEl.querySelector('.card-link')?.getAttribute('href') || '#'
      const iconChar = cardEl.querySelector('.icon-wrapper i')?.innerText || ''

      const data = {
        id: index,
        title,
        subtitle,
        text,
        link,
        iconChar,
        color: positions[index]?.color || '#ffffff',
        position: positions[index] || {x: 0, y: 0, z: 0}
      }

      const texture = this.createCardTexture(data)
      // Use a smaller plane geometry to reduce overlap risk
      const geometry = new this.THREE.PlaneGeometry(baseW, baseH)
      const material = new this.THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: this.THREE.DoubleSide,
        opacity: 0, // Animate in
        depthWrite: false // For transparency sorting issues
      })

      const mesh = new this.THREE.Mesh(geometry, material)
      mesh.position.set(data.position.x, data.position.y, data.position.z)

      // Initial scale adjustment for small viewports
      const viewportScale = Math.min(1, (typeof window !== 'undefined' ? window.innerWidth : 1200) / 1200)
      mesh.scale.setScalar(0.95 * Math.max(0.7, viewportScale))

      mesh.userData = {
        isCard: true,
        link: data.link,
        originalY: data.position.y,
        hoverY: data.position.y + 0.5,
        targetOpacity: 0, // Start invisible
        id: data.id,
        // Zero-G Animation State
        animOffset: new this.THREE.Vector3(),
        animRotation: new this.THREE.Euler(),
        delay: 0
      }

      this.cardGroup.add(mesh)
      this.cards.push(mesh)
    })

    if (this.isVisible) {
      this.cardGroup.visible = true
    }

    // Recompute positions on resize to maintain spacing and fit
    this._onResize = () => {
      const vw = window.innerWidth
      const adaptiveScale = Math.min(1, vw / 1200)
      const newSpacing = baseW * (cardCount > 2 ? 1.4 : 1.25) * Math.max(0.85, adaptiveScale)
      this.cards.forEach((card, idx) => {
        const x = (idx - centerOffset) * newSpacing
        // Keep Z the same but nudge slightly to preserve depth order without overlap
        card.position.x = x
        card.scale.setScalar(0.95 * Math.max(0.65, adaptiveScale))
      })
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._onResize)
    }
  }

  createCardTexture(data) {
    // Determine a scaling factor based on device pixel ratio to keep text crisp
    const DPR = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1
    // Scale aggressively on high-DPI displays for crisper text, clamped for performance
    const S = Math.min(Math.max(Math.ceil(DPR * 2), 2), 4)
    const W = 512 * S
    const H = 700 * S

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    // 1. Background (Glass effect simulation)
    const gradient = ctx.createLinearGradient(0, 0, W, H)
    gradient.addColorStop(0, 'rgba(20, 30, 60, 0.9)')
    gradient.addColorStop(1, 'rgba(10, 15, 30, 0.95)')
    ctx.fillStyle = gradient

    const R = 40 * S
    this.roundRect(ctx, 0, 0, W, H, R)
    ctx.fill()

    // 2. Star Border (Fine line + Dots)
    this.drawStarBorder(ctx, 0, 0, W, H, R, data.color, S)

    // 3. Icon Circle
    const iconY = 150 * S
    const iconCenterX = 256 * S
    const iconRadius = 60 * S

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.beginPath()
    ctx.arc(iconCenterX, iconY, iconRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = data.color
    ctx.lineWidth = 2 * S
    ctx.stroke()

    // 4. Icon Text (Emoji/Char)
    ctx.fillStyle = '#ffffff'
    ctx.font = `${60 * S}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(data.iconChar, iconCenterX, iconY + 5 * S)

    // 5. Subtitle
    ctx.fillStyle = data.color
    ctx.font = `bold ${24 * S}px Arial`
    ctx.letterSpacing = `${4 * S}px`
    ctx.fillText(data.subtitle, iconCenterX, 280 * S)

    // 6. Title
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${48 * S}px Arial`
    ctx.fillText(data.title, iconCenterX, 350 * S)

    // 7. Text (Wrapped)
    ctx.fillStyle = '#cccccc'
    ctx.font = `${30 * S}px Arial`
    this.wrapText(ctx, data.text, iconCenterX, 450 * S, 400 * S, 40 * S)

    const texture = new this.THREE.CanvasTexture(canvas)
    // Use mipmaps + linear mipmap filtering for crisper downscaled rendering
    texture.generateMipmaps = true
    texture.minFilter = this.THREE.LinearMipmapLinearFilter
    texture.magFilter = this.THREE.LinearFilter
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    texture.needsUpdate = true
    return texture
  }

  roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2
    if (h < 2 * r) r = h / 2
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  drawStarBorder(ctx, x, y, w, h, r, color, _scale) {
    // Fine line - keeping it thin relative to the scaled size to appear "finer"
    // Using 1.5 * scale would be proportional. Using just 1.5 or 2 makes it very thin on high res.
    // Let's go with 1.5 pixels absolute thickness on the scaled canvas.
    // Since we scale by 2, a 1.5px line is effectively 0.75px on the original geometry.
    // NOTE: scale is kept as an argument for future adaptive logic, though currently unused for lineWidth
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1.5
    this.roundRect(ctx, x, y, w, h, r)
    ctx.stroke()

    // Dots
    const numStars = 120 // Increased count for better distribution
    ctx.save()
    for (let i = 0; i < numStars; i++) {
      // Random position along perimeter approximation
      const side = Math.floor(Math.random() * 4)
      let px, py
      if (side === 0) {
        px = x + Math.random() * w
        py = y
      } else if (side === 1) {
        px = x + w
        py = y + Math.random() * h
      } else if (side === 2) {
        px = x + Math.random() * w
        py = y + h
      } else {
        px = x
        py = y + Math.random() * h
      }

      // Smaller size for "finer" look.
      // Original was: Math.random() * 2 + 0.5 (relative to 1x scale)
      // We want it smaller.
      // Let's try 0.5 to 2.0 pixels on the 2x canvas (0.25 to 1.0 effective).
      const size = Math.random() * 1.5 + 0.5

      ctx.fillStyle = Math.random() > 0.7 ? color : '#ffffff'
      ctx.globalAlpha = Math.random() * 0.8 + 0.2
      ctx.beginPath()
      ctx.arc(px, py, size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ')
    let line = ''
    let lineCount = 0
    const maxLines = 4

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' '
      const metrics = ctx.measureText(testLine)
      const testWidth = metrics.width
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y)
        line = words[n] + ' '
        y += lineHeight
        lineCount++
        if (lineCount >= maxLines) {
          line += '...'
          break
        }
      } else {
        line = testLine
      }
    }
    ctx.fillText(line, x, y)
  }

  /**
   * Triggers the entry animation based on scroll direction.
   * @param {string} direction 'down' (from Hero) or 'up' (from About)
   */
  animateIn(direction) {
    this.isVisible = true
    this.cardGroup.visible = true
    this.animationState = 'ENTERING'
    this.animationDirection = direction
    this.animationStartTime = performance.now()

    this.cards.forEach((card, index) => {
      card.userData.targetOpacity = 1

      // Reset transforms
      card.rotation.set(0, 0, 0)

      // Setup Zero-G Launch Configurations
      if (direction === 'down') {
        // Entering from Hero (scrolling down)
        // Start: Deep space, below
        // Cascade: Left-to-Right
        card.userData.animOffset.set(0, -3.5, -5.0) // y=-3.5 (below), z=-5.0 (deep)
        card.userData.animRotation.set(-Math.PI * 0.25, 0, 0) // Tilted back looking up
        card.userData.delay = index * 150 // Cascade
      } else {
        // Entering from About (scrolling up)
        // Start: High, closer
        // Cascade: Right-to-Left
        card.userData.animOffset.set(0, 3.5, 2.0) // y=3.5 (above), z=2.0 (close)
        card.userData.animRotation.set(Math.PI * 0.25, 0, 0) // Tilted forward looking down
        card.userData.delay = (this.cards.length - 1 - index) * 150 // Reverse cascade
      }

      // Instant apply start state
      card.material.opacity = 0
    })
  }

  /**
   * Triggers the exit animation.
   * @param {string} toDirection 'down' (to About) or 'up' (to Hero)
   */
  animateOut(toDirection) {
    this.isVisible = false
    this.animationState = 'EXITING'
    this.animationDirection = toDirection

    this.cards.forEach((card, _index) => {
      card.userData.targetOpacity = 0
      // We don't reset positions here, we drift from current spot
      // Drift target logic handled in update loop
    })
  }

  /**
   * Legacy method for compatibility - maps to animateIn/Out defaults
   */
  setVisible(visible) {
    if (visible) this.animateIn('down')
    else this.animateOut('down')
  }

  update(time, mousePos) {
    if (!this.cardGroup.visible) return

    // Time since animation started
    const now = performance.now()
    const elapsed = now - this.animationStartTime

    // Raycasting
    this.raycaster.setFromCamera(mousePos, this.camera)
    const intersects = this.raycaster.intersectObjects(this.cards)
    const hoveredCard = intersects.length > 0 ? intersects[0].object : null

    // Cursor
    if (hoveredCard) {
      document.body.style.cursor = 'pointer'
    } else if (this.isVisible) {
       // Logic for cursor reset is handled elsewhere or implicitly
    }

    this.cards.forEach(card => {
      const ud = card.userData
      const basePos = ud.position || {x: 0, y: 0, z: 0}

      // --- 1. Animation State Logic ---

      const currentAnimOffset = new this.THREE.Vector3()
      const currentAnimRot = new this.THREE.Euler()

      if (this.animationState === 'ENTERING') {
        const cardTime = Math.max(0, elapsed - ud.delay)
        // Duration of entry flight: 800ms
        const duration = 1200
        const progress = Math.min(1, cardTime / duration)

        // Easing: Cubic Out (Fast start, slow settle)
        const ease = 1 - Math.pow(1 - progress, 3)

        // Lerp from Launch Config to 0
        const target = new this.THREE.Vector3(0, 0, 0)
        currentAnimOffset.copy(ud.animOffset).lerp(target, ease)

        // Lerp rotation
        currentAnimRot.x = ud.animRotation.x * (1 - ease)
        currentAnimRot.y = ud.animRotation.y * (1 - ease)
        currentAnimRot.z = ud.animRotation.z * (1 - ease)

        // Fade in
        card.material.opacity = ease

      } else if (this.animationState === 'EXITING') {
        // Drift away
        // If moving to About (scrolling down), drift UP/BACK (opposite)
        // If moving to Hero (scrolling up), drift DOWN/BACK
        const driftDir = this.animationDirection === 'down' ? 1 : -1
        const driftSpeed = 0.05

        ud.animOffset.y += driftDir * driftSpeed
        ud.animOffset.z -= driftSpeed // Always drift back into space

        currentAnimOffset.copy(ud.animOffset)

        // Fade out logic is handled by standard opacity lerp below
      }

      // --- 2. Standard Physics (Float & Hover) ---

      // Opacity
      card.material.opacity += (ud.targetOpacity - card.material.opacity) * 0.08

      // Idle Float (Sine Wave)
      const floatY = Math.sin(time * 0.001 + ud.id) * 0.1

      // Hover Effect
      let targetY = ud.originalY
      let targetScale = 1.0

      if (hoveredCard === card && this.animationState !== 'EXITING') {
        targetY = ud.hoverY
        targetScale = 1.05
      }

      // --- 3. Final Composition ---

      // Position: Base + Idle Float + Hover + Animation Offset
      const finalX = basePos.x + currentAnimOffset.x
      const finalY = targetY + floatY + currentAnimOffset.y
      const finalZ = basePos.z + currentAnimOffset.z

      // Smoothly approach the calculated interaction target (Hover/Float), then add the animation offset strictly
      // We maintain the 'smooth follow' for the interaction parts
      card.position.x += (finalX - card.position.x) * 0.1
      card.position.y += (finalY - card.position.y) * 0.1
      card.position.z += (finalZ - card.position.z) * 0.1

      // Scale
      card.scale.setScalar(card.scale.x + (targetScale - card.scale.x) * 0.1)

      // Rotation: LookAt Camera + Animation Rotation Offset
      // First, look at camera
      card.lookAt(this.camera.position)

      // Then apply offset (local rotation not easy after lookAt, so we add to the resulting quaternion?
      // Actually, simple addition to Euler after lookAt works if axes align, but cards face Z.
      // Better approach: Create a target quaternion.
      // However, for simplicity and stability:
      // We just let lookAt handle the main alignment.
      // The "Tilted" animation is an offset.
      if (this.animationState === 'ENTERING') {
         // Apply the tilt manually to the object after lookAt
         // Since lookAt updates the rotation, we add our offset.
         // Note: This might jitter if not careful.
         // Safe way: Rotate the *container* or parent? No, individual cards.
         // Let's use rotateX method for local rotation relative to the camera-facing state.
         card.rotateX(currentAnimRot.x)
      }
    })

    // Hide group when fully invisible
    if (!this.isVisible && this.cards.length > 0 && this.cards[0].material.opacity < 0.01) {
      this.cardGroup.visible = false
    }
  }

  handleClick(mousePos) {
    if (!this.isVisible) return

    this.raycaster.setFromCamera(mousePos, this.camera)
    const intersects = this.raycaster.intersectObjects(this.cards)

    if (intersects.length > 0) {
      const link = intersects[0].object.userData.link
      if (link) {
        window.location.href = link
      }
    }
  }

  cleanup() {
    this.scene.remove(this.cardGroup)
    this.cards.forEach(card => {
      card.geometry.dispose()
      card.material.map.dispose()
      card.material.dispose()
    })
    this.cards = []
    if (typeof window !== 'undefined' && this._onResize) {
      window.removeEventListener('resize', this._onResize)
      this._onResize = null
    }
  }
}
