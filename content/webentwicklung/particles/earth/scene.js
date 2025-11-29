import { CONFIG } from './config.js';

export function setupScene(THREE, container) {
  const scene = new THREE.Scene();

  const aspectRatio = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(
    CONFIG.CAMERA.FOV,
    aspectRatio,
    CONFIG.CAMERA.NEAR,
    CONFIG.CAMERA.FAR
  );

  const renderer = new THREE.WebGLRenderer({
    canvas: container.querySelector('canvas') || undefined,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });

  const pixelRatio = Math.min(window.devicePixelRatio, 2.0);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  container.appendChild(renderer.domElement);

  return { scene, camera, renderer };
}

export function setupLighting(THREE, scene) {
  const directionalLight = new THREE.DirectionalLight(0xffffff, CONFIG.SUN.INTENSITY);
  directionalLight.position.set(CONFIG.SUN.RADIUS, CONFIG.SUN.HEIGHT, 0);
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(
    CONFIG.LIGHTING.DAY.AMBIENT_COLOR,
    CONFIG.LIGHTING.DAY.AMBIENT_INTENSITY
  );
  scene.add(ambientLight);

  return { directionalLight, ambientLight };
}

export function createAtmosphere(THREE) {
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
      uRayleighColor: { value: new THREE.Color(CONFIG.ATMOSPHERE.RAYLEIGH_COLOR) },
      uMieColor: { value: new THREE.Color(CONFIG.ATMOSPHERE.MIE_COLOR) },
      uPower: { value: CONFIG.ATMOSPHERE.FRESNEL_POWER },
      uRayleighIntensity: { value: CONFIG.ATMOSPHERE.RAYLEIGH_INTENSITY },
      uMieIntensity: { value: CONFIG.ATMOSPHERE.MIE_INTENSITY },
      uScatteringStrength: { value: CONFIG.ATMOSPHERE.SCATTERING_STRENGTH }
    },
    blending: THREE.AdditiveBlending,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false
  });

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(
      CONFIG.EARTH.RADIUS * CONFIG.ATMOSPHERE.SCALE,
      CONFIG.EARTH.SEGMENTS,
      CONFIG.EARTH.SEGMENTS
    ),
    atmosphereMaterial
  );

  return atmosphere;
}
