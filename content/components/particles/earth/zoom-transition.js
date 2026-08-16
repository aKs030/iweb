const smootherstep = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

const lerp = (start, end, amount) => start + (end - start) * amount;
const lerpScale = (start, end, amount) => {
  if (start <= 0 || end <= 0) return lerp(start, end, amount);
  return Math.exp(lerp(Math.log(start), Math.log(end), amount));
};
const lerpAngle = (start, end, amount) => {
  const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start));
  return start + delta * amount;
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

let footerTransitionRangeCache = null;

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

export function getSection3ToFooterScrollProgress(currentSection) {
  if (currentSection !== "section3" && currentSection !== "site-footer") return null;

  const section3 = document.getElementById("section3");
  const footer = document.querySelector(
    "site-footer, footer.site-footer, .site-footer, #site-footer"
  );
  if (!section3 || !footer) return null;

  const footerTop = footer.offsetTop || document.documentElement.scrollHeight - innerHeight;

  if (
    footerTransitionRangeCache?.w !== innerWidth ||
    footerTransitionRangeCache?.h !== innerHeight ||
    footerTransitionRangeCache?.section3Top !== section3.offsetTop ||
    footerTransitionRangeCache?.footerTop !== footerTop
  ) {
    const parsedPadding = Number.parseFloat(
      getComputedStyle(document.documentElement).scrollPaddingTop
    );
    const padding = Number.isFinite(parsedPadding) ? parsedPadding : 0;
    const start = Math.max(0, section3.offsetTop - padding);
    footerTransitionRangeCache = {
      w: innerWidth,
      h: innerHeight,
      section3Top: section3.offsetTop,
      footerTop,
      start,
      end: Math.max(start + 1, footerTop - padding),
    };
  }

  const { start, end } = footerTransitionRangeCache;
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  return Math.max(0, Math.min(1, (scrollTop - start) / (end - start)));
}

export function getScrollLinkedVerticalRotation(progress, startRotation, endRotation) {
  return lerpAngle(startRotation, endRotation, progress);
}

const getStagedProgress = (progress, start, end) => {
  const t = Math.max(0, Math.min(1, (progress - start) / Math.max(0.0001, end - start)));
  return t * t * (3 - 2 * t);
};

export const getHeroToFeaturesRotationProgress = progress => getStagedProgress(progress, 0.1, 0.84);

export const getHeroToFeaturesZoomProgress = progress => getStagedProgress(progress, 0.04, 0.9);

