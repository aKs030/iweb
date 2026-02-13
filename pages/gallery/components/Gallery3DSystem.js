import * as THREE from 'three';

/**
 * Modern 3D Gallery System
 * Renders a 3D helix of images and videos with smooth camera movement.
 */
export class Gallery3DSystem {
  constructor(container, items, onSelect) {
    this.container = container;
    this.items = items.map(item => ({ ...item })); // Clone items to avoid mutation side effects
    this.onSelect = onSelect;

    // Core components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // State
    this.scrollPos = 0;
    this.targetScrollPos = 0;
    this.isDragging = false;
    this.startY = 0;
    this.objects = []; // { group, mesh, index, baseY, item }
    this.frameId = null;

    // Configuration
    this.params = {
      radius: 8, // Radius of the helix (distance from center)
      verticalStep: 4, // Height between items
      rotationStep: Math.PI / 2.5, // Angle between items (approx 72 degrees)
      itemWidth: 4.8,
      itemHeight: 2.7, // 16:9 aspect ratio scaling
    };

    // Bind methods
    this.animate = this.animate.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onClick = this.onClick.bind(this);

    this.init();
  }

  init() {
    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.02);

    // 2. Camera Setup
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Camera starts at center, looking out
    this.camera.position.set(0, 0, 0);

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Spotlights to highlight images
    const spotLight = new THREE.SpotLight(0xffffff, 100);
    spotLight.position.set(0, 10, 0);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    this.camera.add(spotLight); // Light follows camera
    this.scene.add(this.camera);

    // 5. Create Objects
    this.createGalleryObjects();
    this.createStars();

    // 6. Event Listeners
    this.setupEvents();

