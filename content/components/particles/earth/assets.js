import { CONFIG } from "./config.js";
import { EARTH_REGIONAL_TEXTURES, getEarthTextureSetForDisplay } from "./texture-paths.js";
import { createLogger } from "../../../core/logger.js";
import { isLocalDevRuntime } from "../../../core/runtime-env.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

const log = createLogger("EarthAssets");
const TEXTURE_TIMEOUT_MS = 15000;
const KTX2_TRANSCODER_URL = "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/libs/basis/";
const WIND_CLOUD_UNIFORMS = `
uniform float cloudTime;
uniform vec2 cloudWind;
uniform vec2 cloudPhase;
uniform float cloudDistortion;
uniform float cloudRotation;
uniform float cloudDensityShade;
uniform vec2 cloudCoverageRange;`;
const WIND_CLOUD_ALPHA_FRAGMENT = `
#ifdef USE_ALPHAMAP
  vec2 centeredCloudUv = vAlphaMapUv - 0.5;
  float cloudCos = cos(cloudRotation);
  float cloudSin = sin(cloudRotation);
  vec2 rotatedCloudUv = vec2(
    centeredCloudUv.x * cloudCos - centeredCloudUv.y * cloudSin,
    centeredCloudUv.x * cloudSin + centeredCloudUv.y * cloudCos
  ) + 0.5;
  vec2 windUv = rotatedCloudUv + cloudPhase + cloudWind * cloudTime;
  float primaryWave = sin(rotatedCloudUv.y * 15.0 + cloudTime * 0.17);
  float crossWave = sin(rotatedCloudUv.x * 19.0 - cloudTime * 0.11);
  windUv += vec2(primaryWave, crossWave * 0.48) * cloudDistortion;
  float primaryCloud = texture2D(alphaMap, windUv).g;
  vec2 detailUv = fract(
    windUv * 1.87
    + vec2(0.173, -0.117)
    + cloudWind * cloudTime * 0.34
  );
  float detailCloud = texture2D(alphaMap, detailUv).g;
  float cloudCoverage = primaryCloud * mix(0.82, 1.14, detailCloud);
  cloudCoverage = smoothstep(cloudCoverageRange.x, cloudCoverageRange.y, cloudCoverage);
  float densityLight = mix(
    1.0 - cloudDensityShade,
    1.0 + cloudDensityShade * 0.22,
    cloudCoverage
  );
  // Forward-scatter tint: thin cloud edges warm up against sunlight;
  // dense cloud tops stay bright cool-white (Mie scattering).
  vec3 cloudScatterTint = mix(
    vec3(1.05, 0.99, 0.91),  // warm golden-orange at thin edges
    vec3(0.97, 0.98, 1.02),  // cool blue-white at dense tops
    cloudCoverage
  );
  // Subtle self-shadow: very thick clouds (cumulonimbus) darken at the base
  float cloudBaseShadow = 1.0 - smoothstep(0.58, 0.94, cloudCoverage) * 0.18;
  
  // Fresnel Edge Fade: fade out clouds exactly at the sphere limb to prevent them 
  // from sticking out past the earth's edge (the "broken halo" effect)
  // Note: 'normal' is not defined yet here, so we use the view-space 'vNormal.z'
  float cloudFresnel = clamp(vNormal.z, 0.0, 1.0);
  float edgeMask = smoothstep(0.05, 0.35, cloudFresnel);

  diffuseColor.rgb *= cloudScatterTint * densityLight * cloudBaseShadow;
  diffuseColor.a *= cloudCoverage * edgeMask;
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
  landShadowMask * 0.52 * terrainDetailStrength
);
float vegetationSignal = sourceAlbedo.g - max(sourceAlbedo.r * 0.88, sourceAlbedo.b);
float vegetationMask = smoothstep(0.008, 0.095, vegetationSignal)
  * smoothstep(0.035, 0.32, sourceAlbedo.g)
  * earthLandMask;
float darkForestMask = smoothstep(0.012, 0.1, sourceAlbedo.g - sourceAlbedo.b)
  * (1.0 - smoothstep(0.28, 0.62, daylightLuma))
  * earthLandMask;
vegetationMask = max(vegetationMask, darkForestMask * 0.78);
// Richer, more saturated vegetation green
vec3 forestGrade = daylightGrade * vec3(0.84, 1.48, 0.63);
forestGrade += vec3(0.006, 0.046, 0.002);
daylightGrade = mix(
  daylightGrade,
  forestGrade,
  vegetationMask * 0.44 * terrainDetailStrength
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
  float reliefLight = clamp(dot(reliefGradient, terrainSunDirection) * 70.0, -0.38, 0.38);
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
    mountainMask * 0.45 * terrainDetailStrength
  );
  // Glaciers and permanent snow caps at high elevation
  float snowCapHeight = smoothstep(0.62, 0.80, reliefCenter) * reliefLandMask;
  daylightGrade = mix(daylightGrade, vec3(0.91, 0.93, 0.97), snowCapHeight * 0.58 * terrainDetailStrength);
#endif
// Desert / arid zones: warm ochre toning (Sahara, Arabian Peninsula, outback)
float desertLuma = smoothstep(0.50, 0.80, daylightLuma) * earthLandMask;
float desertWarmth = smoothstep(0.02, 0.15, sourceAlbedo.r - sourceAlbedo.b);
float desertMask = desertLuma * desertWarmth;
daylightGrade = mix(daylightGrade, daylightGrade * vec3(1.07, 1.01, 0.83), desertMask * 0.46);
// Polar ice caps: vMapUv.y = 0 (south) → 1 (north) on a standard sphere UV
float polarNorth = smoothstep(0.72, 0.90, vMapUv.y);
float polarSouth = smoothstep(0.28, 0.10, vMapUv.y);
float polarLat   = max(polarNorth, polarSouth);
float iceBrightness = smoothstep(0.40, 0.66, daylightLuma);
float polarIceMask = polarLat * iceBrightness;
vec3 iceWhite = vec3(0.91, 0.94, 0.98);
daylightGrade = mix(daylightGrade, iceWhite, polarIceMask * earthLandMask * 0.82);
// Enhanced ocean: deep indigo-blue far offshore, teal-green near coastlines
float oceanLuma = dot(sourceAlbedo, vec3(0.2126, 0.7152, 0.0722));
float oceanDepth = 1.0 - smoothstep(0.04, 0.22, oceanLuma);
vec3 deepOcean    = oceanLuma * vec3(0.16, 0.38, 1.08);
vec3 shallowOcean = oceanLuma * vec3(0.30, 0.72, 0.80);
vec3 oceanGrade   = mix(sourceAlbedo, mix(shallowOcean, deepOcean, clamp(oceanDepth * 0.80 + 0.20, 0.0, 1.0)), 0.74);
// Polar ocean: ice-white tint near the poles (Arctic / Antarctic pack ice)
oceanGrade = mix(oceanGrade, iceWhite * 0.80, polarIceMask * 0.44);
diffuseColor.rgb = min(mix(daylightGrade, oceanGrade, earthOceanMask * 0.60), vec3(1.0));`;

