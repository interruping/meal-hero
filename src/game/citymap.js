import * as THREE from 'three';
import { terrainHeight } from './heightfield.js';
import { tex, sharedMat } from './textures.js';

// 서울 빌라촌 맵 (§5). 격자 골목 + 언덕 + 계단 샛길 + 남쪽 상가골목.
// 모든 가시 오브젝트는 gpt-image-2 텍스처 또는 Meshy 모델 (§7.10 단색 박스 금지).

export const MAP_HALF = 85;
export const STREETS = [-66, -33, 0, 33, 66]; // x·z 공통 격자
export const ROAD_HALF = 3;
export const SHOP_Z = 76; // 상가골목 중심선

// 계단 샛길: 블록 관통 통로. 볼라드로 탈것 차단(점프로 통과)
const STAIR_PASSAGES = [
  { x: 16.5, z0: -66, z1: -33 },
  { x: -49.5, z0: 0, z1: 33 },
];

// 빌라 타입 12종: 파사드 텍스처 + 층수 고정 (AC-17 실루엣·파사드 구분)
const VILLA_TYPES = [
  { tex: 'villa-01', floors: 3 },
  { tex: 'villa-02', floors: 4 },
  { tex: 'villa-03', floors: 2 },
  { tex: 'villa-04', floors: 3 },
  { tex: 'villa-05', floors: 4 },
  { tex: 'villa-06', floors: 3 },
  { tex: 'villa-07', floors: 2 }, // 옥탑방
  { tex: 'villa-08', floors: 4 },
  { tex: 'villa-09', floors: 3 },
  { tex: 'villa-10', floors: 3 },
  { tex: 'villa-11', floors: 4 },
  { tex: 'villa-12', floors: 2 },
];

const SHOP_DEFS = [
  { tex: 'shop-chicken', name: '치킨집' },
  { tex: 'shop-chinese', name: '중국집' },
  { tex: 'shop-bunsik', name: '분식집' },
  { tex: 'shop-convenience', name: '편의점' },
  { tex: 'shop-pizza', name: '피자집' },
  { tex: 'shop-jokbal', name: '족발집' },
  { tex: 'shop-cafe', name: '카페' },
  { tex: 'shop-dosirak', name: '도시락집' },
  { tex: 'shop-tteokbokki', name: '떡볶이집' },
  { tex: 'shop-burger', name: '버거집' },
];

function makeCollider(mesh, pad = 0) {
  const box = new THREE.Box3().setFromObject(mesh);
  return {
    minX: box.min.x - pad, maxX: box.max.x + pad,
    minY: box.min.y, maxY: box.max.y,
    minZ: box.min.z - pad, maxZ: box.max.z + pad,
  };
}

function buildTerrain() {
  const size = MAP_HALF * 2 + 60;
  const seg = 110;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  // UV를 월드 좌표 기반 타일링으로
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, pos.getX(i) / 7, pos.getZ(i) / 7);
  }
  const mat = new THREE.MeshLambertMaterial({ flatShading: true, map: tex('ground-spring') });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  return mesh;
}

function roadStrip(cx, cz, w, len, alongZ) {
  const seg = Math.ceil(len / 2);
  const geo = alongZ
    ? new THREE.PlaneGeometry(w, len, 1, seg)
    : new THREE.PlaneGeometry(len, w, seg, 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = cx + pos.getX(i);
    const z = cz + pos.getZ(i);
    pos.setX(i, x);
    pos.setY(i, terrainHeight(x, z) + 0.04);
    pos.setZ(i, z);
  }
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    uv.setXY(i, (alongZ ? x : z) / (w), (alongZ ? z : x) / 8);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex('road-spring') }));
}

function buildRoads() {
  const group = new THREE.Group();
  group.name = 'roads';
  for (const s of STREETS) {
    group.add(roadStrip(s, 0, ROAD_HALF * 2, MAP_HALF * 2, true));
    group.add(roadStrip(0, s, ROAD_HALF * 2, MAP_HALF * 2, false));
  }
  group.add(roadStrip(0, SHOP_Z - 3, 10, 150, false));
  return group;
}

