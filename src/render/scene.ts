import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config/constants';

export interface GameScene {
  scene: THREE.Scene;
  roadMesh: THREE.Mesh;
  dispose: () => void;
}

export function createScene(): GameScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.COLORS.SAND);

  // Lighting: crisp directional + ambient (no shadow maps for performance)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
  dirLight.position.set(10, 25, -10);
  scene.add(dirLight);

  // Road surface plane (lying flat on XZ at Y = 0)
  const roadGeometry = new THREE.PlaneGeometry(
    CONFIG.ROAD_WIDTH,
    CONFIG.ROAD_LENGTH,
    1,
    1
  );
  // Rotate plane from XY to XZ
  roadGeometry.rotateX(-Math.PI / 2);
  // Center along Z so it runs from Z = 0 to Z = 100
  roadGeometry.translate(0, 0, CONFIG.ROAD_LENGTH / 2);

  const roadMaterial = new THREE.MeshLambertMaterial({
    color: CONFIG.COLORS.ROAD
  });
  const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
  scene.add(roadMesh);

  // Side curbs / fences along edges (X = -6 and X = +6)
  const curbGeo = new THREE.BoxGeometry(0.3, 0.4, CONFIG.ROAD_LENGTH);
  const curbMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.FENCE });

  const leftCurb = new THREE.Mesh(curbGeo, curbMat);
  leftCurb.position.set(-CONFIG.ROAD_WIDTH / 2, 0.2, CONFIG.ROAD_LENGTH / 2);
  scene.add(leftCurb);

  const rightCurb = new THREE.Mesh(curbGeo, curbMat);
  rightCurb.position.set(CONFIG.ROAD_WIDTH / 2, 0.2, CONFIG.ROAD_LENGTH / 2);
  scene.add(rightCurb);

  // --- Three-Lane Road Markings (Merged into 1 geometry for 0 extra draw calls) ---
  const markingGeos: THREE.BufferGeometry[] = [];

  // 1. Lane divider X = -2.0 for Near half (Z = 0..22)
  const div1 = new THREE.PlaneGeometry(0.12, 22.0);
  div1.rotateX(-Math.PI / 2);
  div1.translate(-2.0, 0.015, 11.0);
  markingGeos.push(div1);

  // 2. Lane divider X = +2.0 for Near half (Z = 0..22)
  const div2 = new THREE.PlaneGeometry(0.12, 22.0);
  div2.rotateX(-Math.PI / 2);
  div2.translate(2.0, 0.015, 11.0);
  markingGeos.push(div2);

  // 3. Transverse mid-line at Z = 22.0 across full road width
  const midLine = new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH, 0.25);
  midLine.rotateX(-Math.PI / 2);
  midLine.translate(0, 0.02, 22.0);
  markingGeos.push(midLine);

  // 4. Center dashed line for Far half (Z = 22..100)
  const farCenter = new THREE.PlaneGeometry(0.2, CONFIG.ROAD_LENGTH - 22.0);
  farCenter.rotateX(-Math.PI / 2);
  farCenter.translate(0, 0.015, 22.0 + (CONFIG.ROAD_LENGTH - 22.0) / 2);
  markingGeos.push(farCenter);

  const mergedMarkings = BufferGeometryUtils.mergeGeometries(markingGeos, false);
  let laneMesh: THREE.Mesh | null = null;
  if (mergedMarkings) {
    const laneMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8, // clean crisp asphalt road marking
      transparent: false
    });
    laneMesh = new THREE.Mesh(mergedMarkings, laneMat);
    scene.add(laneMesh);
  }

  // Cannon start line indicator at Z = CANNON_Z (opaque)
  const startLineGeo = new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH, 0.15);
  startLineGeo.rotateX(-Math.PI / 2);
  startLineGeo.translate(0, 0.022, CONFIG.CANNON_Z);
  const startLineMat = new THREE.MeshBasicMaterial({
    color: CONFIG.COLORS.ROAD_EDGE,
    transparent: false
  });
  const startLine = new THREE.Mesh(startLineGeo, startLineMat);
  scene.add(startLine);

  // --- Static 3D Stone Tunnel Portals at Road Edges (X = ±6.0, Z = 22.0) ---
  const stoneColor = new THREE.Color(0x475569);
  const darkInteriorColor = new THREE.Color(0x020617);
  const tunnelBoxes: THREE.BufferGeometry[] = [];

  const addColorBox = (
    w: number,
    h: number,
    d: number,
    col: THREE.Color,
    tx: number,
    ty: number,
    tz: number
  ) => {
    const b = new THREE.BoxGeometry(w, h, d);
    b.translate(tx, ty, tz);
    const count = b.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    b.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    tunnelBoxes.push(b);
  };

  // Right Road Edge Portal (X = -6.0, Z = 22.0)
  addColorBox(0.5, 3.2, 1.2, stoneColor, -6.45, 1.6, 22.0); // outer pillar
  addColorBox(0.4, 3.2, 1.2, stoneColor, -5.55, 1.6, 22.0); // inner pillar
  addColorBox(1.6, 0.6, 1.4, stoneColor, -6.0, 3.5, 22.0);  // arch lintel
  addColorBox(0.6, 2.8, 0.2, darkInteriorColor, -6.0, 1.5, 22.0); // dark interior mouth

  // Left Road Edge Portal (X = +6.0, Z = 22.0)
  addColorBox(0.4, 3.2, 1.2, stoneColor, 5.55, 1.6, 22.0);  // inner pillar
  addColorBox(0.5, 3.2, 1.2, stoneColor, 6.45, 1.6, 22.0);  // outer pillar
  addColorBox(1.6, 0.6, 1.4, stoneColor, 6.0, 3.5, 22.0);   // arch lintel
  addColorBox(0.6, 2.8, 0.2, darkInteriorColor, 6.0, 1.5, 22.0); // dark interior mouth

  let tunnelMesh: THREE.Mesh | null = null;
  const mergedTunnelGeo = BufferGeometryUtils.mergeGeometries(tunnelBoxes, false);
  if (mergedTunnelGeo) {
    mergedTunnelGeo.computeVertexNormals();
    const tunnelMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    tunnelMesh = new THREE.Mesh(mergedTunnelGeo, tunnelMat);
    scene.add(tunnelMesh);
  }

  // Dev-only ?debugLanes overlay: draws L / C / R ground markers
  const isDebugLanes =
    typeof window !== 'undefined' &&
    window.location &&
    new URLSearchParams(window.location.search).has('debugLanes');

  if (isDebugLanes) {
    // L / C / R lane markers painted on the road at Z = 7.5
    // Screen Left (Option a: world X = +4.0), Centre (X = 0.0), Screen Right (Option a: world X = -4.0)
    const createLaneMarker = (letter: string, x: number, z: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(64, 64, 56, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#facc15';
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 72px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, 64, 66);
      }
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      const geo = new THREE.PlaneGeometry(2.0, 2.0);
      geo.rotateX(-Math.PI / 2);
      geo.translate(x, 0.03, z);
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
    };

    createLaneMarker('L', 4.0, 7.5);
    createLaneMarker('C', 0.0, 7.5);
    createLaneMarker('R', -4.0, 7.5);
  }

  const dispose = () => {
    roadGeometry.dispose();
    roadMaterial.dispose();
    curbGeo.dispose();
    curbMat.dispose();
    if (mergedMarkings) mergedMarkings.dispose();
    if (laneMesh) (laneMesh.material as THREE.Material).dispose();
    startLineGeo.dispose();
    startLineMat.dispose();
    if (mergedTunnelGeo) mergedTunnelGeo.dispose();
    if (tunnelMesh) (tunnelMesh.material as THREE.Material).dispose();
  };

  return { scene, roadMesh, dispose };
}
