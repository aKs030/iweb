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

// DRS Disabled for maximum quality
export function calculateDynamicResolution(_fps, _currentRatio, perfConfig) {
  return perfConfig.PIXEL_RATIO;
}
