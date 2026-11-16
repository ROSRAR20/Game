import * as THREE from 'three';

const MAX_PARTICLES = 300;

export interface ParticleVFXConfig {
  maxParticles?: number;
}

/**
 * High-performance, zero-allocation particle system using a single InstancedMesh.
 * Uses Structure-of-Arrays (SoA) typed arrays and pre-allocated dummy objects.
 */
export class ParticleVFX {
  private mesh: THREE.InstancedMesh;
  private colorsAttr: THREE.InstancedBufferAttribute;

  private activeCount = 0;

  // SoA buffers
  private posX: Float32Array;
  private posY: Float32Array;
  private posZ: Float32Array;
  private velX: Float32Array;
  private velY: Float32Array;
  private velZ: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private baseScale: Float32Array;
  private r: Float32Array;
  private g: Float32Array;
  private b: Float32Array;

  // Reusable dummy objects for zero-allocation transforms
  private dummyObj = new THREE.Object3D();
  private dummyColor = new THREE.Color();

  constructor(scene: THREE.Scene, config?: ParticleVFXConfig) {
    const maxCount = config?.maxParticles ?? MAX_PARTICLES;

    this.posX = new Float32Array(maxCount);
    this.posY = new Float32Array(maxCount);
    this.posZ = new Float32Array(maxCount);
    this.velX = new Float32Array(maxCount);
    this.velY = new Float32Array(maxCount);
    this.velZ = new Float32Array(maxCount);
    this.life = new Float32Array(maxCount);
    this.maxLife = new Float32Array(maxCount);
    this.baseScale = new Float32Array(maxCount);
    this.r = new Float32Array(maxCount);
    this.g = new Float32Array(maxCount);
    this.b = new Float32Array(maxCount);

    const geom = new THREE.PlaneGeometry(0.2, 0.2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.InstancedMesh(geom, mat, maxCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    const colorArray = new Float32Array(maxCount * 3);
    this.colorsAttr = new THREE.InstancedBufferAttribute(colorArray, 3);
    this.colorsAttr.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = this.colorsAttr;

    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  private emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    maxLife: number,
    scale: number,
    r: number,
    g: number,
    b: number
  ): void {
    if (this.activeCount >= MAX_PARTICLES) {
      return; // pool full, skip
    }

    const idx = this.activeCount;
    this.posX[idx] = x;
    this.posY[idx] = y;
    this.posZ[idx] = z;
    this.velX[idx] = vx;
    this.velY[idx] = vy;
    this.velZ[idx] = vz;
    this.life[idx] = maxLife;
    this.maxLife[idx] = maxLife;
    this.baseScale[idx] = scale;
    this.r[idx] = r;
    this.g[idx] = g;
    this.b[idx] = b;

    this.activeCount++;
  }

  /**
   * Spawns quick muzzle flash sparks at cannon barrel tip.
   */
  public spawnMuzzleFlash(x: number, y: number, z: number): void {
    for (let i = 0; i < 4; i++) {
      const vx = (Math.random() - 0.5) * 1.5;
      const vy = (Math.random() - 0.3) * 1.2;
      const vz = 3.0 + Math.random() * 2.5; // blast forward along Z
      this.emit(
        x + (Math.random() - 0.5) * 0.2,
        y + (Math.random() - 0.5) * 0.1,
        z,
        vx,
        vy,
        vz,
        0.08 + Math.random() * 0.06,
        0.25 + Math.random() * 0.15,
        0.4,
        0.8,
        1.0 // cyan flash
      );
    }
  }

  /**
   * Spawns golden-orange combat hit sparks.
   */
  public spawnHitSparks(x: number, y: number, z: number, count = 3): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 3.5;
      const vx = Math.cos(angle) * speed;
      const vy = 1.0 + Math.random() * 2.0;
      const vz = Math.sin(angle) * speed * 0.7;

      this.emit(
        x,
        y + 0.3,
        z,
        vx,
        vy,
        vz,
        0.18 + Math.random() * 0.14,
        0.18 + Math.random() * 0.1,
        1.0,
        0.65 + Math.random() * 0.3,
        0.1 // warm orange/gold
      );
    }
  }

  /**
   * Spawns upward glowing sparkles on gate pass or upgrade pickup.
   */
  public spawnGateSparkles(x: number, y: number, z: number, count = 6, isUpgrade = false): void {
    for (let i = 0; i < count; i++) {
      const vx = (Math.random() - 0.5) * 2.0;
      const vy = 2.5 + Math.random() * 2.0;
      const vz = (Math.random() - 0.5) * 1.5;

      const r = isUpgrade ? 1.0 : 0.2;
      const g = isUpgrade ? 0.85 : 0.9;
      const b = isUpgrade ? 0.2 : 0.9;

      this.emit(
        x + (Math.random() - 0.5) * 1.2,
        y + 0.2,
        z + (Math.random() - 0.5) * 0.6,
        vx,
        vy,
        vz,
        0.35 + Math.random() * 0.25,
        0.22 + Math.random() * 0.12,
        r,
        g,
        b
      );
    }
  }