let villaSeq = 0;
function buildVilla(cx, cz, faceDir /* +1: 동쪽(+x), -1: 서쪽(-x) */) {
  const type = VILLA_TYPES[villaSeq % VILLA_TYPES.length];
  villaSeq++;
  const w = 9 + (villaSeq % 3); // 파사드 폭
  const d = 9 + ((villaSeq * 7) % 3);
  const h = type.floors * 2.9;

  // 지형 4귀퉁이 최저점에 바닥을 맞춰 파묻힘 최소화
  const corners = [
    terrainHeight(cx - w / 2, cz - d / 2), terrainHeight(cx + w / 2, cz - d / 2),
    terrainHeight(cx - w / 2, cz + d / 2), terrainHeight(cx + w / 2, cz + d / 2),
  ];
  const base = Math.min(...corners) - 0.25;

  const facade = sharedMat(type.tex);
  const side = sharedMat('villa-side');
  const back = sharedMat('villa-side-2');
  const roof = sharedMat('shared-concrete', { repeatX: 2, repeatY: 2 });
  // BoxGeometry 면 순서: +x, -x, +y, -y, +z, -z
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roof, roof, facade, back]);
  body.position.set(cx, base + h / 2, cz);
  body.rotation.y = faceDir > 0 ? Math.PI / 2 : -Math.PI / 2; // +z(파사드)가 골목쪽으로
  body.userData.buildingType = type.tex;

  const group = new THREE.Group();
  group.add(body);

  // 옥상 물탱크
  if (villaSeq % 5 !== 2) {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 1.5, 10),
      sharedMat('prop-watertank'),
    );
    tank.position.set(cx + ((villaSeq % 3) - 1) * w * 0.25, base + h + 0.75, cz + ((villaSeq % 2) - 0.5) * d * 0.3);
    group.add(tank);
  }

  const doorX = cx + faceDir * (Math.max(w, d) / 2 + 0.7);
  return {
    group, body, w, d, h, cx, cz, base,
    door: new THREE.Vector3(doorX, terrainHeight(doorX, cz), cz),
    faceDir,
  };
}

