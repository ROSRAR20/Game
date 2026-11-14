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
    // Repeat across road width and along the horde carpet length
    this.texture.repeat.set(4, 10);
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    // Carpet positioned within the top quarter of the framed road area
    // Spans Z from 30 to 65. Exactly matches road width (12 units), no wider than the road.
    const hordeStartZ = CONFIG.HORDE_CARPET.START_Z;
    const hordeLength = CONFIG.HORDE_CARPET.LENGTH;
    this.geometry = new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH, hordeLength, 1, 1);
    this.geometry.rotateX(-Math.PI / 2);
    this.geometry.translate(0, 0.005, hordeStartZ + hordeLength / 2);

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: false,
      depthWrite: true
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    scene.add(this.mesh);
  }

  /**
   * Generates a high-contrast 256x256 procedural silhouette texture representing
   * a dense crowd of red mob heads/helmets with glowing eyes and rim highlights.
   * Reads clearly as an organic swarm crowd rather than a flat slab. Strictly opaque.
   */
  private static createHordeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return new THREE.CanvasTexture(canvas);
    }

    // Deep dark crimson asphalt/ground
    ctx.fillStyle = '#1e0505';
    ctx.fillRect(0, 0, 256, 256);

    // Staggered rows of dense red mob heads and silhouettes
    const rows = 8;
    const cols = 8;
    const xStep = 256 / cols;
    const yStep = 256 / rows;

    for (let r = 0; r < rows; r++) {
      const xOffset = (r % 2) * (xStep / 2);
      for (let c = 0; c < cols; c++) {
        const cx = (c * xStep + xOffset + xStep / 2) % 256;
        const cy = r * yStep + yStep / 2;

        // Dark ground contact shadow
        ctx.fillStyle = '#0a0101';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 8, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mob shoulders / body base
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 5, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Round red mob helmet / head
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 8, 0, Math.PI * 2);
        ctx.fill();

        // Dark helmet edge / contour
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#450a0a';
        ctx.stroke();

        // Bright top specular highlight on helmet
        ctx.fillStyle = '#fca5a5';
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 5, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Glowing hostile eyes (yellow-white slits)
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 1, 1.5, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy - 1, 1.5, 0, Math.PI * 2);
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