  /**
   * Spawns a radial explosion burst when a guardian tower or boss is destroyed.
   */
  public spawnExplosion(x: number, y: number, z: number, count = 28): void {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 3.5 + Math.random() * 5.0;

      const vx = Math.sin(phi) * Math.cos(theta) * speed;
      const vy = Math.cos(phi) * speed * 0.8 + 2.0; // bias upwards
      const vz = Math.sin(phi) * Math.sin(theta) * speed;

      const isFire = Math.random() > 0.3;
      const r = 1.0;
      const g = isFire ? 0.4 + Math.random() * 0.4 : 0.8;
      const b = isFire ? 0.05 : 0.4;

      this.emit(
        x + (Math.random() - 0.5) * 0.5,
        y + 0.5 + (Math.random() - 0.5) * 0.5,
        z + (Math.random() - 0.5) * 0.5,
        vx,
        vy,
        vz,
        0.45 + Math.random() * 0.35,
        0.35 + Math.random() * 0.2,
        r,
        g,
        b
      );
    }
  }

  /**
   * Advances particle simulation and updates Three.js InstancedMesh buffers.
   */
  public update(dt: number, camera: THREE.PerspectiveCamera): void {
    const gravity = -9.8;
    let writeIdx = 0;

    for (let i = 0; i < this.activeCount; i++) {
      this.life[i] -= dt;

      if (this.life[i] > 0) {
        // Integrate motion
        this.posX[i] += this.velX[i] * dt;
        this.posY[i] += this.velY[i] * dt;
        this.posZ[i] += this.velZ[i] * dt;
        this.velY[i] += gravity * dt;

        // Ground bounce/dampen
        if (this.posY[i] < 0.1) {
          this.posY[i] = 0.1;
          this.velY[i] = -this.velY[i] * 0.4;
          this.velX[i] *= 0.8;
          this.velZ[i] *= 0.8;
        }

        // Compact into active positions
        if (writeIdx !== i) {
          this.posX[writeIdx] = this.posX[i];
          this.posY[writeIdx] = this.posY[i];
          this.posZ[writeIdx] = this.posZ[i];
          this.velX[writeIdx] = this.velX[i];
          this.velY[writeIdx] = this.velY[i];
          this.velZ[writeIdx] = this.velZ[i];
          this.life[writeIdx] = this.life[i];
          this.maxLife[writeIdx] = this.maxLife[i];
          this.baseScale[writeIdx] = this.baseScale[i];
          this.r[writeIdx] = this.r[i];
          this.g[writeIdx] = this.g[i];
          this.b[writeIdx] = this.b[i];
        }

        // Compute normalized life & fading
        const lifeFraction = this.life[writeIdx] / this.maxLife[writeIdx];
        const currentScale = this.baseScale[writeIdx] * lifeFraction;

        // Face camera (billboard)
        this.dummyObj.position.set(
          this.posX[writeIdx],
          this.posY[writeIdx],
          this.posZ[writeIdx]
        );
        this.dummyObj.quaternion.copy(camera.quaternion);
        this.dummyObj.scale.set(currentScale, currentScale, currentScale);
        this.dummyObj.updateMatrix();

        this.mesh.setMatrixAt(writeIdx, this.dummyObj.matrix);

        // Instance color with fade
        this.dummyColor.setRGB(
          this.r[writeIdx] * lifeFraction,
          this.g[writeIdx] * lifeFraction,
          this.b[writeIdx] * lifeFraction
        );
        this.mesh.setColorAt(writeIdx, this.dummyColor);

        writeIdx++;
      }
    }

    this.activeCount = writeIdx;
    this.mesh.count = this.activeCount;

    if (this.activeCount > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) {
        this.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public clear(): void {
    this.activeCount = 0;
    this.mesh.count = 0;
  }
}

/**
 * Trauma-based screen shake controller for high-impact game events.
 * Keeps camera roll at zero while adding subtle, satisfying micro-displacements.
 */
export class ScreenShake {
  private trauma = 0.0;
  private maxOffset = 0.35; // Maximum world translation offset
  private time = 0.0;

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public update(
    dt: number,
    camera: THREE.PerspectiveCamera,
    basePos: THREE.Vector3
  ): void {
    if (this.trauma <= 0.001) {
      camera.position.copy(basePos);
      return;
    }

    // Decay trauma over time
    this.trauma = Math.max(0.0, this.trauma - dt * 2.2);
    this.time += dt * 35.0; // Shake frequency

    // Non-linear shake intensity (trauma squared)
    const shake = this.trauma * this.trauma;

    // Pseudo-random noise offsets
    const offsetX = Math.sin(this.time) * this.maxOffset * shake;
    const offsetY = Math.cos(this.time * 1.3) * (this.maxOffset * 0.6) * shake;
    const offsetZ = Math.sin(this.time * 0.7) * (this.maxOffset * 0.5) * shake;

    camera.position.set(
      basePos.x + offsetX,
      basePos.y + offsetY,
      basePos.z + offsetZ
    );
  }

  public getTrauma(): number {
    return this.trauma;
  }

  public reset(): void {
    this.trauma = 0.0;
  }
}
