import { LevelWaves, WaveItem } from '../data/waves';
import { MobPool, spawnMob } from './pool';
import { SeededRNG } from './rng';
import { CONFIG } from '../config/constants';

export class WaveManager {
  public waves: LevelWaves;
  public elapsedSec: number = 0;
  public currentWaveIdx: number = 0;

  constructor(waves: LevelWaves = []) {
    this.waves = waves;
    this.elapsedSec = 0;
    this.currentWaveIdx = 0;
  }

  public setWaves(waves: LevelWaves): void {
    this.waves = waves;
    this.reset();
  }

  public reset(): void {
    this.elapsedSec = 0;
    this.currentWaveIdx = 0;
  }

  /**
   * Advances wave timeline using fixed simulation dt.
   * Spawns red units (Team 1) when trigger times are reached.
   * Zero heap allocations during frame tick.
   */
  public update(dt: number, pool: MobPool, rng: SeededRNG): void {
    this.elapsedSec += dt;

    while (
      this.currentWaveIdx < this.waves.length &&
      this.elapsedSec >= this.waves[this.currentWaveIdx].triggerTimeSec
    ) {
      const wave: WaveItem = this.waves[this.currentWaveIdx];
      this.spawnWave(wave, pool, rng);
      this.currentWaveIdx++;
    }
  }

  private spawnWave(wave: WaveItem, pool: MobPool, rng: SeededRNG): void {
    const maxZ = Math.min(CONFIG.ROAD_Z_MAX - 1.0, wave.spawnZ + 2.5);
    for (let i = 0; i < wave.count; i++) {
      const x = rng.nextRange(wave.minX, wave.maxX);
      const z = rng.nextRange(wave.spawnZ, maxZ);
      spawnMob(
        pool,
        x,
        z,
        0, // vx
        -wave.speed, // vz (moves toward base at Z=0)
        1, // team 1 = Red
        wave.tier,
        1, // hp
        1, // damage
        wave.weight
      );
    }
  }

  public isAllWavesSpawned(): boolean {
    return this.currentWaveIdx >= this.waves.length;
  }
}
