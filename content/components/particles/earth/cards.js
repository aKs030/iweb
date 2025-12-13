
import { CONFIG } from './config.js'
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
    this.mouse = new THREE.Vector2()
    this.isVisible = false

    // Group to hold all cards
    this.cardGroup = new THREE.Group()
    this.scene.add(this.cardGroup)
    this.cardGroup.visible = true

    this.initCards()
  }

  initCards() {
    const cardData = [
      {
        id: 'about',
        title: 'Meine Story',
        subtitle: 'ÜBER MICH',
        text: 'Wer ich bin und was mich antreibt.',
        link: '#about',
        position: { x: -4, y: 0, z: 0 },
        color: '#07a1ff'
      },
      {
        id: 'projects',
        title: 'Meine Arbeiten',
        subtitle: 'PROJEKTE',
        text: 'Vom Konzept bis zur Umsetzung.',
        link: '/pages/projekte/projekte.html#project-1',
        position: { x: 0, y: 0, z: 2 },
        color: '#a107ff'
      },
      {
        id: 'photos',
        title: 'Meine Perspektive',
        subtitle: 'FOTOS',
        text: 'Momente, die mich inspirieren.',
        link: '/pages/gallery/gallery.html',
        position: { x: 4, y: 0, z: 0 },
        color: '#ff07a1'
      }
    ]

    cardData.forEach((data, index) => {
      const texture = this.createCardTexture(data)
      const geometry = new this.THREE.PlaneGeometry(3.5, 4.5)
      const material = new this.THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: this.THREE.DoubleSide,
        opacity: 1
      })

      const mesh = new this.THREE.Mesh(geometry, material)
      mesh.position.set(data.position.x, data.position.y, data.position.z)

      // Store metadata
      mesh.userData = {
        isCard: true,
        link: data.link,
        originalY: data.position.y,
        hoverY: data.position.y + 0.5,
        id: data.id
      }

      this.cardGroup.add(mesh)
      this.cards.push(mesh)
    })
  }

  createCardTexture(data) {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 700
    const ctx = canvas.getContext('2d')

    // Background (Glass effect simulation)
    const gradient = ctx.createLinearGradient(0, 0, 512, 700)
    gradient.addColorStop(0, 'rgba(20, 30, 60, 0.9)')
    gradient.addColorStop(1, 'rgba(10, 15, 30, 0.95)')
    ctx.fillStyle = gradient

    // Rounded Rect background
    this.roundRect(ctx, 0, 0, 512, 700, 40)
    ctx.fill()

    // Star Border (Scattered dots along the edge)
    this.drawStarBorder(ctx, 0, 0, 512, 700, 40)

    // Icon
    this.drawIcon(ctx, data.id, 256, 150, 60, data.color)

    // Subtitle (Eyebrow)
    ctx.fillStyle = data.color
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '4px'
    ctx.fillText(data.subtitle, 256, 280)

    // Title
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 48px Arial'
    ctx.fillText(data.title, 256, 350)

    // Text
    ctx.fillStyle = '#cccccc'
    ctx.font = '32px Arial'
    ctx.fillText(data.text, 256, 450, 400) // Max width 400

    const texture = new this.THREE.CanvasTexture(canvas)
    texture.minFilter = this.THREE.LinearFilter
    texture.magFilter = this.THREE.LinearFilter
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

  drawStarBorder(ctx, x, y, w, h, r) {
    // 1. Draw a very fine, continuous line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1
    this.roundRect(ctx, x, y, w, h, r)
    ctx.stroke()

    // 2. Scatter "stars" (dots) along the edges
    const numStarsPerSide = 40
    const scatter = 4 // variance in pixels

    // Helper to draw a single star dot
    const drawDot = (cx, cy) => {
        const size = Math.random() * 2 + 0.5
        ctx.fillStyle = Math.random() > 0.8 ? '#00ffff' : '#ffffff' // Occasional blue star
        ctx.globalAlpha = Math.random() * 0.8 + 0.2
        ctx.beginPath()
        ctx.arc(cx, cy, size, 0, Math.PI * 2)
        ctx.fill()
    }

    ctx.save()
    // Top Edge
    for (let i = 0; i < numStarsPerSide; i++) {
        drawDot(x + r + Math.random() * (w - 2 * r), y + (Math.random() - 0.5) * scatter)
    }
    // Bottom Edge
    for (let i = 0; i < numStarsPerSide; i++) {
        drawDot(x + r + Math.random() * (w - 2 * r), y + h + (Math.random() - 0.5) * scatter)
    }
    // Left Edge
    for (let i = 0; i < numStarsPerSide; i++) {
        drawDot(x + (Math.random() - 0.5) * scatter, y + r + Math.random() * (h - 2 * r))
    }
    // Right Edge
    for (let i = 0; i < numStarsPerSide; i++) {
        drawDot(x + w + (Math.random() - 0.5) * scatter, y + r + Math.random() * (h - 2 * r))
    }

    // Corners (Approximated with simple scattering around the arc centers could be better,
    // but just placing some dots near corners is sufficient for the effect)
    for(let i=0; i<15; i++) {
        // Top Left
        drawDot(x + r * 0.3, y + r * 0.3)
        // Top Right
        drawDot(x + w - r * 0.3, y + r * 0.3)
        // Bottom Left
        drawDot(x + r * 0.3, y + h - r * 0.3)
        // Bottom Right
        drawDot(x + w - r * 0.3, y + h - r * 0.3)
    }

    ctx.restore()
  }

  drawIcon(ctx, id, x, y, radius, color) {
    // Background Circle
    ctx.fillStyle = 'rgba(7, 161, 255, 0.1)'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw Vector Icon
    ctx.save()
    ctx.translate(x, y)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (id === 'about') { // Person / Code
        // Screen
        ctx.strokeRect(-22, -18, 44, 32)
        // Stand
        ctx.beginPath()
        ctx.moveTo(0, 14); ctx.lineTo(0, 22)
        ctx.moveTo(-10, 22); ctx.lineTo(10, 22)
        ctx.stroke()
        // Code lines
        ctx.beginPath()
        ctx.moveTo(-10, -5); ctx.lineTo(-4, -5)
        ctx.moveTo(-10, 2); ctx.lineTo(0, 2)
        ctx.stroke()
    } else if (id === 'projects') { // Rocket
        ctx.beginPath()
        // Body
        ctx.moveTo(0, -25)
        ctx.quadraticCurveTo(12, -8, 12, 12)
        ctx.lineTo(20, 20)
        ctx.lineTo(12, 20)
        ctx.lineTo(0, 20)
        ctx.lineTo(-12, 20)
        ctx.lineTo(-20, 20)
        ctx.lineTo(-12, 12)
        ctx.quadraticCurveTo(-12, -8, 0, -25)
        ctx.stroke()
        // Window
        ctx.beginPath()
        ctx.arc(0, -5, 6, 0, Math.PI*2)
        ctx.stroke()
        // Fire
        ctx.beginPath()
        ctx.moveTo(-6, 22); ctx.lineTo(0, 32); ctx.lineTo(6, 22);
        ctx.fillStyle = color
        ctx.fill()
    } else if (id === 'photos') { // Camera
        // Body
        ctx.strokeRect(-24, -16, 48, 32)
        // Bump
        ctx.strokeRect(-8, -22, 16, 6)
        // Lens
        ctx.beginPath()
        ctx.arc(0, 0, 10, 0, Math.PI*2)
        ctx.stroke()
        // Shutter
        ctx.beginPath()
        ctx.moveTo(18, -16); ctx.lineTo(18, -20); ctx.stroke()
    }

    ctx.restore()
  }

  setVisible(visible) {
    if (this.isVisible === visible) return
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

    this.cards.forEach(card => {
        // Animation: Fade
        if (card.userData.targetOpacity !== undefined) {
            card.material.opacity += (card.userData.targetOpacity - card.material.opacity) * 0.05
        }

        // Animation: Float
        const floatY = Math.sin(time * 0.001 + card.id) * 0.1

        let targetY = card.userData.originalY
        let targetScale = 1.0

        if (intersects.length > 0 && intersects[0].object === card) {
            targetY = card.userData.hoverY
            targetScale = 1.1
            document.body.style.cursor = 'pointer'
        }

        card.position.y += (targetY + floatY - card.position.y) * 0.1
        card.scale.setScalar(card.scale.x + (targetScale - card.scale.x) * 0.1)

        card.lookAt(this.camera.position)
    })

    if (!this.isVisible && this.cards[0].material.opacity < 0.01) {
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
  }
}
