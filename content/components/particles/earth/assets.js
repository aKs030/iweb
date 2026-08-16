import { CONFIG } from "./config.js";
import { EARTH_REGIONAL_TEXTURES, getEarthTextureSetForDisplay } from "./texture-paths.js";
import { createLogger } from "../../../core/logger.js";
import { isLocalDevRuntime } from "../../../core/runtime-env.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

const log = createLogger("EarthAssets");
const TEXTURE_TIMEOUT_MS = 15000;
const OPTIONAL_TEXTURE_TIMEOUT_MS = 5000;
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
  vec3 cloudScatterTint = mix(
    vec3(1.05, 0.99, 0.91),
    vec3(0.97, 0.98, 1.02),
    cloudCoverage
  );
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
vec3 sourceAlbedo = sampledDiffuseColor.rgb;
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
vec3 forestGrade = daylightGrade * vec3(0.95, 1.12, 0.88);
forestGrade += vec3(0.003, 0.012, 0.002);
daylightGrade = mix(
  daylightGrade,
  forestGrade,
  vegetationMask * 0.2 * terrainDetailStrength
);
#ifdef USE_BUMPMAP
if (terrainDetailStrength > 0.01) {
  vec2 earthReliefTexel = 1.0 / vec2(textureSize(bumpMap, 0));
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
  float snowCapHeight = smoothstep(0.62, 0.80, reliefCenter) * reliefLandMask;
  daylightGrade = mix(daylightGrade, vec3(0.91, 0.93, 0.97), snowCapHeight * 0.58 * terrainDetailStrength);
}
#endif
float desertLuma = smoothstep(0.50, 0.80, daylightLuma) * earthLandMask;
float desertWarmth = smoothstep(0.02, 0.15, sourceAlbedo.r - sourceAlbedo.b);
float desertMask = desertLuma * desertWarmth;
daylightGrade = mix(daylightGrade, daylightGrade * vec3(1.055, 1.01, 0.88), desertMask * 0.3);
float polarNorth = smoothstep(0.72, 0.90, vMapUv.y);
float polarSouth = smoothstep(0.28, 0.10, vMapUv.y);
float polarLat   = max(polarNorth, polarSouth);
float iceBrightness = smoothstep(0.40, 0.66, daylightLuma);
float polarIceMask = polarLat * iceBrightness;
vec3 iceWhite = vec3(0.91, 0.94, 0.98);
daylightGrade = mix(daylightGrade, iceWhite, polarIceMask * earthLandMask * 0.82);
float oceanLuma = dot(sourceAlbedo, vec3(0.2126, 0.7152, 0.0722));
float oceanDepth = 1.0 - smoothstep(0.04, 0.22, oceanLuma);
vec3 deepOcean    = oceanLuma * vec3(0.16, 0.38, 1.08);
vec3 shallowOcean = oceanLuma * vec3(0.30, 0.72, 0.80);
vec3 oceanGrade   = mix(sourceAlbedo, mix(shallowOcean, deepOcean, clamp(oceanDepth * 0.80 + 0.20, 0.0, 1.0)), 0.54);
float gradedOceanLuma = dot(oceanGrade, vec3(0.2126, 0.7152, 0.0722));
oceanGrade = mix(vec3(gradedOceanLuma), oceanGrade, oceanSaturation) * oceanBrightness;
oceanGrade = mix(oceanGrade, iceWhite * 0.80, polarIceMask * 0.44);
diffuseColor.rgb = min(
  mix(daylightGrade, oceanGrade, earthOceanMask * oceanGradeStrength),
  vec3(1.0)
);`;

const EARTH_ROUGHNESS_FRAGMENT = `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.26, earthOceanMask);
float oceanMicroRough = fract(sin(dot(floor(vMapUv * 460.0), vec2(127.1, 311.7))) * 43758.5453);
roughnessFactor = mix(roughnessFactor, 0.22 + oceanMicroRough * 0.08, earthOceanMask * 0.50);`;

const EARTH_FRESNEL_FRAGMENT = `float viewNDot = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
float surfaceSunFacing = dot(normalize(vEarthWorldNormal), normalize(earthSunDirectionWorld));
float nightHemisphere = 1.0 - smoothstep(-0.16, 0.08, surfaceSunFacing);
float earthshineFresnel = pow(1.0 - viewNDot, 2.8);
outgoingLight += diffuseColor.rgb
  * vec3(0.04, 0.06, 0.10)
  * nightHemisphere
  * earthshineFresnel;

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

