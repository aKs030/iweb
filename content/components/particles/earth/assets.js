import { CONFIG } from "./config.js";
import { EARTH_REGIONAL_TEXTURES, getEarthTextureSetForDisplay } from "./texture-paths.js";
import { createLogger } from "../../../core/logger.js";
import { isLocalDevRuntime } from "../../../core/runtime-env.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

const log = createLogger("EarthAssets");
const TEXTURE_TIMEOUT_MS = 15000;
const KTX2_TRANSCODER_URL = "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/libs/basis/";
const CLOUD_ALPHA_FRAGMENT = `
#ifdef USE_ALPHAMAP
  float cloudCoverage = texture2D(alphaMap, vAlphaMapUv).g;
  cloudCoverage = smoothstep(0.16, 0.72, cloudCoverage);
  diffuseColor.a *= cloudCoverage;
#endif`;
const TERRAIN_DISPLACEMENT_VERTEX = `
#ifdef USE_DISPLACEMENTMAP
  float terrainHeightSource = texture2D(displacementMap, vDisplacementMapUv).x;
  float terrainLandHeight = smoothstep(0.018, 0.62, terrainHeightSource);
  float terrainMountainHeight = pow(terrainLandHeight, 1.55);
  transformed += normalize(objectNormal)
    * (terrainMountainHeight * displacementScale + displacementBias);
#endif`;
const DAYLIGHT_MAP_FRAGMENT = `#include <map_fragment>
vec3 sourceAlbedo = texture2D(map, vMapUv).rgb;
earthOceanMask = smoothstep(0.0, 0.03, sourceAlbedo.b - sourceAlbedo.r)
  * smoothstep(-0.005, 0.025, sourceAlbedo.b - sourceAlbedo.g);
vec3 daylightGrade = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(0.92));
float daylightLuma = dot(daylightGrade, vec3(0.2126, 0.7152, 0.0722));
daylightGrade = mix(vec3(daylightLuma), daylightGrade, 1.045);
daylightGrade = clamp((daylightGrade - 0.5) * 1.025 + 0.5, 0.0, 1.0);
daylightGrade *= vec3(1.01, 1.02, 1.03);
float earthLandMask = 1.0 - earthOceanMask;
float landShadowMask = (1.0 - smoothstep(0.18, 0.58, daylightLuma)) * earthLandMask;
vec3 liftedLandGrade = pow(max(daylightGrade, vec3(0.0)), vec3(0.7));
liftedLandGrade *= vec3(1.035, 1.055, 1.02);
daylightGrade = mix(
  daylightGrade,
  liftedLandGrade,
  landShadowMask * 0.62 * terrainDetailStrength
);
float vegetationSignal = sourceAlbedo.g - max(sourceAlbedo.r * 0.88, sourceAlbedo.b);
float vegetationMask = smoothstep(0.008, 0.095, vegetationSignal)
  * smoothstep(0.035, 0.32, sourceAlbedo.g)
  * earthLandMask;
float darkForestMask = smoothstep(0.012, 0.1, sourceAlbedo.g - sourceAlbedo.b)
  * (1.0 - smoothstep(0.28, 0.62, daylightLuma))
  * earthLandMask;
vegetationMask = max(vegetationMask, darkForestMask * 0.78);
vec3 forestGrade = daylightGrade * vec3(0.88, 1.42, 0.68);
forestGrade += vec3(0.008, 0.04, 0.004);
daylightGrade = mix(
  daylightGrade,
  forestGrade,
  vegetationMask * 0.42 * terrainDetailStrength
);
#ifdef USE_BUMPMAP
  vec2 earthReliefTexel = vec2(0.000244140625, 0.00048828125);
  float reliefCenter = texture2D(bumpMap, vBumpMapUv).r;
  float reliefLeft = texture2D(bumpMap, vBumpMapUv - vec2(earthReliefTexel.x, 0.0)).r;
  float reliefRight = texture2D(bumpMap, vBumpMapUv + vec2(earthReliefTexel.x, 0.0)).r;
  float reliefDown = texture2D(bumpMap, vBumpMapUv - vec2(0.0, earthReliefTexel.y)).r;
  float reliefUp = texture2D(bumpMap, vBumpMapUv + vec2(0.0, earthReliefTexel.y)).r;
  vec2 earthReliefCoarseTexel = earthReliefTexel * 4.0;
  float reliefCoarseLeft = texture2D(
    bumpMap,
    vBumpMapUv - vec2(earthReliefCoarseTexel.x, 0.0)
  ).r;
  float reliefCoarseRight = texture2D(
    bumpMap,
    vBumpMapUv + vec2(earthReliefCoarseTexel.x, 0.0)
  ).r;
  float reliefCoarseDown = texture2D(
    bumpMap,
    vBumpMapUv - vec2(0.0, earthReliefCoarseTexel.y)
  ).r;
  float reliefCoarseUp = texture2D(
    bumpMap,
    vBumpMapUv + vec2(0.0, earthReliefCoarseTexel.y)
  ).r;
  vec2 reliefFineGradient = vec2(reliefLeft - reliefRight, reliefDown - reliefUp);
  vec2 reliefCoarseGradient = vec2(
    reliefCoarseLeft - reliefCoarseRight,
    reliefCoarseDown - reliefCoarseUp
  );
  vec2 reliefGradient = reliefFineGradient + reliefCoarseGradient * 0.46;
  float reliefLight = clamp(
    dot(reliefGradient, normalize(vec2(-0.62, 0.78))) * 64.0,
    -0.38,
    0.38
  );
  float reliefLandMask = smoothstep(0.018, 0.11, reliefCenter) * earthLandMask;
  float mountainSlope = smoothstep(0.003, 0.032, length(reliefCoarseGradient));
  float mountainHeight = smoothstep(0.13, 0.58, reliefCenter);
  float mountainMask = max(mountainSlope, mountainHeight * 0.62) * reliefLandMask;
  daylightGrade *= 1.0 + reliefLight * terrainDetailStrength * reliefLandMask;
  vec3 mountainGrade = mix(
    daylightGrade * vec3(0.86, 0.9, 0.94),
    daylightGrade * vec3(1.12, 1.09, 1.04),
    smoothstep(0.38, 0.8, reliefCenter)
  );
  daylightGrade = mix(
    daylightGrade,
    mountainGrade,
    mountainMask * 0.52 * terrainDetailStrength
  );
#endif
float oceanLuma = dot(sourceAlbedo, vec3(0.2126, 0.7152, 0.0722));
vec3 oceanGrade = mix(
  sourceAlbedo,
  oceanLuma * vec3(0.48, 0.76, 1.06),
  0.58
);
diffuseColor.rgb = min(mix(daylightGrade, oceanGrade, earthOceanMask * 0.52), vec3(1.0));`;

