import { CONFIG } from "./config.js";
import { EARTH_REGIONAL_TEXTURES, getEarthTextureSetForDisplay } from "./texture-paths.js";
import { createLogger } from "../../../core/logger.js";
import { isLocalDevRuntime } from "../../../core/runtime-env.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

const log = createLogger("EarthAssets");
const TEXTURE_TIMEOUT_MS = 15000;
const KTX2_TRANSCODER_URL = "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/libs/basis/";
const EARTH_CITY_LIGHTS_URL = "/content/media/data/earth-cities.bin?v=natural-earth-5-r1";
const WIND_CLOUD_UNIFORMS = `
uniform float cloudTime;
uniform vec2 cloudWind;
uniform vec2 cloudPhase;
uniform float cloudDistortion;
uniform float cloudRotation;
uniform float cloudDensityShade;
uniform float cloudIsShadow;
uniform vec2 cloudCoverageRange;
uniform vec2 cloudShadowUvOffset;
uniform vec3 earthSunDirectionWorld;
varying vec3 vCloudWorldNormal;`;
const WIND_CLOUD_ALPHA_FRAGMENT = `
#ifdef USE_ALPHAMAP
  vec2 centeredCloudUv = vAlphaMapUv - 0.5;
  float cloudCos = cos(cloudRotation);
  float cloudSin = sin(cloudRotation);
  vec2 rotatedCloudUv = vec2(
    centeredCloudUv.x * cloudCos - centeredCloudUv.y * cloudSin,
    centeredCloudUv.x * cloudSin + centeredCloudUv.y * cloudCos
  ) + 0.5;
  vec2 windUv = rotatedCloudUv + cloudPhase + cloudWind * cloudTime + cloudShadowUvOffset;
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
  float cloudSun = dot(normalize(vCloudWorldNormal), normalize(earthSunDirectionWorld));
  float cloudDaylight = smoothstep(-0.12, 0.18, cloudSun);
  float cloudTwilight = smoothstep(-0.18, -0.01, cloudSun)
    * (1.0 - smoothstep(-0.01, 0.2, cloudSun));
  cloudScatterTint = mix(
    cloudScatterTint * vec3(0.28, 0.34, 0.46),
    cloudScatterTint,
    cloudDaylight
  );
  cloudScatterTint += vec3(0.16, 0.055, 0.018) * cloudTwilight;
  
  // Fresnel Edge Fade: fade out clouds exactly at the sphere limb to prevent them 
  // from sticking out past the earth's edge (the "broken halo" effect)
  // Note: 'normal' is not defined yet here, so we use the view-space 'vNormal.z'
  float cloudFresnel = clamp(vNormal.z, 0.0, 1.0);
  float edgeMask = smoothstep(0.05, 0.35, cloudFresnel);

  float cloudLightVisibility = mix(0.22, 1.0, cloudDaylight);
  if (cloudIsShadow > 0.5) {
    cloudLightVisibility = smoothstep(-0.02, 0.2, cloudSun);
  }
  diffuseColor.rgb *= cloudScatterTint * densityLight * cloudBaseShadow;
  diffuseColor.a *= cloudCoverage * edgeMask * cloudLightVisibility;
#endif`;
const TERRAIN_DISPLACEMENT_VERTEX = `
#ifdef USE_DISPLACEMENTMAP
  if (abs(displacementScale) > 0.0001) {
    float terrainHeightSource = texture2D(displacementMap, vDisplacementMapUv).x;
    float terrainLandHeight = smoothstep(0.018, 0.62, terrainHeightSource);
    float terrainMountainHeight = pow(terrainLandHeight, 1.55);
    transformed += normalize(objectNormal)
      * (terrainMountainHeight * displacementScale + displacementBias);
  }
#endif`;
const DAYLIGHT_MAP_FRAGMENT = `#include <map_fragment>
vec3 sourceAlbedo = texture2D(map, vMapUv).rgb;
earthOceanMask = smoothstep(0.0, 0.03, sourceAlbedo.b - sourceAlbedo.r)
  * smoothstep(-0.005, 0.025, sourceAlbedo.b - sourceAlbedo.g);
#ifdef USE_BUMPMAP
  float earthElevationForWater = texture2D(bumpMap, vBumpMapUv).r;
  float elevationWaterMask = 1.0 - smoothstep(0.003, 0.03, earthElevationForWater);
  earthOceanMask *= mix(0.34, 1.0, elevationWaterMask);
#endif
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
vec3 forestGrade = daylightGrade * vec3(0.95, 1.12, 0.88);
forestGrade += vec3(0.003, 0.012, 0.002);
daylightGrade = mix(
  daylightGrade,
  forestGrade,
  vegetationMask * 0.2 * terrainDetailStrength
);
#ifdef USE_BUMPMAP
if (terrainDetailStrength > 0.01) {
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
}
#endif
// Desert / arid zones: warm ochre toning (Sahara, Arabian Peninsula, outback)
float desertLuma = smoothstep(0.50, 0.80, daylightLuma) * earthLandMask;
float desertWarmth = smoothstep(0.02, 0.15, sourceAlbedo.r - sourceAlbedo.b);
float desertMask = desertLuma * desertWarmth;
daylightGrade = mix(daylightGrade, daylightGrade * vec3(1.055, 1.01, 0.88), desertMask * 0.3);
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
vec3 oceanGrade   = mix(sourceAlbedo, mix(shallowOcean, deepOcean, clamp(oceanDepth * 0.80 + 0.20, 0.0, 1.0)), 0.54);
// Polar ocean: ice-white tint near the poles (Arctic / Antarctic pack ice)
oceanGrade = mix(oceanGrade, iceWhite * 0.80, polarIceMask * 0.44);
diffuseColor.rgb = min(mix(daylightGrade, oceanGrade, earthOceanMask * 0.48), vec3(1.0));`;

