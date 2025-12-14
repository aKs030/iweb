
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
            originalY: data.position.y,
            hoverY: data.position.y + 0.5,
            targetOpacity: 1,
            id: data.id
        }

        this.cardGroup.add(mesh)
        this.cards.push(mesh)
    })

    if (this.isVisible) {
        this.cardGroup.visible = true
    }
  }

  createCardTexture(data) {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 700
    const ctx = canvas.getContext('2d')

    // 1. Background (Glass effect simulation)
    const gradient = ctx.createLinearGradient(0, 0, 512, 700)
    gradient.addColorStop(0, 'rgba(20, 30, 60, 0.9)')
    gradient.addColorStop(1, 'rgba(10, 15, 30, 0.95)')
    ctx.fillStyle = gradient

    this.roundRect(ctx, 0, 0, 512, 700, 40)
    ctx.fill()

    // 2. Star Border (Fine line + Dots)
    this.drawStarBorder(ctx, 0, 0, 512, 700, 40, data.color)

    // 3. Icon Circle
    const iconY = 150
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.beginPath()
    ctx.arc(256, iconY, 60, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = data.color
    ctx.lineWidth = 2
    ctx.stroke()

    // 4. Icon Text (Emoji/Char)
    ctx.fillStyle = '#ffffff'
    ctx.font = '60px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(data.iconChar, 256, iconY + 5) // +5 vertical adjustment

    // 5. Subtitle
    ctx.fillStyle = data.color
    ctx.font = 'bold 24px Arial'
    ctx.letterSpacing = '4px'
    ctx.fillText(data.subtitle, 256, 280)

    // 6. Title
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 48px Arial'
    ctx.fillText(data.title, 256, 350)

    // 7. Text (Wrapped)
    ctx.fillStyle = '#cccccc'
    ctx.font = '30px Arial'
    this.wrapText(ctx, data.text, 256, 450, 400, 40)

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

  drawStarBorder(ctx, x, y, w, h, r, color) {
    // Fine line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1
    this.roundRect(ctx, x, y, w, h, r)
    ctx.stroke()

    // Dots
    const numStars = 60
    ctx.save()
    for (let i = 0; i < numStars; i++) {
        // Random position along perimeter approximation
        // Simplified: Random points on border rect
        const side = Math.floor(Math.random() * 4)
        let px, py
        if (side === 0) { px = x + Math.random() * w; py = y; }
        else if (side === 1) { px = x + w; py = y + Math.random() * h; }
        else if (side === 2) { px = x + Math.random() * w; py = y + h; }
        else { px = x; py = y + Math.random() * h; }

        const size = Math.random() * 2 + 0.5
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
        // Only reset if we are the reason for pointer
        // document.body.style.cursor = 'default'
        // Better: ThreeEarthSystem handles global cursor or we leave it?
        // Let's reset if we don't hover anything but cards are visible
        // Actually, shared logic is better. For now simple:
    }

    this.cards.forEach(card => {
        // 1. Opacity Animation
        card.material.opacity += (card.userData.targetOpacity - card.material.opacity) * 0.05

        // 2. Float Animation
        const floatY = Math.sin(time * 0.001 + card.userData.id) * 0.1

        let targetY = card.userData.originalY
        let targetScale = 1.0

        if (card === hoveredCard) {
            targetY = card.userData.hoverY
            targetScale = 1.05
        }

        card.position.y += (targetY + floatY - card.position.y) * 0.1
        card.scale.setScalar(card.scale.x + (targetScale - card.scale.x) * 0.1)

        // 3. Face Camera (Billboarding or slight tilt?)
        // Let's make them look at camera but lock X axis?
        // card.lookAt(this.camera.position) // Full lookat
        // Maybe just static orientation is fine for readability.
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
