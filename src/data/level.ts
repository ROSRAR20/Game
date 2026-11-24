import { z } from 'zod';
import { CONFIG } from '../config/constants';
import { createGate, Gate } from '../sim/gates';
import { WaveItemSchema } from './waves';
import level1Json from './level1.json';
import level2Json from './level2.json';
import level3Json from './level3.json';
import level4Json from './level4.json';
import level5Json from './level5.json';

const minRoadX = CONFIG.ROAD_X_MIN + CONFIG.MOB_RADIUS;
const maxRoadX = CONFIG.ROAD_X_MAX - CONFIG.MOB_RADIUS;

export const TOTAL_LEVELS = 5;

export const GateItemSchema = z.object({
  id: z.number().int().positive(),
  kind: z.enum(['add', 'mul', 'sub', 'div']),
  value: z.number().positive(),
  x: z.number().min(CONFIG.ROAD_X_MIN).max(CONFIG.ROAD_X_MAX),
  width: z.number().positive().max(CONFIG.ROAD_WIDTH),
  z: z.number().min(CONFIG.CANNON_MUZZLE_Z).max(CONFIG.ROAD_LENGTH)
});

export const TowerItemSchema = z.object({
  id: z.number().int().positive(),
  x: z.number().min(minRoadX).max(maxRoadX),
  z: z.number().min(5).max(CONFIG.ROAD_LENGTH - 2),
  radius: z.number().positive().max(CONFIG.ROAD_WIDTH / 2),
  maxHp: z.number().int().positive(),
  rewardType: z.enum(['burst_units', 'multiplier_burst', 'upgrade']),
  rewardValue: z.number().int().positive()
});

export const BossItemSchema = z.object({
  id: z.number().int().positive(),
  x: z.number().min(minRoadX).max(maxRoadX),
  z: z.number().min(20).max(CONFIG.ROAD_LENGTH),
  radius: z.number().positive().max(CONFIG.ROAD_WIDTH / 2),
  maxHp: z.number().int().positive(),
  damage: z.number().positive(),
  speed: z.number().positive().max(CONFIG.WAVES.MAX_SPEED)
});

export const PickupItemSchema = z.object({
  id: z.number().int().positive(),
  kind: z.enum(['upgrade']),
  x: z.number().min(minRoadX).max(maxRoadX),
  z: z.number().min(5).max(CONFIG.ROAD_LENGTH - 2),
  radius: z.number().positive().max(CONFIG.ROAD_WIDTH / 2)
});

export const LevelDataSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    gates: z.array(GateItemSchema),
    towers: z.array(TowerItemSchema),
    bosses: z.array(BossItemSchema),
    pickups: z.array(PickupItemSchema).default([]),
    waves: z.array(WaveItemSchema)
  })
  .refine(
    (level) => {
      // Ensure entity IDs are strictly unique within the level
      const gateIds = new Set(level.gates.map((g) => g.id));
      const towerIds = new Set(level.towers.map((t) => t.id));
      const bossIds = new Set(level.bosses.map((b) => b.id));
      const pickupIds = new Set(level.pickups.map((p) => p.id));

      if (gateIds.size !== level.gates.length) return false;
      if (towerIds.size !== level.towers.length) return false;
      if (bossIds.size !== level.bosses.length) return false;
      if (pickupIds.size !== level.pickups.length) return false;
      return true;
    },
    {
      message: 'Entity IDs must be unique within gates, towers, bosses, and pickups'
    }
  );

export type GateItem = z.infer<typeof GateItemSchema>;
export type TowerItem = z.infer<typeof TowerItemSchema>;
export type BossItem = z.infer<typeof BossItemSchema>;
export type PickupItem = z.infer<typeof PickupItemSchema>;
export type LevelData = z.infer<typeof LevelDataSchema>;

const LEVEL_MAP: Record<number, unknown> = {
  1: level1Json,
  2: level2Json,
  3: level3Json,
  4: level4Json,
  5: level5Json
};

export function validateLevel(data: unknown): LevelData {
  return LevelDataSchema.parse(data);
}

export function getLevelData(levelNumber: number = 1): LevelData {
  const safeId = Math.max(1, Math.min(TOTAL_LEVELS, Math.floor(levelNumber)));
  const json = LEVEL_MAP[safeId] || level1Json;
  return validateLevel(json);
}

export function getLevel1Data(): LevelData {
  return getLevelData(1);
}

/**
 * Returns gates for a given level for the simulation GateManager.
 */
export function getLevelGates(levelNumber: number = 1): Gate[] {
  const level = getLevelData(levelNumber);
  return level.gates.map((g) => createGate(g.id, g.kind, g.value, g.x, g.width, g.z));
}
