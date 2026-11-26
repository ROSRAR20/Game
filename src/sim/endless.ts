import { MobPool, spawnMob } from './pool';
import { SeededRNG } from './rng';
import { CONFIG } from '../config/constants';

export interface EndlessConfig {
  baseSpawnRate: number; // units/s at t=0
  spawnRateRampPerMin: number; // +units/s per minute
  maxSpawnRate: number; // hard cap
  baseSpeed: number; // m/s
  speedRampPerMin: number; // +m/s per minute
  maxSpeed: number; // m/s
  maxRedUnits: number; // active red units cap
}

export const DEFAULT_ENDLESS_CONFIG: EndlessConfig = {
  baseSpawnRate: CONFIG.ENDLESS.BASE_SPAWN_RATE,
  spawnRateRampPerMin: CONFIG.ENDLESS.SPAWN_RATE_RAMP_PER_MIN,
  maxSpawnRate: CONFIG.ENDLESS.MAX_SPAWN_RATE,
  baseSpeed: CONFIG.ENDLESS.BASE_SPEED,
  speedRampPerMin: CONFIG.ENDLESS.SPEED_RAMP_PER_MIN,
  maxSpeed: CONFIG.ENDLESS.MAX_SPEED,
  maxRedUnits: CONFIG.ENDLESS.MAX_RED_UNITS
};

export class EndlessManager {
  public difficultyTime: number = 0; // in seconds
  public spawnTimer: number = 0;
  public kills: number = 0;
  public panelBonusScore: number = 0;
  public bossesDefeated: number = 0;
  public bossSpawnCount: number = 0;
  public nextBossTimeSec: number = CONFIG.ENDLESS_BOSS.INTERVAL_SEC;
  public rng: SeededRNG;
  public config: EndlessConfig;

  constructor(seed: number = 42, config: EndlessConfig = DEFAULT_ENDLESS_CONFIG) {
    // Dedicated isolated RNG stream (Amendment 7: never interferes with campaign determinism)
    this.rng = new SeededRNG(seed + 7777);
    this.config = { ...config };
    this.reset();
  }

  public reset(startAtSeconds: number = 0): void {
    const startSec = Math.max(0, startAtSeconds);
    this.difficultyTime = startSec;
    this.spawnTimer = 0;
    this.kills = 0;
    this.panelBonusScore = 0;
    this.bossesDefeated = 0;

    // Align nextBossTimeSec so ?startAt=SECONDS only spawns the next upcoming boss (no backlog burst)
    const interval = CONFIG.ENDLESS_BOSS.INTERVAL_SEC;
    const passedIntervals = Math.floor(startSec / interval);
    this.bossSpawnCount = passedIntervals;
    this.nextBossTimeSec = (passedIntervals + 1) * interval;
  }

  public getBossCountdownSec(): number {
    return Math.max(0, this.nextBossTimeSec - this.difficultyTime);
  }

  public setStartAt(seconds: number): void {
    this.difficultyTime = Math.max(0, seconds);
  }

  public getSpawnRate(t: number): number {
    const mins = t / 60;
    const rate = this.config.baseSpawnRate + mins * this.config.spawnRateRampPerMin;
    return Math.min(this.config.maxSpawnRate, rate);
  }

  public getUnitSpeed(t: number): number {
    const mins = t / 60;
    const speed = this.config.baseSpeed + mins * this.config.speedRampPerMin;
    return Math.min(this.config.maxSpeed, speed);
  }

  public addScore(bonus: number): void {
    this.panelBonusScore += bonus;
  }

  public getScore(survivalTicks: number): number {
    const survivalSeconds = Math.floor(survivalTicks / 60);
    // Score = survival SECONDS + kills * 10 + panelBonusScore
    return survivalSeconds + this.kills * 10 + this.panelBonusScore;
  }

  public update(dt: number, pool: MobPool, activeRedCount: number): void {
    this.difficultyTime += dt;

    if (activeRedCount >= this.config.maxRedUnits) {
      return;
    }

    const currentRate = this.getSpawnRate(this.difficultyTime);
    const spawnInterval = 1 / currentRate;
    this.spawnTimer += dt;

    const speed = this.getUnitSpeed(this.difficultyTime);

    while (this.spawnTimer >= spawnInterval && activeRedCount < this.config.maxRedUnits) {
      this.spawnTimer -= spawnInterval;

      // Determine unit tier based on difficulty time
      let tier = 0;
      let hp = 1;
      let damage = 1;
      let weight = 1;

      const roll = this.rng.nextFloat();
      if (this.difficultyTime >= 240) {
        // 4+ min: 50% Tier 0, 35% Tier 1, 15% Tier 2
        if (roll < 0.15) {
          tier = 2;
          hp = 3;
          damage = 2;
          weight = 1;
        } else if (roll < 0.50) {
          tier = 1;
          hp = 2;
          damage = 1;
          weight = 1;
        }
      } else if (this.difficultyTime >= 90) {
        // 1.5 - 4 min: 75% Tier 0, 25% Tier 1
        if (roll < 0.25) {
          tier = 1;
          hp = 2;
          damage = 1;
          weight = 1;
        }
      }

      // Centre lane spawn strictly: X in [-1.75, 1.75], Z in [48, 52] (far half, never tunnels)
      const spawnX = this.rng.nextRange(-1.75, 1.75);
      const spawnZ = this.rng.nextRange(48.0, 52.0);

      spawnMob(
        pool,
        spawnX,
        spawnZ,
        0,
        -speed,
        1, // Team 1 (Red)
        tier,
        hp,
        damage,
        weight,
        -1
      );
      activeRedCount++;
    }
  }
}