export function applyFeaturesSection3CameraOrbit(
  system,
  features,
  section3,
  progress,
  delta,
  startName = "features",
  endName = "section3"
) {
  const p = smootherstep(Math.max(0, Math.min(1, progress)));
  const nextConfig = p >= 0.9 ? section3 : features;
  const nextName = p >= 0.9 ? endName : startName;
  if (system.earthMesh?.userData.currentMode !== nextConfig.mode) {
    system._updateEarthForSection(nextName);
  }
  system._zoomTransition.stop();
  const startOrbit = features.cameraOrbit ?? 0;
  const endOrbit = section3.cameraOrbit ?? startOrbit;
  const cameraOrbit = startOrbit + (endOrbit - startOrbit) * p;
  const usesMobileLayout = Boolean(system.isMobileLayout);
  const startEarth =
    usesMobileLayout && features.mobileEarth ? features.mobileEarth : features.earth;
  const endEarth = usesMobileLayout && section3.mobileEarth ? section3.mobileEarth : section3.earth;
  const earthPosition = {
    x: lerp(startEarth.pos.x, endEarth.pos.x, p),
    y: lerp(startEarth.pos.y, endEarth.pos.y, p),
    z: lerp(startEarth.pos.z, endEarth.pos.z, p),
  };
  const earthScale = lerpScale(startEarth.scale, endEarth.scale, p);
  const earthRotation = lerpAngle(startEarth.rotation ?? 0, endEarth.rotation ?? 0, p);
  const latitudeTilt = lerp(features.latitudeTilt ?? 0, section3.latitudeTilt ?? 0, p);
  const axialTilt = lerp(features.axialTilt ?? 0, section3.axialTilt ?? 0, p);
  if (system.earthMesh) {
    system.earthMesh.position.set(earthPosition.x, earthPosition.y, earthPosition.z);
    system.earthMesh.scale.setScalar(earthScale);
    system.earthMesh.rotation.x = (latitudeTilt * Math.PI) / 180;
    system.earthMesh.rotation.z = (axialTilt * Math.PI) / 180;
    system.earthMesh.userData.targetPosition?.set(
      earthPosition.x,
      earthPosition.y,
      earthPosition.z
    );
    system.earthMesh.userData.targetScale = earthScale;
  }
  system.cameraManager?.setScrollLinkedPresetProgress(startName, endName, p);
  system.cameraManager?.setScrollLinkedOrbitAngle(cameraOrbit, earthPosition);
  system.cameraManager?.updateCameraPosition(delta);
  if (system.earthMesh) {
    system.earthMesh.rotation.y = earthRotation;
    system.earthMesh.userData.targetRotation = earthRotation;
  }
  if (system.cloudMesh) {
    system.cloudMesh.rotation.x = system.earthMesh?.rotation.x || 0;
    system.cloudMesh.rotation.z = system.earthMesh?.rotation.z || 0;
  }

  // Smoothly fade feature portal cards when scrolling away from features
  if (system.cardManager && startName === "features") {
    const cardProgress = Math.max(0, 1 - p * 2.2);
    system.cardManager.setProgress(cardProgress);
    if (system.container) {
      system.container.dataset.featureCards = cardProgress > 0.05 ? "visible" : "hidden";
    }
  }

  if (system.cityGlowGroup) {
    system.cityGlowGroup.visible = true;
    system.cityGlowGroup.traverse(object => {
      const glowOpacity = object.material?.uniforms?.glowOpacity;
      const baseOpacity = object.material?.userData?.baseGlowOpacity;
      if (glowOpacity && Number.isFinite(baseOpacity)) {
        glowOpacity.value = baseOpacity;
      }
    });
  }
}

