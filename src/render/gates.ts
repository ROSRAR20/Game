import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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

    // Check if opaque styling is requested (e.g. side-lane +1 panels)
    if (kind === 'add' && value === 1) {
      ctx.clearRect(0, 0, 256, 128);
      // Solid opaque cyber-blue background panel
      ctx.fillStyle = '#0369a1';
      ctx.beginPath();
      ctx.roundRect(8, 8, 240, 112, 16);
      ctx.fill();

      // Sharp solid neon cyan border
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();

      // Bold opaque white numeral
      ctx.font = 'bold 62px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 10;
      ctx.fillText('+1', 128, 64);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      GateRenderer.textureCache.set(key, texture);
      return texture;
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

    const isOpaque = kind === 'add' && value === 1;
    const texture = GateRenderer.getOrCreateGateTexture(kind, value);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: !isOpaque,
      opacity: 1.0,
      side: THREE.DoubleSide,
      depthWrite: isOpaque
    });

    GateRenderer.materialCache.set(key, material);
    return material;
  }

  /**
   * Instantiates flat banner meshes for the provided level gates.
   * Batches multiple identical gates (e.g. side-lane +1 column) into InstancedMesh (1 draw call).
   */
  public buildGates(gates: readonly Gate[]): void {
    this.dispose();

    // 1. Merge ALL gate ground energy lines into exactly 1 draw call!
    const lineGeometries: THREE.BufferGeometry[] = [];
    for (const gate of gates) {
      const lg = new THREE.PlaneGeometry(gate.width, 0.15);
      lg.rotateX(-Math.PI / 2);
      lg.translate(gate.x, 0.05, gate.z);
      lineGeometries.push(lg);
    }
    if (lineGeometries.length > 0) {
      const mergedLineGeo = BufferGeometryUtils.mergeGeometries(lineGeometries, false);
      for (const lg of lineGeometries) {
        lg.dispose();
      }
      if (mergedLineGeo) {
        const lineMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: false
        });
        const linesMesh = new THREE.Mesh(mergedLineGeo, lineMat);
        this.scene.add(linesMesh);
        this.gateMeshes.push(linesMesh);
      }
    }

    // 2. Group banners by signature: `${kind}_${value}_${width}`
    const groups: Map<string, Gate[]> = new Map();
    for (const gate of gates) {
      const sig = `${gate.kind}_${gate.value}_${gate.width}`;
      const list = groups.get(sig) || [];
      list.push(gate);
      groups.set(sig, list);
    }

    const dummyMatrix = new THREE.Matrix4();
    const dummyRot = new THREE.Matrix4().makeRotationY(Math.PI);

    for (const list of groups.values()) {
      const sample = list[0];
      const bannerGeo = new THREE.PlaneGeometry(sample.width, CONFIG.GATES.HEIGHT);
      const bannerMat = GateRenderer.getOrCreateMaterial(sample.kind, sample.value);

      if (list.length > 1) {
        // Render identical banners as an InstancedMesh (1 draw call)
        bannerGeo.boundingSphere = new THREE.Sphere(
          new THREE.Vector3(sample.x, CONFIG.GATES.BANNER_Y, list[Math.floor(list.length / 2)].z),
          20.0
        );
        const instancedBanner = new THREE.InstancedMesh(bannerGeo, bannerMat, list.length);
        instancedBanner.frustumCulled = false;

        for (let i = 0; i < list.length; i++) {
          const g = list[i];
          dummyMatrix.makeTranslation(g.x, CONFIG.GATES.BANNER_Y, g.z).multiply(dummyRot);
          instancedBanner.setMatrixAt(i, dummyMatrix);
        }

        instancedBanner.instanceMatrix.needsUpdate = true;
        this.scene.add(instancedBanner);
        this.gateMeshes.push(instancedBanner);
      } else {
        // Single gate banner: standard mesh
        const mesh = new THREE.Mesh(bannerGeo, bannerMat);
        mesh.position.set(sample.x, CONFIG.GATES.BANNER_Y, sample.z);
        mesh.rotation.y = Math.PI;

        this.scene.add(mesh);
        this.gateMeshes.push(mesh);
      }
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
