export const CONFIG = {
  // Road dimensions (XZ plane, Y is up)
  ROAD_WIDTH: 12,
  ROAD_LENGTH: 100,
  ROAD_X_MIN: -6,
  ROAD_X_MAX: 6,
  ROAD_Z_MIN: 0,
  ROAD_Z_MAX: 100,

  // Cannon movement & firing
  CANNON_MIN_X: -5.2,
  CANNON_MAX_X: 5.2,
  CANNON_Z: 2,
  CANNON_FIRE_RATE: 6, // units per second in normal gameplay
  CANNON_LERP_SPEED: 25, // horizontal smoothing speed

  // Mob parameters
  MOB_BASE_SPEED: 12, // units/sec along +Z
  MOB_RADIUS: 0.25,
  MOB_HEIGHT: 0.6,
  MOB_MAX_Z: 105, // despawn threshold

  // Fixed camera tuning (portrait FOV)
  CAMERA_FOV: 55,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 200,
  CAMERA_OFFSET: { x: 0, y: 16, z: -8 },
  CAMERA_LOOK_AT: { x: 0, y: 1.5, z: 22 },

  // Rendering & Performance budgets
  MAX_DPR: 1.5,
  TARGET_VIEWPORT: { width: 390, height: 844 },

  // Simulation parameters
  SIM_HERTZ: 60,
  FIXED_DELTA_TIME: 1 / 60,
  MAX_SUB_STEPS: 4,

  // Unit pool capacities
  MAX_UNITS: 3500,

  // Visual colors (bright arcade palette)
  COLORS: {
    BACKGROUND: 0x0f172a,
    ROAD: 0x1e293b,
    ROAD_EDGE: 0x38bdf8,
    ROAD_MARKING: 0x64748b,
    FENCE: 0x475569,
    CANNON: 0x3b82f6,
    CANNON_ACCENT: 0x60a5fa,
    BLUE_MOB: 0x38bdf8,
    RED_MOB: 0xef4444,
    STRESS_CUBE: 0x06b6d4
  }
} as const;
