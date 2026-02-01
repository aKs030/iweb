import { CONFIG } from './config.js';
import { createLogger } from '/content/core/logger.js';

const log = createLogger('EarthAssets');

export async function createEarthSystem(
  THREE,
  scene,
  renderer,
  isMobileDevice,
  loadingManager,
) {
  // Use passed loadingManager or fallback to a new one
  const manager = loadingManager || new THREE.LoadingManager();
  const textureLoader = new THREE.TextureLoader(manager);

  let dayTexture, nightTexture, normalTexture, bumpTexture;
  try {
    // Start texture loading immediately with higher priority
    const texturePromises = [
      textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.DAY),
      textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.NIGHT),
      textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.NORMAL),
      textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.BUMP),
    ];

    // Load textures in parallel with timeout fallback
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Texture loading timeout')), 10000),
    );

    [dayTexture, nightTexture, normalTexture, bumpTexture] = await Promise.race(
      [Promise.all(texturePromises), timeoutPromise],
    );
  } catch (err) {
    // Silently handle texture loading errors in production
    if (process.env.NODE_ENV === 'development') {
      log.error('Texture loading failed:', err);
    }
    // Return null to indicate failure without throwing
    return null;
  }

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  [dayTexture, nightTexture, normalTexture, bumpTexture].forEach((tex) => {
    if (tex) {
      tex.anisotropy = Math.min(maxAniso, isMobileDevice ? 4 : 16);
      // Fix WebGL error: FLIP_Y and PREMULTIPLY_ALPHA not allowed for 3D textures
      tex.flipY = false;
      tex.premultiplyAlpha = false;
    }
  });

  const dayMaterial = new THREE.MeshStandardMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    roughness: 0.7,
    metalness: 0,
  });

  const nightMaterial = new THREE.MeshStandardMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    roughness: 0.7,
    metalness: 0,
    emissive: 0xffcc66,
    emissiveMap: nightTexture,
    emissiveIntensity: CONFIG.EARTH.EMISSIVE_INTENSITY * 4,
  });

  // OPTIMIZATION: Reduce segments on mobile
  const segments = isMobileDevice
    ? CONFIG.EARTH.SEGMENTS_MOBILE
    : CONFIG.EARTH.SEGMENTS;

  const earthGeometry = new THREE.SphereGeometry(
    CONFIG.EARTH.RADIUS,
    segments,
    segments,
  );
  const earthMesh = new THREE.Mesh(earthGeometry, dayMaterial);
  earthMesh.position.set(0, -6, 0);
  earthMesh.scale.set(1.5, 1.5, 1.5);
  earthMesh.userData.currentMode = 'day';
  earthMesh.userData.targetPosition = new THREE.Vector3(0, -6, 0);
  earthMesh.userData.targetScale = 1.5;
  earthMesh.userData.targetRotation = 0;

  scene.add(earthMesh);

  return { earthMesh, dayMaterial, nightMaterial };
}

export async function createMoonSystem(
  THREE,
  scene,
  renderer,
  isMobileDevice,
  loadingManager,
) {
  const textureLoader = new THREE.TextureLoader(loadingManager);

  const [moonTexture, moonBumpTexture] = await Promise.all([
    textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.MOON).catch(() => null),
    textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.MOON_BUMP).catch(() => null),
  ]);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  if (moonTexture) {
    moonTexture.anisotropy = Math.min(maxAniso, isMobileDevice ? 4 : 16);
    moonTexture.flipY = false;
    moonTexture.premultiplyAlpha = false;
  }
  if (moonBumpTexture) {
    moonBumpTexture.anisotropy = Math.min(maxAniso, isMobileDevice ? 4 : 16);
    moonBumpTexture.flipY = false;
    moonBumpTexture.premultiplyAlpha = false;
  }

  const moonMaterial = new THREE.MeshStandardMaterial({
    map: moonTexture,
    bumpMap: moonBumpTexture,
    bumpScale: CONFIG.MOON.BUMP_SCALE,
    roughness: 0.9,
    metalness: 0,
    color: moonTexture ? 0xffffff : 0xaaaaaa,
  });

  const moonLOD = new THREE.LOD();

  // High detail
  const moonGeometryHigh = new THREE.SphereGeometry(
    CONFIG.MOON.RADIUS,
    CONFIG.MOON.SEGMENTS,
    CONFIG.MOON.SEGMENTS,
  );
  moonLOD.addLevel(new THREE.Mesh(moonGeometryHigh, moonMaterial), 0);

  // Medium detail
  const moonGeometryMed = new THREE.SphereGeometry(CONFIG.MOON.RADIUS, 28, 28);
  moonLOD.addLevel(new THREE.Mesh(moonGeometryMed, moonMaterial), 15);

  // Low detail
  const moonGeometryLow = new THREE.SphereGeometry(CONFIG.MOON.RADIUS, 16, 16);
  moonLOD.addLevel(new THREE.Mesh(moonGeometryLow, moonMaterial), 40);

  moonLOD.position.set(CONFIG.MOON.DISTANCE, 2, -10);
  moonLOD.userData.targetPosition = new THREE.Vector3(
    CONFIG.MOON.DISTANCE,
    2,
    -10,
  );
  moonLOD.userData.targetScale = 1;

  scene.add(moonLOD);
  return moonLOD;
}

export async function createCloudLayer(
  THREE,
  renderer,
  loadingManager,
  isMobileDevice,
) {
  const textureLoader = new THREE.TextureLoader(loadingManager);
  try {
    const cloudTexture = await textureLoader.loadAsync(
      CONFIG.PATHS.TEXTURES.CLOUDS,
    );
    cloudTexture.wrapS = THREE.RepeatWrapping;
    cloudTexture.wrapT = THREE.RepeatWrapping;
    cloudTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    cloudTexture.flipY = false;
    cloudTexture.premultiplyAlpha = false;

    const cloudMaterial = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: CONFIG.CLOUDS.OPACITY,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // OPTIMIZATION: Use same segment reduction for clouds
    const segments = isMobileDevice
      ? CONFIG.EARTH.SEGMENTS_MOBILE
      : CONFIG.EARTH.SEGMENTS;

    const cloudGeometry = new THREE.SphereGeometry(
      CONFIG.EARTH.RADIUS + CONFIG.CLOUDS.ALTITUDE,
      segments,
      segments,
    );
    return new THREE.Mesh(cloudGeometry, cloudMaterial);
  } catch (error) {
    log.warn('Cloud texture failed to load:', error);
    return new THREE.Object3D();
  }
}
