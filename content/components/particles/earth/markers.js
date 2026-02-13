// import { CONFIG } from './config.js';
// import { createLogger } from '../../../core/logger.js';

// const log = createLogger('EarthMarkers');

export class MarkerManager {
  constructor(THREE, scene, camera, renderer, container) {
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.container = container;

    this.markers = [];
    this.activeMarker = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.tooltipElement = this._createTooltip();
    this.isDisposed = false;

    // Bind methods
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onClick = this.onClick.bind(this);

    this._setupEvents();
  }

  _createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = 'earth-marker-tooltip hidden';
    tooltip.innerHTML = `
      <div class="tooltip-content">
        <h3 class="tooltip-title"></h3>
        <p class="tooltip-desc"></p>
      </div>
    `;
    this.container.appendChild(tooltip);
    return tooltip;
  }

  _setupEvents() {
    this.container.addEventListener('mousemove', this.onMouseMove, {
      passive: true,
    });
    this.container.addEventListener('click', this.onClick);
  }

  createMarkers(markerData, earthRadius) {
    if (this.isDisposed) return;

    const geometry = new this.THREE.SphereGeometry(0.04, 16, 16);
    const material = new this.THREE.MeshBasicMaterial({
      color: 0xff3366,
      transparent: true,
      opacity: 0.8,
    });

    // Create a pulse ring geometry
    const ringGeometry = new this.THREE.RingGeometry(0.06, 0.08, 32);
    const ringMaterial = new this.THREE.MeshBasicMaterial({
      color: 0xff3366,
      transparent: true,
      opacity: 0.4,
      side: this.THREE.DoubleSide,
    });

    markerData.forEach((data) => {
      const position = this.latLonToVector3(data.lat, data.lon, earthRadius);

      const markerMesh = new this.THREE.Mesh(geometry, material.clone());
      markerMesh.position.copy(position);
      markerMesh.userData = { ...data, isMarker: true };

      // Add pulse ring
      const ring = new this.THREE.Mesh(ringGeometry, ringMaterial.clone());
      ring.position.copy(position);
      ring.lookAt(new this.THREE.Vector3(0, 0, 0)); // Face center of earth
      ring.userData = { isPulse: true, originalScale: 1 };

      // Group them for easy management if needed, but adding to scene/earth directly is often easier for raycasting
      // We will return these to be added to the Earth mesh
      this.markers.push({ mesh: markerMesh, ring, data });
    });

    return this.markers;
  }

  latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);

    return new this.THREE.Vector3(x, y, z);
  }

  update(time) {
    if (this.isDisposed) return;

    // Pulse animation
    const scale = 1 + Math.sin(time * 3) * 0.3;
    const opacity = 0.4 + Math.sin(time * 3) * 0.2;

    this.markers.forEach(({ ring }) => {
      if (ring) {
        ring.scale.set(scale, scale, scale);
        if (ring.material) ring.material.opacity = opacity;
      }
    });

    // Update tooltip position if active
    if (this.activeMarker) {
      this._updateTooltipPosition(this.activeMarker);
    }
  }

  onMouseMove(event) {
    if (this.isDisposed) return;

    // Normalize mouse coordinates
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.checkIntersection();
  }

  onClick() {
    if (this.activeMarker) {
      // Dispatch event for camera to fly to
      const evt = new CustomEvent('earth-marker-click', {
        detail: {
          lat: this.activeMarker.userData.lat,
          lon: this.activeMarker.userData.lon,
          marker: this.activeMarker,
        },
      });
      document.dispatchEvent(evt);
    }
  }

  checkIntersection() {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Raycast against all marker meshes
    const intersects = this.raycaster.intersectObjects(
      this.markers.map((m) => m.mesh),
      false,
    );

    if (intersects.length > 0) {
      const object = intersects[0].object;
      if (object !== this.activeMarker) {
        this.activeMarker = object;
        this.showTooltip(object.userData);
        document.body.style.cursor = 'pointer';

        // Highlight effect
        object.material.color.setHex(0xffffff);
        object.scale.set(1.2, 1.2, 1.2);
      }
    } else {
      if (this.activeMarker) {
        // Reset previous
        this.activeMarker.material.color.setHex(0xff3366);
        this.activeMarker.scale.set(1, 1, 1);

        this.activeMarker = null;
        this.hideTooltip();
        document.body.style.cursor = 'default'; // Or 'grab' if dragging implemented
      }
    }
  }

  showTooltip(data) {
    const title = this.tooltipElement.querySelector('.tooltip-title');
    const desc = this.tooltipElement.querySelector('.tooltip-desc');

    title.textContent = data.title;
    desc.textContent = data.desc || '';

    this.tooltipElement.classList.remove('hidden');
    this._updateTooltipPosition(this.activeMarker);
  }

  hideTooltip() {
    this.tooltipElement.classList.add('hidden');
  }

  _updateTooltipPosition(markerMesh) {
    if (!markerMesh) return;

    // Project 3D position to 2D screen
    const vector = markerMesh.position.clone();
    vector.project(this.camera); // This projects relative to camera, but markers are inside Earth group...
    // Wait, markers are children of Earth? If so, we need World Position.

    const worldPos = new this.THREE.Vector3();
    markerMesh.getWorldPosition(worldPos);
    worldPos.project(this.camera);

    const x = (worldPos.x * 0.5 + 0.5) * this.container.clientWidth;
    const y = (-(worldPos.y * 0.5) + 0.5) * this.container.clientHeight;

    this.tooltipElement.style.transform = `translate(${x}px, ${y}px)`;
  }

  cleanup() {
    this.isDisposed = true;
    this.container.removeEventListener('mousemove', this.onMouseMove);
    this.container.removeEventListener('click', this.onClick);
    if (this.tooltipElement && this.tooltipElement.parentNode) {
      this.tooltipElement.parentNode.removeChild(this.tooltipElement);
    }
    this.markers = [];
  }
}
