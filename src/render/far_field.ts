import * as THREE from 'three';
import { CONFIG } from '../config/constants';

/**
 * Far-Field Horde Renderer.
 * Renders a flat, opaque quad lying flat on the ground (XZ plane at Y = 0.005)
 * as a visual continuation of the road from Z = 100 to Z = 150 (a horde carpet seen from above).
 * Uses a small, self-made 128x128 tiled texture with mipmaps and strictly no transparency.
 */
export class FarFieldHorde {
  private mesh: THREE.Mesh;
  private texture: THREE.CanvasTexture;
  private geometry: THREE.PlaneGeometry;
  private material: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.texture = FarFieldHorde.createHordeTexture();
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    // Repeat across road width and along the 50-unit length
    this.texture.repeat.set(4, 16);
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const hordeLength = 50;
    this.geometry = new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH, hordeLength, 1, 1);
    this.geometry.rotateX(-Math.PI / 2);
    // Position quad to start at Z = 100 and end at Z = 150
    this.geometry.translate(0, 0.005, 100 + hordeLength / 2);

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: false,
      depthWrite: true
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    scene.add(this.mesh);
  }

  /**
   * Generates a small 128x128 procedural silhouette texture representing
   * a dense crowd of red mob heads/helmets. Strictly opaque.
   */
  private static createHordeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return new THREE.CanvasTexture(canvas);
    }

    // Base dark crimson road/ground fill
    ctx.fillStyle = '#450a0a';
    ctx.fillRect(0, 0, 128, 128);

    // Staggered pattern of red mob silhouettes
    const rows = 8;
    const cols = 8;
    const xStep = 128 / cols;
    const yStep = 128 / rows;

    for (let r = 0; r < rows; r++) {
      const xOffset = (r % 2) * (xStep / 2);
      for (let c = 0; c < cols; c++) {
        const cx = (c * xStep + xOffset + 4) % 128;
        const cy = r * yStep + 4;

        // Outer red mob helmet/head
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Inner highlight
        ctx.fillStyle = '#f87171';
        ctx.beginPath();
        ctx.arc(cx - 1, cy - 1, 3, 0, Math.PI * 2);
        ctx.fill();

        // Dark helmet shadow
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.arc(cx + 1, cy + 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
