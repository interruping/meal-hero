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
export const STAIR_PASSAGES = [
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

// §14.2 상가 사방 재배치 (FR-28): 동·서·남·북 가장자리에 분산 배치.
// yaw는 전면(+z)이 마을 안쪽을 향하게. 좌표는 격자 도로(±33·0·±66) 침범 회피
export const SHOP_DEFS = [
  { tex: 'shop-chicken', name: '치킨집', x: -45, z: 82, yaw: Math.PI }, // 북
  { tex: 'shop-chinese', name: '중국집', x: -15, z: 82, yaw: Math.PI },
  { tex: 'shop-bunsik', name: '분식집', x: 15, z: 82, yaw: Math.PI },
  { tex: 'shop-convenience', name: '편의점', x: 82, z: -15, yaw: -Math.PI / 2 }, // 동
  { tex: 'shop-pizza', name: '피자집', x: 82, z: 15, yaw: -Math.PI / 2 },
  { tex: 'shop-jokbal', name: '족발집', x: -15, z: -82, yaw: 0 }, // 남
  { tex: 'shop-cafe', name: '카페', x: 15, z: -82, yaw: 0 },
  { tex: 'shop-dosirak', name: '도시락집', x: 45, z: -82, yaw: 0 },
  { tex: 'shop-tteokbokki', name: '떡볶이집', x: -82, z: -15, yaw: Math.PI / 2 }, // 서
  { tex: 'shop-burger', name: '버거집', x: -82, z: 15, yaw: Math.PI / 2 },
];

// §14.2 구멍가게 4곳 (FR-28): 빌라 블록 셀을 대체하는 소형 단독 가게.
// 좌표는 빌라 2×2 셀 중심과 일치해야 한다 (셀 간격: 도로선 +9.75 / +23.25)
const CORNER_SHOPS = [
  { tex: 'shop-super', name: '동네슈퍼A', x: -56.25, z: -23.25 },
  { tex: 'shop-baekban', name: '백반집A', x: 56.25, z: -42.75 },
  { tex: 'shop-super', name: '동네슈퍼B', x: -42.75, z: 56.25 },
  { tex: 'shop-baekban', name: '백반집B', x: 9.75, z: 23.25 },
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

// §15.4 (FR-36) 인도·차도 분리: 격자 골목 폭 6을 차도 3.8 + 양측 인도 1.1로 나눈다.
// 전체 폭·건물·navmap 좌표는 그대로라 맵 결정성에 영향 없음
export const LANE_HALF = 1.9; // 차도 반폭 — 차량은 이 안에서만 주행
const WALK_W = ROAD_HALF - LANE_HALF; // 인도 폭 1.1
export const WALK_MID = LANE_HALF + WALK_W / 2; // 인도 중심선 ±2.45

function roadStrip(cx, cz, w, len, alongZ, texName = 'road-spring', lift = 0.04, vTile = 8, uTile = null) {
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
    pos.setY(i, terrainHeight(x, z) + lift);
    pos.setZ(i, z);
  }
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    uv.setXY(i, (alongZ ? x : z) / (uTile ?? w), (alongZ ? z : x) / vTile);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex(texName) }));
}

