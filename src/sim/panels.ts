import { SeededRNG } from './rng';
import { CannonSim } from './cannon';
import { CONFIG } from '../config/constants';

export interface MovingPanel {
  id: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  speed: number;
  value: number;
  isCollected: boolean;
}

export interface PanelCollisionResult {
  collectedCount: number;
  newShooterCount: number;
  bonusScoreAwarded: number;
}

export class PanelManager {
  public panels: MovingPanel[] = [];
  public rng: SeededRNG;
  public spawnTimer: number = 0;
  private nextId: number = 1;

  constructor(seed: number = 42) {
    // Dedicated isolated RNG stream (Amendment: identical seeds produce identical panel spawns)
    this.rng = new SeededRNG(seed + 8888);
  }

  public reset(): void {
    this.panels = [];
    this.spawnTimer = 0;
    this.nextId = 1;
  }

  public getSpawnInterval(difficultyTime: number): number {
    const mins = difficultyTime / 60;
    // Interval scales gently from BASE_INTERVAL (12s) down to MIN_INTERVAL (6s)
    const interval = CONFIG.PANELS.BASE_INTERVAL - mins * 1.0;
    return Math.max(CONFIG.PANELS.MIN_INTERVAL, interval);
  }

  public spawnPanel(): MovingPanel {
    // Left Tunnel mouth (Screen Left: world X in [2, 6], centered around X = 4.0)
    // Add small random jitter in X within the Left lane corridor
    const jitterX = this.rng.nextRange(-0.4, 0.4);
    const spawnX = CONFIG.PANELS.SPAWN_X + jitterX;

    const panel: MovingPanel = {
      id: this.nextId++,
      x: spawnX,
      z: CONFIG.PANELS.SPAWN_Z,
      width: CONFIG.PANELS.WIDTH,
      depth: CONFIG.PANELS.DEPTH,
      speed: CONFIG.PANELS.SPEED,
      value: 1,
      isCollected: false
    };
    this.panels.push(panel);
    return panel;
  }

  public update(
    dt: number,
    difficultyTime: number,
    cannon: CannonSim
  ): PanelCollisionResult {
    let bonusScoreAwarded = 0;
    let collectedCount = 0;

    // 1. Spawner progression
    this.spawnTimer += dt;
    const interval = this.getSpawnInterval(difficultyTime);
    if (this.spawnTimer >= interval) {
      this.spawnTimer -= interval;
      this.spawnPanel();
    }

    // 2. Step panel movement and collision
    const cluster = cannon.getClusterBounds();

    for (let i = this.panels.length - 1; i >= 0; i--) {
      const p = this.panels[i];
      p.z -= p.speed * dt;

      // Check collision ONLY with the cannon cluster (shots/blue mobs pass through)
      const pMinX = p.x - p.width / 2;
      const pMaxX = p.x + p.width / 2;
      const pMinZ = p.z - p.depth / 2;
      const pMaxZ = p.z + p.depth / 2;

      const overlapsX = cluster.minX <= pMaxX && cluster.maxX >= pMinX;
      const overlapsZ = cluster.minZ <= pMaxZ && cluster.maxZ >= pMinZ;

      if (overlapsX && overlapsZ) {
        p.isCollected = true;
        collectedCount++;

        if (cannon.cannonCount < CONFIG.PANELS.MAX_CANNON_COUNT) {
          cannon.setCannonCount(cannon.cannonCount + 1);
        } else {
          // At cap of 6 shooters, award +250 score
          bonusScoreAwarded += CONFIG.PANELS.SCORE_AT_MAX;
        }

        this.panels.splice(i, 1);
        continue;
      }

      // Despawn once safely behind the cannon line without penalty
      if (p.z <= CONFIG.PANELS.DESPAWN_Z - 0.5) {
        this.panels.splice(i, 1);
      }
    }

    return {
      collectedCount,
      newShooterCount: cannon.cannonCount,
      bonusScoreAwarded
    };
  }
}
