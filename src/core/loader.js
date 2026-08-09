import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// Meshy GLB 로드 + 정규화: 발밑 원점, 목표 높이 스케일, nearest 필터 (§7.1)
const loader = new GLTFLoader();
const cache = new Map();

export const ASSET_BASE = import.meta.env.BASE_URL;
// GLB 갱신 시 브라우저가 구버전 캐시를 계속 쓰는 문제 방지 — 에셋 수정 시 올릴 것
const MODEL_V = '?v=4';

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
    cache.set(name, loader.loadAsync(`${ASSET_BASE}models/${name}.glb${MODEL_V}`).then((g) => {
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
    animCache.set(name, loader.loadAsync(`${ASSET_BASE}models/${name}.glb${MODEL_V}`).then((g) => {
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
  // 렌더 전 호출 시 boneMatrices가 구본(스케일 변경 반영 전)일 수 있어 강제 갱신
  root.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.update(); });
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

// 머리 본 스케일로 가분수 비율 정합 — 정상 비율 모델의 머리 비중을 주인공과
// 동일한 targetFrac(주인공 실측 0.316)으로 키워 톤앤매너를 맞춘다.
// 재생성 크레딧 없이 런타임에서 해결. 스케일 후 전체 높이를 다시 정규화한다.
export function applyHeadRatio(wrapper, targetFrac, targetHeight) {
  const inst = wrapper.children[0];
  let headBone = null;
  inst.traverse((o) => { if (o.isBone && /^head/i.test(o.name) && !headBone) headBone = o; });
  if (!headBone) return;
  wrapper.updateMatrixWorld(true);
  const box = skinnedBounds(inst);
  const headY = headBone.getWorldPosition(new THREE.Vector3()).y;
  const h = box.max.y - headY;
  const b = headY - box.min.y;
  if (h <= 0 || b <= 0) return;
  const s = (targetFrac * b) / (h * (1 - targetFrac));
  headBone.scale.multiplyScalar(Math.min(3.4, Math.max(0.7, s)));
  // 커진 머리만큼 높이 재정규화 (발밑 원점 유지)
  inst.scale.setScalar(1);
  inst.position.set(0, 0, 0);
  const box2 = skinnedBounds(inst);
  const size = box2.getSize(new THREE.Vector3());
  const scale = targetHeight / (size.y || 1);
  const center = box2.getCenter(new THREE.Vector3());
  inst.scale.setScalar(scale);
  inst.position.set(-center.x * scale, -box2.min.y * scale, -center.z * scale);
}

// 정적(비리깅) 모델 머리 확대 — 상단 startFrac 위 버텍스를 머리 중심 기준으로 키워
// 가분수 비율을 강화한다 (본 없는 GLB용, 지오메트리 제자리 수정 → 클론·아웃라인 공유 안전).
// 목/어깨 경계는 blend 구간으로 부드럽게 이어 크리스 방지. 확대 후 높이 재정규화.
export function inflateHead(wrapper, factor, startFrac, targetHeight) {
  wrapper.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrapper);
  const height = box.max.y - box.min.y;
  const neckY = box.min.y + height * startFrac;
  const blend = height * 0.08;
  // 머리 중심 = 목 위 버텍스 평균 (wrapper 공간)
  const center = new THREE.Vector3();
  let count = 0;
  const v = new THREE.Vector3();
  const seen = new Set();
  wrapper.traverse((o) => {
    if (!o.isMesh || seen.has(o.geometry)) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.y > neckY) { center.add(v); count++; }
    }
  });
  if (!count) return;
  center.divideScalar(count);
  const inv = new THREE.Matrix4();
  wrapper.traverse((o) => {
    if (!o.isMesh || seen.has(o.geometry)) return;
    seen.add(o.geometry);
    inv.copy(o.matrixWorld).invert();
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const t = Math.min(1, Math.max(0, (v.y - neckY) / blend));
      const w = t * t * (3 - 2 * t); // smoothstep
      if (w > 0) {
        v.sub(center).multiplyScalar(1 + (factor - 1) * w).add(center);
        v.applyMatrix4(inv);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
    pos.needsUpdate = true;
    o.geometry.computeBoundingSphere();
  });
  // 커진 머리만큼 전체 높이 재정규화 + 발밑 재접지
  const inst = wrapper.children[0];
  const box2 = new THREE.Box3().setFromObject(wrapper);
  const s = targetHeight / (box2.max.y - box2.min.y || 1);
  inst.scale.multiplyScalar(s);
  wrapper.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(wrapper);
  const c = box3.getCenter(new THREE.Vector3());
  inst.position.x -= c.x;
  inst.position.z -= c.z;
  inst.position.y -= box3.min.y;
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