function buildRoads() {
  const roads = new THREE.Group();
  roads.name = 'roads';
  const sidewalks = new THREE.Group();
  sidewalks.name = 'sidewalks';
  // §16.2 (FR-40) 교차로 체크무늬 제거 — 인도는 교차로 앞에서 끊는다.
  // 세로 인도는 교차 도로 전폭(±ROAD_HALF)에서, 가로 인도는 차선(±LANE_HALF)에서
  // 절단 → 교차로 내부는 전면 차도, 모서리는 가로 인도가 정확히 1회 커버 (겹침 0)
  const spans = (cutHalf) => {
    const out = [];
    let a = -MAP_HALF;
    for (const c of STREETS) {
      if (c - cutHalf > a + 0.05) out.push([a, c - cutHalf]);
      a = c + cutHalf;
    }
    if (MAP_HALF > a + 0.05) out.push([a, MAP_HALF]);
    return out;
  };
  const walk = (cx, cz, len, alongZ) =>
    roadStrip(cx, cz, WALK_W, len, alongZ, 'sidewalk-spring', 0.07, WALK_W);
  for (const s of STREETS) {
    // 차도 (계절 road-* 텍스처)
    roads.add(roadStrip(s, 0, LANE_HALF * 2, MAP_HALF * 2, true));
    roads.add(roadStrip(0, s, LANE_HALF * 2, MAP_HALF * 2, false));
    // 양측 인도 (계절 sidewalk-* 보도블럭, 차도보다 살짝 높게 — 연석 느낌)
    for (const side of [-1, 1]) {
      for (const [a, b] of spans(ROAD_HALF)) {
        sidewalks.add(walk(s + side * WALK_MID, (a + b) / 2, b - a, true));
      }
      for (const [a, b] of spans(LANE_HALF)) {
        sidewalks.add(walk((a + b) / 2, s + side * WALK_MID, b - a, false));
      }
    }
  }
  // §16.1 (FR-38) 외곽 순환 도로 제거 — 접근로 링 대신 상가 앞 보행 프롬나드(보도블럭).
  // 도로가 아니라 보행 광장: 픽업 지점(전면 4.7m)을 덮는 폭 7 스트립, 상가 군집 구간만
  // lift 0.03: 골목 차도(0.04)가 프롬나드를 가로지르는 구간은 차도가 위에 오게
  const PROM_MID = SHOP_Z + 0.5; // 중심 76.5 → 73~80 커버 (상가 전면 78·픽업 77.3)
  sidewalks.add(roadStrip(-15, PROM_MID, 7, 78, false, 'sidewalk-spring', 0.03, WALK_W, WALK_W)); // 북
  sidewalks.add(roadStrip(15, -PROM_MID, 7, 78, false, 'sidewalk-spring', 0.03, WALK_W, WALK_W)); // 남
  sidewalks.add(roadStrip(PROM_MID, 0, 7, 54, true, 'sidewalk-spring', 0.03, WALK_W, WALK_W)); // 동
  sidewalks.add(roadStrip(-PROM_MID, 0, 7, 54, true, 'sidewalk-spring', 0.03, WALK_W, WALK_W)); // 서
  return { roads, sidewalks };
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

// §14.2 구멍가게: 빌라 셀 자리에 들어가는 소형 단독 가게 (전면 간판 텍스처)
function buildCornerShop(def, cx, cz, faceDir) {
  const w = 7, d = 6, h = 3.4;
  const corners = [
    terrainHeight(cx - w / 2, cz - d / 2), terrainHeight(cx + w / 2, cz - d / 2),
    terrainHeight(cx - w / 2, cz + d / 2), terrainHeight(cx + w / 2, cz + d / 2),
  ];
  const base = Math.min(...corners) - 0.25;
  const side = sharedMat('villa-side-2');
  const roof = sharedMat('shared-concrete', { repeatX: 2, repeatY: 2 });
  const front = sharedMat(def.tex);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    [side, side, roof, roof, front, side],
  );
  body.position.set(cx, base + h / 2, cz);
  body.rotation.y = faceDir > 0 ? Math.PI / 2 : -Math.PI / 2; // 전면(+z)이 골목쪽
  body.userData.buildingType = def.tex;
  const group = new THREE.Group();
  group.add(body);
  const fx = cx + faceDir * (d / 2 + 1.2);
  return {
    group, body,
    front: new THREE.Vector3(fx, terrainHeight(fx, cz), cz),
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
  const { roads, sidewalks } = buildRoads();
  root.add(roads);
  root.add(sidewalks);

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
          const isEmpty = rng() < 0.08; // rng 소비 순서 유지 (맵 결정성)
          const faceDir = ui === 0 ? -1 : 1; // 바깥 골목쪽 현관
          // §14.2 구멍가게 셀: 빌라 대신 소형 가게 (공터 여부 무관 — 반드시 생성)
          const corner = CORNER_SHOPS.find((c) => Math.abs(c.x - cx) < 2 && Math.abs(c.z - cz) < 2);
          if (corner) {
            const shop = buildCornerShop(corner, cx, cz, faceDir);
            root.add(shop.group);
            colliders.push(makeCollider(shop.body));
            buildingMeshes.push(shop.body);
            shops.push({ pos: shop.front, name: corner.name });
            continue;
          }
          if (isEmpty) continue; // 공터
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
    // 난간은 Meshy 3D 모델(prop3d-railing) — props.js에서 배치
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

  // 상가 (픽업 지점): 사방 가장자리 배치 (§14.2) — 전면 간판 텍스처
  const shopSide = sharedMat('villa-side-2');
  const shopRoof = sharedMat('shared-concrete', { repeatX: 2, repeatY: 2 });
  for (const def of SHOP_DEFS) {
    const y = terrainHeight(def.x, def.z);
    const front = sharedMat(def.tex);
    const shop = new THREE.Mesh(
      new THREE.BoxGeometry(12, 4.6, 8),
      [shopSide, shopSide, shopRoof, shopRoof, front, shopSide],
    );
    shop.position.set(def.x, y + 2.3 - 0.4, def.z);
    shop.rotation.y = def.yaw; // 회전 후 +z(전면)가 마을 안쪽
    shop.userData.buildingType = def.tex;
    root.add(shop);
    colliders.push(makeCollider(shop));
    buildingMeshes.push(shop);
    // 전면 4.7m 앞이 픽업 지점
    const fx = def.x + Math.sin(def.yaw) * 4.7;
    const fz = def.z + Math.cos(def.yaw) * 4.7;
    shops.push({ pos: new THREE.Vector3(fx, terrainHeight(fx, fz), fz), name: def.name });
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
    sidewalks,
    colliders,
    doors,
    shops,
    buildingMeshes,
    villas,
    stairPassages: STAIR_PASSAGES,
    groundHeight: terrainHeight,
    // §16.1 (FR-39) 시작 위치 차도 금지 — x=0 골목 동측 인도 위 (차선 |x|<1.9 밖)
    spawn: new THREE.Vector3(WALK_MID, terrainHeight(WALK_MID, 70), 70),
    rng,
  };
}
