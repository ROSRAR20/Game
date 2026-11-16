import { z } from 'zod';
import { CONFIG } from '../config/constants';
import level1Data from './level1_waves.json';

const minRoadX = CONFIG.ROAD_X_MIN + CONFIG.MOB_RADIUS;
const maxRoadX = CONFIG.ROAD_X_MAX - CONFIG.MOB_RADIUS;

export const WaveItemSchema = z
  .object({
    id: z.number().int().positive(),
    triggerTimeSec: z.number().nonnegative(),
    count: z.number().int().positive(),
    minX: z.number().min(minRoadX).max(maxRoadX),
    maxX: z.number().min(minRoadX).max(maxRoadX),
    spawnZ: z.number().min(CONFIG.WAVES.SPAWN_Z_MIN).max(CONFIG.WAVES.SPAWN_Z_MAX),
    speed: z.number().positive().max(CONFIG.WAVES.MAX_SPEED),
    weight: z.number().int().min(1).default(1),
    tier: z.number().int().nonnegative().default(0)
  })
  .refine((data) => data.minX <= data.maxX, {
    message: 'minX must be <= maxX',
    path: ['maxX']
  });

export const LevelWavesSchema = z
  .array(WaveItemSchema)
  .refine(
    (waves) => {
      const ids = new Set<number>();
      for (const w of waves) {
        if (ids.has(w.id)) return false;
        ids.add(w.id);
      }
      return true;
    },
    {
      message: 'Wave IDs must be unique'
    }
  )
  .refine(
    (waves) => {
      for (let i = 1; i < waves.length; i++) {
        if (waves[i].triggerTimeSec < waves[i - 1].triggerTimeSec) return false;
      }
      return true;
    },
    {
      message: 'triggerTimeSec must be ascending'
    }
  );

export type WaveItem = z.infer<typeof WaveItemSchema>;
export type LevelWaves = z.infer<typeof LevelWavesSchema>;

export function validateWaves(data: unknown): LevelWaves {
  return LevelWavesSchema.parse(data);
}

export function getLevel1Waves(): LevelWaves {
  return validateWaves(level1Data);
}
