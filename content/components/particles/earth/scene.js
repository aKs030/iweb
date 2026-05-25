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
    antialias: false,
    alpha: true,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  });

  // Allow a moderate pixel ratio for low power consumption
  const maxAllowedPR = container.clientWidth > 1200 ? 1.5 : 1;
  const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, maxAllowedPR);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

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
  const directionalLight = new THREE.DirectionalLight(0xffffff, CONFIG.SUN.INTENSITY);
  directionalLight.position.set(CONFIG.SUN.RADIUS, CONFIG.SUN.HEIGHT, 0);
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

export function createEarthDepthOverlay(THREE, isMobileDevice = false) {
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    void main() {
      vNormal = normalize(mat3(modelMatrix) * normal);
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      float facing = clamp(dot(normalize(vNormal), viewDirection), 0.0, 1.0);
      float limbShadow = 1.0 - smoothstep(0.0, 0.34, facing);
      float lowerShadow = smoothstep(-0.15, 0.75, -normalize(vNormal).y);
      float alpha = limbShadow * 0.2 + lowerShadow * 0.045;
      gl_FragColor = vec4(vec3(0.012, 0.02, 0.052), alpha);
    }
  `;

  const depthMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    blending: THREE.NormalBlending,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
  });

  const segments = isMobileDevice ? CONFIG.EARTH.SEGMENTS_MOBILE : CONFIG.EARTH.SEGMENTS;
  const depthOverlay = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.EARTH.RADIUS * 1.003, segments, segments),
    depthMaterial
  );
  depthOverlay.name = "earth-depth-overlay";

  return depthOverlay;
}

export function createAtmosphere(THREE, isMobileDevice = false) {
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    uniform vec3 uRayleighColor;
    uniform vec3 uMieColor;
    uniform float uPower;
    uniform float uRayleighIntensity;
    uniform float uMieIntensity;
    uniform float uScatteringStrength;

    void main() {
      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      float fresnel = pow(1.0 - abs(dot(vNormal, viewDirection)), uPower);

      vec3 rayleighScatter = uRayleighColor * fresnel * uRayleighIntensity;
      vec3 mieScatter = uMieColor * fresnel * uMieIntensity;

      vec3 finalColor = (rayleighScatter + mieScatter) * uScatteringStrength;
      float alpha = fresnel * (uRayleighIntensity + uMieIntensity * 0.5);

      gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uRayleighColor: {
        value: new THREE.Color(CONFIG.ATMOSPHERE.RAYLEIGH_COLOR),
      },
      uMieColor: { value: new THREE.Color(CONFIG.ATMOSPHERE.MIE_COLOR) },
      uPower: { value: CONFIG.ATMOSPHERE.FRESNEL_POWER },
      uRayleighIntensity: { value: CONFIG.ATMOSPHERE.RAYLEIGH_INTENSITY },
      uMieIntensity: { value: CONFIG.ATMOSPHERE.MIE_INTENSITY },
      uScatteringStrength: { value: CONFIG.ATMOSPHERE.SCATTERING_STRENGTH },
    },
    blending: THREE.AdditiveBlending,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const segments = isMobileDevice ? CONFIG.EARTH.SEGMENTS_MOBILE : CONFIG.EARTH.SEGMENTS;

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.EARTH.RADIUS * CONFIG.ATMOSPHERE.SCALE, segments, segments),
    atmosphereMaterial
  );

  return atmosphere;
}
