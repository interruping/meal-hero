import * as THREE from 'three';
import { terrainHeight } from './heightfield.js';

// 서울 빌라촌 맵 (§5). 격자 골목 + 언덕 + 계단 샛길 + 남쪽 상가골목.
// 건물·소품은 우선 블록아웃(단색 금지 규칙상 FR-18에서 전부 텍스처 교체).

export const MAP_HALF = 85;
const STREETS = [-66, -33, 0, 33, 66]; // x·z 공통 격자
export const ROAD_HALF = 3;
const SHOP_Z = 76; // 상가골목 중심선

// 계단 샛길: 블록 관통 통로 (x중심, z범위). 볼라드로 탈것 차단(점프로 통과)
const STAIR_PASSAGES = [
  { x: 16.5, z0: -66, z1: -33 },
  { x: -49.5, z0: 0, z1: 33 },
];

const VILLA_COLORS = [0x9a6a58, 0xa67462, 0x8d5f4f, 0xb08a70, 0x97705d];
const SHOP_NAMES = ['치킨집', '중국집', '분식집', '편의점', '피자집', '족발집', '카페', '도시락집', '떡볶이집', '버거집'];

function makeCollider(mesh, pad = 0) {
  const box = new THREE.Box3().setFromObject(mesh);
  return {
    minX: box.min.x - pad, maxX: box.max.x + pad,
    minY: box.min.y, maxY: box.max.y,
    minZ: box.min.z - pad, maxZ: box.max.z + pad,
  };
}

function buildTerrain() {
  const size = MAP_HALF * 2 + 60; // 가장자리 여유 (안개 속으로)
  const seg = 110;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  return mesh;
}

function buildRoads() {
  const group = new THREE.Group();
  group.name = 'roads';
  const mat = new THREE.MeshLambertMaterial();
  // 세로(z방향) 골목
  for (const s of STREETS) {
    const len = MAP_HALF * 2;
    const seg = Math.ceil(len / 2);
    const geo = new THREE.PlaneGeometry(ROAD_HALF * 2, len, 1, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = s + pos.getX(i);
      const z = pos.getZ(i);
      pos.setX(i, x);
      pos.setY(i, terrainHeight(x, z) + 0.04);
    }
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, mat));
  }
  for (const s of STREETS) {
    // 가로 골목: plane을 z축 길이로 쓰기 위해 회전 접근 대신 수동 생성
    const len = MAP_HALF * 2;
    const seg = Math.ceil(len / 2);
    const geo = new THREE.PlaneGeometry(len, ROAD_HALF * 2, seg, 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = s + pos.getZ(i);
      pos.setY(i, terrainHeight(x, z) + 0.04);
      pos.setZ(i, z);
    }
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, mat));
  }
  // 상가골목 (넓은 길)
  {
    const len = 150;
    const seg = 75;
    const geo = new THREE.PlaneGeometry(len, 10, seg, 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = SHOP_Z - 3 + pos.getZ(i);
      pos.setY(i, terrainHeight(x, z) + 0.04);
      pos.setZ(i, z);
    }
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, mat));
  }
  return group;
}

let villaSeq = 0;
function buildVilla(cx, cz, rng) {
  const floors = 2 + Math.floor(rng() * 3); // 2~4층
  const w = 8 + rng() * 3;
  const d = 8 + rng() * 3;
  const h = floors * 2.8;
  const baseY = terrainHeight(cx, cz);
  const group = new THREE.Group();
  const color = VILLA_COLORS[villaSeq % VILLA_COLORS.length];
  villaSeq++;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h + 3, d), // 지형에 3m 묻힘
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.set(cx, baseY + h / 2 - 1.5 + 1.5, cz);
  body.userData.buildingPart = 'villa-body';
  group.add(body);

  // 옥상 물탱크 (노란 원통 — 추후 텍스처)
  if (rng() > 0.4) {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1.6, 10),
      new THREE.MeshLambertMaterial({ color: 0xc9b13b }),
    );
    tank.position.set(cx + (rng() - 0.5) * w * 0.4, baseY + h + 0.8, cz + (rng() - 0.5) * d * 0.4);
    group.add(tank);
  }
  return { group, body, w, d, h, cx, cz, baseY };
}

