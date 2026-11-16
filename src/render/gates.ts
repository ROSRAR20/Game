import * as THREE from 'three';
import { Gate, GateKind } from '../sim/gates';
import { CONFIG } from '../config/constants';

/**
 * Gate Banner Renderer.
 * Renders flat banner meshes across road lanes with high-contrast numeral textures
 * generated once per distinct value via an offscreen 2D canvas cache.
 * Follows strict constraints: flat banner meshes only, no arch meshes, no SDF text.
 */
export class GateRenderer {
  private scene: THREE.Scene;
  private gateMeshes: THREE.Mesh[] = [];
  private static textureCache: Map<string, THREE.CanvasTexture> = new Map();
  private static materialCache: Map<string, THREE.MeshBasicMaterial> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Generates or retrieves a cached CanvasTexture for the specified gate modifier.
   * Created strictly once per distinct value.
   */
  private static getOrCreateGateTexture(kind: GateKind, value: number): THREE.CanvasTexture {
    const key = `${kind}_${value}`;
    const cached = GateRenderer.textureCache.get(key);
    if (cached) {
      return cached;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      const fallback = new THREE.CanvasTexture(canvas);
      GateRenderer.textureCache.set(key, fallback);
      return fallback;
    }

    // Determine color theme
    let bgColor = '#0284c7';
    let borderColor = '#38bdf8';
    let label = `+${value}`;

    switch (kind) {
      case 'add':
        bgColor = CONFIG.GATES.COLORS.ADD_BG;
        borderColor = CONFIG.GATES.COLORS.ADD_BORDER;
        label = `+${value}`;
        break;
      case 'mul':
        bgColor = CONFIG.GATES.COLORS.MUL_BG;
        borderColor = CONFIG.GATES.COLORS.MUL_BORDER;
        label = `×${value}`;
        break;
      case 'sub':
        bgColor = CONFIG.GATES.COLORS.SUB_BG;
        borderColor = CONFIG.GATES.COLORS.SUB_BORDER;
        label = `-${value}`;
        break;
      case 'div':
        bgColor = CONFIG.GATES.COLORS.DIV_BG;
        borderColor = CONFIG.GATES.COLORS.DIV_BORDER;
        label = `÷${value}`;
        break;
    }

    // Background panel with rounded corners and translucent gradient
    ctx.clearRect(0, 0, 256, 128);
    const radius = 16;
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 112, radius);

    // Glowing gradient fill
    const grad = ctx.createLinearGradient(0, 8, 0, 120);
    grad.addColorStop(0, bgColor);
    grad.addColorStop(1, 'rgba(11, 15, 25, 0.85)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Vibrant neon border
    ctx.lineWidth = 6;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // High-contrast bold numeral
    ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text glow/shadow
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    GateRenderer.textureCache.set(key, texture);
    return texture;
  }

  /**
   * Retrieves or creates a shared material for this gate type.
   */
  private static getOrCreateMaterial(kind: GateKind, value: number): THREE.MeshBasicMaterial {
    const key = `${kind}_${value}`;
    const cached = GateRenderer.materialCache.get(key);
    if (cached) {
      return cached;
    }

    const texture = GateRenderer.getOrCreateGateTexture(kind, value);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    GateRenderer.materialCache.set(key, material);
    return material;
  }

  /**
   * Instantiates flat banner meshes for the provided level gates.
   * Orients banner meshes around Y to face camera yaw so numerals read upright and unskewed.
   */
  public buildGates(gates: readonly Gate[]): void {
    this.dispose();

    for (const gate of gates) {
      const geometry = new THREE.PlaneGeometry(gate.width, CONFIG.GATES.HEIGHT);
      const material = GateRenderer.getOrCreateMaterial(gate.kind, gate.value);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(gate.x, CONFIG.GATES.BANNER_Y, gate.z);
      // Align banner strictly with the road cross-section (parallel to road X-axis)
      mesh.rotation.y = Math.PI;

      // Add a thin glowing base energy line on the road beneath the gate (parallel to road X-axis)
      const lineGeom = new THREE.PlaneGeometry(gate.width, 0.15);
      lineGeom.rotateX(-Math.PI / 2);
      const lineColor =
        gate.kind === 'mul'
          ? 0x4ade80
          : gate.kind === 'add'
            ? 0x38bdf8
            : 0xf87171;
      const lineMat = new THREE.MeshBasicMaterial({
        color: lineColor,
        transparent: false,
        side: THREE.DoubleSide
      });
      const lineMesh = new THREE.Mesh(lineGeom, lineMat);
      lineMesh.position.set(gate.x, 0.05, gate.z);

      this.scene.add(mesh);
      this.scene.add(lineMesh);
      this.gateMeshes.push(mesh, lineMesh);
    }
  }

  public updateYaw(_cameraYawDeg: number): void {
    for (let i = 0; i < this.gateMeshes.length; i += 2) {
      const banner = this.gateMeshes[i];
      if (banner) {
        banner.rotation.y = Math.PI;
      }
    }
  }

  public dispose(): void {
    for (const mesh of this.gateMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.gateMeshes = [];
  }
}
