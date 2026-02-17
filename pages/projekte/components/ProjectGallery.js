import * as THREE from 'three';

const LAYOUT_BREAKPOINTS = {
  mobile: 640,
  tablet: 1024,
};

function getLayoutPreset(viewportWidth = window.innerWidth) {
  if (viewportWidth <= LAYOUT_BREAKPOINTS.mobile) {
    return {
      key: 'mobile',
      scale: 0.72,
      spacing: 11,
      xAmplitude: 1.25,
      yAmplitude: 0.75,
      yOffset: 1.25,
      lookAtOffset: 7.5,
      focusOffset: 6.2,
    };
  }

  if (viewportWidth <= LAYOUT_BREAKPOINTS.tablet) {
    return {
      key: 'tablet',
      scale: 0.86,
      spacing: 12.5,
      xAmplitude: 2.1,
      yAmplitude: 1.05,
      yOffset: 1.6,
      lookAtOffset: 8.8,
      focusOffset: 7.1,
    };
  }

  return {
    key: 'desktop',
    scale: 1,
    spacing: 15,
    xAmplitude: 3,
    yAmplitude: 1.5,
    yOffset: 2,
    lookAtOffset: 10,
    focusOffset: 8,
  };
}

/**
 * Creates and manages the 3D objects for the project gallery.
 */
export class ProjectGallery {
  constructor(scene, projects) {
    this.scene = scene;
    this.projects = projects;
    this.objects = [];
    this.group = new THREE.Group();
    this.layout = getLayoutPreset();
    this.scene.add(this.group);

    this.initObjects();
  }

  getProjectPosition(index) {
    const zPos = -index * this.layout.spacing;
    const xPos = Math.sin(index * 0.5) * this.layout.xAmplitude;
    const yPos =
      Math.cos(index * 0.5) * this.layout.yAmplitude + this.layout.yOffset;

    return { xPos, yPos, zPos };
  }

  applyLayoutToObject(obj) {
    const { xPos, yPos, zPos } = this.getProjectPosition(obj.index);
    obj.group.position.set(xPos, yPos, zPos);
    obj.group.scale.setScalar(this.layout.scale);
    obj.group.lookAt(0, 0, zPos + this.layout.lookAtOffset);
    obj.originalPos.copy(obj.group.position);
    obj.zPos = zPos;
  }

  initObjects() {
    const geometry = new THREE.PlaneGeometry(4, 2.25); // 16:9 aspect ratio
    const frameGeometry = new THREE.BoxGeometry(4.2, 2.45, 0.1);
    const textureLoader = new THREE.TextureLoader();

    // Default fallback texture if image fails
    const defaultMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.4,
      metalness: 0.8,
    });

    this.projects.forEach((project, index) => {
      const projectGroup = new THREE.Group();

      // 1. Image Screen
      const material = defaultMaterial;
      const projectName = project.dirName || project.name || project.id;
      // We assume previews exist at this path as per previous code
      const imageUrl = `/content/assets/img/previews/${projectName}.svg`;

      // Attempt to load texture
      textureLoader.load(
        imageUrl,
        (texture) => {
          const screen = projectGroup.getObjectByName('screen');
          if (screen && 'material' in screen) {
            screen.material = new THREE.MeshBasicMaterial({ map: texture });
          }
        },
        undefined,
        () => {
          // On error, maybe show a "code" pattern or text
          // For now, stick to default dark grey
        },
      );

      const screen = new THREE.Mesh(geometry, material);
      screen.name = 'screen';
      projectGroup.add(screen);

      // 2. Frame
      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      frame.position.z = -0.06; // Slightly behind screen
      projectGroup.add(frame);

      // 3. Floating Title (3D Text is heavy, let's use a sprite for simplicity or skip if HUD handles it)
      // We skip 3D text for now as HUD is the primary reader.

      this.group.add(projectGroup);
      const obj = {
        group: projectGroup,
        originalPos: new THREE.Vector3(),
        index: index,
        zPos: 0,
      };

      this.applyLayoutToObject(obj);
      this.objects.push(obj);
    });
  }

  setViewportWidth(viewportWidth) {
    const nextLayout = getLayoutPreset(viewportWidth);

    if (nextLayout.key === this.layout.key) return;

    this.layout = nextLayout;
    this.objects.forEach((obj) => this.applyLayoutToObject(obj));
  }

  getPathLength() {
    return this.projects.length * this.layout.spacing + 10;
  }

  dispose() {
    this.objects.forEach((obj) => {
      obj.group.traverse((child) => {
        if (!child || !child.isMesh) return;

        if (child.geometry) {
          child.geometry.dispose();
        }

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        materials.forEach((material) => {
          if (!material) return;
          if (material.map) material.map.dispose();
          material.dispose();
        });
      });
    });

    this.scene.remove(this.group);
    this.objects = [];
  }

  /**
   * Updates object animations (e.g. floating, glowing)
   * @param {number} time - Global time for sine waves
   */
  update(time) {
    this.objects.forEach((obj) => {
      // Gentle floating animation
      obj.group.position.y =
        obj.originalPos.y + Math.sin(time + obj.index) * 0.1;

      // Optional: Fade out/in based on distance to camera
      // Dist: obj.zPos - cameraZ
      // If object is very far behind camera, hide it?
    });
  }

  /**
   * Finds the project currently closest to the "focus point" in front of the camera
   * @param {number} cameraZ - The camera's current Z position
   * @returns {number} index - Index of active project
   */
  getActiveIndex(cameraZ) {
    // Camera is at cameraZ looking at -Z.
    // Focus point is roughly 10 units in front of camera: cameraZ - 10
    const focusZ = cameraZ - this.layout.focusOffset;

    let closestIndex = 0;
    let minDiff = Infinity;

    this.objects.forEach((obj) => {
      const diff = Math.abs(obj.zPos - focusZ);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = obj.index;
      }
    });

    return closestIndex;
  }
}
