import { CONFIG } from "./config.js";

// ===== Helper Functions (Pure) =====

export function calculateQualityLevel(fps) {
  if (fps < CONFIG.QUALITY_LEVELS.MEDIUM.minFPS) {
    return "LOW";
  } else if (fps < CONFIG.QUALITY_LEVELS.HIGH.minFPS) {
    return "MEDIUM";
  }
  return "HIGH";
}

export function calculateDynamicResolution(fps, currentRatio, perfConfig) {
  if (fps < 10) {
    return 0.5;
  }

  if (fps < perfConfig.DRS_DOWN_THRESHOLD && currentRatio > 0.5) {
    return Math.max(0.5, currentRatio - 0.15);
  } else if (
    fps > perfConfig.DRS_UP_THRESHOLD &&
    currentRatio < perfConfig.PIXEL_RATIO
  ) {
    return Math.min(perfConfig.PIXEL_RATIO, currentRatio + 0.05);
  }

  return currentRatio;
}
