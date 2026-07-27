const smootherstep = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

const lerp = (start, end, amount) => start + (end - start) * amount;
const lerpScale = (start, end, amount) => {
  if (start <= 0 || end <= 0) return lerp(start, end, amount);
  return Math.exp(lerp(Math.log(start), Math.log(end), amount));
};
const channel = (color, shift) => (color >> shift) & 255;
const lerpColor = (start, end, amount) =>
  (Math.round(lerp(channel(start, 16), channel(end, 16), amount)) << 16) |
  (Math.round(lerp(channel(start, 8), channel(end, 8), amount)) << 8) |
  Math.round(lerp(channel(start, 0), channel(end, 0), amount));
let scrollRangeCache = null;

export function getHeroToFeaturesScrollProgress(currentSection) {
  if (currentSection !== "hero" && currentSection !== "features") return null;

  const hero = document.getElementById("hero");
  const features = document.getElementById("features");
  if (!hero || !features) return null;

  const key = `${innerWidth}:${innerHeight}:${hero.offsetTop}:${features.offsetTop}`;
  if (scrollRangeCache?.key !== key) {
    const parsedPadding = Number.parseFloat(
      getComputedStyle(document.documentElement).scrollPaddingTop
    );
    const padding = Number.isFinite(parsedPadding) ? parsedPadding : 0;
    const start = Math.max(0, hero.offsetTop - padding);
    scrollRangeCache = {
      key,
      start,
      end: Math.max(start + 1, features.offsetTop - padding),
    };
  }
  const { start, end } = scrollRangeCache;
  const range = end - start;
  if (range <= 0) return null;

  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  return Math.max(0, Math.min(1, (scrollTop - start) / range));
}

export function getScrollLinkedVerticalRotation(progress, startRotation, turn) {
  return startRotation + turn * progress;
}

export const getHeroToFeaturesZoomProgress = progress =>
  smootherstep(Math.max(0, Math.min(1, progress)));

export function applyScrollLinkedSectionVisuals(system, hero, features, progress, config) {
  const p = getHeroToFeaturesZoomProgress(progress);
  const day = config.LIGHTING.DAY;
  const lightValue = (section, key, fallback) => section.lighting?.[key] ?? fallback;
  const blendLight = (key, fallback) =>
    lerp(lightValue(hero, key, fallback), lightValue(features, key, fallback), p);
  const blendColor = (key, fallback) =>
    lerpColor(lightValue(hero, key, fallback), lightValue(features, key, fallback), p);
  const targets = system._lightTargets;
  if (targets) {
    targets.directionalIntensity = blendLight("sunIntensity", day.SUN_INTENSITY);
    const heroSun = hero.lighting?.sunPosition || { x: -10, y: 6, z: 12 };
    const featureSun = features.lighting?.sunPosition || { x: -10, y: 6, z: 12 };
    targets.directionalPosition.set(
      lerp(heroSun.x, featureSun.x, p),
      lerp(heroSun.y, featureSun.y, p),
      lerp(heroSun.z, featureSun.z, p)
    );
    targets.ambientIntensity = blendLight("ambientIntensity", day.AMBIENT_INTENSITY);
    targets.ambientColor.set(blendColor("ambientColor", day.AMBIENT_COLOR));
    targets.fillIntensity = blendLight("fillIntensity", day.FILL_INTENSITY);
    targets.fillColor.set(blendColor("fillColor", 0x6ea8ff));
    targets.rimIntensity = blendLight("rimIntensity", day.RIM_INTENSITY);
    targets.rimColor.set(blendColor("rimColor", 0xffc76a));
    system.directionalLight?.position.copy(targets.directionalPosition);
    if (system.directionalLight) system.directionalLight.intensity = targets.directionalIntensity;
    if (system.ambientLight) {
      system.ambientLight.intensity = targets.ambientIntensity;
      system.ambientLight.color.copy(targets.ambientColor);
    }
    if (system.fillLight) {
      system.fillLight.intensity = targets.fillIntensity;
      system.fillLight.color.copy(targets.fillColor);
    }
    if (system.rimLight) {
      system.rimLight.intensity = targets.rimIntensity;
      system.rimLight.color.copy(targets.rimColor);
    }
  }

  const material = system.dayMaterial;
  if (material) {
    material.clearcoat = lerp(hero.surfaceClearcoat ?? 0, features.surfaceClearcoat ?? 0, p);
    material.specularIntensity = lerp(
      hero.surfaceSpecularIntensity ?? 1,
      features.surfaceSpecularIntensity ?? 1,
      p
    );
    material.emissiveIntensity = lerp(
      hero.surfaceEmissiveIntensity ?? 0,
      features.surfaceEmissiveIntensity ?? 0,
      p
    );
    material.normalScale?.setScalar(
      lerp(hero.surfaceNormalScale ?? 1, features.surfaceNormalScale ?? 1, p)
    );
    material.bumpScale = lerp(hero.surfaceBumpScale ?? 0, features.surfaceBumpScale ?? 0, p);
  }

  const clouds = system.cloudMesh;
  if (clouds) {
    const parts =
      clouds.userData.scrollBlendParts ||
      (clouds.userData.scrollBlendParts = {
        low: clouds.getObjectByName?.("earth-cloud-surface"),
        high: clouds.getObjectByName?.("earth-cloud-high"),
        shadow: clouds.getObjectByName?.("earth-cloud-shadow"),
      });
    const opacity = lerp(hero.cloudOpacity ?? 0, features.cloudOpacity ?? 0, p);
    if (parts.low?.material) parts.low.material.opacity = opacity;
    if (parts.high?.material)
      parts.high.material.opacity = opacity * config.CLOUDS.HIGH_OPACITY_FACTOR;
    if (parts.shadow?.material) {
      parts.shadow.material.opacity = lerp(
        hero.cloudShadowOpacity ?? 0,
        features.cloudShadowOpacity ?? 0,
        p
      );
    }
    clouds.userData.targetScaleFactor = lerp(
      hero.cloudScaleFactor ?? 1,
      features.cloudScaleFactor ?? 1,
      p
    );
  }

  if (system.moonMesh && hero.moon && features.moon) {
    const moon = system.moonMesh;
    moon.position.set(
      lerp(hero.moon.pos.x, features.moon.pos.x, p),
      lerp(hero.moon.pos.y, features.moon.pos.y, p),
      lerp(hero.moon.pos.z, features.moon.pos.z, p)
    );
    moon.scale.setScalar(lerp(hero.moon.scale, features.moon.scale, p));
    moon.userData.targetPosition?.copy(moon.position);
    moon.userData.targetScale = moon.scale.x;
  }
}

