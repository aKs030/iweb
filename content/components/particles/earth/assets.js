import { CONFIG } from "./config.js";
import { getEarthTextureSet } from "./texture-paths.js";
import { createLogger } from "../../../core/logger.js";
import { isLocalDevRuntime } from "../../../core/runtime-env.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

const log = createLogger("EarthAssets");
const TEXTURE_TIMEOUT_MS = 10000;
const KTX2_TRANSCODER_URL = "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/libs/basis/";
const DAYLIGHT_MAP_FRAGMENT = `#include <map_fragment>
vec3 sourceAlbedo = texture2D(map, vMapUv).rgb;
earthOceanMask = smoothstep(0.0, 0.03, sourceAlbedo.b - sourceAlbedo.r)
  * smoothstep(-0.005, 0.025, sourceAlbedo.b - sourceAlbedo.g);
vec3 daylightGrade = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(0.93));
daylightGrade *= vec3(1.015, 1.025, 1.035);
float oceanLuma = dot(sourceAlbedo, vec3(0.2126, 0.7152, 0.0722));
vec3 oceanGrade = mix(
  sourceAlbedo,
  oceanLuma * vec3(0.55, 0.8, 1.02),
  0.62
);
diffuseColor.rgb = min(mix(daylightGrade, oceanGrade, earthOceanMask * 0.52), vec3(1.0));`;

const EARTH_ROUGHNESS_FRAGMENT = `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.31, earthOceanMask);`;

const EARTH_FRESNEL_FRAGMENT = `float earthFresnel = pow(
  1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0),
  3.0
);
outgoingLight += vec3(0.035, 0.105, 0.16) * earthFresnel * earthOceanMask;
#include <opaque_fragment>`;

const NIGHT_EARTHLIGHT_FRAGMENT = `float nightEarthFresnel = pow(
  1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0),
  2.4
);
outgoingLight += diffuseColor.rgb * vec3(0.1, 0.14, 0.22);
outgoingLight += vec3(0.012, 0.035, 0.075) * nightEarthFresnel;
#include <opaque_fragment>`;

