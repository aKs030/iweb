import { CONFIG } from "./config.js";
import { getResponsiveCameraFov, isMobileCameraViewport } from "./camera.js";

export function setupScene(THREE, container) {
  const scene = new THREE.Scene();

  const aspectRatio = container.clientWidth / container.clientHeight;
  const isMobile = isMobileCameraViewport(container.clientWidth);
  const fov = getResponsiveCameraFov(CONFIG.CAMERA.FOV, isMobile);
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
    stencil: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });

  renderer.setPixelRatio(CONFIG.PERFORMANCE.PIXEL_RATIO);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Golden-hour look: balanced exposure keeps highlights clean while preserving
  // daylight clarity on the Berlin aerial close-up
  renderer.toneMappingExposure = 1.15;

  // Shadow maps are expensive (4096px on desktop). Disabled by default and
  // enabled per-section only when procedural buildings need them.
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // Fog density is controlled per-section in three-earth-system.js.
  // Starts at 0 — the Hero close-up needs no fog; deeper sections enable it
  // for depth cueing on the globe view.
  scene.fog = new THREE.FogExp2(0x060c14, 0);

  container.appendChild(renderer.domElement);

  renderer.domElement.style.opacity = "1";
  renderer.domElement.style.visibility = "visible";

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
  // Low, raking golden-hour sun → long hard shadows that break up flat rooftops
  const directionalLight = new THREE.DirectionalLight(0xffe8c8, CONFIG.SUN.INTENSITY);
  directionalLight.position.set(10, 3, 12);

  // Cinematic shadows — 4096 on desktop for crisp inter-building shadows
  directionalLight.castShadow = true;
  const shadowRes = typeof window !== "undefined" && window.devicePixelRatio >= 1.5 ? 4096 : 2048;
  directionalLight.shadow.mapSize.width = shadowRes;
  directionalLight.shadow.mapSize.height = shadowRes;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 45.0;
  // Tight frustum around the city closeup area
  const shadowBounds = 7.0;
  directionalLight.shadow.camera.left = -shadowBounds;
  directionalLight.shadow.camera.right = shadowBounds;
  directionalLight.shadow.camera.top = shadowBounds;
  directionalLight.shadow.camera.bottom = -shadowBounds;
  // Slight negative bias keeps shadow acne away without Peter-Panning
  directionalLight.shadow.bias = -0.0008;
  directionalLight.shadow.normalBias = 0.02;
  scene.add(directionalLight);

  // Cool-blue sky fill from the opposite side — gives buildings depth
  const fillLight = new THREE.DirectionalLight(0x7ab8ff, CONFIG.LIGHTING.DAY.FILL_INTENSITY);
  fillLight.position.set(-8, 4, 6);
  scene.add(fillLight);

  // Warm rim/bounce from low horizon — simulates ground-reflected golden light
  const rimLight = new THREE.PointLight(0xff9840, CONFIG.LIGHTING.DAY.RIM_INTENSITY, 90, 1.6);
  rimLight.position.set(12, 1, 8);
  scene.add(rimLight);

  const ambientLight = new THREE.AmbientLight(
    CONFIG.LIGHTING.DAY.AMBIENT_COLOR,
    CONFIG.LIGHTING.DAY.AMBIENT_INTENSITY
  );
  scene.add(ambientLight);

  return { directionalLight, ambientLight, fillLight, rimLight };
}