export function buildCity(scene) {
  villaSeq = 0;
  const root = new THREE.Group();
  root.name = 'city';
  const colliders = [];
  const doors = [];
  const shops = [];
  const buildingMeshes = [];
  const villas = [];

  let seed = 12345;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const terrain = buildTerrain();
  root.add(terrain);
  const roads = buildRoads();
  root.add(roads);

  // 블록마다 빌라 2×2 (계단 통로·공터 제외)
  for (let bi = 0; bi < STREETS.length - 1; bi++) {
    for (let bj = 0; bj < STREETS.length - 1; bj++) {
      const x0 = STREETS[bi] + ROAD_HALF;
      const x1 = STREETS[bi + 1] - ROAD_HALF;
      const z0 = STREETS[bj] + ROAD_HALF;
      const z1 = STREETS[bj + 1] - ROAD_HALF;
      const stair = STAIR_PASSAGES.find(
        (s) => s.x > x0 - 5 && s.x < x1 + 5 && Math.abs(s.z0 - STREETS[bj]) < 1,
      );
      for (let ui = 0; ui < 2; ui++) {
        for (let uj = 0; uj < 2; uj++) {
          const cx = x0 + (x1 - x0) * (0.25 + ui * 0.5);
          const cz = z0 + (z1 - z0) * (0.25 + uj * 0.5);
          if (stair && Math.abs(cx - stair.x) < 7) continue;
          if (rng() < 0.08) continue; // 공터
          const faceDir = ui === 0 ? -1 : 1; // 바깥 골목쪽 현관
          const villa = buildVilla(cx, cz, faceDir);
          root.add(villa.group);
          colliders.push(makeCollider(villa.body));
          buildingMeshes.push(villa.body);
          villas.push(villa);
          doors.push({ pos: villa.door, name: `빌라 ${doors.length + 1}호` });
        }
      }
    }
  }

  // 계단 샛길: 스텝(석재 텍스처) + 볼라드
  const stepMat = sharedMat('prop-scaffold-stairs');
  const bollardMat = sharedMat('prop-bollard');
  const railMat = sharedMat('prop-railing', { repeatX: 3, repeatY: 0.5 });
  for (const s of STAIR_PASSAGES) {
    const steps = 26;
    for (let i = 0; i < steps; i++) {
      const z = s.z0 + ((i + 0.5) / steps) * (s.z1 - s.z0);
      const y = terrainHeight(s.x, z);
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.2, Math.abs(s.z1 - s.z0) / steps + 0.06),
        stepMat,
      );
      step.position.set(s.x, y + 0.1, z);
      root.add(step);
    }
    // 난간 (계단 양측)
    for (const off of [-1.35, 1.35]) {
      const segCount = 6;
      for (let i = 0; i < segCount; i++) {
        const zs = s.z0 + ((i + 0.5) / segCount) * (s.z1 - s.z0);
        const y = terrainHeight(s.x + off, zs);
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.9, Math.abs(s.z1 - s.z0) / segCount),
          railMat,
        );
        rail.position.set(s.x + off, y + 0.85, zs);
        root.add(rail);
      }
    }
    for (const zEnd of [s.z0 + 1, s.z1 - 1]) {
      for (const off of [-0.9, 0, 0.9]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.55, 8), bollardMat);
        const y = terrainHeight(s.x + off, zEnd);
        b.position.set(s.x + off, y + 0.27, zEnd);
        root.add(b);
        colliders.push({
          minX: s.x + off - 0.16, maxX: s.x + off + 0.16,
          minY: y, maxY: y + 0.55,
          minZ: zEnd - 0.16, maxZ: zEnd + 0.16,
        });
      }
    }
  }

  // 남쪽 상가 (픽업 지점): 전면 간판 텍스처
  const shopSide = sharedMat('villa-side-2');
  const shopRoof = sharedMat('shared-concrete', { repeatX: 2, repeatY: 2 });
  for (let i = 0; i < SHOP_DEFS.length; i++) {
    const def = SHOP_DEFS[i];
    const sx = -67 + i * 15;
    const sz = SHOP_Z + 6;
    const y = terrainHeight(sx, sz);
    const front = sharedMat(def.tex);
    const shop = new THREE.Mesh(
      new THREE.BoxGeometry(12, 4.6, 8),
      [shopSide, shopSide, shopRoof, shopRoof, front, shopSide],
    );
    shop.position.set(sx, y + 2.3 - 0.4, sz);
    shop.rotation.y = Math.PI; // 전면이 -z(마을쪽)
    shop.userData.buildingType = def.tex;
    root.add(shop);
    colliders.push(makeCollider(shop));
    buildingMeshes.push(shop);
    const frontZ = sz - 4.7;
    shops.push({ pos: new THREE.Vector3(sx, terrainHeight(sx, frontZ), frontZ), name: def.name });
  }

  // 외곽 경계 담 (벽돌 텍스처)
  const fenceMat = sharedMat('shared-brick', { repeatX: 4, repeatY: 1 });
  const F = MAP_HALF;
  const fenceDefs = [
    { x: 0, z: -F, w: F * 2, d: 1 },
    { x: 0, z: F, w: F * 2, d: 1 },
    { x: -F, z: 0, w: 1, d: F * 2 },
    { x: F, z: 0, w: 1, d: F * 2 },
  ];
  for (const f of fenceDefs) {
    const seg = 16;
    for (let i = 0; i < seg; i++) {
      const t = (i + 0.5) / seg - 0.5;
      const x = f.x + (f.w > 2 ? t * f.w : 0);
      const z = f.z + (f.d > 2 ? t * f.d : 0);
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(f.w > 2 ? f.w / seg + 0.1 : 1, 2.2, f.d > 2 ? f.d / seg + 0.1 : 1),
        fenceMat,
      );
      wall.position.set(x, terrainHeight(x, z) + 1.1 - 0.3, z);
      root.add(wall);
      colliders.push(makeCollider(wall));
    }
  }

  scene.add(root);

  return {
    root,
    terrain,
    roads,
    colliders,
    doors,
    shops,
    buildingMeshes,
    villas,
    stairPassages: STAIR_PASSAGES,
    groundHeight: terrainHeight,
    spawn: new THREE.Vector3(0, terrainHeight(0, 70), 70),
    rng,
  };
}