export function applyScrollLinkedSectionVisuals(
  system,
  hero,
  features,
  progress,
  config,
  stagedZoom = true
) {
  const p = stagedZoom
    ? getHeroToFeaturesZoomProgress(progress)
    : smootherstep(Math.max(0, Math.min(1, progress)));
  const globeBlend = stagedZoom ? getStagedProgress(progress, 0.62, 0.96) : p;
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
    material.opacity = lerp(hero.surfaceOpacity ?? 1, features.surfaceOpacity ?? 1, globeBlend);
    material.depthWrite = material.opacity >= 0.98;
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
    const oceanShader = material.userData?.reliefShader;
    const oceanGradeStrength = lerp(
      hero.oceanGradeStrength ?? 0.48,
      features.oceanGradeStrength ?? 0.48,
      p
    );
    const oceanSaturation = lerp(hero.oceanSaturation ?? 1, features.oceanSaturation ?? 1, p);
    const oceanBrightness = lerp(hero.oceanBrightness ?? 1, features.oceanBrightness ?? 1, p);
    material.userData.oceanGradeStrength = oceanGradeStrength;
    material.userData.oceanSaturation = oceanSaturation;
    material.userData.oceanBrightness = oceanBrightness;
    if (oceanShader?.uniforms?.oceanGradeStrength) {
      oceanShader.uniforms.oceanGradeStrength.value = oceanGradeStrength;
    }
    if (oceanShader?.uniforms?.oceanSaturation) {
      oceanShader.uniforms.oceanSaturation.value = oceanSaturation;
    }
    if (oceanShader?.uniforms?.oceanBrightness) {
      oceanShader.uniforms.oceanBrightness.value = oceanBrightness;
    }
  }

  const cityGlowMultiplier = lerp(
    hero.cityGlowMultiplier ?? 1,
    features.cityGlowMultiplier ?? 1,
    globeBlend
  );
  system.cityGlowGroup?.traverse(object => {
    const glowOpacity = object.material?.uniforms?.glowOpacity;
    const baseOpacity = object.material?.userData?.baseGlowOpacity;
    if (glowOpacity && Number.isFinite(baseOpacity)) {
      glowOpacity.value = baseOpacity * cityGlowMultiplier;
    }
  });
  const cityPointOpacity = system.cityLightsPoints?.getObjectByName?.(
    "earth-city-light-points-mesh"
  )?.material?.uniforms?.cityPointOpacity;
  if (cityPointOpacity) {
    cityPointOpacity.value = lerp(
      hero.cityPointOpacity ?? 0,
      features.cityPointOpacity ?? 0,
      globeBlend
    );
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
    const opacity = lerp(hero.cloudOpacity ?? 0, features.cloudOpacity ?? 0, globeBlend);
    clouds.visible = opacity > 0.001;
    if (parts.low?.material) parts.low.material.opacity = opacity;
    if (parts.high?.material)
      parts.high.material.opacity = opacity * config.CLOUDS.HIGH_OPACITY_FACTOR;
    if (parts.shadow?.material) {
      parts.shadow.material.opacity = lerp(
        hero.cloudShadowOpacity ?? 0,
        features.cloudShadowOpacity ?? 0,
        globeBlend
      );
    }
    clouds.userData.targetScaleFactor = lerp(
      hero.cloudScaleFactor ?? 1,
      features.cloudScaleFactor ?? 1,
      globeBlend
    );
  }

  const atmosphere = system.earthMesh?.getObjectByName?.("earth-atmosphere");
  if (atmosphere?.material?.uniforms?.atmosphereOpacity) {
    const heroAtmos = hero.atmosphereVisible !== false ? (hero.atmosphereOpacity ?? 0.42) : 0;
    const featAtmos =
      features.atmosphereVisible !== false ? (features.atmosphereOpacity ?? 0.42) : 0;
    const atmosphereOpacity = lerp(heroAtmos, featAtmos, globeBlend);
    atmosphere.material.uniforms.atmosphereOpacity.value = atmosphereOpacity;
    atmosphere.visible = atmosphereOpacity > 0.001;
  }

  if (system.moonMesh && hero.moon && features.moon) {
    const moon = system.moonMesh;
    moon.position.set(
      lerp(hero.moon.pos.x, features.moon.pos.x, globeBlend),
      lerp(hero.moon.pos.y, features.moon.pos.y, globeBlend),
      lerp(hero.moon.pos.z, features.moon.pos.z, globeBlend)
    );
    moon.scale.setScalar(lerp(hero.moon.scale, features.moon.scale, globeBlend));
    moon.visible = moon.scale.x > 0.001;
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
  endLatitude,
  ambientRotation,
}) {
  const hero = isMobile && heroConfig.mobileEarth ? heroConfig.mobileEarth : heroConfig.earth;
  const features =
    isMobile && featuresConfig.mobileEarth ? featuresConfig.mobileEarth : featuresConfig.earth;
  const scrollProgress = Math.max(0, Math.min(1, progress));
  const rotationProgress = getHeroToFeaturesRotationProgress(scrollProgress);
  const zoomProgress = getHeroToFeaturesZoomProgress(scrollProgress);
  const positionProgress = 1 - Math.pow(1 - zoomProgress, 1.55);
  const verticalRotation = getScrollLinkedVerticalRotation(
    rotationProgress,
    startLatitude,
    endLatitude
  );
  earth.position.set(
    lerp(hero.pos.x, features.pos.x, positionProgress),
    lerp(hero.pos.y, features.pos.y, positionProgress),
    lerp(hero.pos.z, features.pos.z, positionProgress)
  );
  const scale = lerpScale(hero.scale, features.scale, zoomProgress);
  earth.scale.setScalar(scale);
  earth.userData.targetPosition?.copy(earth.position);
  earth.userData.targetScale = scale;
  earth.userData.targetRotation = lerp(
    hero.rotation || 0,
    features.rotation || 0,
    rotationProgress
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