export function applyScrollLinkedEarthTransform({
  earth,
  clouds,
  heroConfig,
  featuresConfig,
  isMobile,
  progress,
  startLatitude,
  verticalTurn,
  ambientRotation,
}) {
  const hero = isMobile && heroConfig.mobileEarth ? heroConfig.mobileEarth : heroConfig.earth;
  const features =
    isMobile && featuresConfig.mobileEarth ? featuresConfig.mobileEarth : featuresConfig.earth;
  const scrollProgress = Math.max(0, Math.min(1, progress));
  const synchronizedProgress = getHeroToFeaturesZoomProgress(scrollProgress);
  const verticalRotation = getScrollLinkedVerticalRotation(
    synchronizedProgress,
    startLatitude,
    verticalTurn
  );
  earth.position.set(
    lerp(hero.pos.x, features.pos.x, synchronizedProgress),
    lerp(hero.pos.y, features.pos.y, synchronizedProgress),
    lerp(hero.pos.z, features.pos.z, synchronizedProgress)
  );
  // Scale proportionally so the perceived zoom advances with the rotation.
  // A linear scale leaves a large visible size change for the end of the scroll.
  const scale = lerpScale(hero.scale, features.scale, synchronizedProgress);
  earth.scale.setScalar(scale);
  earth.userData.targetPosition?.copy(earth.position);
  earth.userData.targetScale = scale;
  earth.userData.targetRotation = lerp(
    hero.rotation || 0,
    features.rotation || 0,
    synchronizedProgress
  );
  earth.rotation.y = earth.userData.targetRotation + ambientRotation;
  earth.rotation.x = verticalRotation;
  const startZ = ((heroConfig.axialTilt ?? -7) * Math.PI) / 180;
  earth.rotation.z = startZ;
  if (clouds) {
    clouds.rotation.x = earth.rotation.x;
    clouds.rotation.z = earth.rotation.z;
  }
}

export class EarthZoomTransition {
  constructor() {
    this.active = false;
    this.startTime = 0;
    this.duration = 2300;
    this.startScale = 1;
    this.endScale = 1;
    this.startRotation = 0;
    this.endRotation = 0;
    this.startLatitude = 0;
    this.endLatitude = 0;
    this.startPosition = { x: 0, y: 0, z: 0 };
    this.endPosition = { x: 0, y: 0, z: 0 };
  }

  start({
    isMobile,
    duration,
    startScale,
    endScale,
    startRotation,
    endRotation,
    startLatitude,
    endLatitude,
    startPosition,
    endPosition,
  }) {
    this.active = Math.abs(endScale - startScale) > 0.08;
    this.startTime = performance.now();
    this.duration = duration || (isMobile ? 1900 : 2150);
    this.startScale = startScale;
    this.endScale = endScale;
    this.startRotation = startRotation;
    this.endRotation = endRotation;
    this.startLatitude = startLatitude;
    this.endLatitude = endLatitude;
    this.startPosition = startPosition;
    this.endPosition = endPosition;
  }

  stop() {
    this.active = false;
  }

  _progress() {
    const progress = Math.max(0, Math.min(1, (performance.now() - this.startTime) / this.duration));
    if (progress >= 1) {
      this.active = false;
      return null;
    }
    return smootherstep(progress);
  }

  _sampleScalar(start, end, fallback) {
    if (!this.active) return fallback;
    const progress = this._progress();
    return progress === null ? fallback : lerp(start, end, progress);
  }

  getScale(fallback) {
    return this._sampleScalar(this.startScale, this.endScale, fallback);
  }

  getRotation(fallback) {
    return this._sampleScalar(this.startRotation, this.endRotation, fallback);
  }

  getLatitude(fallback) {
    return this._sampleScalar(this.startLatitude, this.endLatitude, fallback);
  }

  getPosition(fallback) {
    if (!this.active) return fallback;
    const progress = this._progress();
    if (progress === null) return fallback;
    return {
      x: lerp(this.startPosition.x, this.endPosition.x, progress),
      y: lerp(this.startPosition.y, this.endPosition.y, progress),
      z: lerp(this.startPosition.z, this.endPosition.z, progress),
    };
  }
}