    // 7. Start Loop
    this.animate();
  }

  createGalleryObjects() {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'anonymous';

    const geometry = new THREE.PlaneGeometry(
      this.params.itemWidth,
      this.params.itemHeight
    );

    this.items.forEach((item, index) => {
      // Group to hold mesh and frame
      const group = new THREE.Group();

      // Position in Helix (Spiral down)
      const angle = index * this.params.rotationStep;
      const y = -index * this.params.verticalStep;
      const x = Math.cos(angle) * this.params.radius;
      const z = Math.sin(angle) * this.params.radius;

      group.position.set(x, y, z);

      // Look at center (0, y, 0)
      group.lookAt(0, y, 0);
      // Flip logic: Camera is inside looking out.
      // Plane looks at (0,0,0) by default means its front faces (0,0,0).
      // So if camera looks at it from (0,0,0), we see the front. Correct.

      // 1. Mesh Content
      let material;
      if (item.type === 'video') {
        const video = document.createElement('video');
        video.src = item.url;
        video.crossOrigin = 'anonymous';
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.play().catch(e => console.warn('Autoplay prevented:', e));

        const videoTexture = new THREE.VideoTexture(video);
        videoTexture.colorSpace = THREE.SRGBColorSpace;

        material = new THREE.MeshBasicMaterial({ map: videoTexture });
        item.videoElement = video;
      } else {
        material = new THREE.MeshBasicMaterial({
          color: 0x333333, // Placeholder
        });

        textureLoader.load(item.url, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          material.map = tex;
          material.color.setHex(0xffffff);
          material.needsUpdate = true;
        });
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { id: index, item };
      group.add(mesh);

      // 2. Glass Frame
      const frameGeo = new THREE.PlaneGeometry(
        this.params.itemWidth + 0.2,
        this.params.itemHeight + 0.2
      );
      const frameMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.2,
        transmission: 0.5, // Glass effect
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
      });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.z = -0.05; // Slightly behind
      group.add(frame);

      // 3. Title Text (Optional, maybe simple sprite or just overlay)
      // Skipping 3D text for performance/complexity, relies on UI overlay.

      this.scene.add(group);
      this.objects.push({ group, mesh, index, baseY: y, item });
    });
  }

  createStars() {
    const starGeo = new THREE.BufferGeometry();
    const count = 3000;
    const pos = new Float32Array(count * 3);

    for(let i=0; i<count*3; i++) {
      pos[i] = (Math.random() - 0.5) * 200; // Wide field
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true
    });

    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);
  }

  setupEvents() {
    // Wheel
    window.addEventListener('wheel', this.handleWheel, { passive: false });

    // Resize
    window.addEventListener('resize', this.handleResize);

    // Touch/Drag
    this.container.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);

    // Touch events for mobile
    this.container.addEventListener('touchstart', (e) => {
      this.onMouseDown({ clientY: e.touches[0].clientY });
    }, { passive: false });
    this.container.addEventListener('touchmove', (e) => {
      this.onMouseMove({ clientY: e.touches[0].clientY });
    }, { passive: false });
    this.container.addEventListener('touchend', this.onMouseUp);

    // Click
    this.container.addEventListener('click', this.onClick);
  }

  handleWheel(e) {
    e.preventDefault();
    this.targetScrollPos += e.deltaY * 0.005; // Sensitive scroll
    this.clampScroll();
  }

  clampScroll() {
    const maxScroll = (this.items.length - 1) * this.params.verticalStep;
    // Allow slight overscroll
    this.targetScrollPos = Math.max(-2, Math.min(this.targetScrollPos, maxScroll + 2));
  }

  onMouseDown(e) {
    this.isDragging = true;
    this.startY = e.clientY;
  }

  onMouseMove(e) {
    // Update mouse for raycaster even if not dragging
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (!this.isDragging) return;

    const delta = (e.clientY - this.startY) * 0.02;
    this.targetScrollPos -= delta;
    this.startY = e.clientY;
    this.clampScroll();
  }

  onMouseUp() {
    this.isDragging = false;
  }

  onClick(e) {
    // Update mouse position just in case
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // Raycast to find clicked object
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Intersect with meshes only (not frames/stars)
    const meshes = this.objects.map(o => o.mesh);
    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const selected = intersects[0].object;
      const data = selected.userData;
      if (this.onSelect) {
        this.onSelect(data.item);

        // Auto scroll to this item?
        this.targetScrollPos = data.id * this.params.verticalStep;
      }
    }
  }

  handleResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    this.frameId = requestAnimationFrame(this.animate);

    // 1. Smooth Scroll Physics
    this.scrollPos += (this.targetScrollPos - this.scrollPos) * 0.1;

    // 2. Camera Movement (Helix Path)
    // We move camera down Y axis
    const camY = -this.scrollPos;
    this.camera.position.y = camY;

    // Camera Rotation (Look outwards)
    // One full rotation per X items?
    const angle = (this.scrollPos / this.params.verticalStep) * this.params.rotationStep;
    this.camera.rotation.y = -angle - Math.PI / 2; // Offset to face "front"

    // 3. Object Animation (Float & Hover)
    const time = performance.now() * 0.001;

    // Raycaster for hover effect
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = this.objects.map(o => o.mesh);
    const intersects = this.raycaster.intersectObjects(meshes);
    const hoveredMesh = intersects.length > 0 ? intersects[0].object : null;

    this.objects.forEach(obj => {
      // Floating sine wave
      obj.group.position.y = obj.baseY + Math.sin(time + obj.index) * 0.1;

      // Hover scale
      const isHovered = (obj.mesh === hoveredMesh);
      const targetScale = isHovered ? 1.1 : 1.0;
      obj.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

      // Look at camera? No, they face center.
    });

    // 4. Stars Animation
    if (this.stars) {
      this.stars.rotation.y = time * 0.05;
      this.stars.position.y = camY; // Stars follow camera vertically so we never run out
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.frameId) cancelAnimationFrame(this.frameId);

    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);

    // Dispose Three.js
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }

    this.objects.forEach(obj => {
      if (obj.item.videoElement) {
        obj.item.videoElement.pause();
        obj.item.videoElement.src = '';
      }
    });
  }
}
