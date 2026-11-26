import * as THREE from 'three';
import { MovingPanel } from '../sim/panels';
import { CONFIG } from '../config/constants';

/**
 * Moving +1 Panels Renderer (Stage 3).
 * Renders moving +1 upgrade panels in the left lane using a single InstancedMesh
 * for 1 total draw call.
 */
export class PanelRenderer {
  private scene: THREE.Scene;
  private instancedMesh: THREE.InstancedMesh;
  private dummy: THREE.Object3D;
  private texture: THREE.CanvasTexture;
  private material: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, maxPanels: number = 8) {
    this.scene = scene;
    this.dummy = new THREE.Object3D();

    this.texture = PanelRenderer.createPanelTexture();
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const geometry = new THREE.PlaneGeometry(CONFIG.PANELS.WIDTH, CONFIG.PANELS.HEIGHT);

    this.instancedMesh = new THREE.InstancedMesh(geometry, this.material, maxPanels);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.count = 0;
    this.instancedMesh.frustumCulled = false;

    this.scene.add(this.instancedMesh);
  }

  private static createPanelTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return new THREE.CanvasTexture(canvas);
    }

    ctx.clearRect(0, 0, 512, 256);

    // Glowing bright cyan rounded panel
    const radius = 32;
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 224, radius);

    const grad = ctx.createLinearGradient(0, 16, 0, 240);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(1, 'rgba(8, 47, 73, 0.96)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 10;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // High-contrast, massive "+1" label readable at a glance
    ctx.font = '900 116px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('+1', 256, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  public update(panels: readonly MovingPanel[]): void {
    const count = panels.length;
    this.instancedMesh.count = count;

    for (let i = 0; i < count; i++) {
      const p = panels[i];
      // Floating bob animation based on Z position centered around BANNER_Y
      const bobY = CONFIG.PANELS.BANNER_Y + Math.sin(p.z * 2.0) * 0.08;
      this.dummy.position.set(p.x, bobY, p.z);
      this.dummy.rotation.set(0, Math.PI, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.scene.remove(this.instancedMesh);
    this.instancedMesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
