
import { createLogger } from '../../../utils/shared-utilities.js'

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

    // Group to hold all cards
    this.cardGroup = new THREE.Group()
    this.scene.add(this.cardGroup)
    this.cardGroup.visible = false

    this.responsiveScale = 1.0
  }

  initFromDOM(sectionElement) {
    if (this.cards.length > 0) return

    const originalCards = sectionElement.querySelectorAll('.features-cards .card')
    if (!originalCards.length) return

    log.debug(`Found ${originalCards.length} cards to convert to WebGL`)

    const positions = [
        { x: -4, y: 0, z: 0, color: '#07a1ff' },
        { x: 0, y: 0, z: 2, color: '#a107ff' },
        { x: 4, y: 0, z: 0, color: '#ff07a1' }
    ]

    originalCards.forEach((cardEl, index) => {
        // Extract Data
        const title = cardEl.querySelector('.card-title')?.innerText || 'Title'
        const subtitle = cardEl.querySelector('.card-title')?.getAttribute('data-eyebrow') || 'INFO'
        const text = cardEl.querySelector('.card-text')?.innerText || ''
        const link = cardEl.querySelector('.card-link')?.getAttribute('href') || '#'
        const iconChar = cardEl.querySelector('.icon-wrapper i')?.innerText || ''

        const data = {
            id: index,
            title, subtitle, text, link, iconChar,
            color: positions[index]?.color || '#ffffff',
            position: positions[index] || {x:0, y:0, z:0}
        }

        const texture = this.createCardTexture(data)
        const geometry = new this.THREE.PlaneGeometry(3.5, 4.5)
        const material = new this.THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: this.THREE.DoubleSide,
            opacity: 0, // Animate in
            depthWrite: false // For transparency sorting issues
        })

        const mesh = new this.THREE.Mesh(geometry, material)
        mesh.position.set(data.position.x, data.position.y, data.position.z)

        mesh.userData = {
            isCard: true,
            link: data.link,
            originalX: data.position.x,
            originalY: data.position.y,
            originalZ: data.position.z,
            hoverY: data.position.y + 0.5,
            targetOpacity: 1,
            id: data.id
        }

        this.cardGroup.add(mesh)
        this.cards.push(mesh)
    })

    // Apply initial responsive state
    const container = this.renderer.domElement.parentElement
    if (container) {
        this.handleResize(container.clientWidth, container.clientHeight)
    }

    if (this.isVisible) {
        this.cardGroup.visible = true
    }
  }

  handleResize(width, height) {
    if (!this.cards.length) return

    const isMobile = width < 768
    // Reduce scale to 0.5 to fit 3 cards vertically in the limited FOV
    this.responsiveScale = isMobile ? 0.5 : 1.0

    this.cards.forEach((card, index) => {
        if (isMobile) {
            // Vertical Stack Layout
            card.position.x = 0
            // Slight Z-offset per card to ensure consistent rendering order if they overlap vertically
            // (Though they shouldn't overlap much visually, this prevents Z-fighting)
            card.position.z = 0.05 * (3 - index)

            // Stack: Top (0), Middle (1), Bottom (2)
            // Spacing: 1.8 units (Card height 2.25 at 0.5 scale. 1.8 spacing means slight overlap/tight fit)
            // Center Offset: Camera looks at y=0.5 in 'features' preset.
            const centerOffset = 0.5
            const spacing = 1.8

            if (index === 0) card.userData.responsiveBaseY = centerOffset + spacing
            else if (index === 1) card.userData.responsiveBaseY = centerOffset
            else if (index === 2) card.userData.responsiveBaseY = centerOffset - spacing

            card.position.y = card.userData.responsiveBaseY

        } else {
            // Desktop Layout (Restore originals)
            card.userData.responsiveBaseY = undefined // Clear mobile override

            if (card.userData.originalX !== undefined) card.position.x = card.userData.originalX
            if (card.userData.originalY !== undefined) card.position.y = card.userData.originalY
            if (card.userData.originalZ !== undefined) card.position.z = card.userData.originalZ
        }
    })
  }

  createCardTexture(data) {
    const S = 2 // Scaling factor for high DPI
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
    ctx.fillText(data.iconChar, iconCenterX, iconY + (5 * S))

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
    texture.minFilter = this.THREE.LinearFilter
    texture.magFilter = this.THREE.LinearFilter // Better for text
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
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
    const numStars = 120 // Increased count for better distribution
    ctx.save()
    for (let i = 0; i < numStars; i++) {
        // Random position along perimeter approximation
        const side = Math.floor(Math.random() * 4)
        let px, py
        if (side === 0) { px = x + Math.random() * w; py = y; }
        else if (side === 1) { px = x + w; py = y + Math.random() * h; }
        else if (side === 2) { px = x + Math.random() * w; py = y + h; }
        else { px = x; py = y + Math.random() * h; }

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

  setVisible(visible) {
    this.isVisible = visible
    this.cardGroup.visible = true

    const targetOpacity = visible ? 1 : 0
    this.cards.forEach(card => {
        card.userData.targetOpacity = targetOpacity
    })
  }

  update(time, mousePos) {
    if (!this.cardGroup.visible) return

    this.raycaster.setFromCamera(mousePos, this.camera)
    const intersects = this.raycaster.intersectObjects(this.cards)
    const hoveredCard = intersects.length > 0 ? intersects[0].object : null

    // Cursor handling
    if (hoveredCard) {
        document.body.style.cursor = 'pointer'
    } else if (this.isVisible) {
        // Logic for cursor reset is handled elsewhere or implicitly
    }

    this.cards.forEach(card => {
        // 1. Opacity Animation
        card.material.opacity += (card.userData.targetOpacity - card.material.opacity) * 0.05

        // 2. Float Animation
        const floatY = Math.sin(time * 0.001 + card.userData.id) * 0.1

        // Use current position logic (which might be the stacked Y) as the base,
        // but we need to know the 'base' Y for the animation to oscillate around.
        // Since we modify position.y in handleResize, we can't just use originalY.
        // We need to track the 'currentBaseY' which handleResize sets.
        // FIX: In handleResize, we set position.y. Let's assume that is the base.
        // However, this update loop runs every frame.
        // If we want to animate around the stack position, we need to respect it.

        // Simple approach: Calculate targetY based on layout mode
        let baseLayoutY = card.userData.originalY // Default desktop

        // Check if we are in mobile stack mode based on X position (heuristic)
        // Or better, re-calculate the target base Y here or store it in userData during resize.
        // Let's rely on the fact that handleResize sets the initial Y.
        // But we need a stable reference.

        // To avoid complex state, let's just add the float to the current position logic
        // But card.position.y is accumulating changes.
        // We need a stable anchor.

        // Let's verify if 'responsiveBaseY' exists, else use originalY.
        const baseY = (card.userData.responsiveBaseY !== undefined) ? card.userData.responsiveBaseY : card.userData.originalY

        let targetY = baseY
        let targetScale = this.responsiveScale || 1.0

        if (card === hoveredCard) {
            targetY = baseY + 0.5 // Hover up relative to base
            targetScale = targetScale * 1.05
        }

        card.position.y += (targetY + floatY - card.position.y) * 0.1
        card.scale.setScalar(card.scale.x + (targetScale - card.scale.x) * 0.1)

        // 3. Face Camera
        // Ensure the cards always face the camera to prevent skewing
        card.lookAt(this.camera.position)
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
    this.cards.forEach(card => {
        card.geometry.dispose()
        card.material.map.dispose()
        card.material.dispose()
    })
    this.cards = []
  }
}