const EARTH_ROUGHNESS_FRAGMENT = `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.26, earthOceanMask);
// Micro-scale ocean roughness: hash noise simulates subtle wave-pattern variation
float oceanMicroRough = fract(sin(dot(floor(vMapUv * 460.0), vec2(127.1, 311.7))) * 43758.5453);
roughnessFactor = mix(roughnessFactor, 0.22 + oceanMicroRough * 0.08, earthOceanMask * 0.50);`;

const EARTH_FRESNEL_FRAGMENT = `float viewNDot = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
float surfaceSunFacing = dot(normalize(vEarthWorldNormal), normalize(earthSunDirectionWorld));
float nightHemisphere = 1.0 - smoothstep(-0.16, 0.12, surfaceSunFacing);
float earthshineFresnel = pow(1.0 - viewNDot, 1.8);
outgoingLight += diffuseColor.rgb
  * vec3(0.075, 0.105, 0.17)
  * nightHemisphere
  * (0.55 + earthshineFresnel * 0.45);
// Broad specular shimmer across the ocean face
float broadWaterReflection = pow(1.0 - viewNDot, 1.45);
outgoingLight += vec3(0.010, 0.013, 0.020) * broadWaterReflection * earthOceanMask;
#include <opaque_fragment>`;

const EARTH_EMISSIVE_FRAGMENT = `
#ifdef USE_EMISSIVEMAP
  vec3 earthNightSample = texture2D(emissiveMap, vEmissiveMapUv, -1.25).rgb;
  float earthNightBrightness = max(
    earthNightSample.r,
    max(earthNightSample.g, earthNightSample.b)
  );
  float earthCityCores = smoothstep(0.055, 0.4, earthNightBrightness);
  float earthBoostedBrightness = pow(max(earthNightBrightness, 0.0), 0.72);
  vec3 earthWarmCityColor = mix(
    earthNightSample,
    vec3(1.0, 0.58, 0.22) * earthBoostedBrightness,
    0.58
  );
  totalEmissiveRadiance *= earthWarmCityColor
    * earthCityCores
    * (1.32 + earthBoostedBrightness * 1.2);
#endif
float earthSunFacing = dot(normalize(vEarthWorldNormal), normalize(earthSunDirectionWorld));
float earthNightMask = 1.0 - smoothstep(-0.1, 0.055, earthSunFacing);
float earthTwilightLights = 1.0 - smoothstep(-0.025, 0.07, earthSunFacing);
totalEmissiveRadiance *= earthNightMask * earthTwilightLights;`;