function createAtmosphereLayer(THREE, segments) {
  // Inner Mie-scattering layer — warm haze hugging the surface
  const innerGeometry = new THREE.SphereGeometry(
    CONFIG.EARTH.RADIUS + 0.018,
    Math.min(segments, 128),
    Math.min(segments, 128)
  );
  const innerMaterial = new THREE.ShaderMaterial({
    uniforms: {
      sunDirection: { value: new THREE.Vector3(0.6, 0.2, 0.8) },
    },
    vertexShader: `
      varying float vFresnel;
      varying vec3 vWorldNormal;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vec3 v = normalize(-p.xyz);
        vFresnel = pow(1.0 - max(dot(n, v), 0.0), 3.2);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: `
      uniform vec3 sunDirection;
      varying float vFresnel;
      varying vec3 vWorldNormal;
      void main() {
        // Sunset tint: when sun is near the horizon, shift to orange-pink
        float sunHorizon = dot(normalize(vWorldNormal), normalize(sunDirection));
        float sunsetFactor = smoothstep(0.05, 0.35, sunHorizon);
        // Daytime: blue-white haze. Sunset: warm orange-pink
        vec3 dayColor    = vec3(0.42, 0.70, 1.00);
        vec3 sunsetColor = vec3(1.00, 0.52, 0.22);
        vec3 mieColor = mix(sunsetColor, dayColor, sunsetFactor);
        float alpha = smoothstep(0.05, 0.88, vFresnel) * 0.18;
        gl_FragColor = vec4(mieColor, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  innerMaterial.userData.isSunTracked = true;

  // Outer Rayleigh-scattering layer — deep blue limb
  const outerGeometry = new THREE.SphereGeometry(
    CONFIG.EARTH.RADIUS + 0.042,
    Math.min(segments, 96),
    Math.min(segments, 96)
  );
  const outerMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      varying float vFresnel;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vec3 v = normalize(-p.xyz);
        vFresnel = pow(1.0 - max(dot(n, v), 0.0), 2.2);
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: `
      varying float vFresnel;
      void main() {
        float a = smoothstep(0.10, 0.96, vFresnel) * 0.072;
        gl_FragColor = vec4(0.22, 0.50, 1.00, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const group = new THREE.Group();
  group.name = "earth-atmosphere";
  group.renderOrder = 1;

  const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial);
  innerMesh.name = "earth-atmosphere-mie";
  innerMesh.renderOrder = 1;

  const outerMesh = new THREE.Mesh(outerGeometry, outerMaterial);
  outerMesh.name = "earth-atmosphere-rayleigh";
  outerMesh.renderOrder = 1;

  group.add(innerMesh);
  group.add(outerMesh);
  return group;
}

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
        if (cityPointOpacity <= 0.001 || alpha <= 0.002) discard;
        vec3 color = mix(vec3(1.0, 0.36, 0.08), vec3(1.0, 0.78, 0.38), core);
        gl_FragColor = vec4(color * alpha, alpha);
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

function getTexturePixelRatio(isMobileDevice, qualityLevel) {
  const quality = CONFIG.QUALITY_LEVELS[qualityLevel] || CONFIG.QUALITY_LEVELS.HIGH;
  const limit = isMobileDevice ? quality.mobilePixelRatio : quality.desktopPixelRatio;
  return Math.min(window.devicePixelRatio || 1, limit);
}

function selectTextureSet(renderer, isMobileDevice, qualityLevel) {
  return getEarthTextureSetForDisplay({
    isMobile: isMobileDevice,
    width: renderer.domElement.clientWidth,
    pixelRatio: getTexturePixelRatio(isMobileDevice, qualityLevel),
    maxTextureSize: renderer.capabilities.maxTextureSize,
    saveData: qualityLevel === "LOW",
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

async function loadOptionalTexture(label, texturePromise, timeoutMs = OPTIONAL_TEXTURE_TIMEOUT_MS) {
  let timedOut = false;
  let timeoutId;
  const guardedTexturePromise = texturePromise
    .then(texture => {
      if (timedOut) {
        texture.dispose();
        return null;
      }
      return texture;
    })
    .catch(error => {
      if (isLocalDevRuntime()) {
        log.warn(`Optional texture unavailable (${label}):`, error);
      }
      return null;
    });
  const timeoutPromise = new Promise(resolve => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      if (isLocalDevRuntime()) log.warn(`Optional texture timed out (${label})`);
      resolve(null);
    }, timeoutMs);
  });

  try {
    return await Promise.race([guardedTexturePromise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
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

const REGIONAL_LONGITUDE_HALF_EXTENT = 45;
const REGIONAL_LATITUDE_HALF_EXTENT = 36;
const REGIONAL_SURFACE_ELEVATION = 0.002;

function terrainDirection(THREE, x, y, target = new THREE.Vector3()) {
  const longitudeExtent = THREE.MathUtils.degToRad(REGIONAL_LONGITUDE_HALF_EXTENT);
  const latitudeExtent = THREE.MathUtils.degToRad(REGIONAL_LATITUDE_HALF_EXTENT);
  const latitude = Math.asin(THREE.MathUtils.clamp(y * Math.sin(latitudeExtent), -0.999, 0.999));
  const latitudeRadius = Math.cos(latitude);
  const longitude = Math.asin(
    THREE.MathUtils.clamp(
      (x * Math.sin(longitudeExtent)) / Math.max(latitudeRadius, 0.74),
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

const getTerrainSamplingSize = image => {
  const sourceWidth = image?.naturalWidth || image?.videoWidth || image?.width || 0;
  const sourceHeight = image?.naturalHeight || image?.videoHeight || image?.height || 0;
  if (!sourceWidth || !sourceHeight) return { width: 0, height: 0 };
  const scale = Math.min(1, 1024 / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
};

function createTerrainMaskSampler(THREE, terrainMaskTexture) {
  const image = terrainMaskTexture?.image;
  const { width, height } = getTerrainSamplingSize(image);
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
      let wrappedU = Math.abs(u) % 2.0;
      if (wrappedU > 1.0) wrappedU = 2.0 - wrappedU;

      let wrappedV = Math.abs(v) % 2.0;
      if (wrappedV > 1.0) wrappedV = 2.0 - wrappedV;

      const pixelX = THREE.MathUtils.clamp(wrappedU, 0, 1) * (width - 1);
      const pixelY = (1 - THREE.MathUtils.clamp(wrappedV, 0, 1)) * (height - 1);
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
    if (isLocalDevRuntime()) log.warn("Terrain mask sampling failed:", error);
    return null;
  }
}

function createTerrainColorSampler(THREE, terrainTexture) {
  const image = terrainTexture.image;
  const { width, height } = getTerrainSamplingSize(image);
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
      // Mirrored repeat logic
      let wrappedU = Math.abs(u) % 2.0;
      if (wrappedU > 1.0) wrappedU = 2.0 - wrappedU;

      let wrappedV = Math.abs(v) % 2.0;
      if (wrappedV > 1.0) wrappedV = 2.0 - wrappedV;

      const pixelX = Math.round(THREE.MathUtils.clamp(wrappedU, 0, 1) * (width - 1));
      const pixelY = Math.round((1 - THREE.MathUtils.clamp(wrappedV, 0, 1)) * (height - 1));
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

function createRegionalTerrainGeometry(THREE, widthSegments, heightSegments) {
  const geometry = new THREE.PlaneGeometry(2, 2, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");

  const tempPoint = new THREE.Vector3();
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    terrainSurfacePoint(THREE, x, y, REGIONAL_SURFACE_ELEVATION, tempPoint);
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
      vec2 regionalCenteredUv = (vInstanceUv - 0.5) * 2.0;
      float regionalRadius = length(regionalCenteredUv);
      float regionalEdgeFade = 1.0 - smoothstep(0.60, 0.75, regionalRadius);
      diffuseColor.a *= regionalEdgeFade;`
      );
  };
  material.customProgramCacheKey = () => "earth-regional-instance-radial-fade-v4";
}

function configureRegionalSurfaceFade(material, cacheKey) {
  const originalOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (originalOnBeforeCompile) {
      originalOnBeforeCompile(shader, renderer);
    }
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vOriginalUv;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vOriginalUv = uv;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vOriginalUv;`
      )
      .replace(
        "#include <alphamap_fragment>",
        `#include <alphamap_fragment>
vec2 regionalCenteredUv = (vOriginalUv - 0.5) * 2.0;
float regionalRadius = length(regionalCenteredUv);
float regionalEdgeFade = 1.0 - smoothstep(0.85, 0.98, regionalRadius);
diffuseColor.a *= regionalEdgeFade;`
      );
  };
  material.customProgramCacheKey = () => cacheKey;
}

function createProceduralTerrainLayer(
  THREE,
  isMobileDevice,
  qualityLevel,
  terrainTexture,
  regionalWaterTexture
) {
  const group = new THREE.Group();
  group.name = "earth-procedural-region";
  group.renderOrder = 5;
  group.visible = false;
  group.userData.opacity = 0;
  group.userData.targetOpacity = 0;
  group.userData.anchorLocked = false;
  group.userData.anchorInitialized = false;
  group.userData.regionalAvailable = false;
  group.userData.cityMesh = null;
  group.userData.forestMesh = null;
  group.userData.cityFullCount = 0;
  group.userData.forestFullCount = 0;
  group.userData.fadeMaterials = [];

  if (terrainTexture) {
    terrainTexture.anisotropy = isMobileDevice ? 8 : 16;
    terrainTexture.generateMipmaps = true;
    terrainTexture.minFilter = THREE.LinearMipmapLinearFilter;
    terrainTexture.magFilter = THREE.LinearFilter;
    terrainTexture.wrapS = THREE.MirroredRepeatWrapping;
    terrainTexture.wrapT = THREE.MirroredRepeatWrapping;
    terrainTexture.repeat.set(6, 6);
    terrainTexture.needsUpdate = true;
  }
  if (regionalWaterTexture) {
    regionalWaterTexture.anisotropy = isMobileDevice ? 8 : 16;
    regionalWaterTexture.generateMipmaps = true;
    regionalWaterTexture.minFilter = THREE.LinearMipmapLinearFilter;
    regionalWaterTexture.magFilter = THREE.LinearFilter;
    regionalWaterTexture.wrapS = THREE.MirroredRepeatWrapping;
    regionalWaterTexture.wrapT = THREE.MirroredRepeatWrapping;
    regionalWaterTexture.repeat.set(6, 6);
    regionalWaterTexture.needsUpdate = true;
  }

  const lowQuality = qualityLevel === "LOW";
  const mediumQuality = qualityLevel === "MEDIUM";
  const widthSegments = lowQuality ? 48 : isMobileDevice ? 64 : mediumQuality ? 72 : 128;
  const heightSegments = lowQuality ? 40 : isMobileDevice ? 52 : mediumQuality ? 60 : 112;
  const sampleColor = createTerrainColorSampler(THREE, terrainTexture);
  const sampleWater = regionalWaterTexture
    ? createTerrainMaskSampler(THREE, regionalWaterTexture)
    : null;
  const geometry = createRegionalTerrainGeometry(THREE, widthSegments, heightSegments);
  const terrainMaterial = new THREE.MeshStandardMaterial({
    map: terrainTexture,
    color: 0xffffff,
    emissive: 0x121c22,
    emissiveIntensity: 0.12,
    roughness: 0.65,
    metalness: 0.1,
    transparent: true,
    opacity: 1,
    depthTest: true,
    depthWrite: false,
    side: THREE.FrontSide,
    dithering: true,
  });
  configureRegionalSurfaceFade(terrainMaterial, "earth-regional-surface-radial-fade-v5");
  const terrain = new THREE.Mesh(geometry, terrainMaterial);
  terrain.name = "earth-regional-surface";
  terrain.renderOrder = 5;
  terrain.receiveShadow = true;
  group.add(terrain);

  let waterMaterial = null;
  if (regionalWaterTexture) {
    waterMaterial = new THREE.MeshPhysicalMaterial({
      alphaMap: regionalWaterTexture,
      color: 0x0a4266,
      emissive: 0x02080d,
      emissiveIntensity: 0.05,
      roughness: 0.22,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.46,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.FrontSide,
      dithering: true,
    });
    waterMaterial.userData.waterTime = 0;
    waterMaterial.onBeforeCompile = shader => {
      shader.uniforms.waterTime = { value: 0 };
      waterMaterial.userData.waterShader = shader;
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "uniform float waterTime;\nvoid main() {")
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          #ifdef USE_ALPHAMAP
            vec2 rippleUv = vAlphaMapUv * 64.0 + vec2(sin(waterTime * 0.7 + vAlphaMapUv.y * 24.0), cos(waterTime * 0.6 + vAlphaMapUv.x * 24.0)) * 0.4;
            float rip1 = sin(rippleUv.x * 6.28 + waterTime * 1.4);
            float rip2 = cos(rippleUv.y * 5.3 - waterTime * 1.1);
            float waveGlint = pow(clamp(rip1 * rip2 * 0.5 + 0.5, 0.0, 1.0), 7.0);
            roughnessFactor = clamp(roughnessFactor - waveGlint * 0.14, 0.06, 1.0);
          #endif`
        );
    };
    waterMaterial.customProgramCacheKey = () => "earth-regional-water-shimmer-v1";
    configureRegionalSurfaceFade(
      waterMaterial,
      "earth-regional-water-radial-fade-v2",
      "vAlphaMapUv"
    );
    const water = new THREE.Mesh(geometry, waterMaterial);
    water.name = "earth-regional-lakes";
    water.renderOrder = 6;
    water.scale.setScalar(1 + 0.0015 / CONFIG.EARTH.RADIUS);
    group.add(water);
  }

  const instanceBudget = isMobileDevice ? 15000 : qualityLevel === "MEDIUM" ? 40000 : 120000;
  const maxCityInstances = Math.floor(instanceBudget * 0.75);
  const maxForestInstances = Math.floor(instanceBudget * 0.25);

  // ---------------------------------------------------------------------------
  // Geometry helpers for building variants with roof shapes
  // ---------------------------------------------------------------------------

  /** Creates a simple flat-roof box (existing LoD1 fallback). */
  function makeFlatRoofBuilding(THREE) {
    const g = new THREE.BoxGeometry(0.0034, 0.0034, 0.0028);
    g.translate(0, 0, 0.0014);
    return g;
  }

  /** Gable (Satteldach) — box body + triangular prism ridge. */
  function makeGableRoofBuilding(THREE) {
    const body = new THREE.BoxGeometry(0.0034, 0.003, 0.002);
    body.translate(0, 0, 0.001);

    // Ridge prism: a long triangle rotated along Y
    const ridge = new THREE.CylinderGeometry(0, 0.0017, 0.0035, 3, 1);
    ridge.rotateZ(Math.PI / 2);
    ridge.rotateY(Math.PI / 6);
    ridge.translate(0, 0, 0.002 + 0.00085);

    const merged = mergeBufferGeometries(THREE, [body, ridge]);
    return merged || body;
  }

  /** Hip (Walmdach) — box + low square pyramid. */
  function makeHipRoofBuilding(THREE) {
    const body = new THREE.BoxGeometry(0.0036, 0.0036, 0.0022);
    body.translate(0, 0, 0.0011);

    const hip = new THREE.ConeGeometry(0.00255, 0.0016, 4, 1);
    hip.rotateZ(Math.PI / 4);
    hip.translate(0, 0, 0.0022 + 0.0008);

    const merged = mergeBufferGeometries(THREE, [body, hip]);
    return merged || body;
  }

  /** Stepped highrise — two stacked boxes of diminishing footprint. */
  function makeSteppedHighrise(THREE) {
    const base = new THREE.BoxGeometry(0.0038, 0.0038, 0.004);
    base.translate(0, 0, 0.002);

    const setback = new THREE.BoxGeometry(0.0024, 0.0024, 0.003);
    setback.translate(0, 0, 0.004 + 0.0015);

    const merged = mergeBufferGeometries(THREE, [base, setback]);
    return merged || base;
  }

  /** Flat-roof slab with a rooftop penthouse ridge. */
  function makePenthouseBuilding(THREE) {
    const slab = new THREE.BoxGeometry(0.004, 0.0028, 0.003);
    slab.translate(0, 0, 0.0015);

    const penthouse = new THREE.BoxGeometry(0.002, 0.0016, 0.0012);
    penthouse.translate(0, 0, 0.003 + 0.0006);

    const merged = mergeBufferGeometries(THREE, [slab, penthouse]);
    return merged || slab;
  }

  /**
   * Minimal BufferGeometry merge — no external import needed.
   * Merges an array of geometries into one by concatenating attributes.
   */
  function mergeBufferGeometries(THREE, geometries) {
    try {
      const positions = [];
      const normals = [];
      const uvs = [];
      const indices = [];
      let indexOffset = 0;

      for (const geo of geometries) {
        geo.computeVertexNormals();
        const pos = geo.getAttribute("position");
        const nor = geo.getAttribute("normal");
        const uv = geo.getAttribute("uv");
        const idx = geo.getIndex();

        for (let i = 0; i < pos.count; i++) {
          positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
          normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
          if (uv) uvs.push(uv.getX(i), uv.getY(i));
          else uvs.push(0, 0);
        }

        if (idx) {
          for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + indexOffset);
        } else {
          for (let i = 0; i < pos.count; i++) indices.push(i + indexOffset);
        }
        indexOffset += pos.count;
      }

      const merged = new THREE.BufferGeometry();
      merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      merged.setIndex(indices);
      return merged;
    } catch {
      return null;
    }
  }

  /**
   * Generates a procedural window-grid normal map as a DataTexture.
   * No external asset required — pure GPU-ready data.
   */
  function createWindowNormalMap(THREE) {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Window grid: recessed every ~6px horizontal, ~8px vertical
        const insetX = x % 6 < 1 ? 0 : 1;
        const insetY = y % 8 < 1 ? 0 : 1;
        const isWindow = insetX && insetY;
        // Normal: window recesses slightly inward (Z < 128)
        const nx = 128;
        const ny = 128;
        const nz = isWindow ? 210 : 255; // concrete face vs. slightly inset window
        const offset = (y * size + x) * 4;
        data[offset] = nx;
        data[offset + 1] = ny;
        data[offset + 2] = nz;
        data[offset + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  const buildingGeometryPool = [
    makeFlatRoofBuilding(THREE),
    makeGableRoofBuilding(THREE),
    makeHipRoofBuilding(THREE),
    makeSteppedHighrise(THREE),
    makePenthouseBuilding(THREE),
    makeFlatRoofBuilding(THREE), // extra flat-roof weight (most common in Berlin)
  ];

  const windowNormalMap = createWindowNormalMap(THREE);
  windowNormalMap.repeat.set(8, 4);

  const treeGeometry = new THREE.ConeGeometry(0.0012, 0.003, 5);
  treeGeometry.translate(0, 0, 0.001);
  treeGeometry.rotateX(Math.PI / 2);

  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0xd0ccc8,
    emissive: 0x1a232c,
    emissiveIntensity: 0.12,
    roughness: 0.72,
    metalness: 0.15,
    normalMap: windowNormalMap,
    normalScale: new THREE.Vector2(0.25, 0.25),
    transparent: true,
    opacity: 1,
    depthTest: true,
  });

  const treeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 1,
    depthTest: true,
  });

  configureInstanceFade(buildingMaterial);
  configureInstanceFade(treeMaterial);

  // Each building type gets its own InstancedMesh so geometries can differ per-type.
  // We create one InstancedMesh per geometry variant and merge them logically.
  const cityMeshes = buildingGeometryPool.map((geo, idx) => {
    const countSlice = Math.floor(maxCityInstances / buildingGeometryPool.length);
    const m = new THREE.InstancedMesh(geo, buildingMaterial, countSlice);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = `earth-regional-cities-v${idx}`;
    m.renderOrder = 5;
    return m;
  });
  // Backwards-compat alias pointing at the first mesh (for fadeMaterials tracking)
  const cityMesh = cityMeshes[0];

  const forestMesh = new THREE.InstancedMesh(treeGeometry, treeMaterial, maxForestInstances);
  forestMesh.castShadow = true;
  forestMesh.receiveShadow = true;

  // Per-variant UV arrays (each variant mesh has its own slice of the budget)
  const sliceSize = Math.floor(maxCityInstances / buildingGeometryPool.length);
  const cityUvArrays = cityMeshes.map(() => new Float32Array(sliceSize * 2));
  const cityCounters = new Array(buildingGeometryPool.length).fill(0);

  cityMeshes.forEach((m, idx) => {
    m.geometry.setAttribute("instanceUv", new THREE.InstancedBufferAttribute(cityUvArrays[idx], 2));
  });

  const forestUvArray = new Float32Array(maxForestInstances * 2);
  const forestUvAttribute = new THREE.InstancedBufferAttribute(forestUvArray, 2);
  forestMesh.geometry.setAttribute("instanceUv", forestUvAttribute);

  // cityMesh kept for backwards compat (fadeMaterials etc.)
  forestMesh.name = "earth-regional-forests";
  forestMesh.renderOrder = 5;

  const dummy = new THREE.Object3D();
  const upVector = new THREE.Vector3(0, 0, 1);

  let seed = 12345;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // Box–Muller log-normal: produces realistic height distributions
  // (many short buildings, a few tall ones)
  const logNormalHeight = (mu, sigma) => {
    const u1 = Math.max(1e-10, random());
    const u2 = random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.exp(mu + sigma * z);
  };

  const tempColor = new THREE.Color();
  const dir = new THREE.Vector3();
  const tempPoint = new THREE.Vector3();
  const colorData = [0, 0, 0];

  let treeCount = 0;
  let totalCityCount = 0;

  for (let i = 0; i < instanceBudget * 8; i++) {
    if (totalCityCount >= maxCityInstances && treeCount >= maxForestInstances) break;

    const r1 = random();
    const r2 = random();
    const radius = Math.sqrt(r1) * 0.95;
    const theta = r2 * Math.PI * 2;

    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);
    const distanceFromBerlinCenter = Math.hypot(x, y + 0.05);
    const coreStrength = THREE.MathUtils.clamp(1 - distanceFromBerlinCenter / 0.85, 0, 1);

    const u = (x + 1) / 2;
    const v = (y + 1) / 2;
    const sampleU = u * 6.0;
    const sampleV = v * 6.0;
    const waterCoverage = sampleWater ? sampleWater(sampleU, sampleV) : 0;
    if (waterCoverage > 0.18) continue;

    terrainSurfacePoint(THREE, x, y, REGIONAL_SURFACE_ELEVATION + 0.0005, tempPoint);
    dir.copy(tempPoint).normalize();
    dummy.position.copy(tempPoint);
    dummy.quaternion.setFromUnitVectors(upVector, dir);
    dummy.rotateZ(random() * Math.PI * 2);

    let isCity = false;
    let isForest = false;

    if (sampleColor) {
      sampleColor(sampleU, sampleV, colorData);
      const r = colorData[0];
      const g = colorData[1];
      const b = colorData[2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (g > r + 10 && g > b + 10 && max > 30 && max < 200) {
        isForest = true;
      } else if (max - min < 60 && max > 35) {
        isCity = true;
      }
    } else {
      const noise = (Math.sin(x * 20) + Math.cos(y * 20)) * 0.5 + 0.5;
      if (noise > 0.6) isCity = true;
      else if (noise <= 0.6) isForest = true;
    }

    const scatterNoise = (Math.sin(x * 50) + Math.cos(y * 50)) * 0.5 + 0.5;

    if (isCity && scatterNoise > 0.05 && totalCityCount < maxCityInstances) {
      // Choose geometry variant based on zone:
      // Core (high coreStrength) → stepped highrises (idx 3)
      // Inner ring → mix of gable (1), hip (2), penthouse (4)
      // Periphery → flat roofs (0, 5)
      let variantIdx;
      const rv = random();
      if (coreStrength > 0.65) {
        // City core: highrises + penthouses
        variantIdx = rv < 0.5 ? 3 : 4;
      } else if (coreStrength > 0.3) {
        // Mid-ring: historic gable + hip roofs
        if (rv < 0.35)
          variantIdx = 1; // Satteldach
        else if (rv < 0.62)
          variantIdx = 2; // Walmdach
        else if (rv < 0.8)
          variantIdx = 4; // Penthouse
        else variantIdx = 0; // Flachdach
      } else {
        // Suburbs: mostly flat roofs
        variantIdx = rv < 0.72 ? 0 : rv < 0.88 ? 5 : 2;
      }

      const sliceIdx = variantIdx;
      const sliceCount = cityCounters[sliceIdx];
      if (sliceCount >= sliceSize) continue; // this variant is full, skip

      // Log-normal height: core buildings cluster taller
      const heightMu = 0.3 + coreStrength * 0.7;
      const heightSig = 0.4;
      const rawHeight = logNormalHeight(heightMu, heightSig);
      const heightScale = THREE.MathUtils.clamp(rawHeight, 0.6, coreStrength > 0.5 ? 8.0 : 3.5);

      const footprintScale = 0.9 + random() * 0.8;
      dummy.scale.set(footprintScale, footprintScale, heightScale);
      dummy.updateMatrix();

      cityMeshes[sliceIdx].setMatrixAt(sliceCount, dummy.matrix);
      cityUvArrays[sliceIdx][sliceCount * 2] = u;
      cityUvArrays[sliceIdx][sliceCount * 2 + 1] = v;

      // Sample texture color → building facade color (blends into orthophoto)
      tempColor.setRGB(
        (colorData[0] / 255.0) * 1.04,
        (colorData[1] / 255.0) * 1.04,
        (colorData[2] / 255.0) * 1.04
      );
      cityMeshes[sliceIdx].setColorAt(sliceCount, tempColor);
      cityCounters[sliceIdx]++;
      totalCityCount++;
    } else if (isForest && treeCount < maxForestInstances) {
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

  // Finalise all variant meshes
  cityMeshes.forEach((m, idx) => {
    m.count = cityCounters[idx];
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  forestMesh.count = treeCount;
  forestMesh.instanceMatrix.needsUpdate = true;
  if (forestMesh.instanceColor) forestMesh.instanceColor.needsUpdate = true;

  // Add all variant meshes to the group
  cityMeshes.forEach(m => group.add(m));
  group.add(forestMesh);

  group.userData.targetOpacity = 1;
  group.userData.regionalAvailable = true;
  group.userData.cityMesh = cityMesh; // kept for backwards compat
  group.userData.cityMeshes = cityMeshes;
  group.userData.forestMesh = forestMesh;
  group.userData.cityFullCount = totalCityCount;
  group.userData.forestFullCount = treeCount;
  group.userData.fadeMaterials = [
    { material: terrainMaterial, baseOpacity: 1 },
    ...(waterMaterial ? [{ material: waterMaterial, baseOpacity: 0.46 }] : []),
    { material: buildingMaterial, baseOpacity: 1 },
    { material: treeMaterial, baseOpacity: 1 },
  ];
  return group;
}

function configureRegionalCloudMaterial(material, terrainData) {
  material.onBeforeCompile = shader => {
    shader.uniforms.rct = { value: 0 };
    terrainData.rcs = shader;
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform float rct;\nvoid main() {")
      .replace(
        "#include <alphamap_fragment>",
        `#ifdef USE_ALPHAMAP
vec2 u=vAlphaMapUv*vec2(.42,.34)+vec2(.06,.37);
u+=vec2(rct*.0016,sin(rct*.07)*.004);
float a=smoothstep(.16,.72,texture2D(alphaMap,u).g);
vec2 p=(vAlphaMapUv-.5)*2.;
diffuseColor.a*=a*(1.-smoothstep(.52,1.,length(p)));
#endif`
      );
  };
  material.customProgramCacheKey = () => "ercw1";
}

export function attachRegionalCloudLayer(THREE, terrainGroup, cloudGroup) {
  const terrain = terrainGroup?.getObjectByName?.("earth-regional-surface");
  const cloudTexture = cloudGroup?.userData?.cloudTexture;
  if (!terrain?.geometry || !cloudTexture) return;

  const material = new THREE.MeshBasicMaterial({
    alphaMap: cloudTexture,
    transparent: true,
    opacity: 0.34,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  configureRegionalCloudMaterial(material, terrainGroup.userData);

  const mesh = new THREE.Mesh(terrain.geometry, material);
  mesh.renderOrder = 9;
  terrainGroup.add(mesh);

  terrainGroup.userData.fadeMaterials?.push({ material, baseOpacity: 0.34 });
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
  const regionalTextureLoader = new THREE.TextureLoader();
  const textureSet = selectTextureSet(renderer, isMobileDevice, qualityLevel);
  const useCompactRegionalTexture =
    qualityLevel === "LOW" ||
    renderer.domElement.clientWidth * getTexturePixelRatio(isMobileDevice, qualityLevel) <= 1600 ||
    renderer.capabilities.maxTextureSize < 4096;
  const pendingTextures = new Set();
  let textureLoadAbandoned = false;
  const trackTexture = texturePromise =>
    texturePromise.then(texture => {
      if (!texture?.isTexture) return texture;
      if (textureLoadAbandoned) texture.dispose();
      else pendingTextures.add(texture);
      return texture;
    });
  const abandonTextureLoad = () => {
    textureLoadAbandoned = true;
    pendingTextures.forEach(texture => texture.dispose());
    pendingTextures.clear();
  };

  let regionalTerrainTexture,
    regionalWaterTexture,
    dayTexture,
    nightTexture,
    normalTexture,
    bumpTexture,
    cityBuffer;
  let timeoutId;
  try {
    const texturePromise = Promise.all([
      trackTexture(
        loadNamedTexture(
          "day",
          loadPreferredTexture(ktx2Loader, textureLoader, textureSet.DAY_KTX2, textureSet.DAY)
        )
      ),
      trackTexture(
        loadNamedTexture(
          "night",
          loadPreferredTexture(ktx2Loader, textureLoader, textureSet.NIGHT_KTX2, textureSet.NIGHT)
        )
      ),
      trackTexture(loadNamedTexture("normal", textureLoader.loadAsync(textureSet.NORMAL))),
      trackTexture(loadNamedTexture("bump", textureLoader.loadAsync(textureSet.BUMP))),
      trackTexture(
        loadOptionalTexture(
          "EOX Berlin regional surface",
          regionalTextureLoader.loadAsync(
            useCompactRegionalTexture
              ? EARTH_REGIONAL_TEXTURES.TERRAIN_MOBILE
              : EARTH_REGIONAL_TEXTURES.TERRAIN
          )
        )
      ),
      trackTexture(
        loadOptionalTexture(
          "EOX regional lakes",
          regionalTextureLoader.loadAsync(EARTH_REGIONAL_TEXTURES.WATER)
        )
      ),
      fetch(EARTH_CITY_LIGHTS_URL)
        .then(response => (response.ok ? response.arrayBuffer() : null))
        .catch(() => null),
    ]);
    [
      dayTexture,
      nightTexture,
      normalTexture,
      bumpTexture,
      regionalTerrainTexture,
      regionalWaterTexture,
      cityBuffer,
    ] = await Promise.race([
      texturePromise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          abandonTextureLoad();
          reject(new Error("Texture loading timeout"));
        }, TEXTURE_TIMEOUT_MS);
      }),
    ]);
    pendingTextures.clear();
  } catch (err) {
    abandonTextureLoad();
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
  if (regionalTerrainTexture) {
    configureTexture(THREE, regionalTerrainTexture, anisotropy, THREE.SRGBColorSpace);
    regionalTerrainTexture.wrapS = THREE.ClampToEdgeWrapping;
  }
  if (regionalWaterTexture) {
    configureTexture(THREE, regionalWaterTexture, anisotropy, THREE.NoColorSpace);
    regionalWaterTexture.wrapS = THREE.ClampToEdgeWrapping;
  }

  const dayMaterial = new THREE.MeshPhysicalMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    normalScale: new THREE.Vector2(0.94, 0.94),
    bumpMap: bumpTexture,
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
  dayMaterial.userData.oceanGradeStrength = 0.48;
  dayMaterial.userData.oceanSaturation = 1;
  dayMaterial.userData.oceanBrightness = 1;
  dayMaterial.userData.oceanTime = 0;
  dayMaterial.userData.terrainSunDirection = new THREE.Vector2(-0.62, 0.78).normalize();
  dayMaterial.userData.earthSunDirectionWorld = new THREE.Vector3(0, 0, 1);
  dayMaterial.userData.proceduralTerrainMix = 1;
  dayMaterial.userData.isEarthPhysicalLightingMaterial = true;
  dayMaterial.onBeforeCompile = shader => {
    shader.uniforms.terrainDetailStrength = {
      value: dayMaterial.userData.terrainDetailStrength,
    };
    shader.uniforms.oceanGradeStrength = {
      value: dayMaterial.userData.oceanGradeStrength,
    };
    shader.uniforms.oceanSaturation = {
      value: dayMaterial.userData.oceanSaturation,
    };
    shader.uniforms.oceanBrightness = {
      value: dayMaterial.userData.oceanBrightness,
    };
    shader.uniforms.oceanTime = {
      value: dayMaterial.userData.oceanTime,
    };
    shader.uniforms.terrainSunDirection = {
      value: dayMaterial.userData.terrainSunDirection,
    };
    shader.uniforms.earthSunDirectionWorld = {
      value: dayMaterial.userData.earthSunDirectionWorld,
    };
    shader.uniforms.proceduralTerrainMix = {
      value: dayMaterial.userData.proceduralTerrainMix,
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
        "uniform float terrainDetailStrength;\nuniform float oceanGradeStrength;\nuniform float oceanSaturation;\nuniform float oceanBrightness;\nuniform float oceanTime;\nuniform vec2 terrainSunDirection;\nuniform vec3 earthSunDirectionWorld;\nuniform float proceduralTerrainMix;\nvarying vec3 vEarthWorldNormal;\nfloat earthOceanMask = 0.0;\nvoid main() {"
      )
      .replace("#include <map_fragment>", DAYLIGHT_MAP_FRAGMENT)
      .replace("#include <emissivemap_fragment>", EARTH_EMISSIVE_FRAGMENT)
      .replace("#include <roughnessmap_fragment>", EARTH_ROUGHNESS_FRAGMENT)
      .replace("#include <opaque_fragment>", EARTH_FRESNEL_FRAGMENT);
  };
  dayMaterial.customProgramCacheKey = () => "earth-city-points-v30";
  const nightMaterial = dayMaterial;

  const segments = isMobileDevice
    ? CONFIG.EARTH.SEGMENTS_MOBILE
    : qualityLevel === "MEDIUM"
      ? Math.min(CONFIG.EARTH.SEGMENTS, 160)
      : CONFIG.EARTH.SEGMENTS;

  const earthGeometry = new THREE.SphereGeometry(CONFIG.EARTH.RADIUS, segments, segments);
  const europeSegments = isMobileDevice ? 96 : Math.min(segments, 160);
  const europeGeometry =
    europeSegments === segments
      ? earthGeometry
      : new THREE.SphereGeometry(CONFIG.EARTH.RADIUS, europeSegments, europeSegments);
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
    europe: europeGeometry,
  };

  const cityGlowGroup = createCityGlow(THREE, nightTexture, segments, isMobileDevice);
  const cityLightsPoints = createCityLightsPoints(THREE, cityBuffer, isMobileDevice);
  const atmosphere = createAtmosphereLayer(THREE, segments);
  const proceduralTerrainGroup = createProceduralTerrainLayer(
    THREE,
    isMobileDevice,
    qualityLevel,
    regionalTerrainTexture,
    regionalWaterTexture
  );
  earthMesh.add(cityGlowGroup);
  earthMesh.add(cityLightsPoints);
  earthMesh.add(atmosphere);
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

export async function createMoonSystem(THREE, scene, renderer, isMobileDevice, qualityLevel) {
  const textureLoader = new THREE.TextureLoader();
  const textureSet = selectTextureSet(renderer, isMobileDevice, qualityLevel);

  const [moonTexture, moonBumpTexture] = await Promise.all([
    loadOptionalTexture("moon surface", textureLoader.loadAsync(textureSet.MOON)),
    loadOptionalTexture("moon relief", textureLoader.loadAsync(textureSet.MOON_BUMP)),
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

  const moonGeometryHigh = new THREE.SphereGeometry(
    CONFIG.MOON.RADIUS,
    isMobileDevice ? 64 : CONFIG.MOON.SEGMENTS,
    isMobileDevice ? 64 : CONFIG.MOON.SEGMENTS
  );
  moonLOD.addLevel(new THREE.Mesh(moonGeometryHigh, moonMaterial), 0);

  const moonGeometryMed = new THREE.SphereGeometry(CONFIG.MOON.RADIUS, 48, 48);
  moonLOD.addLevel(new THREE.Mesh(moonGeometryMed, moonMaterial), 35);

  const moonGeometryLow = new THREE.SphereGeometry(CONFIG.MOON.RADIUS, 24, 24);
  moonLOD.addLevel(new THREE.Mesh(moonGeometryLow, moonMaterial), 80);

  moonLOD.position.set(CONFIG.MOON.DISTANCE, 2, -10);
  moonLOD.userData.targetPosition = new THREE.Vector3(CONFIG.MOON.DISTANCE, 2, -10);
  moonLOD.userData.targetScale = 1;

  scene.add(moonLOD);
  return moonLOD;
}

export async function createCloudLayer(THREE, renderer, isMobileDevice, qualityLevel = "HIGH") {
  const textureLoader = new THREE.TextureLoader();
  try {
    const textureSet = selectTextureSet(renderer, isMobileDevice, qualityLevel);
    const cloudTexture = await loadOptionalTexture(
      "cloud surface",
      textureLoader.loadAsync(textureSet.CLOUDS),
      7000
    );
    if (!cloudTexture) return new THREE.Object3D();
    const anisotropy = Math.min(
      renderer.capabilities.getMaxAnisotropy(),
      qualityLevel === "LOW" ? 4 : isMobileDevice ? 8 : 16
    );
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

    const segments =
      qualityLevel === "LOW" ? 64 : isMobileDevice ? 80 : Math.min(CONFIG.EARTH.SEGMENTS, 144);

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

    const windMaterials = [lowCloudMaterial];
    if (qualityLevel === "HIGH") {
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
        densityShade: 0.15,
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
      windMaterials.push(highCloudMaterial);
    }

    if (!isMobileDevice && qualityLevel !== "LOW") {
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
    cloudGroup.userData.cloudTexture = cloudTexture;
    return cloudGroup;
  } catch (error) {
    log.warn("Cloud texture failed to load:", error);
    return new THREE.Object3D();
  }
}