const EARTH_ROUGHNESS_FRAGMENT = `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.26, earthOceanMask);
// Micro-scale ocean roughness: hash noise simulates subtle wave-pattern variation
float oceanMicroRough = fract(sin(dot(floor(vMapUv * 460.0), vec2(127.1, 311.7))) * 43758.5453);
roughnessFactor = mix(roughnessFactor, 0.22 + oceanMicroRough * 0.08, earthOceanMask * 0.50);`;

const EARTH_FRESNEL_FRAGMENT = `float viewNDot = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
// Globaler Rayleigh-artiger Dunst am Erdrand (wirkt auch ueber Land)
float globalHaze = pow(1.0 - viewNDot, 5.2);
outgoingLight += vec3(0.035, 0.055, 0.095) * globalHaze;
// Strong blue Fresnel rim – visible at the ocean horizon
float earthFresnel = pow(1.0 - viewNDot, 4.2);
outgoingLight += vec3(0.028, 0.036, 0.058) * earthFresnel * earthOceanMask;
// Broad specular shimmer across the ocean face
float broadWaterReflection = pow(1.0 - viewNDot, 1.45);
outgoingLight += vec3(0.010, 0.013, 0.020) * broadWaterReflection * earthOceanMask;
// Sun Glint: Intense solar specular reflection on ocean surface facing sun direction
vec3 viewDir = normalize(vViewPosition);
vec3 sunDir = normalize(vec3(terrainSunDirection.x, terrainSunDirection.y, 0.72));
vec3 halfVector = normalize(sunDir + viewDir);
float NdotH = clamp(dot(normal, halfVector), 0.0, 1.0);
float oceanSunGlint = pow(NdotH, 140.0) * earthOceanMask;
float oceanSoftGlint = pow(NdotH, 18.0) * earthOceanMask;
vec3 glintColor = (vec3(1.0, 0.95, 0.86) * oceanSunGlint * 2.2 + vec3(0.95, 0.65, 0.35) * oceanSoftGlint * 0.35);
outgoingLight += glintColor * terrainGlintIntensity;
#include <opaque_fragment>`;

