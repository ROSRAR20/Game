export const CONFIG = {
  // Road dimensions (XZ plane, Y is up)
  ROAD_WIDTH: 12,
  ROAD_LENGTH: 100,
  ROAD_X_MIN: -6,
  ROAD_X_MAX: 6,
  ROAD_Z_MIN: 0,
  ROAD_Z_MAX: 100,

  // Cannon placement & movement (Z = 5.0 places cannon cleanly in lower 18% of screen)
  CANNON_Z: 5.0,
  CANNON_MUZZLE_Z: 6.2,
  CANNON_MIN_X: -5.0,
  CANNON_MAX_X: 5.0,
  CANNON_FIRE_RATE: 6, // units per second in normal gameplay
  CANNON_LERP_SPEED: 25, // horizontal smoothing speed

  // Mob parameters
  MOB_BASE_SPEED: 12, // units/sec along +Z
  MOB_RADIUS: 0.25,
  MOB_HEIGHT: 0.6,
  MOB_MAX_Z: 105, // despawn threshold

  // Camera tuning (elevated diagonal perspective, framing cannon + gates + far-field horde)
  CAMERA_FOV: 48,
  CAMERA_PITCH: 26, // degrees downward pitch from horizontal
  CAMERA_YAW: 10, // degrees horizontal yaw offset around Y
  CAMERA_HEIGHT: 22, // camera Y position
  CAMERA_LOOK_AT_DISTANCE: 30, // distance along sightline to look-at target
  CAMERA_POS_X: -4.0, // camera X position
  CAMERA_POS_Z: -15.0, // camera Z position
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 500,
  CAMERA_OFFSET: { x: -4.0, y: 22, z: -15.0 },
  CAMERA_LOOK_AT: { x: 0, y: 1.0, z: 20 },

  // Rendering & Performance budgets (Default DPR = 1.0 for this device class; fill rate constraint)
  DEFAULT_DPR: 1.0,
  MAX_DPR: 1.0,
  TARGET_VIEWPORT: { width: 390, height: 844 },

  // Adaptive quality thresholds (ms)
  ADAPTIVE_QUALITY: {
    TARGET_FPS: 60,
    TARGET_FRAME_TIME_MS: 16.6,
    DOWNGRADE_THRESHOLD_MS: 18.5, // ~54 fps
    UPGRADE_THRESHOLD_MS: 15.0, // solid 60 fps headroom
    WINDOW_DURATION_SEC: 2.0, // evaluation window
    UPGRADE_STABLE_SEC: 5.0 // headroom duration needed before upgrade
  },

  // Simulation parameters
  SIM_HERTZ: 60,
  FIXED_DELTA_TIME: 1 / 60,
  MAX_SUB_STEPS: 4,

  // Unit pool capacities
  MAX_UNITS: 3500,

  // Gate simulation & visual parameters
  GATES: {
    PLANE_OFFSET_Z: 0.1, // Clones spawn just past gate plane
    MAX_CLONES_PER_TICK: 50, // Per-tick clone burst budget
    HEIGHT: 2.2, // Gate banner visual height
    BANNER_Y: 1.2, // Center elevation above road
    COLORS: {
      ADD_BG: '#0284c7', // Bright blue
      ADD_BORDER: '#38bdf8',
      MUL_BG: '#16a34a', // Emerald green
      MUL_BORDER: '#4ade80',
      SUB_BG: '#dc2626', // Crimson red
      SUB_BORDER: '#f87171',
      DIV_BG: '#d97706', // Amber orange
      DIV_BORDER: '#fbbf24'
    }
  },

  // Visual colors (bright high-contrast arcade palette)
  COLORS: {
    BACKGROUND: 0x0f172a,
    ROAD: 0x1e293b,
    ROAD_EDGE: 0x38bdf8,
    ROAD_MARKING: 0x64748b,
    FENCE: 0x475569,
    CANNON_CHASSIS: 0x1e293b,
    CANNON_TREADS: 0x0f172a,
    CANNON_DOME: 0x0284c7,
    CANNON_BARREL: 0x38bdf8,
    CANNON_MUZZLE: 0xffffff,
    CANNON_RING: 0x00f5ff,
    BLUE_MOB: 0x38bdf8,
    RED_MOB: 0xef4444,
    STRESS_CUBE: 0x06b6d4,
    SAND: 0xd4b483,
    SAND_HEX: '#d4b483'
  }
} as const;

export interface CameraConfig {
  fov: number;
  pitch: number;
  yaw: number;
  height: number;
  lookAtDistance: number;
  posX: number;
  posZ: number;
  near: number;
  far: number;
}

/**
 * Returns effective camera configuration, parsing URL query parameters for tuning overrides
 * (?camPitch=, ?camYaw=, ?camFov=, ?camHeight=, ?camLookAtDistance=, ?camX=, ?camZ=).
 */
export function getEffectiveCameraConfig(): CameraConfig {
  const defaults: CameraConfig = {
    fov: CONFIG.CAMERA_FOV,
    pitch: CONFIG.CAMERA_PITCH,
    yaw: CONFIG.CAMERA_YAW,
    height: CONFIG.CAMERA_HEIGHT,
    lookAtDistance: CONFIG.CAMERA_LOOK_AT_DISTANCE,
    posX: CONFIG.CAMERA_POS_X,
    posZ: CONFIG.CAMERA_POS_Z,
    near: CONFIG.CAMERA_NEAR,
    far: CONFIG.CAMERA_FAR
  };

  if (typeof window === 'undefined' || !window.location) {
    return defaults;
  }

  const params = new URLSearchParams(window.location.search);

  const parseParam = (key: string, fallback: number): number => {
    const val = params.get(key);
    if (val === null) return fallback;
    const num = parseFloat(val);
    return isNaN(num) ? fallback : num;
  };

  return {
    fov: parseParam('camFov', defaults.fov),
    pitch: parseParam('camPitch', defaults.pitch),
    yaw: parseParam('camYaw', defaults.yaw),
    height: parseParam('camHeight', defaults.height),
    lookAtDistance: parseParam('camLookAtDistance', defaults.lookAtDistance),
    posX: parseParam('camX', defaults.posX),
    posZ: parseParam('camZ', defaults.posZ),
    near: defaults.near,
    far: defaults.far
  };
}
