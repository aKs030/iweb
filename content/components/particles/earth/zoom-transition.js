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
const clampByte = v => Math.max(0, Math.min(255, Math.round(v)));
const lerpColor = (start, end, amount) =>
  (clampByte(lerp(channel(start, 16), channel(end, 16), amount)) << 16) |
  (clampByte(lerp(channel(start, 8), channel(end, 8), amount)) << 8) |
  clampByte(lerp(channel(start, 0), channel(end, 0), amount));
let scrollRangeCache = null;
let sectionTransitionRangeCache = null;

export function getHeroToFeaturesScrollProgress(currentSection) {
  if (currentSection !== "hero" && currentSection !== "features") return null;

  const hero = document.getElementById("hero");
  const features = document.getElementById("features");
  if (!hero || !features) return null;

  // Compare numeric fields directly – avoids building a string on every frame.
  if (
    scrollRangeCache?.w !== innerWidth ||
    scrollRangeCache?.h !== innerHeight ||
    scrollRangeCache?.heroTop !== hero.offsetTop ||
    scrollRangeCache?.featTop !== features.offsetTop
  ) {
    const parsedPadding = Number.parseFloat(
      getComputedStyle(document.documentElement).scrollPaddingTop
    );
    const padding = Number.isFinite(parsedPadding) ? parsedPadding : 0;
    const start = Math.max(0, hero.offsetTop - padding);
    scrollRangeCache = {
      w: innerWidth,
      h: innerHeight,
      heroTop: hero.offsetTop,
      featTop: features.offsetTop,
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

export function getFeaturesToSection3ScrollProgress(currentSection) {
  if (currentSection !== "features" && currentSection !== "section3") return null;

  const features = document.getElementById("features");
  const section3 = document.getElementById("section3");
  if (!features || !section3) return null;

  if (
    sectionTransitionRangeCache?.w !== innerWidth ||
    sectionTransitionRangeCache?.h !== innerHeight ||
    sectionTransitionRangeCache?.featuresTop !== features.offsetTop ||
    sectionTransitionRangeCache?.section3Top !== section3.offsetTop
  ) {
    const parsedPadding = Number.parseFloat(
      getComputedStyle(document.documentElement).scrollPaddingTop
    );
    const padding = Number.isFinite(parsedPadding) ? parsedPadding : 0;
    const start = Math.max(0, features.offsetTop - padding);
    sectionTransitionRangeCache = {
      w: innerWidth,
      h: innerHeight,
      featuresTop: features.offsetTop,
      section3Top: section3.offsetTop,
      start,
      end: Math.max(start + 1, section3.offsetTop - padding),
    };
  }

  const { start, end } = sectionTransitionRangeCache;
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  return Math.max(0, Math.min(1, (scrollTop - start) / (end - start)));
}

export function getScrollLinkedVerticalRotation(progress, startRotation, turn) {
  return startRotation + turn * progress;
}

export const getHeroToFeaturesZoomProgress = progress =>
  smootherstep(Math.max(0, Math.min(1, progress)));

export function applyFeaturesSection3CameraOrbit(system, features, section3, progress, delta) {
  const p = getHeroToFeaturesZoomProgress(progress);
  const nextConfig = p >= 0.9 ? section3 : features;
  if (system.earthMesh?.userData.currentMode !== nextConfig.mode) {
    system._updateEarthForSection(nextConfig === section3 ? "section3" : "features");
  }
  system._zoomTransition.stop();
  const startOrbit = features.cameraOrbit ?? 0;
  const endOrbit = section3.cameraOrbit ?? startOrbit;
  const cameraOrbit = startOrbit + (endOrbit - startOrbit) * p;
  const earthConfig =
    system.isMobileDevice && features.mobileEarth ? features.mobileEarth : features.earth;
  if (system.earthMesh) {
    system.earthMesh.position.set(earthConfig.pos.x, earthConfig.pos.y, earthConfig.pos.z);
    system.earthMesh.scale.setScalar(earthConfig.scale);
    system.earthMesh.rotation.x = ((features.latitudeTilt ?? 0) * Math.PI) / 180;
    system.earthMesh.rotation.z = ((features.axialTilt ?? 0) * Math.PI) / 180;
    system.earthMesh.userData.targetPosition?.set(
      earthConfig.pos.x,
      earthConfig.pos.y,
      earthConfig.pos.z
    );
    system.earthMesh.userData.targetScale = earthConfig.scale;
  }
  system.cameraManager?.setScrollLinkedPresetProgress("features", "section3", p);
  system.cameraManager?.setScrollLinkedOrbitAngle(cameraOrbit, earthConfig.pos);
  system.cameraManager?.updateCameraPosition(delta);
  if (system.earthMesh) {
    system.earthMesh.rotation.y = earthConfig.rotation || 0;
    system.earthMesh.userData.targetRotation = earthConfig.rotation || 0;
  }
  if (system.cloudMesh) {
    system.cloudMesh.rotation.x = system.earthMesh?.rotation.x || 0;
    system.cloudMesh.rotation.z = system.earthMesh?.rotation.z || 0;
  }

  const cityBlendProgress = Math.max(0, Math.min(1, (p - 0.45) / 0.55));
  const cityBlend = smootherstep(cityBlendProgress);
  if (system.cityGlowGroup) {
    system.cityGlowGroup.visible = cityBlend > 0.001;
    system.cityGlowGroup.traverse(object => {
      const glowOpacity = object.material?.uniforms?.glowOpacity;
      const baseOpacity = object.material?.userData?.baseGlowOpacity;
      if (glowOpacity && Number.isFinite(baseOpacity)) {
        glowOpacity.value = baseOpacity * cityBlend;
      }
    });
  }
}

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
    if (material.userData.reliefShader?.uniforms?.terrainGlintIntensity) {
      if (progress >= 1) {
        material.userData.reliefShader.uniforms.terrainGlintIntensity.value = 0;
      } else {
        const glintFade = Math.pow(Math.max(0, 1 - p * 3.33), 2);
        material.userData.reliefShader.uniforms.terrainGlintIntensity.value =
          (hero.surfaceSpecularIntensity ?? 1) * glintFade;
      }
    }
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
    // Cache last computed progress to avoid redundant performance.now() calls
    // when multiple getters are called within the same animation frame.
    this._progressCache = null;
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
    this._progressCache = null;
  }

  stop() {
    this.active = false;
    this._progressCache = null;
  }

  _progress() {
    const now = performance.now();
    // Cache progress for 8 ms so multiple getters in the same animation frame
    // share one calculation instead of each calling performance.now() + smootherstep.
    if (this._progressCache !== null && now - this._progressCache.time < 8) {
      return this._progressCache.value;
    }
    const raw = Math.max(0, Math.min(1, (now - this.startTime) / this.duration));
    if (raw >= 1) {
      this.active = false;
      this._progressCache = null;
      return null;
    }
    const value = smootherstep(raw);
    this._progressCache = { time: now, value };
    return value;
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