const EARTH_ROUGHNESS_FRAGMENT = `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.2, earthOceanMask);`;

const EARTH_FRESNEL_FRAGMENT = `float earthFresnel = pow(
  1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0),
  3.0
);
outgoingLight += vec3(0.018, 0.052, 0.085) * earthFresnel * earthOceanMask;
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
  return getEarthTextureSetForDisplay({
    isMobile: isMobileDevice,
    width: renderer.domElement.clientWidth,
    pixelRatio: Math.min(window.devicePixelRatio || 1, CONFIG.PERFORMANCE.PIXEL_RATIO),
    maxTextureSize: renderer.capabilities.maxTextureSize,
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

async function loadNamedTexture(label, texturePromise) {
  try {
    return await texturePromise;
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
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

function createSolidTexture(THREE, color, colorSpace) {
  const texture = new THREE.DataTexture(
    new Uint8Array([...color, 255]),
    1,
    1,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );
  texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
  return texture;
}

function terrainDirection(THREE, x, y) {
  const longitudeExtent = THREE.MathUtils.degToRad(44);
  const latitudeExtent = THREE.MathUtils.degToRad(30);
  const latitude = Math.asin(THREE.MathUtils.clamp(y * Math.sin(latitudeExtent), -0.999, 0.999));
  const latitudeRadius = Math.cos(latitude);
  const longitude = Math.asin(
    THREE.MathUtils.clamp(
      (x * Math.sin(longitudeExtent)) / Math.max(latitudeRadius, 0.75),
      -0.999,
      0.999
    )
  );

  return new THREE.Vector3(
    Math.sin(longitude) * latitudeRadius,
    Math.sin(latitude),
    Math.cos(longitude) * latitudeRadius
  );
}

function terrainSurfacePoint(THREE, x, y, elevation = 0.018) {
  return terrainDirection(THREE, x, y).multiplyScalar(CONFIG.EARTH.RADIUS + elevation);
}

function createTerrainHeightSampler(THREE, terrainHeightTexture) {
  const image = terrainHeightTexture.image;
  const width = image?.naturalWidth || image?.videoWidth || image?.width || 0;
  const height = image?.naturalHeight || image?.videoHeight || image?.height || 0;
  if (!width || !height) return null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;

    return (u, v) => {
      const pixelX = THREE.MathUtils.clamp(u, 0, 1) * (width - 1);
      const pixelY = (1 - THREE.MathUtils.clamp(v, 0, 1)) * (height - 1);
      const x0 = Math.floor(pixelX);
      const y0 = Math.floor(pixelY);
      const x1 = Math.min(x0 + 1, width - 1);
      const y1 = Math.min(y0 + 1, height - 1);
      const blendX = pixelX - x0;
      const blendY = pixelY - y0;
      const sample = (x, y) => pixels[(y * width + x) * 4] / 255;
      const top = THREE.MathUtils.lerp(sample(x0, y0), sample(x1, y0), blendX);
      const bottom = THREE.MathUtils.lerp(sample(x0, y1), sample(x1, y1), blendX);
      return THREE.MathUtils.lerp(top, bottom, blendY);
    };
  } catch (error) {
    if (isLocalDevRuntime()) log.warn("Terrain height sampling failed:", error);
    return null;
  }
}

function createProceduralTerrainLayer(
  THREE,
  isMobileDevice,
  terrainTexture,
  terrainHeightTexture,
  terrainNormalTexture,
  regionalCloudTexture
) {
  const group = new THREE.Group();
  group.name = "earth-procedural-region";
  group.renderOrder = 5;

  const widthSegments = isMobileDevice ? 256 : 512;
  const heightSegments = isMobileDevice ? 192 : 384;
  const geometry = new THREE.PlaneGeometry(2, 2, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  const sampleHeight = createTerrainHeightSampler(THREE, terrainHeightTexture);

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const sourceHeight = sampleHeight ? sampleHeight(uvs.getX(index), uvs.getY(index)) : 0.2;
    const landHeight = THREE.MathUtils.smoothstep(sourceHeight, 0.12, 0.82);
    const mountainHeight = Math.pow(landHeight, 1.35);
    const edgeBlend = THREE.MathUtils.smoothstep(Math.abs(x), 0.55, 1);
    const edgeRelief = THREE.MathUtils.lerp(1, 0.55, edgeBlend);
    const elevation = 0.008 + mountainHeight * 0.03 * edgeRelief;
    const point = terrainSurfacePoint(THREE, x, y, elevation);
    positions.setXYZ(index, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();

  const terrainMaterial = new THREE.MeshStandardMaterial({
    map: terrainTexture,
    normalMap: terrainNormalTexture,
    normalScale: new THREE.Vector2(0.2, 0.2),
    bumpMap: terrainHeightTexture,
    bumpScale: 0.0015,
    emissive: 0xffffff,
    emissiveMap: terrainTexture,
    emissiveIntensity: 0.14,
    roughness: 0.86,
    metalness: 0,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    side: THREE.FrontSide,
    dithering: true,
  });
  const terrain = new THREE.Mesh(geometry, terrainMaterial);
  terrain.name = "earth-regional-mountains";
  terrain.renderOrder = 5;
  group.add(terrain);

  const cloudShadowGeometry = geometry.clone();
  const cloudShadowPositions = cloudShadowGeometry.getAttribute("position");
  const cloudShadowPoint = new THREE.Vector3();
  for (let index = 0; index < cloudShadowPositions.count; index += 1) {
    cloudShadowPoint.fromBufferAttribute(cloudShadowPositions, index);
    cloudShadowPoint.setLength(cloudShadowPoint.length() + 0.0025);
    cloudShadowPositions.setXYZ(index, cloudShadowPoint.x, cloudShadowPoint.y, cloudShadowPoint.z);
  }

  const regionalCloudShadowMaterial = new THREE.MeshBasicMaterial({
    alphaMap: regionalCloudTexture,
    color: 0x101923,
    transparent: true,
    opacity: 0.1,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    dithering: true,
  });
  const regionalCloudShadow = new THREE.Mesh(cloudShadowGeometry, regionalCloudShadowMaterial);
  regionalCloudShadow.name = "earth-regional-cloud-shadow";
  regionalCloudShadow.renderOrder = 6;
  group.add(regionalCloudShadow);

  const cloudGeometry = geometry.clone();
  const cloudPositions = cloudGeometry.getAttribute("position");
  const cloudPoint = new THREE.Vector3();
  for (let index = 0; index < cloudPositions.count; index += 1) {
    cloudPoint.fromBufferAttribute(cloudPositions, index);
    cloudPoint.setLength(cloudPoint.length() + 0.005);
    cloudPositions.setXYZ(index, cloudPoint.x, cloudPoint.y, cloudPoint.z);
  }

  const regionalCloudMaterial = new THREE.MeshBasicMaterial({
    alphaMap: regionalCloudTexture,
    color: 0xf8fbff,
    transparent: true,
    opacity: 0.42,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    dithering: true,
  });
  const regionalClouds = new THREE.Mesh(cloudGeometry, regionalCloudMaterial);
  regionalClouds.name = "earth-regional-clouds";
  regionalClouds.renderOrder = 7;
  group.add(regionalClouds);

  group.userData.opacity = 0;
  group.userData.targetOpacity = 1;
  group.userData.anchorLocked = false;
  group.userData.regionalCloudTime = 0;
  group.userData.regionalCloudTexture = regionalCloudTexture;
  group.userData.fadeMaterials = [
    { material: terrainMaterial, baseOpacity: 1 },
    { material: regionalCloudShadowMaterial, baseOpacity: 0.1 },
    { material: regionalCloudMaterial, baseOpacity: 0.42 },
  ];
  return group;
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

  let regionalTerrainTexture,
    regionalTerrainHeightTexture,
    regionalTerrainNormalTexture,
    regionalCloudTexture;
  let timeoutId;
  try {
    const texturePromise = Promise.all([
      loadNamedTexture(
        "regional terrain",
        textureLoader.loadAsync(EARTH_REGIONAL_TEXTURES.TERRAIN)
      ),
      loadNamedTexture(
        "regional terrain height",
        textureLoader.loadAsync(EARTH_REGIONAL_TEXTURES.HEIGHT)
      ),
      loadNamedTexture(
        "regional terrain normals",
        textureLoader.loadAsync(EARTH_REGIONAL_TEXTURES.NORMAL)
      ),
      loadNamedTexture("regional clouds", textureLoader.loadAsync(EARTH_REGIONAL_TEXTURES.CLOUDS)),
    ]);
    [
      regionalTerrainTexture,
      regionalTerrainHeightTexture,
      regionalTerrainNormalTexture,
      regionalCloudTexture,
    ] = await Promise.race([
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
    throw new Error(`Texture loading failed: ${err instanceof Error ? err.message : err}`, {
      cause: err,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), isMobileDevice ? 4 : 16);
  const dayTexture = createSolidTexture(THREE, [28, 67, 92], THREE.SRGBColorSpace);
  const nightTexture = createSolidTexture(THREE, [0, 0, 0], THREE.SRGBColorSpace);
  const normalTexture = createSolidTexture(THREE, [128, 128, 255], THREE.NoColorSpace);
  const bumpTexture = createSolidTexture(THREE, [0, 0, 0], THREE.NoColorSpace);
  configureTexture(THREE, dayTexture, anisotropy, THREE.SRGBColorSpace);
  configureTexture(THREE, nightTexture, anisotropy, THREE.SRGBColorSpace);
  configureTexture(THREE, normalTexture, anisotropy, THREE.NoColorSpace);
  configureTexture(THREE, bumpTexture, anisotropy, THREE.NoColorSpace);
  configureTexture(THREE, regionalTerrainTexture, anisotropy, THREE.SRGBColorSpace);
  regionalTerrainTexture.wrapS = THREE.ClampToEdgeWrapping;
  // The regional layer is fixed relative to the camera. Sampling its full-resolution
  // source directly keeps roads and tree crowns crisp instead of blending mip levels.
  regionalTerrainTexture.generateMipmaps = false;
  regionalTerrainTexture.minFilter = THREE.LinearFilter;
  regionalTerrainTexture.magFilter = THREE.LinearFilter;
  regionalTerrainTexture.needsUpdate = true;
  configureTexture(THREE, regionalTerrainHeightTexture, anisotropy, THREE.NoColorSpace);
  regionalTerrainHeightTexture.wrapS = THREE.ClampToEdgeWrapping;
  configureTexture(THREE, regionalTerrainNormalTexture, anisotropy, THREE.NoColorSpace);
  regionalTerrainNormalTexture.wrapS = THREE.ClampToEdgeWrapping;
  configureTexture(THREE, regionalCloudTexture, anisotropy, THREE.NoColorSpace);
  regionalCloudTexture.wrapS = THREE.RepeatWrapping;
  regionalCloudTexture.wrapT = THREE.ClampToEdgeWrapping;

  const dayMaterial = new THREE.MeshPhysicalMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    normalScale: new THREE.Vector2(0.78, 0.78),
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    displacementMap: bumpTexture,
    displacementScale: CONFIG.EARTH.HERO_DISPLACEMENT_SCALE,
    roughness: 0.84,
    metalness: 0,
    clearcoat: 0.045,
    clearcoatRoughness: 0.2,
    emissive: 0xffffff,
    emissiveIntensity: 0.04,
    dithering: true,
  });
  dayMaterial.userData.terrainDetailStrength = 1;
  dayMaterial.onBeforeCompile = shader => {
    shader.uniforms.terrainDetailStrength = {
      value: dayMaterial.userData.terrainDetailStrength,
    };
    dayMaterial.userData.reliefShader = shader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <displacementmap_vertex>",
      TERRAIN_DISPLACEMENT_VERTEX
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        "uniform float terrainDetailStrength;\nfloat earthOceanMask = 0.0;\nvoid main() {"
      )
      .replace("#include <map_fragment>", DAYLIGHT_MAP_FRAGMENT)
      .replace("#include <roughnessmap_fragment>", EARTH_ROUGHNESS_FRAGMENT)
      .replace("#include <opaque_fragment>", EARTH_FRESNEL_FRAGMENT);
  };
  dayMaterial.customProgramCacheKey = () => "earth-day-relief-v16";

  const nightMaterial = new THREE.MeshPhysicalMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    displacementMap: bumpTexture,
    displacementScale: CONFIG.EARTH.DEFAULT_DISPLACEMENT_SCALE,
    normalScale: new THREE.Vector2(0.72, 0.72),
    roughness: 0.76,
    metalness: 0,
    clearcoat: 0.025,
    clearcoatRoughness: 0.34,
    emissive: 0xffb65d,
    emissiveMap: nightTexture,
    emissiveIntensity: CONFIG.EARTH.EMISSIVE_INTENSITY * 4.4,
    dithering: true,
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
  const proceduralTerrainGroup = createProceduralTerrainLayer(
    THREE,
    isMobileDevice,
    regionalTerrainTexture,
    regionalTerrainHeightTexture,
    regionalTerrainNormalTexture,
    regionalCloudTexture
  );
  earthMesh.add(cityGlowGroup);
  earthMesh.add(proceduralTerrainGroup);
  scene.add(earthMesh);

  void Promise.all([
    loadNamedTexture(
      "day",
      loadPreferredTexture(ktx2Loader, textureLoader, textureSet.DAY_KTX2, textureSet.DAY)
    ),
    loadNamedTexture(
      "night",
      loadPreferredTexture(ktx2Loader, textureLoader, textureSet.NIGHT_KTX2, textureSet.NIGHT)
    ),
    loadNamedTexture("normal", textureLoader.loadAsync(textureSet.NORMAL)),
    loadNamedTexture("bump", textureLoader.loadAsync(textureSet.BUMP)),
  ])
    .then(([loadedDayTexture, loadedNightTexture, loadedNormalTexture, loadedBumpTexture]) => {
      if (!earthMesh.parent) {
        [loadedDayTexture, loadedNightTexture, loadedNormalTexture, loadedBumpTexture].forEach(
          texture => texture.dispose()
        );
        return;
      }

      configureTexture(THREE, loadedDayTexture, anisotropy, THREE.SRGBColorSpace);
      configureTexture(THREE, loadedNightTexture, anisotropy, THREE.SRGBColorSpace);
      configureTexture(THREE, loadedNormalTexture, anisotropy, THREE.NoColorSpace);
      configureTexture(THREE, loadedBumpTexture, anisotropy, THREE.NoColorSpace);

      dayMaterial.map = loadedDayTexture;
      dayMaterial.normalMap = loadedNormalTexture;
      dayMaterial.bumpMap = loadedBumpTexture;
      dayMaterial.displacementMap = loadedBumpTexture;
      dayMaterial.needsUpdate = true;

      nightMaterial.map = loadedDayTexture;
      nightMaterial.normalMap = loadedNormalTexture;
      nightMaterial.bumpMap = loadedBumpTexture;
      nightMaterial.displacementMap = loadedBumpTexture;
      nightMaterial.emissiveMap = loadedNightTexture;
      nightMaterial.needsUpdate = true;

      cityGlowGroup.traverse(object => {
        if (object.material?.uniforms?.cityMap) {
          object.material.uniforms.cityMap.value = loadedNightTexture;
        }
      });

      [dayTexture, nightTexture, normalTexture, bumpTexture].forEach(texture => texture.dispose());
    })
    .catch(error => {
      if (isLocalDevRuntime()) log.warn("Deferred globe textures failed:", error);
    });

  return {
    earthMesh,
    dayMaterial,
    nightMaterial,
    cityGlowGroup,
    proceduralTerrainGroup,
  };
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

  const moonMaterial = new THREE.MeshPhysicalMaterial({
    map: moonTexture,
    bumpMap: moonBumpTexture,
    bumpScale: CONFIG.MOON.BUMP_SCALE * 1.35,
    displacementMap: moonBumpTexture,
    displacementScale: CONFIG.MOON.DISPLACEMENT_SCALE,
    displacementBias: CONFIG.MOON.DISPLACEMENT_SCALE * -0.22,
    roughness: 0.91,
    metalness: 0,
    clearcoat: 0.018,
    clearcoatRoughness: 0.78,
    emissive: 0x101722,
    emissiveIntensity: 0.08,
    color: moonTexture ? 0xffffff : 0xaaaaaa,
    dithering: true,
  });

  const moonLOD = new THREE.LOD();

  // High detail
  const moonGeometryHigh = new THREE.SphereGeometry(
    CONFIG.MOON.RADIUS,
    isMobileDevice ? 64 : CONFIG.MOON.SEGMENTS,
    isMobileDevice ? 64 : CONFIG.MOON.SEGMENTS
  );
  moonLOD.addLevel(new THREE.Mesh(moonGeometryHigh, moonMaterial), 0);

  // Medium detail
  const moonGeometryMed = new THREE.SphereGeometry(CONFIG.MOON.RADIUS, 48, 48);
  moonLOD.addLevel(new THREE.Mesh(moonGeometryMed, moonMaterial), 35);

  // Low detail
  const moonGeometryLow = new THREE.SphereGeometry(CONFIG.MOON.RADIUS, 24, 24);
  moonLOD.addLevel(new THREE.Mesh(moonGeometryLow, moonMaterial), 80);

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
    const useCompressedClouds = isMobileDevice || renderer.capabilities.maxTextureSize < 8192;
    const cloudTexture = useCompressedClouds
      ? await loadPreferredTexture(
          ktx2Loader,
          textureLoader,
          textureSet.CLOUDS_KTX2,
          textureSet.CLOUDS
        )
      : await textureLoader.loadAsync(textureSet.CLOUDS);
    const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), isMobileDevice ? 8 : 16);
    configureTexture(THREE, cloudTexture, anisotropy, THREE.NoColorSpace);
    cloudTexture.wrapT = THREE.ClampToEdgeWrapping;

    const cloudMaterial = new THREE.MeshStandardMaterial({
      alphaMap: cloudTexture,
      color: 0xf4f7fa,
      emissive: 0x6e7f91,
      emissiveIntensity: 0.12,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: CONFIG.CLOUDS.OPACITY,
      blending: THREE.NormalBlending,
      depthWrite: false,
      alphaTest: 0,
      side: THREE.FrontSide,
      dithering: true,
    });
    cloudMaterial.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <alphamap_fragment>",
        CLOUD_ALPHA_FRAGMENT
      );
    };
    cloudMaterial.customProgramCacheKey = () => "earth-cloud-soft-alpha-v3";

    const segments = isMobileDevice ? 96 : Math.min(CONFIG.EARTH.SEGMENTS, 256);

    const cloudGeometry = new THREE.SphereGeometry(
      CONFIG.EARTH.RADIUS + CONFIG.CLOUDS.ALTITUDE,
      segments,
      segments
    );
    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloudMesh.name = "earth-cloud-surface";
    cloudMesh.renderOrder = 7;
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
        alphaTest: 0,
        side: THREE.FrontSide,
      });
      shadowMaterial.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <alphamap_fragment>",
          CLOUD_ALPHA_FRAGMENT
        );
      };
      shadowMaterial.customProgramCacheKey = () => "earth-cloud-shadow-soft-alpha-v3";
      const shadowGeometry = new THREE.SphereGeometry(
        CONFIG.EARTH.RADIUS + CONFIG.CLOUDS.SHADOW_ALTITUDE,
        segments,
        segments
      );
      const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
      shadowMesh.name = "earth-cloud-shadow";
      shadowMesh.renderOrder = 6;
      shadowMesh.rotation.y = -0.012;
      cloudGroup.add(shadowMesh);
    }

    return cloudGroup;
  } catch (error) {
    log.warn("Cloud texture failed to load:", error);
    return new THREE.Object3D();
  }
}
