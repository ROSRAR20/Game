import { z } from 'zod';
import { CONFIG } from '../config/constants';
import { createGate, Gate } from '../sim/gates';
import { WaveItemSchema } from './waves';
import level1Json from './level1.json';

const minRoadX = CONFIG.ROAD_X_MIN + CONFIG.MOB_RADIUS;
const maxRoadX = CONFIG.ROAD_X_MAX - CONFIG.MOB_RADIUS;

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
  z: z.number().min(10).max(CONFIG.ROAD_LENGTH - 2),
  radius: z.number().positive().max(CONFIG.ROAD_WIDTH / 2),
  maxHp: z.number().int().positive(),
  rewardType: z.enum(['burst_units', 'multiplier_burst']),
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

export function validateLevel(data: unknown): LevelData {
  return LevelDataSchema.parse(data);
}

export function getLevel1Data(): LevelData {
  return validateLevel(level1Json);
}

/**
 * Returns Level 1 gates for the simulation GateManager.
 */
export function getLevelGates(): Gate[] {
  const level = getLevel1Data();
  return level.gates.map((g) => createGate(g.id, g.kind, g.value, g.x, g.width, g.z));
}
