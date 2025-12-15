import {createLogger} from '../../../utils/shared-utilities.js'

const log = createLogger('CardManager')

// SVG Paths (viewBox 0 0 24 24 assumed)
const ICON_PATHS = {
  profile:
    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  rocket:
    'M12 2.5s-2 2-2 7c0 2 1 4 2 4s2-2 2-4c0-5-2-7-2-7zm-4 8c-2 0-3.5 1.5-3.5 3.5 0 2.2 1.3 4.2 3.5 5.2V22l3-1 3 1v-2.8c2.2-1 3.5-3 3.5-5.2 0-2-1.5-3.5-3.5-3.5H8z',
  camera:
    'M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z M12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  code: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
  mail: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
  tools:
    'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  heart:
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  github:
    'M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1.01.07 1.54 1.04 1.54 1.04.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.65.7 1.03 1.59 1.03 2.68 0 3.84-2.33 4.66-4.56 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z',
  linkedin:
    'M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.74 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z'
}

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
    this._tempCanvas = null
    this._tmpVec = new THREE.Vector3()
    this._tmpQuat = new THREE.Quaternion()
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
      const iconKey = cardEl.querySelector('.icon-wrapper')?.getAttribute('data-icon') || ''
      const iconChar = (cardEl.querySelector('.icon-wrapper i')?.innerText || '').trim()

      const data = {
        id: index,
        title,
        subtitle,
        text,
        link,
        iconKey,
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
      mesh.scale.setScalar(0.95 * Math.max(0.7, viewportScale))

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
        parallaxStrength: 0.14
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
        const adaptiveScale = Math.min(1, vw / 1200)
        const newSpacing = baseW * (cardCount > 2 ? 1.4 : 1.25) * Math.max(0.85, adaptiveScale)
        this.cards.forEach((card, idx) => {
          const x = (idx - centerOffset) * newSpacing
          // Keep Z the same but nudge slightly to preserve depth order without overlap
          card.position.x = x
          card.scale.setScalar(0.95 * Math.max(0.65, adaptiveScale))
        })
        this._resizeRAF = null
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

    // 4. Icon Drawing (SVG Path or fallback Emoji)
    if (data.iconKey && ICON_PATHS[data.iconKey]) {
      this.drawIcon(ctx, data.iconKey, iconCenterX, iconY, 60 * S, '#ffffff')
    } else {
      // Fallback
      ctx.fillStyle = '#ffffff'
      ctx.font = `${60 * S}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(data.iconChar, iconCenterX, iconY + 5 * S)
    }

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

  drawIcon(ctx, iconKey, x, y, size, color) {
    const pathStr = ICON_PATHS[iconKey]
    if (!pathStr) return

    ctx.save()
    ctx.fillStyle = color
    // Center the icon. Assuming standard 24x24 viewBox for the paths
    // Scale factor: size / 24
    const scale = size / 24
    // Translate to center position (x,y) minus half the scaled size
    ctx.translate(x - (24 * scale) / 2, y - (24 * scale) / 2)
    ctx.scale(scale, scale)

    const path = new Path2D(pathStr)
    ctx.fill(path)
    ctx.restore()
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
    this.cardGroup.visible = p > 0.01
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
      const tiltX = -mousePos.y * parallax * card.userData.hoverProgress
      const tiltY = mousePos.x * parallax * card.userData.hoverProgress * 0.8

      // Compute target values
      let targetY = card.userData.originalY
      let targetScale = 1.0
      if (card === hoveredCard) {
        targetY = card.userData.hoverY
        targetScale = 1.05
      }

      // Apply position and scale easing
      card.position.y += (targetY + floatY - card.position.y) * 0.12
      card.scale.setScalar(card.scale.x + (targetScale - card.scale.x) * 0.12)

      // Smooth rotation/tilt
      card.rotation.x += (tiltX - card.rotation.x) * 0.12
      card.rotation.y += (tiltY - card.rotation.y) * 0.12

      // Ensure the cards generally face the camera (soft lookAt via rotation lerp)
      this.camera.getWorldPosition(this._tmpVec)
      this._orientDummy.position.copy(card.position)
      this._orientDummy.lookAt(this._tmpVec)
      this._tmpQuat.copy(this._orientDummy.quaternion)
      card.quaternion.slerp(this._tmpQuat, 0.08)

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
