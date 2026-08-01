import { CONFIG } from "./config.js";

export function isMobileDeviceLike(deviceNavigator = globalThis.navigator) {
  const ua = (deviceNavigator?.userAgent || "").toLowerCase();
  return (
    /mobile|tablet|android|ios|iphone|ipad/.test(ua) ||
    (ua.includes("macintosh") && (deviceNavigator?.maxTouchPoints || 0) > 1)
  );
}

export function supportsWebGL(log) {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      log.warn("WebGL context not available");
      return false;
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch (error) {
    log.warn("WebGL detection failed:", error);
    return false;
  }
}

export function detectDeviceCapabilities(log) {
  try {
    const ua = (navigator.userAgent || "").toLowerCase();
    const isMobile = isMobileDeviceLike(navigator);
    const deviceNavigator =
      /** @type {Navigator & { deviceMemory?: number, connection?: { saveData?: boolean } }} */ (
        navigator
      );
    const cores = deviceNavigator.hardwareConcurrency || 0;
    const memory = Number(deviceNavigator.deviceMemory || 0);
    const saveData = Boolean(deviceNavigator.connection?.saveData);
    const reducedMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    const isLegacyMobile =
      /android 4|android 5|cpu iphone os 9|cpu iphone os 10|cpu iphone os 11/i.test(ua);
    const isLowEnd =
      isLegacyMobile || saveData || (cores > 0 && cores <= 2 && (memory === 0 || memory <= 2));

    let recommendedQuality;
    if (isLowEnd) recommendedQuality = "LOW";
    else if (reducedMotion) recommendedQuality = "MEDIUM";
    else if (isMobile || (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4))
      recommendedQuality = "MEDIUM";
    else recommendedQuality = "HIGH";

    return { isMobile, isLowEnd, reducedMotion, recommendedQuality };
  } catch (error) {
    log.warn("Device detection failed:", error);
    return {
      isMobile: false,
      isLowEnd: false,
      reducedMotion: false,
      recommendedQuality: "MEDIUM",
    };
  }
}

export function getOptimizedConfig(capabilities) {
  if (!capabilities) return {};
  if (capabilities.isLowEnd) {
    return {
      EARTH: { ...CONFIG.EARTH, SEGMENTS: 72, SEGMENTS_MOBILE: 48 },
      STARS: { ...CONFIG.STARS, COUNT: 1000 },
      PERFORMANCE: {
        ...CONFIG.PERFORMANCE,
        PIXEL_RATIO: Math.min(window.devicePixelRatio || 1, 1.25),
      },
      CLOUDS: { ...CONFIG.CLOUDS, OPACITY: 0 },
    };
  }
  if (capabilities.isMobile) {
    return {
      EARTH: { ...CONFIG.EARTH, SEGMENTS_MOBILE: 96 },
      STARS: { ...CONFIG.STARS, COUNT: 2400 },
      PERFORMANCE: {
        ...CONFIG.PERFORMANCE,
        PIXEL_RATIO: Math.min(window.devicePixelRatio || 1, 1.75),
      },
    };
  }
  return {};
}
