export const CONFIG = {
  EARTH: {
    RADIUS: 3.5,
    SEGMENTS: 128,
    SEGMENTS_MOBILE: 96,
    HERO_DISPLACEMENT_SCALE: 0,
    DEFAULT_DISPLACEMENT_SCALE: 0,
    AMBIENT_ROTATION_SPEED: 0,
    CITY_LIGHT_INTENSITY: 1.35,
    AXIAL_TILT: -23.4,
  },
  CLOUDS: {
    ALTITUDE: 0.014,
    HIGH_ALTITUDE: 0.024,
    SHADOW_ALTITUDE: 0.0035,
    SHADOW_OPACITY: 0.018,
    HIGH_OPACITY_FACTOR: 0.28,
    ROTATION_SPEED: 0.000065,
    OPACITY: 0.2,
  },
  SUN: {
    INTENSITY: 2.2,
  },
  LIGHTING: {
    DAY: {
      AMBIENT_INTENSITY: 1.1,
      AMBIENT_COLOR: 0x505060,
      SUN_INTENSITY: 2.2,
      FILL_INTENSITY: 0.18,
      RIM_INTENSITY: 0.45,
    },
    NIGHT: {
      AMBIENT_INTENSITY: 0.36,
      AMBIENT_COLOR: 0x202845,
      SUN_INTENSITY: 0.42,
      FILL_INTENSITY: 0.36,
      RIM_INTENSITY: 0.62,
    },
  },
  STARS: {
    COUNT: 3600,
    TWINKLE_SPEED: 0.2,
  },
  MOON: {
    RADIUS: 0.95,
    DISTANCE: 25,
    ORBIT_SPEED: 0.00025,
    SEGMENTS: 96,
    BUMP_SCALE: 0.028,
    DISPLACEMENT_SCALE: 0.016,
  },
  CAMERA: {
    FOV: 45,
    NEAR: 0.1,
    FAR: 1000,
    ZOOM_MIN: 8,
    ZOOM_MAX: 18.5,
    LERP_FACTOR: 0.075,
    PRESETS: {
      hero: {
        x: 0,
        y: 4.8, // optimal height for a cinematic flyover feel
        z: 15.0, // pulled back for wide skyline view
        fov: 40, // balanced FOV for depth and scale
        lookAt: { x: 0, y: -2.6, z: 0 }, // gaze towards the horizon
      },
      features: {
        x: 0.42,
        y: 3.65,
        z: 11.55,
        fov: 40,
        lookAt: { x: 0, y: -1.05, z: -1.15 },
      },
      section3: {
        // Keep Section 2 distance/FOV; the sideways perspective comes from camera orbit.
        x: 0.42,
        y: 3.65,
        z: 11.55,
        fov: 40,
        lookAt: { x: 0, y: -1.05, z: -1.15 },
      },
      "site-footer": {
        x: 0.42,
        y: 3.65,
        z: 11.55,
        fov: 40,
        lookAt: { x: 0, y: -1.05, z: -1.15 },
      },
    },
    TRANSITION_DURATION: 1.85,
  },
  SHOOTING_STARS: {
    BASE_FREQUENCY: 0.012,
    MAX_SIMULTANEOUS: 4,
  },
  PERFORMANCE: {
    PIXEL_RATIO: Math.min(globalThis.devicePixelRatio || 1, 2),
  },
  QUALITY_LEVELS: {
    HIGH: {
      minFPS: 50,
      cloudLayer: true,
      highCloudLayer: true,
      terrainDetailScale: 1,
      meteorShowers: true,
      desktopPixelRatio: 2,
      mobilePixelRatio: 1.75,
    },
    MEDIUM: {
      minFPS: 28,
      cloudLayer: true,
      highCloudLayer: false,
      terrainDetailScale: 0.78,
      meteorShowers: true,
      desktopPixelRatio: 1.7,
      mobilePixelRatio: 1.45,
    },
    LOW: {
      minFPS: 0,
      cloudLayer: true,
      highCloudLayer: false,
      terrainDetailScale: 0.52,
      meteorShowers: false,
      desktopPixelRatio: 1.25,
      mobilePixelRatio: 1.1,
    },
  },
};