function createCityGlow(THREE, nightTexture, segments, isMobileDevice) {
  const glowGroup = new THREE.Group();
  const citySegments = isMobileDevice ? 80 : Math.min(segments, 160);
  const layerSettings = isMobileDevice
    ? [{ altitude: 0.018, opacity: 0.23 }]
    : [
        { altitude: 0.012, opacity: 0.27 },
        { altitude: 0.032, opacity: 0.11 },
      ];

  layerSettings.forEach(({ altitude, opacity }) => {
    const geometry = new THREE.SphereGeometry(
      CONFIG.EARTH.RADIUS + altitude,
      citySegments,
      citySegments
    );
    const material = new THREE.ShaderMaterial({
      uniforms: {
        cityMap: { value: nightTexture },
        glowOpacity: { value: opacity },
        earthSunDirectionWorld: { value: new THREE.Vector3(0, 0, 1) },
      },
      vertexShader: `
        varying vec2 vCityUv;
        varying vec3 vCityWorldNormal;
        void main() {
          vCityUv = uv;
          vCityWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D cityMap;
        uniform float glowOpacity;
        uniform vec3 earthSunDirectionWorld;
        varying vec2 vCityUv;
        varying vec3 vCityWorldNormal;
        void main() {
          vec3 cityColor = texture2D(cityMap, vCityUv, -1.15).rgb;
          float brightness = max(cityColor.r, max(cityColor.g, cityColor.b));
          float warmSignal = max(
            cityColor.r * 1.1 - cityColor.b * 0.35,
            cityColor.g * 0.9 - cityColor.b * 0.28
          );
          float roadSignal = pow(max(warmSignal, 0.0), 0.7);
          float roadMask = smoothstep(0.018, 0.2, roadSignal);
          float cityCore = smoothstep(0.095, 0.52, brightness);
          float lightMask = max(roadMask * 0.42, cityCore);
          vec3 warmLight = mix(
            cityColor,
            vec3(1.0, 0.65, 0.3) * brightness,
            0.45
          );
          float sunFacing = dot(
            normalize(vCityWorldNormal),
            normalize(earthSunDirectionWorld)
          );
          float nightMask = 1.0 - smoothstep(-0.12, 0.045, sunFacing);
          float horizonFade = 1.0 - smoothstep(-0.1, -0.025, sunFacing);
          float physicalVisibility = nightMask * mix(0.45, 1.0, horizonFade);
          gl_FragColor = vec4(
            warmLight * (roadMask * 0.98 + cityCore * 1.34),
            lightMask * glowOpacity * physicalVisibility
          );
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.FrontSide,
      toneMapped: false,
    });
    material.userData.baseGlowOpacity = opacity;
    glowGroup.add(new THREE.Mesh(geometry, material));
  });

  glowGroup.visible = true;
  glowGroup.renderOrder = 2;
  return glowGroup;
}

function createCityLightsPoints(THREE, cityBuffer, isMobileDevice) {
  const group = new THREE.Group();
  group.name = "earth-city-light-points";
  if (!cityBuffer) return group;

  const encoded = new Int16Array(cityBuffer);
  const positions = [];
  const weights = [];
  const radius = CONFIG.EARTH.RADIUS + 0.018;

  for (let index = 0; index < encoded.length; index += 3) {
    const weight = Math.max(0, encoded[index + 2] / 10000);
    if (isMobileDevice && weight < 0.28 && index % 2 === 0) continue;
    const longitude = THREE.MathUtils.degToRad(encoded[index] / 100);
    const latitude = THREE.MathUtils.degToRad(encoded[index + 1] / 100);
    const latitudeRadius = Math.cos(latitude);
    positions.push(
      radius * Math.cos(longitude) * latitudeRadius,
      radius * Math.sin(latitude),
      -radius * Math.sin(longitude) * latitudeRadius
    );
    weights.push(weight);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("cityWeight", new THREE.Float32BufferAttribute(weights, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      cityPointOpacity: { value: 0 },
    },
    vertexShader: `
      attribute float cityWeight;
      varying float vSurfaceFacing;
      varying float vCityWeight;
      void main() {
        vCityWeight = cityWeight;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vec3 viewNormal = normalize(normalMatrix * position);
        vSurfaceFacing = smoothstep(
          0.06,
          0.22,
          dot(viewNormal, normalize(-viewPosition.xyz))
        );
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = mix(2.0, 5.5, cityWeight)
          * (12.0 / max(-viewPosition.z, 1.0));
      }
    `,
    fragmentShader: `
      uniform float cityPointOpacity;
      varying float vSurfaceFacing;
      varying float vCityWeight;
      void main() {
        float distanceToCenter = length(gl_PointCoord - 0.5) * 2.0;
        float core = 1.0 - smoothstep(0.08, 0.42, distanceToCenter);
        float halo = 1.0 - smoothstep(0.18, 1.0, distanceToCenter);
        float alpha = (core + halo * 0.38)
          * cityPointOpacity
          * vSurfaceFacing
          * mix(0.68, 1.0, vCityWeight);
        vec3 color = mix(vec3(1.0, 0.36, 0.08), vec3(1.0, 0.78, 0.38), core);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "earth-city-light-points-mesh";
  points.renderOrder = 3;
  group.add(points);
  return group;
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
    shadowOffsetFactor = 0,
    isShadow = false,
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
    shader.uniforms.cloudIsShadow = { value: isShadow ? 1 : 0 };
    shader.uniforms.cloudCoverageRange = {
      value: new THREE.Vector2(coverage[0], coverage[1]),
    };
    material.userData.shadowOffsetFactor = shadowOffsetFactor;
    shader.uniforms.cloudShadowUvOffset = {
      value: new THREE.Vector2(),
    };
    shader.uniforms.earthSunDirectionWorld = {
      value: material.userData.earthSunDirectionWorld || new THREE.Vector3(0, 0, 1),
    };
    material.userData.cloudShader = shader;
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", `${WIND_CLOUD_UNIFORMS}\nvoid main() {`)
      .replace("#include <alphamap_fragment>", WIND_CLOUD_ALPHA_FRAGMENT);

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vCloudWorldNormal;
${material.type === "MeshBasicMaterial" ? "varying vec3 vNormal;" : ""}`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
  vCloudWorldNormal = normalize(mat3(modelMatrix) * normal);
  ${material.type === "MeshBasicMaterial" ? "vNormal = normalize(normalMatrix * normal);" : ""}`
      );
  };
  material.customProgramCacheKey = () => cacheKey;
}

function terrainDirection(THREE, x, y, target = new THREE.Vector3()) {
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

  return target.set(
    Math.sin(longitude) * latitudeRadius,
    Math.sin(latitude),
    Math.cos(longitude) * latitudeRadius
  );
}

function terrainSurfacePoint(THREE, x, y, elevation = 0.018, target = new THREE.Vector3()) {
  return terrainDirection(THREE, x, y, target).multiplyScalar(CONFIG.EARTH.RADIUS + elevation);
}

function createTerrainHeightSampler(THREE, terrainHeightTexture) {
  const image = terrainHeightTexture?.image;
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

function createTerrainColorSampler(THREE, terrainTexture) {
  const image = terrainTexture.image;
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

    return (u, v, targetRGB) => {
      const pixelX = Math.round(THREE.MathUtils.clamp(u, 0, 1) * (width - 1));
      const pixelY = Math.round((1 - THREE.MathUtils.clamp(v, 0, 1)) * (height - 1));
      const index = (pixelY * width + pixelX) * 4;
      targetRGB[0] = pixels[index];
      targetRGB[1] = pixels[index + 1];
      targetRGB[2] = pixels[index + 2];
    };
  } catch (error) {
    if (isLocalDevRuntime()) log.warn("Terrain color sampling failed:", error);
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

  const tempPoint = new THREE.Vector3();
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const sourceHeight = sampleHeight ? sampleHeight(uvs.getX(index), uvs.getY(index)) : 0.2;
    const landHeight = THREE.MathUtils.smoothstep(sourceHeight, 0.12, 0.82);
    const mountainHeight = Math.pow(landHeight, 1.35);
    const edgeBlend = THREE.MathUtils.smoothstep(Math.abs(x), 0.55, 1);
    const edgeRelief = THREE.MathUtils.lerp(1, 0.55, edgeBlend);
    const elevation = 0.004 + mountainHeight * 0.03 * edgeRelief * reliefScale;
    terrainSurfacePoint(THREE, x, y, elevation, tempPoint);
    positions.setXYZ(index, tempPoint.x, tempPoint.y, tempPoint.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

function configureInstanceFade(material) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
      attribute vec2 instanceUv;
      varying vec2 vInstanceUv;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
      vInstanceUv = instanceUv;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying vec2 vInstanceUv;`
      )
      .replace(
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
normal = normalize(mix(normal, treeNormal, isGreen * 0.42));
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
  regionalWaterTexture,
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
  const sampleColor = createTerrainColorSampler(THREE, terrainTexture);
  const geometry = createRegionalTerrainGeometry(
    THREE,
    widthSegments,
    heightSegments,
    sampleHeight,
    1.7
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

  const waterMaterial = new THREE.MeshPhysicalMaterial({
    alphaMap: regionalWaterTexture,
    color: 0x1678ad,
    emissive: 0x0a3550,
    emissiveIntensity: 0.2,
    roughness: 0.18,
    metalness: 0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    transparent: true,
    opacity: 0.76,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    dithering: true,
  });
  const water = new THREE.Mesh(geometry, waterMaterial);
  water.name = "earth-regional-lakes";
  water.renderOrder = 6;
  water.scale.setScalar(1 + 0.003 / CONFIG.EARTH.RADIUS);
  group.add(water);

  const regionalCloudShadowMaterial = new THREE.MeshBasicMaterial({
    alphaMap: regionalCloudTexture,
    color: 0x17232e,
    transparent: true,
    opacity: 0.075,
    depthTest: false,
    depthWrite: false,
  });
  const regionalCloudShadow = new THREE.Mesh(geometry, regionalCloudShadowMaterial);
  regionalCloudShadow.name = "earth-regional-cloud-shadow";
  regionalCloudShadow.renderOrder = 7;
  regionalCloudShadow.scale.setScalar(1 + 0.008 / CONFIG.EARTH.RADIUS);
  group.add(regionalCloudShadow);

  const regionalCloudMaterial = new THREE.MeshLambertMaterial({
    alphaMap: regionalCloudTexture,
    color: 0xf3f7fa,
    emissive: 0x46515c,
    emissiveIntensity: 0.16,
    transparent: true,
    opacity: 0.6,
    depthTest: false,
    depthWrite: false,
    dithering: true,
  });
  const regionalClouds = new THREE.Mesh(geometry, regionalCloudMaterial);
  regionalClouds.name = "earth-regional-clouds";
  regionalClouds.renderOrder = 8;
  regionalClouds.scale.setScalar(1 + 0.022 / CONFIG.EARTH.RADIUS);
  group.add(regionalClouds);

  const numInstances = isMobileDevice
    ? 4000
    : qualityLevel === "LOW"
      ? 2500
      : qualityLevel === "MEDIUM"
        ? 8000
        : 12000;

  const buildingGeometry = new THREE.BoxGeometry(0.0018, 0.0018, 0.0018);
  buildingGeometry.translate(0, 0, 0.00075);

  const treeGeometry = new THREE.ConeGeometry(0.0008, 0.002, 5);
  treeGeometry.translate(0, 0, 0.001);
  treeGeometry.rotateX(Math.PI / 2);

  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0x77828d,
    emissive: 0x202933,
    emissiveIntensity: 0.06,
    roughness: 0.72,
    metalness: 0.18,
    transparent: true,
    opacity: 1,
  });

  const treeMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e5c2e,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 1,
  });

  configureInstanceFade(buildingMaterial);
  configureInstanceFade(treeMaterial);

  const cityMesh = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, numInstances);
  const forestMesh = new THREE.InstancedMesh(treeGeometry, treeMaterial, numInstances);
  const cityUvArray = new Float32Array(numInstances * 2);
  const forestUvArray = new Float32Array(numInstances * 2);

  cityMesh.geometry = cityMesh.geometry.clone();
  forestMesh.geometry = forestMesh.geometry.clone();

  const cityUvAttribute = new THREE.InstancedBufferAttribute(cityUvArray, 2);
  const forestUvAttribute = new THREE.InstancedBufferAttribute(forestUvArray, 2);

  cityMesh.geometry.setAttribute("instanceUv", cityUvAttribute);
  forestMesh.geometry.setAttribute("instanceUv", forestUvAttribute);

  cityMesh.name = "earth-regional-cities";
  forestMesh.name = "earth-regional-forests";
  cityMesh.renderOrder = 5;
  forestMesh.renderOrder = 5;

  const dummy = new THREE.Object3D();
  const upVector = new THREE.Vector3(0, 0, 1);

  let cityCount = 0;
  let treeCount = 0;
  const maxCityInstances = Math.floor(numInstances * 0.35);
  const maxForestInstances = Math.floor(numInstances * 0.12);

  let seed = 12345;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const reliefScaleNum = 1.7;

  const tempColor = new THREE.Color();
  const dir = new THREE.Vector3();
  const tempPoint = new THREE.Vector3();
  const colorData = [0, 0, 0];

  for (let i = 0; i < numInstances * 4; i++) {
    if (cityCount >= maxCityInstances && treeCount >= maxForestInstances) break;

    const r1 = random();
    const r2 = random();
    const radius = Math.sqrt(r1) * 0.95;
    const theta = r2 * Math.PI * 2;

    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);
    const distanceFromBerlinCenter = Math.hypot(x, y + 0.05);

    const u = (x + 1) / 2;
    const v = (y + 1) / 2;

    const sourceHeight = sampleHeight ? sampleHeight(u, v) : 0.2;

    if (sourceHeight < 0.02) continue;

    const landHeight = THREE.MathUtils.smoothstep(sourceHeight, 0.12, 0.82);
    const mountainHeight = Math.pow(landHeight, 1.35);
    const edgeBlend = THREE.MathUtils.smoothstep(Math.abs(x), 0.55, 1);
    const edgeRelief = THREE.MathUtils.lerp(1, 0.55, edgeBlend);
    const elevation = 0.004 + mountainHeight * 0.03 * edgeRelief * reliefScaleNum;

    terrainSurfacePoint(THREE, x, y, elevation, tempPoint);

    dir.copy(tempPoint).normalize();

    dummy.position.copy(tempPoint);
    dummy.quaternion.setFromUnitVectors(upVector, dir);
    dummy.rotateZ(random() * Math.PI * 2);

    let isCity = false;
    let isForest = false;

    if (sampleColor) {
      sampleColor(u, v, colorData);
      const r = colorData[0];
      const g = colorData[1];
      const b = colorData[2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      if (g > r + 10 && g > b + 10 && max > 30 && max < 200) {
        isForest = true;
      } else if (max - min < 38 && max > 45 && max < 210) {
        isCity = true;
      }
    } else {
      const noise = (Math.sin(x * 20) + Math.cos(y * 20)) * 0.5 + 0.5;
      if (noise > 0.6) isCity = true;
      else if (noise <= 0.6) isForest = true;
    }

    const scatterNoise = (Math.sin(x * 50) + Math.cos(y * 50)) * 0.5 + 0.5;

    if (
      (isCity || distanceFromBerlinCenter < 0.4) &&
      distanceFromBerlinCenter < 0.62 &&
      sourceHeight > 0.02 &&
      sourceHeight < 0.45 &&
      scatterNoise > 0.3 &&
      cityCount < maxCityInstances
    ) {
      const coreStrength = THREE.MathUtils.clamp(1 - distanceFromBerlinCenter / 0.62, 0, 1);
      const footprintScale = 0.9 + random() * 0.7 + coreStrength * 0.55;
      const heightScale = 1.4 + random() * 3.2 + coreStrength * (2.4 + random() * 3.8);
      dummy.scale.set(footprintScale, footprintScale, heightScale);
      dummy.updateMatrix();
      cityMesh.setMatrixAt(cityCount, dummy.matrix);
      cityUvArray[cityCount * 2] = u;
      cityUvArray[cityCount * 2 + 1] = v;

      tempColor.setHSL(0.6, 0.08, 0.3 + random() * 0.25);
      cityMesh.setColorAt(cityCount, tempColor);
      cityCount++;
    } else if (
      isForest &&
      distanceFromBerlinCenter > 0.46 &&
      sourceHeight >= 0.03 &&
      sourceHeight < 0.5 &&
      scatterNoise > 0.2 &&
      treeCount < maxForestInstances
    ) {
      const scale = 0.5 + random() * 0.8;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      forestMesh.setMatrixAt(treeCount, dummy.matrix);
      forestUvArray[treeCount * 2] = u;
      forestUvArray[treeCount * 2 + 1] = v;

      tempColor.setHSL(0.3 + random() * 0.05, 0.5 + random() * 0.4, 0.15 + random() * 0.2);
      forestMesh.setColorAt(treeCount, tempColor);
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
  group.userData.anchorInitialized = false;
  group.userData.terrainMaterial = terrainMaterial;
  group.userData.cloudTexture = regionalCloudTexture;
  group.userData.fadeMaterials = [
    { material: terrainMaterial, baseOpacity: 1 },
    { material: waterMaterial, baseOpacity: 0.76 },
    { material: regionalCloudShadowMaterial, baseOpacity: 0.075 },
    { material: regionalCloudMaterial, baseOpacity: 0.6 },
    { material: buildingMaterial, baseOpacity: 1 },
    { material: treeMaterial, baseOpacity: 1 },
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
    regionalWaterTexture,
    regionalCloudTexture,
    dayTexture,
    nightTexture,
    normalTexture,
    bumpTexture,
    cityBuffer;
  let timeoutId;
  try {
    const texturePromise = Promise.all([
      loadNamedTexture(
        "EOX city hemisphere",
        textureLoader.loadAsync(
          isMobileDevice ? EARTH_REGIONAL_TEXTURES.TERRAIN_MOBILE : EARTH_REGIONAL_TEXTURES.TERRAIN
        )
      ),
      loadNamedTexture(
        "EOX regional height",
        textureLoader.loadAsync(EARTH_REGIONAL_TEXTURES.HEIGHT)
      ),
      loadNamedTexture(
        "EOX regional normal",
        textureLoader.loadAsync(EARTH_REGIONAL_TEXTURES.NORMAL)
      ),
      loadNamedTexture(
        "EOX regional lakes",
        textureLoader.loadAsync(EARTH_REGIONAL_TEXTURES.WATER)
      ),
      loadNamedTexture("regional clouds", textureLoader.loadAsync(textureSet.CLOUDS)),
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
      fetch(EARTH_CITY_LIGHTS_URL)
        .then(response => (response.ok ? response.arrayBuffer() : null))
        .catch(() => null),
    ]);
    [
      regionalTerrainTexture,
      regionalTerrainHeightTexture,
      regionalTerrainNormalTexture,
      regionalWaterTexture,
      regionalCloudTexture,
      dayTexture,
      nightTexture,
      normalTexture,
      bumpTexture,
      cityBuffer,
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

  const qualityAnisotropy = qualityLevel === "LOW" ? 4 : qualityLevel === "MEDIUM" ? 8 : 16;
  const deviceAnisotropy = isMobileDevice ? 8 : 16;
  const anisotropy = Math.min(
    renderer.capabilities.getMaxAnisotropy(),
    qualityAnisotropy,
    deviceAnisotropy
  );
  configureTexture(THREE, dayTexture, anisotropy, THREE.SRGBColorSpace);
  configureTexture(THREE, nightTexture, anisotropy, THREE.SRGBColorSpace);
  configureTexture(THREE, normalTexture, anisotropy, THREE.NoColorSpace);
  configureTexture(THREE, bumpTexture, anisotropy, THREE.NoColorSpace);
  configureTexture(THREE, regionalTerrainTexture, anisotropy, THREE.SRGBColorSpace);
  regionalTerrainTexture.wrapS = THREE.ClampToEdgeWrapping;
  configureTexture(THREE, regionalTerrainHeightTexture, anisotropy, THREE.NoColorSpace);
  regionalTerrainHeightTexture.wrapS = THREE.ClampToEdgeWrapping;
  configureTexture(THREE, regionalTerrainNormalTexture, anisotropy, THREE.NoColorSpace);
  regionalTerrainNormalTexture.wrapS = THREE.ClampToEdgeWrapping;
  configureTexture(THREE, regionalWaterTexture, anisotropy, THREE.NoColorSpace);
  regionalWaterTexture.wrapS = THREE.ClampToEdgeWrapping;
  configureTexture(THREE, regionalCloudTexture, anisotropy, THREE.NoColorSpace);
  regionalCloudTexture.wrapS = regionalCloudTexture.wrapT = THREE.RepeatWrapping;
  regionalCloudTexture.repeat.set(0.42, 0.34);
  regionalCloudTexture.offset.set(0.06, 0.37);

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
    emissive: 0xffb65d,
    emissiveMap: nightTexture,
    emissiveIntensity: CONFIG.EARTH.CITY_LIGHT_INTENSITY,
    dithering: true,
  });
  dayMaterial.userData.terrainDetailStrength = 1;
  dayMaterial.userData.terrainSunDirection = new THREE.Vector2(-0.62, 0.78).normalize();
  dayMaterial.userData.earthSunDirectionWorld = new THREE.Vector3(0, 0, 1);
  dayMaterial.userData.isEarthPhysicalLightingMaterial = true;
  dayMaterial.onBeforeCompile = shader => {
    shader.uniforms.terrainDetailStrength = {
      value: dayMaterial.userData.terrainDetailStrength,
    };
    shader.uniforms.terrainSunDirection = {
      value: dayMaterial.userData.terrainSunDirection,
    };
    shader.uniforms.earthSunDirectionWorld = {
      value: dayMaterial.userData.earthSunDirectionWorld,
    };
    dayMaterial.userData.reliefShader = shader;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vEarthWorldNormal;")
      .replace(
        "#include <defaultnormal_vertex>",
        "#include <defaultnormal_vertex>\nvEarthWorldNormal = normalize(mat3(modelMatrix) * objectNormal);"
      )
      .replace("#include <displacementmap_vertex>", TERRAIN_DISPLACEMENT_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        "uniform float terrainDetailStrength;\nuniform vec2 terrainSunDirection;\nuniform vec3 earthSunDirectionWorld;\nvarying vec3 vEarthWorldNormal;\nfloat earthOceanMask = 0.0;\nvoid main() {"
      )
      .replace("#include <map_fragment>", DAYLIGHT_MAP_FRAGMENT)
      .replace("#include <emissivemap_fragment>", EARTH_EMISSIVE_FRAGMENT)
      .replace("#include <roughnessmap_fragment>", EARTH_ROUGHNESS_FRAGMENT)
      .replace("#include <opaque_fragment>", EARTH_FRESNEL_FRAGMENT);
  };
  dayMaterial.customProgramCacheKey = () => "earth-city-points-v27";
  const nightMaterial = dayMaterial;

  // OPTIMIZATION: Reduce segments on mobile
  const segments = isMobileDevice
    ? CONFIG.EARTH.SEGMENTS_MOBILE
    : qualityLevel === "MEDIUM"
      ? Math.min(CONFIG.EARTH.SEGMENTS, 256)
      : CONFIG.EARTH.SEGMENTS;

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
  const cityLightsPoints = createCityLightsPoints(THREE, cityBuffer, isMobileDevice);
  const proceduralTerrainGroup = createProceduralTerrainLayer(
    THREE,
    isMobileDevice,
    qualityLevel,
    regionalTerrainTexture,
    regionalTerrainHeightTexture,
    regionalTerrainNormalTexture,
    regionalWaterTexture,
    regionalCloudTexture
  );
  earthMesh.add(cityGlowGroup);
  earthMesh.add(cityLightsPoints);
  earthMesh.add(proceduralTerrainGroup);
  scene.add(earthMesh);

  return {
    earthMesh,
    dayMaterial,
    nightMaterial,
    cityGlowGroup,
    cityLightsPoints,
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
        shadowOffsetFactor: 0.0045,
        isShadow: true,
        cacheKey: "earth-cloud-shadow-sun-wind-v8",
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