export function buildCity(scene) {
  const root = new THREE.Group();
  root.name = 'city';
  const colliders = [];
  const doors = [];
  const shops = [];
  const buildingMeshes = [];

  // 시드 고정 의사난수 (레이아웃 재현성)
  let seed = 12345;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const terrain = buildTerrain();
  root.add(terrain);
  root.add(buildRoads());

  // 블록마다 빌라 2×2
  for (let bi = 0; bi < STREETS.length - 1; bi++) {
    for (let bj = 0; bj < STREETS.length - 1; bj++) {
      const x0 = STREETS[bi] + ROAD_HALF;
      const x1 = STREETS[bi + 1] - ROAD_HALF;
      const z0 = STREETS[bj] + ROAD_HALF;
      const z1 = STREETS[bj + 1] - ROAD_HALF;
      const bw = x1 - x0;
      const stair = STAIR_PASSAGES.find(
        (s) => s.x > x0 - 5 && s.x < x1 + 5 && Math.abs(s.z0 - STREETS[bj]) < 1,
      );
      for (let ui = 0; ui < 2; ui++) {
        for (let uj = 0; uj < 2; uj++) {
          const cx = x0 + bw * (0.25 + ui * 0.5);
          const cz = z0 + (z1 - z0) * (0.25 + uj * 0.5);
          // 계단 통로 자리 비우기
          if (stair && Math.abs(cx - stair.x) < 7) continue;
          if (rng() < 0.08) continue; // 공터
          const villa = buildVilla(cx, cz, rng);
          root.add(villa.group);
          colliders.push(makeCollider(villa.body));
          buildingMeshes.push(villa.body);
          // 현관: 가장 가까운 골목 쪽 면
          const doorSide = Math.abs(cx - x0) < Math.abs(x1 - cx) ? -1 : 1;
          const doorX = cx + doorSide * (villa.w / 2 + 0.6);
          const doorZ = cz;
          doors.push({
            pos: new THREE.Vector3(doorX, terrainHeight(doorX, doorZ), doorZ),
            name: `빌라 ${doors.length + 1}호`,
          });
        }
      }
    }
  }

  // 계단 샛길: 계단 판 + 볼라드
  const stairMat = new THREE.MeshLambertMaterial({ color: 0x8a8a86 });
  const bollardMat = new THREE.MeshLambertMaterial({ color: 0x6a6a66 });
  for (const s of STAIR_PASSAGES) {
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const z = s.z0 + ((i + 0.5) / steps) * (s.z1 - s.z0);
      const y = terrainHeight(s.x, z);
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, Math.abs(s.z1 - s.z0) / steps + 0.05), stairMat);
      step.position.set(s.x, y + 0.09, z);
      root.add(step);
    }
    for (const zEnd of [s.z0 + 1, s.z1 - 1]) {
      for (const off of [-0.9, 0.9]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55, 8), bollardMat);
        const y = terrainHeight(s.x + off, zEnd);
        b.position.set(s.x + off, y + 0.27, zEnd);
        root.add(b);
        colliders.push({
          minX: s.x + off - 0.15, maxX: s.x + off + 0.15,
          minY: y, maxY: y + 0.55,
          minZ: zEnd - 0.15, maxZ: zEnd + 0.15,
        });
      }
    }
  }

  // 남쪽 상가 (픽업 지점)
  const shopMat = () => new THREE.MeshLambertMaterial({ color: 0x8d7a6a });
  for (let i = 0; i < SHOP_NAMES.length; i++) {
    const sx = -67 + i * 15;
    const sz = SHOP_Z + 6;
    const y = terrainHeight(sx, sz);
    const shop = new THREE.Mesh(new THREE.BoxGeometry(12, 4.5, 8), shopMat());
    shop.position.set(sx, y + 2.25 - 0.5, sz);
    shop.userData.buildingPart = 'shop';
    root.add(shop);
    colliders.push(makeCollider(shop));
    buildingMeshes.push(shop);
    const frontZ = sz - 4.6;
    shops.push({
      pos: new THREE.Vector3(sx, terrainHeight(sx, frontZ), frontZ),
      name: SHOP_NAMES[i],
    });
  }

  // 외곽 경계 담 (낮은 벽, 맵 이탈 방지)
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0x7a746c });
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
    colliders,
    doors,
    shops,
    buildingMeshes,
    stairPassages: STAIR_PASSAGES,
    groundHeight: terrainHeight,
    spawn: new THREE.Vector3(0, terrainHeight(0, 70), 70),
  };
}