function createCityGlow(THREE, nightTexture, segments, isMobileDevice) {
  const glowGroup = new THREE.Group();
  const layerSettings = isMobileDevice
    ? [{ altitude: 0.018, opacity: 0.11 }]
    : [
        { altitude: 0.012, opacity: 0.105 },
        { altitude: 0.032, opacity: 0.045 },
      ];

  layerSettings.forEach(({ altitude, opacity }) => {
    const geometry = new THREE.SphereGeometry(CONFIG.EARTH.RADIUS + altitude, segments, segments);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        cityMap: { value: nightTexture },
        glowOpacity: { value: opacity },
      },
      vertexShader: `
        varying vec2 vCityUv;
        void main() {
          vCityUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D cityMap;
        uniform float glowOpacity;
        varying vec2 vCityUv;
        void main() {
          vec3 cityColor = texture2D(cityMap, vCityUv).rgb;
          float brightness = max(cityColor.r, max(cityColor.g, cityColor.b));
          float cityMask = smoothstep(0.24, 0.72, brightness);
          gl_FragColor = vec4(cityColor * cityMask, cityMask * glowOpacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.FrontSide,
      toneMapped: false,
    });
    glowGroup.add(new THREE.Mesh(geometry, material));
  });

  glowGroup.visible = false;
  glowGroup.renderOrder = 2;
  return glowGroup;
}

function selectTextureSet(renderer, isMobileDevice) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, CONFIG.PERFORMANCE.PIXEL_RATIO);
  const physicalWidth = renderer.domElement.clientWidth * pixelRatio;

  return getEarthTextureSet({
    isMobile: isMobileDevice,
    compact: renderer.capabilities.maxTextureSize < 8192 || physicalWidth < 1800,
  });
}

export function createEarthKTX2Loader(renderer, loadingManager, isMobileDevice) {
  if (typeof WebAssembly === "undefined") return null;

  return new KTX2Loader(loadingManager)
    .setTranscoderPath(KTX2_TRANSCODER_URL)
    .setWorkerLimit(isMobileDevice ? 1 : 2)
    .detectSupport(renderer);
}

async function loadPreferredTexture(ktx2Loader, textureLoader, compressedPath, fallbackPath) {
  if (ktx2Loader && compressedPath) {
    try {
      return await ktx2Loader.loadAsync(compressedPath);
    } catch (error) {
      if (isLocalDevRuntime()) log.warn("KTX2 texture fallback:", compressedPath, error);
    }
  }

  return textureLoader.loadAsync(fallbackPath);
}

function configureTexture(THREE, texture, anisotropy, colorSpace) {
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = !texture.isCompressedTexture;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = !texture.isCompressedTexture;
  texture.premultiplyAlpha = false;
  texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
}

export async function createEarthSystem(
  THREE,
  scene,
  renderer,
  isMobileDevice,
  loadingManager,
  ktx2Loader = null
) {
  const manager = loadingManager || new THREE.LoadingManager();
  const textureLoader = new THREE.TextureLoader(manager);
  const textureSet = selectTextureSet(renderer, isMobileDevice);

  let dayTexture, nightTexture, normalTexture, bumpTexture;
  let timeoutId;
  try {
    const texturePromise = Promise.all([
      loadPreferredTexture(ktx2Loader, textureLoader, textureSet.DAY_KTX2, textureSet.DAY),
      loadPreferredTexture(ktx2Loader, textureLoader, textureSet.NIGHT_KTX2, textureSet.NIGHT),
      textureLoader.loadAsync(textureSet.NORMAL),
      textureLoader.loadAsync(textureSet.BUMP),
    ]);
    [dayTexture, nightTexture, normalTexture, bumpTexture] = await Promise.race([
      texturePromise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Texture loading timeout")),
          TEXTURE_TIMEOUT_MS
        );
      }),
    ]);
  } catch (err) {
    if (isLocalDevRuntime()) log.error("Texture loading failed:", err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }

  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), isMobileDevice ? 4 : 16);
  configureTexture(THREE, dayTexture, anisotropy, THREE.SRGBColorSpace);
  configureTexture(THREE, nightTexture, anisotropy, THREE.SRGBColorSpace);
  configureTexture(THREE, normalTexture, anisotropy, THREE.NoColorSpace);
  configureTexture(THREE, bumpTexture, anisotropy, THREE.NoColorSpace);

  const dayMaterial = new THREE.MeshPhysicalMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    normalScale: new THREE.Vector2(0.58, 0.58),
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE * 0.72,
    roughness: 0.82,
    metalness: 0,
    clearcoat: 0.055,
    clearcoatRoughness: 0.3,
    emissive: 0x8b9cac,
    emissiveMap: dayTexture,
    emissiveIntensity: 0.19,
  });
  dayMaterial.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "float earthOceanMask = 0.0;\nvoid main() {")
      .replace("#include <map_fragment>", DAYLIGHT_MAP_FRAGMENT)
      .replace("#include <roughnessmap_fragment>", EARTH_ROUGHNESS_FRAGMENT)
      .replace("#include <opaque_fragment>", EARTH_FRESNEL_FRAGMENT);
  };
  dayMaterial.customProgramCacheKey = () => "earth-day-pbr-water-v1";

  const nightMaterial = new THREE.MeshPhysicalMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    normalScale: new THREE.Vector2(0.72, 0.72),
    roughness: 0.76,
    metalness: 0,
    clearcoat: 0.025,
    clearcoatRoughness: 0.34,
    emissive: 0xffb65d,
    emissiveMap: nightTexture,
    emissiveIntensity: CONFIG.EARTH.EMISSIVE_INTENSITY * 4.4,
  });
  nightMaterial.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      NIGHT_EARTHLIGHT_FRAGMENT
    );
  };
  nightMaterial.customProgramCacheKey = () => "earth-night-earthlight-v1";

  // OPTIMIZATION: Reduce segments on mobile
  const segments = isMobileDevice ? CONFIG.EARTH.SEGMENTS_MOBILE : CONFIG.EARTH.SEGMENTS;

  const earthGeometry = new THREE.SphereGeometry(CONFIG.EARTH.RADIUS, segments, segments);
  const earthMesh = new THREE.Mesh(earthGeometry, dayMaterial);
  earthMesh.position.set(0, -6, 0);
  earthMesh.scale.set(1.5, 1.5, 1.5);
  earthMesh.rotation.z = THREE.MathUtils.degToRad(CONFIG.EARTH.AXIAL_TILT);
  earthMesh.userData.currentMode = "day";
  earthMesh.userData.targetPosition = new THREE.Vector3(0, -6, 0);
  earthMesh.userData.targetScale = 1.5;
  earthMesh.userData.targetRotation = 0;

  const cityGlowGroup = createCityGlow(THREE, nightTexture, segments, isMobileDevice);
  earthMesh.add(cityGlowGroup);
  scene.add(earthMesh);

  return { earthMesh, dayMaterial, nightMaterial, cityGlowGroup };
}

export async function createMoonSystem(THREE, scene, renderer, isMobileDevice, loadingManager) {
  const textureLoader = new THREE.TextureLoader(loadingManager);
  const textureSet = selectTextureSet(renderer, isMobileDevice);

  const [moonTexture, moonBumpTexture] = await Promise.all([
    textureLoader.loadAsync(textureSet.MOON).catch(() => null),
    textureLoader.loadAsync(textureSet.MOON_BUMP).catch(() => null),
  ]);

  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), isMobileDevice ? 4 : 16);
  if (moonTexture) {
    configureTexture(THREE, moonTexture, anisotropy, THREE.SRGBColorSpace);
  }
  if (moonBumpTexture) {
    configureTexture(THREE, moonBumpTexture, anisotropy, THREE.NoColorSpace);
  }

  const moonMaterial = new THREE.MeshStandardMaterial({
    map: moonTexture,
    bumpMap: moonBumpTexture,
    bumpScale: CONFIG.MOON.BUMP_SCALE,
    roughness: 0.96,
    metalness: 0,
    color: moonTexture ? 0xffffff : 0xaaaaaa,
  });

  const moonLOD = new THREE.LOD();

  // High detail
  const moonGeometryHigh = new THREE.SphereGeometry(
    CONFIG.MOON.RADIUS,
    CONFIG.MOON.SEGMENTS,
    CONFIG.MOON.SEGMENTS
  );
  moonLOD.addLevel(new THREE.Mesh(moonGeometryHigh, moonMaterial), 0);

  // Medium detail
  const moonGeometryMed = new THREE.SphereGeometry(CONFIG.MOON.RADIUS, 28, 28);
  moonLOD.addLevel(new THREE.Mesh(moonGeometryMed, moonMaterial), 15);

  // Low detail
  const moonGeometryLow = new THREE.SphereGeometry(CONFIG.MOON.RADIUS, 16, 16);
  moonLOD.addLevel(new THREE.Mesh(moonGeometryLow, moonMaterial), 40);

  moonLOD.position.set(CONFIG.MOON.DISTANCE, 2, -10);
  moonLOD.userData.targetPosition = new THREE.Vector3(CONFIG.MOON.DISTANCE, 2, -10);
  moonLOD.userData.targetScale = 1;

  scene.add(moonLOD);
  return moonLOD;
}

export async function createCloudLayer(
  THREE,
  renderer,
  loadingManager,
  isMobileDevice,
  ktx2Loader = null
) {
  const textureLoader = new THREE.TextureLoader(loadingManager);
  try {
    const textureSet = selectTextureSet(renderer, isMobileDevice);
    const cloudTexture = await loadPreferredTexture(
      ktx2Loader,
      textureLoader,
      textureSet.CLOUDS_KTX2,
      textureSet.CLOUDS
    );
    const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), isMobileDevice ? 4 : 12);
    configureTexture(THREE, cloudTexture, anisotropy, THREE.NoColorSpace);
    cloudTexture.wrapT = THREE.RepeatWrapping;

    const cloudMaterial = new THREE.MeshStandardMaterial({
      alphaMap: cloudTexture,
      color: 0xf4f8ff,
      emissive: 0xb6c5d5,
      emissiveIntensity: 0.55,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: CONFIG.CLOUDS.OPACITY,
      blending: THREE.NormalBlending,
      depthWrite: false,
      alphaTest: 0.025,
      side: THREE.FrontSide,
    });

    const segments = isMobileDevice ? CONFIG.EARTH.SEGMENTS_MOBILE : CONFIG.EARTH.SEGMENTS;

    const cloudGeometry = new THREE.SphereGeometry(
      CONFIG.EARTH.RADIUS + CONFIG.CLOUDS.ALTITUDE,
      segments,
      segments
    );
    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    const cloudGroup = new THREE.Group();
    cloudGroup.add(cloudMesh);

    if (!isMobileDevice) {
      const shadowMaterial = new THREE.MeshBasicMaterial({
        alphaMap: cloudTexture,
        color: 0x07111d,
        transparent: true,
        opacity: CONFIG.CLOUDS.SHADOW_OPACITY,
        blending: THREE.NormalBlending,
        depthWrite: false,
        alphaTest: 0.04,
        side: THREE.FrontSide,
      });
      const shadowGeometry = new THREE.SphereGeometry(
        CONFIG.EARTH.RADIUS + CONFIG.CLOUDS.SHADOW_ALTITUDE,
        segments,
        segments
      );
      const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
      shadowMesh.rotation.y = -0.012;
      cloudGroup.add(shadowMesh);
    }

    return cloudGroup;
  } catch (error) {
    log.warn("Cloud texture failed to load:", error);
    return new THREE.Object3D();
  }
}
