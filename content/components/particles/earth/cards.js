
import { createLogger } from '../../../utils/shared-utilities.js'
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js'

const log = createLogger('CardManager')

export class CardManager {
  constructor(THREE, scene, camera, renderer, cssScene) {
    this.THREE = THREE
    this.scene = scene // WebGL Scene (unused for cards now)
    this.camera = camera
    this.renderer = renderer
    this.cssScene = cssScene
    this.cards = []
    this.isVisible = false

    // Group to hold all CSS cards
    this.cardGroup = new THREE.Group()
    if (this.cssScene) {
        this.cssScene.add(this.cardGroup)
    }
    this.cardGroup.visible = false
  }

  initFromDOM(sectionElement) {
    if (this.cards.length > 0) return // Already initialized

    const originalCards = sectionElement.querySelectorAll('.features-cards .card')
    if (!originalCards.length) return

    log.debug(`Found ${originalCards.length} cards to convert to 3D`)

    const positions = [
        { x: -4, y: 0, z: 0, color: '#07a1ff' },
        { x: 0, y: 0, z: 2, color: '#a107ff' }, // Center card slightly forward
        { x: 4, y: 0, z: 0, color: '#ff07a1' }
    ]

    originalCards.forEach((cardEl, index) => {
      // Clone the card element
      const clone = cardEl.cloneNode(true)

      // Add necessary styles for 3D representation
      clone.style.pointerEvents = 'auto' // Re-enable interaction
      clone.classList.add('card-3d') // For specific styling

      // Ensure the clone has dimensions (CSS3D needs layout)
      // We assume styling is handled by CSS, but we might need to enforce width/height
      // The original CSS handles it.

      // Wrap in CSS3DObject
      const object = new CSS3DObject(clone)

      const pos = positions[index] || { x: 0, y: 0, z: 0 }

      // Scale: CSS pixels to World Units
      // 1 unit = 100px approximately
      const SCALE = 0.01
      object.scale.set(SCALE, SCALE, SCALE)

      object.position.set(pos.x, pos.y, pos.z)

      // Store metadata
      object.userData = {
        originalY: pos.y,
        id: index,
        floatOffset: Math.random() * 100
      }

      this.cardGroup.add(object)
      this.cards.push(object)
    })

    if (this.isVisible) {
        this.cardGroup.visible = true
    }
  }

  setVisible(visible) {
    this.isVisible = visible
    if (this.cardGroup) {
        this.cardGroup.visible = visible
        // CSS3DObject visibility is linked to object.visible
        // But CSS3DRenderer checks it.
    }
  }

  update(time) {
    if (!this.isVisible || !this.cardGroup.visible) return

    this.cards.forEach(card => {
        // Animation: Float
        const floatY = Math.sin(time * 0.001 + card.userData.id) * 0.1
        card.position.y = card.userData.originalY + floatY

        // Face camera (Billboarding) - optional, or strict facing?
        // Usually cards are flat planes.
        // card.lookAt(this.camera.position)
        // User requested 3D cards, usually fixed orientation is better for reading text unless it's a billboard.
        // Let's keep them fixed orientation (facing Z) for now as it's cleaner for reading.
    })
  }

  cleanup() {
    if (this.cssScene) {
        this.cssScene.remove(this.cardGroup)
    }
    // Remove Elements? CSS3DObject removes element when object is removed from scene?
    // Actually no, we should probably remove the elements manually if they aren't auto-removed.
    // CSS3DRenderer usually manages the DOM.
    this.cards = []
  }
}
