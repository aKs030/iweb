import { CONFIG } from "./config.js";

export function supportsWebGL(log) {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      log.warn("WebGL context not available");
      return false;
    }
    log.debug("WebGL is supported");
    return true;
  } catch (error) {
    log.warn("WebGL detection failed:", error);
    return false;
  }
}

export function detectDeviceCapabilities(log) {
  try {
    const ua = (navigator.userAgent || "").toLowerCase();
    const isMobile = /mobile|tablet|android|ios|iphone|ipad/i.test(ua);
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

    log.debug("Device capabilities:", {
      isMobile,
      isLowEnd,
      cores,
      memory,
      saveData,
      reducedMotion,
      recommendedQuality,
    });

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
