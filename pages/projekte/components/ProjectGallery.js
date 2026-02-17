import * as THREE from 'three';

/**
 * Creates and manages the 3D objects for the project gallery.
 */
export class ProjectGallery {
  constructor(scene, projects) {
    this.scene = scene;
    this.projects = projects;
    this.objects = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.initObjects();
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

      // Calculate position
      // Z moves forward (negative in ThreeJS), X oscillates
      // Position objects higher in the viewport to avoid HUD overlap
      const zPos = -index * 15; // 15 units apart
      const xPos = Math.sin(index * 0.5) * 3; // Wiggle left/right
      const yPos = Math.cos(index * 0.5) * 1.5 + 2; // Wiggle up/down + offset higher

      projectGroup.position.set(xPos, yPos, zPos);

      // Look roughly at the center path (0,0, zPos + offset)
      projectGroup.lookAt(0, 0, zPos + 10);

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
      screen.userData.index = index;
      projectGroup.add(screen);

      // 2. Frame
      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      frame.position.z = -0.06; // Slightly behind screen
      frame.userData.index = index;
      projectGroup.add(frame);

      // 3. Floating Title (3D Text is heavy, let's use a sprite for simplicity or skip if HUD handles it)
      // We skip 3D text for now as HUD is the primary reader.

      this.group.add(projectGroup);
      this.objects.push({
        group: projectGroup,
        originalPos: projectGroup.position.clone(),
        index: index,
        zPos: zPos,
      });
    });
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
    const focusZ = cameraZ - 8;

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
