import { CONFIG } from "./config.js";

export function setupScene(THREE, container) {
  const scene = new THREE.Scene();

  const aspectRatio = container.clientWidth / container.clientHeight;
  // Use wider FOV on mobile for better vertical card visibility
  const isMobile = container.clientWidth < 768;
  const fov = isMobile ? 55 : CONFIG.CAMERA.FOV;
  const camera = new THREE.PerspectiveCamera(
    fov,
    aspectRatio,
    CONFIG.CAMERA.NEAR,
    CONFIG.CAMERA.FAR
  );

  const renderer = new THREE.WebGLRenderer({
    canvas: container.querySelector("canvas") || undefined,
    antialias: !isMobile,
    alpha: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });

  renderer.setPixelRatio(CONFIG.PERFORMANCE.PIXEL_RATIO);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  container.appendChild(renderer.domElement);

  // Ensure canvas is visible immediately
  renderer.domElement.style.opacity = "1";
  renderer.domElement.style.visibility = "visible";

  // Mark that the renderer DOM element has been attached so tests or other code can detect presence
  try {
    container.dataset.threeAttached = "1";
    document.dispatchEvent(
      new CustomEvent("three-attached", {
        detail: { containerId: container.id || null },
      })
    );
  } catch {
    /* ignore */
  }

  return { scene, camera, renderer };
}

export function setupLighting(THREE, scene) {
  const directionalLight = new THREE.DirectionalLight(0xfff4e5, CONFIG.SUN.INTENSITY);
  // Light the camera-facing hemisphere so Europe remains legible in the hero.
  directionalLight.position.set(-10, 6, 12);
  scene.add(directionalLight);

  const fillLight = new THREE.DirectionalLight(0x6ea8ff, CONFIG.LIGHTING.DAY.FILL_INTENSITY);
  fillLight.position.set(-8, -1.5, 9);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xffc76a, CONFIG.LIGHTING.DAY.RIM_INTENSITY, 80, 1.8);
  rimLight.position.set(-9, 6, 10);
  scene.add(rimLight);

  const ambientLight = new THREE.AmbientLight(
    CONFIG.LIGHTING.DAY.AMBIENT_COLOR,
    CONFIG.LIGHTING.DAY.AMBIENT_INTENSITY
  );
  scene.add(ambientLight);

  return { directionalLight, ambientLight, fillLight, rimLight };
}