const NIGHT_EARTHLIGHT_FRAGMENT = `float nightEarthFresnel = pow(
  1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0),
  2.2
);
// Subtle blue-indigo earthshine tint on the night side
outgoingLight += diffuseColor.rgb * vec3(0.09, 0.13, 0.22);
outgoingLight += vec3(0.014, 0.040, 0.088) * nightEarthFresnel;
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

function configureWindCloudMaterial(
  THREE,
  material,
  {
    wind,
    phase = [0, 0],
    distortion = 0.004,
    rotation = 0,
    densityShade = 0,
    coverage = [0.16, 0.72],
    cacheKey,
  }
) {
  material.userData.windTime = 0;
  material.onBeforeCompile = shader => {
    shader.uniforms.cloudTime = { value: material.userData.windTime || 0 };
    shader.uniforms.cloudWind = { value: new THREE.Vector2(wind[0], wind[1]) };
    shader.uniforms.cloudPhase = { value: new THREE.Vector2(phase[0], phase[1]) };
    shader.uniforms.cloudDistortion = { value: distortion };
    shader.uniforms.cloudRotation = { value: rotation };
    shader.uniforms.cloudDensityShade = { value: densityShade };
    shader.uniforms.cloudCoverageRange = {
      value: new THREE.Vector2(coverage[0], coverage[1]),
    };
    material.userData.cloudShader = shader;
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", `${WIND_CLOUD_UNIFORMS}\nvoid main() {`)
      .replace("#include <alphamap_fragment>", WIND_CLOUD_ALPHA_FRAGMENT);
  };
  material.customProgramCacheKey = () => cacheKey;
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

function createRegionalTerrainGeometry(
  THREE,
  widthSegments,
  heightSegments,
  sampleHeight,
  reliefScale = 1
) {
  const geometry = new THREE.PlaneGeometry(2, 2, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const sourceHeight = sampleHeight ? sampleHeight(uvs.getX(index), uvs.getY(index)) : 0.2;
    const landHeight = THREE.MathUtils.smoothstep(sourceHeight, 0.12, 0.82);
    const mountainHeight = Math.pow(landHeight, 1.35);
    const edgeBlend = THREE.MathUtils.smoothstep(Math.abs(x), 0.55, 1);
    const edgeRelief = THREE.MathUtils.lerp(1, 0.55, edgeBlend);
    const elevation = 0.004 + mountainHeight * 0.03 * edgeRelief * reliefScale;
    const point = terrainSurfacePoint(THREE, x, y, elevation);
    positions.setXYZ(index, point.x, point.y, point.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}


function configureInstanceFade(material) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      attribute vec2 instanceUv;
      varying vec2 vInstanceUv;`
    ).replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vInstanceUv = instanceUv;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      varying vec2 vInstanceUv;`
    ).replace(
      "#include <alphamap_fragment>",
      `#include <alphamap_fragment>
      float regionalFadeX =
        smoothstep(0.0, 0.13, vInstanceUv.x)
        * smoothstep(0.0, 0.13, 1.0 - vInstanceUv.x);
      float regionalFadeY =
        smoothstep(0.0, 0.15, vInstanceUv.y)
        * smoothstep(0.0, 0.15, 1.0 - vInstanceUv.y);
      float regionalEdgeFade = regionalFadeX * regionalFadeY;
      diffuseColor.a *= regionalEdgeFade;`
    );
  };
  material.customProgramCacheKey = () => "earth-regional-instance-fade-v2";
}

function configureRegionalTerrainEdgeFade(material) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
// 3D Tree Canopy effect (Procedural normal mapping for forests)
vec3 texColor = texture2D(map, vMapUv).rgb;
// Isolate green areas (where green is stronger than red and blue)
float isGreen = smoothstep(0.01, 0.05, texColor.g - max(texColor.r, texColor.b));
// High frequency pseudo-random noise for canopy micro-bumps
vec2 treeUv = vMapUv * 7500.0;
float treeNoise1 = fract(sin(dot(floor(treeUv), vec2(12.9898, 78.233))) * 43758.5453);
float treeNoise2 = fract(sin(dot(floor(treeUv + vec2(0.5, 0.5)), vec2(12.9898, 78.233))) * 43758.5453);
// Smooth interpolation for the noise
vec2 f = fract(treeUv);
f = f * f * (3.0 - 2.0 * f);
float treeBump = mix(treeNoise1, treeNoise2, f.x * f.y);
// Generate a fake normal from the bump
vec3 treeNormal = normalize(vec3(treeBump - 0.5, treeBump - 0.5, 1.2));
// Blend normal with the procedural tree normal
normal = normalize(mix(normal, treeNormal, isGreen * 0.95));
// Make trees rougher (less shiny than terrain)
roughnessFactor = mix(roughnessFactor, 0.98, isGreen);`
      )
      .replace(
        "#include <alphamap_fragment>",
        `#include <alphamap_fragment>
float regionalFadeX =
  smoothstep(0.0, 0.13, vMapUv.x)
  * smoothstep(0.0, 0.13, 1.0 - vMapUv.x);
float regionalFadeY =
  smoothstep(0.0, 0.15, vMapUv.y)
  * smoothstep(0.0, 0.15, 1.0 - vMapUv.y);
float regionalEdgeFade = regionalFadeX * regionalFadeY;
diffuseColor.a *= regionalEdgeFade;`
      );
  };
  material.customProgramCacheKey = () => "earth-regional-terrain-edge-fade-v4";
}

