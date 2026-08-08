import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Meshy GLB 로드 + 정규화: 발밑 원점, 목표 높이 스케일, nearest 필터 (§7.1)
const loader = new GLTFLoader();
const cache = new Map();

export const ASSET_BASE = import.meta.env.BASE_URL;

function prepare(root) {
  root.traverse((o) => {
    if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map) {
          m.map.minFilter = THREE.NearestFilter;
          m.map.magFilter = THREE.NearestFilter;
          m.map.generateMipmaps = false;
        }
        m.metalness = 0;
        m.roughness = 1;
      }
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
}

async function loadRaw(name) {
  if (!cache.has(name)) {
    cache.set(name, loader.loadAsync(`${ASSET_BASE}models/${name}.glb`).then((g) => {
      prepare(g.scene);
      return g.scene;
    }));
  }
  return cache.get(name);
}

// targetHeight 기준 스케일 정규화 사본 반환 (원점 = 발밑 중앙)
export async function loadModel(name, targetHeight) {
  const raw = await loadRaw(name);
  const inst = raw.clone(true);
  const box = new THREE.Box3().setFromObject(inst);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / (size.y || 1);
  const wrapper = new THREE.Group();
  inst.scale.setScalar(scale);
  const box2 = new THREE.Box3().setFromObject(inst);
  const center = box2.getCenter(new THREE.Vector3());
  inst.position.x -= center.x;
  inst.position.z -= center.z;
  inst.position.y -= box2.min.y;
  wrapper.add(inst);
  return wrapper;
}
