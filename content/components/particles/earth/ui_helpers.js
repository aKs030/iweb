import { CONFIG } from './config.js';

// ===== Helper Functions (Pure) =====

export function calculateQualityLevel(fps) {
  if (fps < CONFIG.QUALITY_LEVELS.MEDIUM.minFPS) {
    return 'LOW';
  } else if (fps < CONFIG.QUALITY_LEVELS.HIGH.minFPS) {
    return 'MEDIUM';
  }
  return 'HIGH';
}

export function calculateDynamicResolution(fps, currentRatio, perfConfig) {
  // DISABLE DRS: Always return the configured max pixel ratio.
  // The user requested maximum quality even on mobile, so we prevent downscaling.
  return perfConfig.PIXEL_RATIO;
}
