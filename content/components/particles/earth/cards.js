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

    // Internal state
    this._hovered = null
    this._resizeRAF = null
    this._sharedGeometry = null
    this._sharedGlowTexture = null
    this._tmpVec = new THREE.Vector3()
    this._tmpQuat = new THREE.Quaternion()
    this._tmpQuat2 = new THREE.Quaternion()
    this._tmpEuler = new THREE.Euler()
    this._orientDummy = new THREE.Object3D()

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

    // Shared geometry reused across cards to reduce memory / GC churn
    this._sharedGeometry = new this.THREE.PlaneGeometry(baseW, baseH)

    // Prepare shared glow texture (small radial gradient) once
    if (!this._sharedGlowTexture) this._sharedGlowTexture = this.createGlowTexture()

    originalCards.forEach((cardEl, index) => {
      // Extract Data
      const rawTitle = cardEl.querySelector('.card-title')?.innerText || 'Title'
      const rawSubtitle = cardEl.querySelector('.card-title')?.getAttribute('data-eyebrow') || 'INFO'
      const rawText = cardEl.querySelector('.card-text')?.innerText || ''
      const title = rawTitle.replace(/\s+/g, ' ').trim()
      const subtitle = rawSubtitle.replace(/\s+/g, ' ').trim()
      const text = rawText.replace(/\s+/g, ' ').trim()
      const link = cardEl.querySelector('.card-link')?.getAttribute('href') || '#'
      const iconChar = (cardEl.querySelector('.icon-wrapper i')?.innerText || '').trim()

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
      const material = new this.THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: this.THREE.DoubleSide,
        opacity: 0, // Animate in
        depthWrite: false // For transparency sorting issues
      })

      const mesh = new this.THREE.Mesh(this._sharedGeometry, material)
      // Start slightly lower for entrance animation
      mesh.position.set(data.position.x, data.position.y - 0.8, data.position.z)

      // Initial scale adjustment for small viewports
      const viewportScale = Math.min(1, (typeof window !== 'undefined' ? window.innerWidth : 1200) / 1200)
      // Increased minimum scale from 0.7 to 0.85 for better legibility on mobile
      mesh.scale.setScalar(0.95 * Math.max(0.85, viewportScale))

      mesh.userData = {
        isCard: true,
        link: data.link,
        originalY: data.position.y,
        hoverY: data.position.y + 0.5,
        targetOpacity: 1,
        id: data.id,
        entranceDelay: index * 80, // ms
        entranceProgress: 0,
        hoverProgress: 0,
        parallaxStrength: 0.14,
        // Rotation State for smooth composition
        currentTiltX: 0,
        currentTiltY: 0
      }

      // Glow sprite with shared texture, tinted per card
      const glowMat = new this.THREE.SpriteMaterial({
        map: this._sharedGlowTexture,
        color: data.color,
        transparent: true,
        blending: this.THREE.AdditiveBlending,
        depthWrite: false
      })
      const glow = new this.THREE.Sprite(glowMat)
      glow.scale.set(baseW * 0.95, baseH * 0.45, 1)
      glow.position.set(0, -0.12, -0.01)
      mesh.add(glow)
      mesh.userData.glow = glow

      this.cardGroup.add(mesh)
      this.cards.push(mesh)
    })

    if (this.isVisible) {
      this.cardGroup.visible = true
    }

    // Recompute positions on resize to maintain spacing and fit (throttled via rAF)
    this._onResize = () => {
      if (this._resizeRAF) cancelAnimationFrame(this._resizeRAF)
      this._resizeRAF = requestAnimationFrame(() => {
        const vw = window.innerWidth
        const isMobile = vw < 768

        this.cards.forEach((card, idx) => {
          if (isMobile) {
            // Mobile: Vertical Stack
            const scale = 0.82
            // Increased spacing slightly for cleaner layout (2.75 -> 2.9)
            const spacingY = 2.9
            // Stack from top to bottom
            const y = (centerOffset - idx) * spacingY

            card.scale.setScalar(scale)
            card.position.x = 0
            card.position.y = y

            // Update metadata for animation loop
            card.userData.originalY = y
            card.userData.hoverY = y + 0.2 // Reduced hover lift on mobile
          } else {
             // Desktop: Horizontal Row
             const adaptiveScale = Math.min(1, vw / 1200)
             const newSpacing = baseW * (cardCount > 2 ? 1.4 : 1.25) * Math.max(0.85, adaptiveScale)
             const x = (idx - centerOffset) * newSpacing

             card.scale.setScalar(0.95 * Math.max(0.65, adaptiveScale))
             card.position.x = x
             card.position.y = 0

             // Reset metadata
             card.userData.originalY = 0
             card.userData.hoverY = 0.5
          }
        })
        this._resizeRAF = null
      })
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._onResize)
      // Force initial layout
      this._onResize()
    }
  }

  createCardTexture(data) {
    // Determine a scaling factor based on device pixel ratio to keep text crisp
    const DPR = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1
    // Scale aggressively on high-DPI displays for crisper text, clamped for performance
    const S = Math.min(Math.max(Math.ceil(DPR * 2), 2), 4)
    const W = 512 * S
    const H = 700 * S

    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : document.createElement('canvas')
    if (typeof OffscreenCanvas === 'undefined') {
      canvas.width = W
      canvas.height = H
    }
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

    // 5. Subtitle (fit to width)
    ctx.fillStyle = data.color
    const subtitleText = (data.subtitle || '').trim()
    const subtitleSize = this.fitTextToWidth(ctx, subtitleText, 420 * S, 'bold', 24 * S, 12 * S)
    ctx.font = `bold ${subtitleSize}px Arial`
    ctx.fillText(subtitleText, iconCenterX, 280 * S)

    // 6. Title (fit to width, prefer single line)
    ctx.fillStyle = '#ffffff'
    const titleText = (data.title || '').trim()
    const titleSize = this.fitTextToWidth(ctx, titleText, 420 * S, 'bold', 48 * S, 20 * S)
    ctx.font = `bold ${titleSize}px Arial`
    ctx.fillText(titleText, iconCenterX, 350 * S)

    // 7. Text (Wrapped) - reduce size slightly for long text
    ctx.fillStyle = '#cccccc'
    const baseTextSize = data.text && data.text.length > 160 ? Math.max(18 * S, 22 * S) : 30 * S
    ctx.font = `${baseTextSize}px Arial`
    this.wrapText(ctx, data.text, iconCenterX, 450 * S, 400 * S, Math.round(40 * S))

    const texture = new this.THREE.CanvasTexture(canvas)
    // Use mipmaps + linear mipmap filtering for crisper downscaled rendering
    texture.generateMipmaps = true
    texture.minFilter = this.THREE.LinearMipmapLinearFilter
    texture.magFilter = this.THREE.LinearFilter
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    texture.needsUpdate = true
    return texture
  }

  createGlowTexture() {
    const DPR = typeof window !== 'undefined' && window.devicePixelRatio ? Math.min(window.devicePixelRatio, 2) : 1
    const size = Math.floor(128 * DPR)
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : document.createElement('canvas')
    if (typeof OffscreenCanvas === 'undefined') {
      canvas.width = size
      canvas.height = size
    }
    const ctx = canvas.getContext('2d')

    const cx = size / 2
    const cy = size / 2
    const r = size * 0.45
    const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r)
    grad.addColorStop(0, 'rgba(255,255,255,0.9)')
    grad.addColorStop(0.3, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')

    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()

    const tex = new this.THREE.CanvasTexture(canvas)
    tex.generateMipmaps = true
    tex.minFilter = this.THREE.LinearMipmapLinearFilter
    tex.magFilter = this.THREE.LinearFilter
    tex.needsUpdate = true
    return tex
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

  drawStarBorder(ctx, x, y, w, h, r, color, scale) {
    // Fine line - keeping it thin relative to the scaled size to appear "finer"
    // Using 1.5 * scale would be proportional. Using just 1.5 or 2 makes it very thin on high res.
    // Let's go with 1.5 pixels absolute thickness on the scaled canvas.
    // Since we scale by 2, a 1.5px line is effectively 0.75px on the original geometry.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1.5
    this.roundRect(ctx, x, y, w, h, r)
    ctx.stroke()

    // Dots
    const numStars = Math.min(200, Math.max(20, Math.floor(60 * scale))) // scale-dependent density
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
    const words = (text || '').split(' ')
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

  fitTextToWidth(ctx, text, maxWidth, fontWeight = 'normal', initialSize = 24, minSize = 12) {
    if (!text) return initialSize
    let size = initialSize
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    while (size >= minSize) {
      ctx.font = `${fontWeight} ${Math.round(size)}px Arial`
      const w = ctx.measureText(text).width
      if (w <= maxWidth) break
      size -= 1
    }
    return Math.max(minSize, Math.round(size))
  }

  setVisible(visible) {
    // Backwards-compatible: map visible boolean to progress target
    this.isVisible = visible
    this.setProgress(visible ? 1 : 0)
  }

  setProgress(progress) {
    const p = Math.max(0, Math.min(1, progress || 0))
    const wasVisible = this.cardGroup.visible
    this.cardGroup.visible = p > 0.01

    // If becoming visible right now, snap cards to face the camera to avoid
    // a brief incorrect orientation during the entrance animation.
    if (this.cardGroup.visible && !wasVisible) {
      this.alignCardsToCameraImmediate()
    }

    this.cards.forEach(card => {
      // account for per-card stagger using entranceDelay
      const stagger = (card.userData.entranceDelay || 0) / 800
      const local = Math.max(0, Math.min(1, (p - stagger) / Math.max(0.0001, 1 - stagger)))
      card.userData.entranceTarget = local
      // Also map opacity target so the material fades out gracefully
      card.userData.targetOpacity = local > 0 ? 1 : 0
    })
  }

  update(time, mousePos) {
    if (!this.cardGroup.visible) return

    this.raycaster.setFromCamera(mousePos, this.camera)
    const intersects = this.raycaster.intersectObjects(this.cards)
    const hoveredCard = intersects.length > 0 ? intersects[0].object : null

    // Cursor handling - avoid redundant style writes
    if (hoveredCard !== this._hovered) {
      this._hovered = hoveredCard
      document.body.style.cursor = hoveredCard ? 'pointer' : ''
    }

    this.camera.getWorldPosition(this._tmpVec)

    this.cards.forEach(card => {
      // Entrance progress (staggered)
      const targetEntrance = typeof card.userData.entranceTarget === 'number' ? card.userData.entranceTarget : this.isVisible ? 1 : 0
      card.userData.entranceProgress += (targetEntrance - card.userData.entranceProgress) * 0.06

      // 1. Opacity Animation influenced by entrance progress
      const baseOpacity = card.userData.targetOpacity || 1
      card.material.opacity = baseOpacity * (0.05 + 0.95 * card.userData.entranceProgress)

      // 2. Float Animation
      const floatY = Math.sin(time * 0.001 + card.userData.id) * 0.06

      // Hover progress smoothing
      const hoverTarget = card === hoveredCard ? 1 : 0
      card.userData.hoverProgress += (hoverTarget - card.userData.hoverProgress) * 0.12

      // Parallax tilt based on mouse position when hovered
      const parallax = card.userData.parallaxStrength || 0.12
      const targetTiltX = -mousePos.y * parallax * card.userData.hoverProgress
      const targetTiltY = mousePos.x * parallax * card.userData.hoverProgress * 0.8

      // Smoothly update tilt state (Euler angles)
      card.userData.currentTiltX += (targetTiltX - card.userData.currentTiltX) * 0.12
      card.userData.currentTiltY += (targetTiltY - card.userData.currentTiltY) * 0.12

      // Compute target values for Position/Scale
      let targetY = card.userData.originalY
      let targetScale = 1.0
      if (card === hoveredCard) {
        targetY = card.userData.hoverY
        targetScale = 1.05
      }

      // Apply position and scale easing
      card.position.y += (targetY + floatY - card.position.y) * 0.12
      card.scale.setScalar(card.scale.x + (targetScale - card.scale.x) * 0.12)

      // --- Orientation Logic ---

      // 1. Calculate Base Rotation (Upright / Billboard on Y-axis)
      // Project camera position to the card's horizontal plane
      this._orientDummy.position.copy(card.position)
      // Look at camera x/z but same y as card to stay vertical
      this._orientDummy.lookAt(this._tmpVec.x, card.position.y, this._tmpVec.z)
      // Reuse this._tmpQuat for the base rotation
      this._tmpQuat.copy(this._orientDummy.quaternion)

      // 2. Calculate Tilt Rotation (Local perturbation from mouse)
      // Use re-usable Euler and Quaternion to avoid garbage
      this._tmpEuler.set(card.userData.currentTiltX, card.userData.currentTiltY, 0, 'XYZ')
      this._tmpQuat2.setFromEuler(this._tmpEuler)

      // 3. Combine: Base * Tilt
      this._tmpQuat.multiply(this._tmpQuat2)

      // 4. Smoothly interpolate current quaternion to target
      card.quaternion.slerp(this._tmpQuat, 0.12)

      // Glow pulsing
      if (card.userData.glow && card.userData.glow.material) {
        const glow = card.userData.glow
        glow.material.opacity =
          Math.max(0.06, 0.6 * (0.5 + 0.5 * Math.sin(time * 0.002 + card.userData.id))) * card.userData.entranceProgress
      }
    })

    if (!this.isVisible && this.cards[0] && this.cards[0].material.opacity < 0.01) {
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

  alignCardsToCameraImmediate() {
    // Immediately orient all cards to face the current camera position (projected upright).
    if (!this.camera) return
    this.camera.getWorldPosition(this._tmpVec)
    this.cards.forEach(card => {
      this._orientDummy.position.copy(card.position)
      this._orientDummy.lookAt(this._tmpVec.x, card.position.y, this._tmpVec.z)
      card.quaternion.copy(this._orientDummy.quaternion)
      // Reset tilt state
      card.userData.currentTiltX = 0
      card.userData.currentTiltY = 0
    })
  }

  cleanup() {
    this.scene.remove(this.cardGroup)

    // Dispose each card's resources (geometry, textures, materials, glow)
    this.cards.forEach(card => {
      try {
        if (card.geometry && card.geometry.dispose) card.geometry.dispose()

        if (card.material) {
          if (card.material.map && card.material.map.dispose) card.material.map.dispose()
          card.material.map = null
          if (card.material.dispose) card.material.dispose()
        }

        const glow = card.userData && card.userData.glow
        if (glow && glow.material) {
          if (glow.material.map && glow.material.map.dispose) glow.material.map.dispose()
          if (glow.material.dispose) glow.material.dispose()
        }
      } catch {
        // Defensive: ignore disposal errors to avoid blocking cleanup
      }
    })

    // Dispose shared geometry and textures
    if (this._sharedGeometry) {
      this._sharedGeometry.dispose()
      this._sharedGeometry = null
    }

    if (this._sharedGlowTexture && this._sharedGlowTexture.dispose) {
      this._sharedGlowTexture.dispose()
      this._sharedGlowTexture = null
    }

    // Clear card references
    this.cards = []

    if (typeof window !== 'undefined' && this._onResize) {
      window.removeEventListener('resize', this._onResize)
      this._onResize = null
    }
    if (this._resizeRAF) {
      cancelAnimationFrame(this._resizeRAF)
      this._resizeRAF = null
    }
  }
}
