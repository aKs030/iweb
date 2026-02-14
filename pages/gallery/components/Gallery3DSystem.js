import * as THREE from 'three';

/**
 * Modern 3D Gallery System
 * Renders a 3D helix of images and videos with smooth camera movement.
 * Optimized with proper memory disposal and render loops.
 */
export class Gallery3DSystem {
  constructor(container, items, onSelect) {
    this.container = container;
    this.items = items.map((item) => ({ ...item }));
    this.onSelect = onSelect;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-1000, -1000); // Start off-screen

    this.scrollPos = 0;
    this.targetScrollPos = 0;
    this.isDragging = false;
    this.startY = 0;
    this.objects = [];
    this.frameId = null;
    this.clock = new THREE.Clock();

    this.params = {
      radius: 8,
      verticalStep: 4,
      rotationStep: Math.PI / 2.5,
      itemWidth: 4.8,
      itemHeight: 2.7,
    };

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
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.02);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffffff, 100);
    spotLight.position.set(0, 10, 0);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    this.camera.add(spotLight);
    this.scene.add(this.camera);

    this.createGalleryObjects();
    this.createStars();
    this.setupEvents();

    this.clock.start();
    this.animate();
  }

  createGalleryObjects() {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'anonymous';
    const geometry = new THREE.PlaneGeometry(
      this.params.itemWidth,
      this.params.itemHeight,
    );

    // Shared Material für den Glasrahmen für bessere Performance
    const frameGeo = new THREE.PlaneGeometry(
      this.params.itemWidth + 0.2,
      this.params.itemHeight + 0.2,
    );
    const frameMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.2,
      transmission: 0.5,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });

    this.items.forEach((item, index) => {
      const group = new THREE.Group();
      const angle = index * this.params.rotationStep;
      const y = -index * this.params.verticalStep;
      const x = Math.cos(angle) * this.params.radius;
      const z = Math.sin(angle) * this.params.radius;

      group.position.set(x, y, z);
      group.lookAt(0, y, 0);

      let material;
      if (item.type === 'video') {
        const video = document.createElement('video');
        video.src = item.url;
        video.crossOrigin = 'anonymous';
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.play().catch(() => {});

        const videoTexture = new THREE.VideoTexture(video);
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        material = new THREE.MeshBasicMaterial({ map: videoTexture });
        item.videoElement = video;
      } else {
        material = new THREE.MeshBasicMaterial({ color: 0x333333 });
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

      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.z = -0.05;
      group.add(frame);

      this.scene.add(group);
      this.objects.push({ group, mesh, index, baseY: y, item });
    });
  }

  createStars() {
    const starGeo = new THREE.BufferGeometry();
    const count = 3000;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 200;

    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });

    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);
  }

  setupEvents() {
    window.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('resize', this.handleResize);
    this.container.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.container.addEventListener(
      'touchstart',
      (e) => this.onMouseDown({ clientY: e.touches[0].clientY }),
      { passive: true },
    );
    window.addEventListener(
      'touchmove',
      (e) =>
        this.onMouseMove({
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY,
        }),
      { passive: true },
    );
    window.addEventListener('touchend', this.onMouseUp);
    this.container.addEventListener('click', this.onClick);
  }

  handleWheel(e) {
    e.preventDefault();
    this.targetScrollPos += e.deltaY * 0.005;
    this.clampScroll();
  }

  clampScroll() {
    const maxScroll = (this.items.length - 1) * this.params.verticalStep;
    this.targetScrollPos = Math.max(
      -2,
      Math.min(this.targetScrollPos, maxScroll + 2),
    );
  }

  onMouseDown(e) {
    this.isDragging = true;
    this.startY = e.clientY;
  }

  onMouseMove(e) {
    if (e.clientX !== undefined) {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }
    if (!this.isDragging) return;
    const delta = (e.clientY - this.startY) * 0.02;
    this.targetScrollPos -= delta;
    this.startY = e.clientY;
    this.clampScroll();
  }

  onMouseUp() {
    this.isDragging = false;
  }

  onClick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.objects.map((o) => o.mesh),
    );
    if (intersects.length > 0) {
      const data = intersects[0].object.userData;
      if (this.onSelect) this.onSelect(data.item);
      this.targetScrollPos = data.id * this.params.verticalStep;
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
    const time = this.clock.getElapsedTime();

    this.scrollPos += (this.targetScrollPos - this.scrollPos) * 0.1;
    const camY = -this.scrollPos;

    this.camera.position.y = camY;
    this.camera.rotation.y =
      -(this.scrollPos / this.params.verticalStep) * this.params.rotationStep -
      Math.PI / 2;

    // Raycasting optimization
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.objects.map((o) => o.mesh),
    );
    const hoveredMesh = intersects.length > 0 ? intersects[0].object : null;

    this.objects.forEach((obj) => {
      obj.group.position.y = obj.baseY + Math.sin(time + obj.index) * 0.1;
      const targetScale = obj.mesh === hoveredMesh ? 1.1 : 1.0;
      obj.group.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.1,
      );
    });

    if (this.stars) {
      this.stars.rotation.y = time * 0.05;
      this.stars.position.y = camY;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.frameId) cancelAnimationFrame(this.frameId);

    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('touchmove', this.onMouseMove);
    window.removeEventListener('touchend', this.onMouseUp);

    // Deep Dispose - Verhindert WebGL Memory Leaks!
    this.scene.traverse((object) => {
      if (object.isMesh || object.isPoints) {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => this.disposeMaterial(mat));
          } else {
            this.disposeMaterial(object.material);
          }
        }
      }
    });

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.container.removeChild(this.renderer.domElement);
    }

    this.objects.forEach((obj) => {
      if (obj.item.videoElement) {
        obj.item.videoElement.pause();
        obj.item.videoElement.removeAttribute('src');
        obj.item.videoElement.load();
      }
    });
  }

  disposeMaterial(material) {
    if (material.map) material.map.dispose();
    if (material.lightMap) material.lightMap.dispose();
    if (material.bumpMap) material.bumpMap.dispose();
    if (material.normalMap) material.normalMap.dispose();
    if (material.specularMap) material.specularMap.dispose();
    if (material.envMap) material.envMap.dispose();
    material.dispose();
  }
}
