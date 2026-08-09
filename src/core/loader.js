import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

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
        // Meshy GLB가 emissiveTexture(=베이스컬러)를 넣어 자체발광함 — 조명 무시로
        // 캐릭터만 밝아지므로 전부 제거 (피격 플래시는 단색 emissive만 사용)
        if (m.emissive) {
          m.emissive.setHex(0x000000);
          m.emissiveMap = null;
          m.needsUpdate = true;
        }
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

// 리깅 GLB 로드: 씬 + 애니메이션 클립 유지 (Meshy rigging/animation 결과물)
const animCache = new Map();
export async function loadAnimated(name, targetHeight) {
  if (!animCache.has(name)) {
    animCache.set(name, loader.loadAsync(`${ASSET_BASE}models/${name}.glb`).then((g) => {
      prepare(g.scene);
      g.scene.traverse((o) => { if (o.isSkinnedMesh) o.frustumCulled = false; });
      return { proto: g.scene, clips: g.animations, targetHeight };
    }));
  }
  return animCache.get(name);
}

// 스킨드 메시 실측 바운즈 — Box3.setFromObject는 본 변형을 무시해서
// (Meshy rig GLB는 Armature scale 0.01 구조) 렌더 크기와 어긋난다.
// 렌더 파이프라인과 동일하게 본 변형 정점을 샘플링해 잰다.
function skinnedBounds(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (o.isSkinnedMesh) {
      const pos = o.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 300));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i);
        o.applyBoneTransform(i, v);
        v.applyMatrix4(o.matrixWorld);
        box.expandByPoint(v);
      }
    } else if (o.isMesh) {
      box.union(new THREE.Box3().setFromObject(o));
    }
  });
  return box;
}

// 스켈레톤 공유 문제 없는 사본 + 정규화 + AnimationMixer 생성
export function instantiateAnimated(asset) {
  const inst = cloneSkinned(asset.proto);
  const box = skinnedBounds(inst);
  const size = box.getSize(new THREE.Vector3());
  const scale = asset.targetHeight / (size.y || 1);
  const center = box.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  inst.scale.setScalar(scale);
  inst.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  wrapper.add(inst);
  const mixer = new THREE.AnimationMixer(inst);
  return { model: wrapper, mixer, clips: asset.clips };
}

// 스킨드 메시용 실루엣 아웃라인 — 본을 따라가는 인버티드 헐 (정적 헐은 애니메이션에 못 씀)
export function addSkinnedOutline(root, thickness = 0.02) {
  const targets = [];
  root.traverse((o) => { if (o.isSkinnedMesh) targets.push(o); });
  for (const o of targets) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, side: THREE.BackSide });
    mat.onBeforeCompile = (s) => {
      // basic 재질 버텍스 셰이더엔 objectNormal이 없음(envMap 전용) — normal 어트리뷰트 직접 사용
      s.vertexShader = s.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed += normal * ${thickness.toFixed(4)};`,
      );
    };
    const outline = new THREE.SkinnedMesh(o.geometry, mat);
    outline.bind(o.skeleton, o.bindMatrix);
    outline.frustumCulled = false;
    o.add(outline);
  }
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