function createProceduralTerrainLayer(
  THREE,
  isMobileDevice,
  qualityLevel,
  terrainTexture,
  terrainHeightTexture,
  terrainNormalTexture,
  regionalCloudTexture
) {
  const group = new THREE.Group();
  group.name = "earth-procedural-region";
  group.renderOrder = 5;

  const lowQuality = qualityLevel === "LOW";
  const mediumQuality = qualityLevel === "MEDIUM";
  const widthSegments = lowQuality ? 160 : isMobileDevice ? 224 : mediumQuality ? 352 : 512;
  const heightSegments = lowQuality ? 120 : isMobileDevice ? 168 : mediumQuality ? 264 : 384;
  const sampleHeight = createTerrainHeightSampler(THREE, terrainHeightTexture);
  const geometry = createRegionalTerrainGeometry(
    THREE,
    widthSegments,
    heightSegments,
    sampleHeight,
    3.8 // Massive 3D relief for mountains
  );
  const terrainMaterial = new THREE.MeshStandardMaterial({
    map: terrainTexture,
    normalMap: terrainNormalTexture,
    normalScale: new THREE.Vector2(1.2, 1.2), // Sharper details
    bumpMap: terrainHeightTexture,
    bumpScale: 0.012, // Taller bumps
    emissive: 0xffffff,
    emissiveMap: terrainTexture,
    emissiveIntensity: 0.065,
    roughness: 0.88,
    metalness: 0,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    side: THREE.FrontSide,
    dithering: true,
  });
  configureRegionalTerrainEdgeFade(terrainMaterial);
  const terrain = new THREE.Mesh(geometry, terrainMaterial);
  terrain.name = "earth-regional-mountains";
  terrain.renderOrder = 5;
  group.add(terrain);

  const cloudShadowGeometry = geometry.clone();
  const cloudShadowPositions = cloudShadowGeometry.getAttribute("position");
  const cloudShadowPoint = new THREE.Vector3();
  for (let index = 0; index < cloudShadowPositions.count; index += 1) {
    cloudShadowPoint.fromBufferAttribute(cloudShadowPositions, index);
    cloudShadowPoint.setLength(cloudShadowPoint.length() + 0.002);
    cloudShadowPositions.setXYZ(index, cloudShadowPoint.x, cloudShadowPoint.y, cloudShadowPoint.z);
  }

  const regionalCloudShadowMaterial = new THREE.MeshStandardMaterial({
    alphaMap: regionalCloudTexture,
    color: 0x101923,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.05,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    dithering: true,
  });
  configureWindCloudMaterial(THREE, regionalCloudShadowMaterial, {
    wind: [0.00075, 0.000045],
    distortion: 0.0022,
    rotation: -0.025,
    coverage: [0.07, 0.6],
    cacheKey: "earth-regional-cloud-shadow-wind-v5",
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
    cloudPoint.setLength(cloudPoint.length() + 0.003);
    cloudPositions.setXYZ(index, cloudPoint.x, cloudPoint.y, cloudPoint.z);
  }

  const regionalCloudMaterial = new THREE.MeshStandardMaterial({
    alphaMap: regionalCloudTexture,
    color: 0xffffff,
    emissive: 0x83909b,
    emissiveIntensity: 0.1,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.4,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    dithering: true,
  });
  configureWindCloudMaterial(THREE, regionalCloudMaterial, {
    wind: [0.00075, 0.000045],
    distortion: 0.0022,
    rotation: -0.025,
    densityShade: 0.14,
    coverage: [0.07, 0.6],
    cacheKey: "earth-regional-cloud-low-wind-v5",
  });
  const regionalClouds = new THREE.Mesh(cloudGeometry, regionalCloudMaterial);
  regionalClouds.name = "earth-regional-cloud-low";
  regionalClouds.renderOrder = 7;
  group.add(regionalClouds);

  const highCloudGeometry = geometry.clone();
  const highCloudPositions = highCloudGeometry.getAttribute("position");
  const highCloudPoint = new THREE.Vector3();
  for (let index = 0; index < highCloudPositions.count; index += 1) {
    highCloudPoint.fromBufferAttribute(highCloudPositions, index);
    highCloudPoint.setLength(highCloudPoint.length() + 0.007);
    highCloudPositions.setXYZ(index, highCloudPoint.x, highCloudPoint.y, highCloudPoint.z);
  }

  const regionalHighCloudMaterial = new THREE.MeshStandardMaterial({
    alphaMap: regionalCloudTexture,
    color: 0xf8fbff,
    emissive: 0x8996a2,
    emissiveIntensity: 0.11,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.14,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    dithering: true,
  });
  configureWindCloudMaterial(THREE, regionalHighCloudMaterial, {
    wind: [0.0011, -0.000035],
    phase: [0.31, 0.045],
    distortion: 0.0036,
    rotation: 0.065,
    densityShade: 0.12,
    coverage: [0.16, 0.74],
    cacheKey: "earth-regional-cloud-high-wind-v5",
  });
  const regionalHighClouds = new THREE.Mesh(highCloudGeometry, regionalHighCloudMaterial);
  regionalHighClouds.name = "earth-regional-cloud-high";
  regionalHighClouds.renderOrder = 8;
  group.add(regionalHighClouds);
  // Add 3D Details (Cities and Trees) using InstancedMesh
  const numInstances = isMobileDevice ? 5000 : (qualityLevel === "LOW" ? 8000 : 25000);

  // Create geometries
  const buildingGeometry = new THREE.BoxGeometry(0.0015, 0.0015, 0.0015);
  // Shift origin to bottom so they scale up from the ground
  buildingGeometry.translate(0, 0, 0.00075);

  const treeGeometry = new THREE.ConeGeometry(0.0008, 0.002, 5);
  treeGeometry.translate(0, 0, 0.001);
  treeGeometry.rotateX(Math.PI / 2); // align with z-axis (up from surface)

  // Edge fade logic for instances is handled via a custom shader below
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    roughness: 0.7,
    metalness: 0.2,
    transparent: true,
    opacity: 1, // Will be controlled by userData/fadeMaterials
  });

  const treeMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e5c2e,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 1,
  });

  // Share the terrain edge fade shader modification for the instances
  configureInstanceFade(buildingMaterial);
  configureInstanceFade(treeMaterial);

  const cityMesh = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, numInstances);
  const forestMesh = new THREE.InstancedMesh(treeGeometry, treeMaterial, numInstances);
  // Add an instanced buffer attribute for UVs so instances fade exactly like the terrain
  const cityUvArray = new Float32Array(numInstances * 2);
  const forestUvArray = new Float32Array(numInstances * 2);

  cityMesh.geometry = cityMesh.geometry.clone();
  forestMesh.geometry = forestMesh.geometry.clone();

  const cityUvAttribute = new THREE.InstancedBufferAttribute(cityUvArray, 2);
  const forestUvAttribute = new THREE.InstancedBufferAttribute(forestUvArray, 2);

  cityMesh.geometry.setAttribute('instanceUv', cityUvAttribute);
  forestMesh.geometry.setAttribute('instanceUv', forestUvAttribute);


  cityMesh.name = "earth-regional-cities";
  forestMesh.name = "earth-regional-forests";
  cityMesh.renderOrder = 5;
  forestMesh.renderOrder = 5;

  const dummy = new THREE.Object3D();
  const upVector = new THREE.Vector3(0, 0, 1);

  let cityCount = 0;
  let treeCount = 0;

  // We use a seeded random for stable placement
  let seed = 12345;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const reliefScaleNum = 3.8;

  for (let i = 0; i < numInstances * 4; i++) {
    if (cityCount >= numInstances && treeCount >= numInstances) break;

    // Distribute randomly across the region
    const r1 = random();
    const r2 = random();
    const radius = Math.sqrt(r1) * 0.95; // keep slightly away from absolute edge
    const theta = r2 * Math.PI * 2;

    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);

    // UV coordinates (0 to 1)
    const u = (x + 1) / 2;
    const v = (y + 1) / 2;

    const sourceHeight = sampleHeight ? sampleHeight(u, v) : 0.2;

    // Avoid oceans
    if (sourceHeight < 0.02) continue;

    const landHeight = THREE.MathUtils.smoothstep(sourceHeight, 0.12, 0.82);
    const mountainHeight = Math.pow(landHeight, 1.35);
    const edgeBlend = THREE.MathUtils.smoothstep(Math.abs(x), 0.55, 1);
    const edgeRelief = THREE.MathUtils.lerp(1, 0.55, edgeBlend);
    const elevation = 0.004 + mountainHeight * 0.03 * edgeRelief * reliefScaleNum;

    const point = terrainSurfacePoint(THREE, x, y, elevation);

    // Determine normal at this point to orient the object
    const dir = point.clone().normalize();

    dummy.position.copy(point);
    // Align z-axis to surface normal
    dummy.quaternion.setFromUnitVectors(upVector, dir);

    // Random rotation around local z-axis
    dummy.rotateZ(random() * Math.PI * 2);

    // Use noise to group items together loosely
    const noise = (Math.sin(x * 20) + Math.cos(y * 20)) * 0.5 + 0.5;

    // Cities prefer lower flatter ground and specific noise regions
    if (sourceHeight > 0.02 && sourceHeight < 0.15 && noise > 0.6 && cityCount < numInstances) {
      // City (lowlands)
      const heightScale = 0.5 + random() * 2.5; // Random building heights
      dummy.scale.set(0.6 + random()*0.4, 0.6 + random()*0.4, heightScale);
      dummy.updateMatrix();
      cityMesh.setMatrixAt(cityCount, dummy.matrix);
      cityUvArray[cityCount * 2] = u;
      cityUvArray[cityCount * 2 + 1] = v;

      // Color variation for buildings
      const color = new THREE.Color().setHSL(0.6, 0.1, 0.3 + random() * 0.4);
      cityMesh.setColorAt(cityCount, color);
      cityCount++;

    // Trees prefer mid elevations and different noise regions
    } else if (sourceHeight >= 0.03 && sourceHeight < 0.5 && noise <= 0.6 && treeCount < numInstances) {
      // Forest
      const scale = 0.5 + random() * 0.8;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      forestMesh.setMatrixAt(treeCount, dummy.matrix);
      forestUvArray[treeCount * 2] = u;
      forestUvArray[treeCount * 2 + 1] = v;

      // Color variation for trees
      const color = new THREE.Color().setHSL(0.3 + random() * 0.05, 0.5 + random() * 0.4, 0.15 + random() * 0.2);
      forestMesh.setColorAt(treeCount, color);
      treeCount++;
    }
  }

  cityMesh.count = cityCount;
  forestMesh.count = treeCount;

  if (cityMesh.instanceColor) cityMesh.instanceColor.needsUpdate = true;
  if (forestMesh.instanceColor) forestMesh.instanceColor.needsUpdate = true;

  group.add(cityMesh);
  group.add(forestMesh);


  group.userData.opacity = 0;
  group.userData.targetOpacity = 1;
  group.userData.anchorLocked = false;
  group.userData.terrainMaterial = terrainMaterial;
  group.userData.berlinWeight = 1;
  group.userData.europeWeight = 0;
  group.userData.globeWeight = 0;
  group.userData.highCloudMesh = regionalHighClouds;
  group.userData.windMaterials = [
    regionalCloudShadowMaterial,
    regionalCloudMaterial,
    regionalHighCloudMaterial,
  ];
  group.userData.fadeMaterials = [

    { material: terrainMaterial, baseOpacity: 1, lod: "berlin" },
    { material: regionalCloudShadowMaterial, baseOpacity: 0.05, lod: "cloud" },
    { material: regionalCloudMaterial, baseOpacity: 0.4, lod: "cloud" },
    { material: regionalHighCloudMaterial, baseOpacity: 0.14, lod: "cloud" },
    { material: buildingMaterial, baseOpacity: 1, lod: "berlin" },
    { material: treeMaterial, baseOpacity: 1, lod: "berlin" }
  ];
  return group;
}

