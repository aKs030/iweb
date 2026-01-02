export const CONFIG = {
  EARTH: {
    RADIUS: 3.5,
    SEGMENTS: 64,
    SEGMENTS_MOBILE: 32, // Reduced geometry for mobile
    BUMP_SCALE: 0.008,
    EMISSIVE_INTENSITY: 0.2,
    EMISSIVE_PULSE_SPEED: 0.3,
    EMISSIVE_PULSE_AMPLITUDE: 0.08,
  },
  CLOUDS: {
    ALTITUDE: 0.03,
    ROTATION_SPEED: 0.0008,
    OPACITY: 0.3,
  },
  ATMOSPHERE: {
    SCALE: 1.015,
    FRESNEL_POWER: 4.5,
    RAYLEIGH_SCALE: 1.028,
    MIE_SCALE: 1.018,
    RAYLEIGH_COLOR: 0x4488ff,
    MIE_COLOR: 0xffbb66,
    RAYLEIGH_INTENSITY: 0.08,
    MIE_INTENSITY: 0.04,
    SCATTERING_STRENGTH: 0.18,
  },
  OCEAN: {
    SHININESS: 100.0,
    SPECULAR_INTENSITY: 0.5,
    SPECULAR_COLOR: 0xffffff,
  },
  SUN: {
    RADIUS: 15,
    HEIGHT: 3.0,
    INTENSITY: 1.8,
  },
  LIGHTING: {
    DAY: {
      AMBIENT_INTENSITY: 1.4,
      AMBIENT_COLOR: 0x606060,
      SUN_INTENSITY: 1.8,
    },
    NIGHT: {
      AMBIENT_INTENSITY: 0.3,
      AMBIENT_COLOR: 0x202845,
      SUN_INTENSITY: 0.35,
    },
  },
  STARS: {
    COUNT: 3000,
    TWINKLE_SPEED: 0.2, // Reduziert für subtileren Effekt
    ANIMATION: {
      DURATION: 2800, // Schnellere Animation
      CAMERA_SETTLE_DELAY: 1800, // Schnellere Anpassung
      MIN_UPDATE_INTERVAL: 100,
      CARD_FADE_START: 0.75,
      CARD_FADE_END: 0.95,
      SPREAD_XY: 0.02, // Extrem fein für exakte Rand-Linien
      SPREAD_Z: 0.01, // Minimale Tiefe
      LERP_FACTOR: 0.08,
    },
  },
  MOON: {
    RADIUS: 0.95,
    DISTANCE: 25,
    ORBIT_SPEED: 0.00025,
    SEGMENTS: 48,
    BUMP_SCALE: 0.015,
  },
  CAMERA: {
    FOV: 45,
    NEAR: 0.1,
    FAR: 1000,
    ZOOM_MIN: 5,
    ZOOM_MAX: 25,
    LERP_FACTOR: 0.06,
    PRESETS: {
      hero: {
        x: -6.5,
        y: 4.8,
        z: 10.5,
        lookAt: { x: 0, y: -0.5, z: 0 },
      },
      features: {
        x: 7.0,
        y: 5.5,
        z: 7.5,
        lookAt: { x: 0, y: 0.5, z: 0 },
      },
      about: {
        x: -3.2,
        y: 3.0,
        z: 9.5,
        lookAt: { x: 0, y: 0, z: 0 },
      },
      contact: {
        x: -0.5,
        y: 3.0,
        z: 9.5,
        lookAt: { x: 0, y: 0, z: 0 },
      },
    },
    TRANSITION_DURATION: 1.8,
  },
  SHOOTING_STARS: {
    BASE_FREQUENCY: 0.003,
    SHOWER_FREQUENCY: 0.02,
    SHOWER_DURATION: 180,
    SHOWER_COOLDOWN: 1200,
    MAX_SIMULTANEOUS: 3,
  },
  PERFORMANCE: {
    // Cap pixel ratio conservatively to avoid GPU stalls on some drivers/devices
    // Dynamically adjusted by PerformanceMonitor during runtime
    PIXEL_RATIO: Math.min(window.devicePixelRatio || 1, 1.5),
    TARGET_FPS: 30,
    DRS_DOWN_THRESHOLD: 25,
    DRS_UP_THRESHOLD: 35,
  },
  QUALITY_LEVELS: {
    HIGH: {
      minFPS: 28,
      multiLayerAtmosphere: true,
      oceanReflections: true,
      cloudLayer: true,
      meteorShowers: true,
    },
    MEDIUM: {
      minFPS: 18,
      multiLayerAtmosphere: false,
      oceanReflections: true,
      cloudLayer: true,
      meteorShowers: true,
    },
    LOW: {
      minFPS: 0,
      multiLayerAtmosphere: false,
      oceanReflections: false,
      cloudLayer: false,
      meteorShowers: false,
    },
  },
  PATHS: {
    TEXTURES: {
      DAY: "/content/assets/img/earth/textures/earth_day.webp",
      NIGHT: "/content/assets/img/earth/textures/earth_night.webp",
      NORMAL: "/content/assets/img/earth/textures/earth_normal.webp",
      BUMP: "/content/assets/img/earth/textures/earth_bump.webp",
      CLOUDS: "/content/assets/img/earth/textures/earth_clouds_1024.png",
      MOON: "/content/assets/img/earth/textures/moon_texture.webp",
      MOON_BUMP: "/content/assets/img/earth/textures/moon_bump.webp",
    },
  },
};
