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

  // Base defense & combat (M3)
  BASE_MAX_HP: 100,
  BASE_Z: 0,
  RED_MOB_BASE_DAMAGE: 1,
  MAX_CONTACTS_PER_TICK: 10,

  // Enemy wave parameters (M3)
  WAVES: {
    DEFAULT_SPEED: 2.5, // units/sec along -Z
    MAX_SPEED: 4.0, // maximum enemy speed
    SPAWN_Z_MIN: 10,
    SPAWN_Z_MAX: 95
  },

  // Spatial hash grid parameters (M3)
  SPATIAL_HASH: {
    CELL_SIZE: 0.8,
    COLS: 15, // ceil(ROAD_WIDTH / 0.8) = 15
    ROWS: 125, // ceil(ROAD_LENGTH / 0.8) = 125
    TOTAL_CELLS: 1875
  },

  // Camera tuning defaults (approved device-tuned camera angle)
  CAMERA_FOV: 56,
  CAMERA_PITCH: 40, // degrees downward pitch from horizontal
  CAMERA_YAW: 25.5, // degrees horizontal yaw offset around Y
  CAMERA_HEIGHT: 20, // camera Y elevation
  CAMERA_LOOK_AT_DISTANCE: 16, // distance along sightline to look-at target
  CAMERA_POS_X: -8.8, // camera lateral offset to left of road
  CAMERA_POS_Z: -9, // camera Z position
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 500,
  CAMERA_OFFSET: { x: -8.8, y: 20, z: -9 },
  CAMERA_LOOK_AT: { x: 0, y: 1.0, z: 20 },

  // Horde carpet positioning (visible in top quarter of framed road, behind boss spawn)
  HORDE_CARPET: {
    START_Z: 50,
    LENGTH: 40
  },

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

  // Endless Run & Difficulty Configuration (Stage 2/3 retuned)
  ENDLESS: {
    BASE_SPAWN_RATE: 3.2, // units/s at t=0
    SPAWN_RATE_RAMP_PER_MIN: 3.0, // +units/s per minute
    MAX_SPAWN_RATE: 22.0, // hard cap
    BASE_SPEED: 2.7, // m/s
    SPEED_RAMP_PER_MIN: 0.10, // +m/s per minute
    MAX_SPEED: 3.6, // m/s
    MAX_RED_UNITS: 900 // active red units cap
  },

  // Left-Lane Moving +1 Panels (Stage 3)
  PANELS: {
    SPEED: 2.0, // 2.0 m/s moving toward cannon line
    DESPAWN_Z: 5.0, // cannon line
    SPAWN_X: 4.0, // left tunnel mouth (world X in [2, 6])
    SPAWN_Z: 22.0,
    WIDTH: 1.4,
    HEIGHT: 1.0,
    DEPTH: 0.4,
    BASE_INTERVAL: 12.0, // seconds
    MIN_INTERVAL: 6.0,
    MAX_CANNON_COUNT: 6,
    SCORE_AT_MAX: 250 // score granted when collected at max shooters
  },

  // Cap Behaviour Option 1: Weight Merging
  CAP_MERGE: {
    POOL_THRESHOLD: 3000,
    MAX_UNIT_WEIGHT: 10,
    MAX_VISUAL_SCALE: 1.8
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

export interface CameraPresetConfig {
  name: string;
  fov: number;
  pitch: number;
  yaw: number;
  height: number;
  lookAtDistance: number;
  posX: number;
  posZ: number;
}

export const CAMERA_PRESETS: Record<'a' | 'b' | 'c' | 'middle', CameraPresetConfig> = {
  a: {
    name: 'Preset A (Approved Tuned: pitch 40, yaw 25.5, fov 56, height 20, posX -8.8, posZ -9)',
    fov: 56,
    pitch: 40,
    yaw: 25.5,
    height: 20,
    lookAtDistance: 16,
    posX: -8.8,
    posZ: -9
  },
  b: {
    name: 'Preset B (Medium: yaw 25, pitch 55, fov 52, height 28, span ~49.1)',
    fov: 52,
    pitch: 55,
    yaw: 25,
    height: 28,
    lookAtDistance: 30,
    posX: -8.0,
    posZ: -3.5
  },
  c: {
    name: 'Preset C (Far / Wide: yaw 35, pitch 56, fov 54, height 38, span ~66.4)',
    fov: 54,
    pitch: 56,
    yaw: 35,
    height: 38,
    lookAtDistance: 40,
    posX: -11.0,
    posZ: -3.0
  },
  middle: {
    name: 'Middle Option (yaw 16.0, posX -5.2, posZ -11.5, height 24.5, pitch 44, fov 60)',
    fov: 60,
    pitch: 44,
    yaw: 16.0,
    height: 24.5,
    lookAtDistance: 20,
    posX: -5.2,
    posZ: -11.5
  }
};

/**
 * Returns effective camera configuration, parsing URL query parameters for presets (?camPreset=a|b|c|middle)
 * and individual tuning overrides (?camPitch=, ?camYaw=, ?camFov=, ?camHeight=, ?camLookAtDistance=, ?camX=, ?camZ=).
 */
export function getEffectiveCameraConfig(): CameraConfig & { preset: 'a' | 'b' | 'c' | 'middle' } {
  let presetKey: 'a' | 'b' | 'c' | 'middle' = 'a';

  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('camPreset')?.toLowerCase();
    if (p === 'b' || p === 'c' || p === 'middle') {
      presetKey = p;
    }
  }

  const base = CAMERA_PRESETS[presetKey];
  const defaults: CameraConfig = {
    fov: base.fov,
    pitch: base.pitch,
    yaw: base.yaw,
    height: base.height,
    lookAtDistance: base.lookAtDistance,
    posX: base.posX,
    posZ: base.posZ,
    near: CONFIG.CAMERA_NEAR,
    far: CONFIG.CAMERA_FAR
  };

  if (typeof window === 'undefined' || !window.location) {
    return { ...defaults, preset: presetKey };
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
    far: defaults.far,
    preset: presetKey
  };
}
