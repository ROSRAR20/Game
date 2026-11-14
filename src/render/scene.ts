import * as THREE from 'three';
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

  // Center dashed line or lane dividers (opaque, no transparent passes)
  const laneGeo = new THREE.PlaneGeometry(0.2, CONFIG.ROAD_LENGTH);
  laneGeo.rotateX(-Math.PI / 2);
  laneGeo.translate(0, 0.01, CONFIG.ROAD_LENGTH / 2);
  const laneMat = new THREE.MeshBasicMaterial({
    color: CONFIG.COLORS.ROAD_MARKING,
    transparent: false
  });
  const laneMesh = new THREE.Mesh(laneGeo, laneMat);
  scene.add(laneMesh);

  // Cannon start line indicator at Z = CANNON_Z (opaque)
  const startLineGeo = new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH, 0.15);
  startLineGeo.rotateX(-Math.PI / 2);
  startLineGeo.translate(0, 0.015, CONFIG.CANNON_Z);
  const startLineMat = new THREE.MeshBasicMaterial({
    color: CONFIG.COLORS.ROAD_EDGE,
    transparent: false
  });
  const startLine = new THREE.Mesh(startLineGeo, startLineMat);
  scene.add(startLine);

  const dispose = () => {
    roadGeometry.dispose();
    roadMaterial.dispose();
    curbGeo.dispose();
    curbMat.dispose();
    laneGeo.dispose();
    laneMat.dispose();
    startLineGeo.dispose();
    startLineMat.dispose();
  };

  return { scene, roadMesh, dispose };
}