export async function createEarthSystem(
  THREE,
  scene,
  renderer,
  isMobileDevice,
  qualityLevel,
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
        textureLoader.loadAsync(
          isMobileDevice ? EARTH_REGIONAL_TEXTURES.TERRAIN_MOBILE : EARTH_REGIONAL_TEXTURES.TERRAIN
        )
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
  regionalCloudTexture.repeat.set(0.42, 0.38);
  regionalCloudTexture.offset.set(0.02, 0.4);
  regionalCloudTexture.needsUpdate = true;

  const dayMaterial = new THREE.MeshPhysicalMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    normalScale: new THREE.Vector2(0.94, 0.94),
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    displacementMap: bumpTexture,
    displacementScale: CONFIG.EARTH.HERO_DISPLACEMENT_SCALE,
    roughness: 0.86,
    metalness: 0,
    clearcoat: 0.035,
    clearcoatRoughness: 0.26,
    emissive: 0xffffff,
    emissiveIntensity: 0.03,
    dithering: true,
  });
  dayMaterial.userData.terrainDetailStrength = 1;
  dayMaterial.userData.terrainSunDirection = new THREE.Vector2(-0.62, 0.78).normalize();
  dayMaterial.userData.terrainGlintIntensity = 1.0;
  dayMaterial.onBeforeCompile = shader => {
    shader.uniforms.terrainDetailStrength = {
      value: dayMaterial.userData.terrainDetailStrength,
    };
    shader.uniforms.terrainSunDirection = {
      value: dayMaterial.userData.terrainSunDirection,
    };
    shader.uniforms.terrainGlintIntensity = {
      value: dayMaterial.userData.terrainGlintIntensity,
    };
    dayMaterial.userData.reliefShader = shader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <displacementmap_vertex>",
      TERRAIN_DISPLACEMENT_VERTEX
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        "uniform float terrainDetailStrength;\nuniform vec2 terrainSunDirection;\nuniform float terrainGlintIntensity;\nfloat earthOceanMask = 0.0;\nvoid main() {"
      )
      .replace("#include <map_fragment>", DAYLIGHT_MAP_FRAGMENT)
      .replace("#include <roughnessmap_fragment>", EARTH_ROUGHNESS_FRAGMENT)
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
// Global 3D Tree Canopy effect
// Exclude ocean areas using earthOceanMask
if (earthOceanMask < 0.1) {
  vec3 globalTexColor = texture2D(map, vMapUv).rgb;
  // Isolate green areas (where green is stronger than red and blue)
  float isGlobalGreen = smoothstep(0.01, 0.05, globalTexColor.g - max(globalTexColor.r, globalTexColor.b));
  // High frequency noise for canopy micro-bumps (high scale for global earth)
  vec2 globalTreeUv = vMapUv * 35000.0;
  float gTreeNoise1 = fract(sin(dot(floor(globalTreeUv), vec2(12.9898, 78.233))) * 43758.5453);
  float gTreeNoise2 = fract(sin(dot(floor(globalTreeUv + vec2(0.5, 0.5)), vec2(12.9898, 78.233))) * 43758.5453);
  vec2 gf = fract(globalTreeUv);
  gf = gf * gf * (3.0 - 2.0 * gf);
  float gTreeBump = mix(gTreeNoise1, gTreeNoise2, gf.x * gf.y);
  // Blend normal with the procedural tree normal
  vec3 gTreeNormal = normalize(vec3(gTreeBump - 0.5, gTreeBump - 0.5, 1.2));
  normal = normalize(mix(normal, gTreeNormal, isGlobalGreen * 0.95));
  // Make trees rougher (less shiny than terrain)
  roughnessFactor = mix(roughnessFactor, 0.98, isGlobalGreen);
}`
      )
      .replace("#include <opaque_fragment>", EARTH_FRESNEL_FRAGMENT);
  };
  dayMaterial.customProgramCacheKey = () => "earth-day-relief-water-v17";

  const nightMaterial = new THREE.MeshPhysicalMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    displacementMap: bumpTexture,
    displacementScale: CONFIG.EARTH.DEFAULT_DISPLACEMENT_SCALE,
    normalScale: new THREE.Vector2(0.85, 0.85),
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
  earthMesh.userData.zoomGeometries = {
    berlin: earthGeometry,
    europe: new THREE.SphereGeometry(
      CONFIG.EARTH.RADIUS,
      isMobileDevice ? 128 : Math.min(segments, 256),
      isMobileDevice ? 128 : Math.min(segments, 256)
    ),
    globe: new THREE.SphereGeometry(
      CONFIG.EARTH.RADIUS,
      isMobileDevice ? 96 : Math.min(segments, 144),
      isMobileDevice ? 96 : Math.min(segments, 144)
    ),
  };

  const cityGlowGroup = createCityGlow(THREE, nightTexture, segments, isMobileDevice);
  const proceduralTerrainGroup = createProceduralTerrainLayer(
    THREE,
    isMobileDevice,
    qualityLevel,
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
    cloudTexture.wrapS = THREE.RepeatWrapping;
    cloudTexture.wrapT = THREE.ClampToEdgeWrapping;

    const lowCloudMaterial = new THREE.MeshStandardMaterial({
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
    configureWindCloudMaterial(THREE, lowCloudMaterial, {
      wind: [0.00035, 0.000018],
      distortion: 0.003,
      rotation: -0.012,
      densityShade: 0.22, // increased for volumetric cloud depth
      coverage: [0.16, 0.72],
      cacheKey: "earth-cloud-low-wind-v8",
    });

    const segments = isMobileDevice ? 96 : Math.min(CONFIG.EARTH.SEGMENTS, 256);

    const cloudGeometry = new THREE.SphereGeometry(
      CONFIG.EARTH.RADIUS + CONFIG.CLOUDS.ALTITUDE,
      segments,
      segments
    );
    const cloudMesh = new THREE.Mesh(cloudGeometry, lowCloudMaterial);
    cloudMesh.name = "earth-cloud-surface";
    cloudMesh.renderOrder = 7;
    const cloudGroup = new THREE.Group();
    cloudGroup.add(cloudMesh);

    const highCloudMaterial = new THREE.MeshStandardMaterial({
      alphaMap: cloudTexture,
      color: 0xf8fbff,
      emissive: 0x75889b,
      emissiveIntensity: 0.1,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: CONFIG.CLOUDS.OPACITY * CONFIG.CLOUDS.HIGH_OPACITY_FACTOR,
      blending: THREE.NormalBlending,
      depthWrite: false,
      alphaTest: 0,
      side: THREE.FrontSide,
      dithering: true,
    });
    configureWindCloudMaterial(THREE, highCloudMaterial, {
      wind: [0.00055, -0.000015],
      phase: [0.23, 0.018],
      distortion: 0.005,
      rotation: 0.04,
      densityShade: 0.15, // increased for volumetric cloud depth
      coverage: [0.24, 0.77],
      cacheKey: "earth-cloud-high-wind-v5",
    });
    const highCloudGeometry = new THREE.SphereGeometry(
      CONFIG.EARTH.RADIUS + CONFIG.CLOUDS.HIGH_ALTITUDE,
      segments,
      segments
    );
    const highCloudMesh = new THREE.Mesh(highCloudGeometry, highCloudMaterial);
    highCloudMesh.name = "earth-cloud-high";
    highCloudMesh.renderOrder = 8;
    highCloudMesh.rotation.y = 0.08;
    cloudGroup.add(highCloudMesh);

    const windMaterials = [lowCloudMaterial, highCloudMaterial];

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
      configureWindCloudMaterial(THREE, shadowMaterial, {
        wind: [0.00035, 0.000018],
        distortion: 0.003,
        rotation: -0.012,
        coverage: [0.16, 0.72],
        cacheKey: "earth-cloud-shadow-wind-v7",
      });
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
      windMaterials.push(shadowMaterial);
    }

    cloudGroup.userData.windMaterials = windMaterials;
    cloudGroup.userData.highCloudMesh = highCloudMesh;
    return cloudGroup;
  } catch (error) {
    log.warn("Cloud texture failed to load:", error);
    return new THREE.Object3D();
  }
}
