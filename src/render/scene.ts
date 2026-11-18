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

  // Side curbs / fences along edges (X = -6 and X = +6) merged into 1 mesh
  const leftCurbGeo = new THREE.BoxGeometry(0.3, 0.4, CONFIG.ROAD_LENGTH);
  leftCurbGeo.translate(-CONFIG.ROAD_WIDTH / 2, 0.2, CONFIG.ROAD_LENGTH / 2);

  const rightCurbGeo = new THREE.BoxGeometry(0.3, 0.4, CONFIG.ROAD_LENGTH);
  rightCurbGeo.translate(CONFIG.ROAD_WIDTH / 2, 0.2, CONFIG.ROAD_LENGTH / 2);

  const mergedCurbsGeo = BufferGeometryUtils.mergeGeometries([leftCurbGeo, rightCurbGeo], false);
  leftCurbGeo.dispose();
  rightCurbGeo.dispose();

  const curbMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.FENCE });
  const curbsMesh = new THREE.Mesh(mergedCurbsGeo || new THREE.BufferGeometry(), curbMat);
  scene.add(curbsMesh);

  // Center dashed line and start line merged into 1 mesh
  const laneGeo = new THREE.PlaneGeometry(0.2, CONFIG.ROAD_LENGTH);
  laneGeo.rotateX(-Math.PI / 2);
  laneGeo.translate(0, 0.01, CONFIG.ROAD_LENGTH / 2);

  const startLineGeo = new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH, 0.15);
  startLineGeo.rotateX(-Math.PI / 2);
  startLineGeo.translate(0, 0.015, CONFIG.CANNON_Z);

  const mergedMarkingsGeo = BufferGeometryUtils.mergeGeometries([laneGeo, startLineGeo], false);
  laneGeo.dispose();
  startLineGeo.dispose();

  const markingsMat = new THREE.MeshBasicMaterial({
    color: CONFIG.COLORS.ROAD_MARKING,
    transparent: false
  });
  const markingsMesh = new THREE.Mesh(mergedMarkingsGeo || new THREE.BufferGeometry(), markingsMat);
  scene.add(markingsMesh);

  const dispose = () => {
    roadGeometry.dispose();
    roadMaterial.dispose();
    mergedCurbsGeo?.dispose();
    curbMat.dispose();
    mergedMarkingsGeo?.dispose();
    markingsMat.dispose();
  };

  return { scene, roadMesh, dispose };
}
