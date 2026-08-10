import * as THREE from 'three';
import { terrainHeight } from './heightfield.js';
import { tex, sharedMat } from './textures.js';
import { STREETS, ROAD_HALF, SHOP_Z, MAP_HALF, STAIR_PASSAGES, SHOP_DEFS } from './citymap.js';

// §7.10 장식 오브젝트 30종+ 배치. 전부 gpt-image-2 텍스처 사용 (단색 금지).
// 반환: { group, seasonalTreeMats, typeCount }

const H = terrainHeight;

function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}
// 전면 텍스처 + 나머지 면 중립 재질 (6면 동일 텍스처 방지)
// BoxGeometry 면 순서: +x, -x, +y, -y, +z, -z
function boxFaced(w, h, d, frontMat, sideMat, topMat = sideMat) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    [sideMat, sideMat, topMat, topMat, frontMat, sideMat],
  );
}
function cyl(r, h, material, segs = 8) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segs), material);
}
function plane(w, h, material) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
}

// M: Meshy 소품 모델 맵 (원점=발밑, 높이 정규화)
export function buildProps(world, scene, M) {
  const group = new THREE.Group();
  group.name = 'props';
  const colliders = world.colliders;
  const rng = world.rng;
  const typeSet = new Set();
  // 배치된 소품 풋프린트 기록 — 소품끼리·주차 차량과 겹침 방지
  const placedBoxes = [];
  world.propBoxes = placedBoxes;
  const overlapsAny = (b, margin = 0.2) => {
    for (const c of colliders) {
      if (b.min.x < c.maxX + margin && b.max.x > c.minX - margin
        && b.min.z < c.maxZ + margin && b.max.z > c.minZ - margin
        && b.min.y < c.maxY && b.max.y > c.minY) return true;
    }
    for (const p of placedBoxes) {
      if (b.min.x < p.maxX + margin && b.max.x > p.minX - margin
        && b.min.z < p.maxZ + margin && b.max.z > p.minZ - margin) return true;
    }
    return false;
  };
  const add = (type, obj, collide = false, pad = 0.05) => {
    typeSet.add(type);
    group.add(obj);
    if (collide) {
      const b = new THREE.Box3().setFromObject(obj);
      colliders.push({
        minX: b.min.x - pad, maxX: b.max.x + pad,
        minY: b.min.y, maxY: b.max.y,
        minZ: b.min.z - pad, maxZ: b.max.z + pad,
      });
    }
  };
  // 모델 배치 헬퍼. opts.check: 기존 배치물과 겹치면 배치 취소(null 반환)
  const place = (type, key, x, z, yaw = null, collide = false, opts = {}) => {
    const m = M[key].clone(true);
    m.position.set(x, H(x, z), z);
    m.rotation.y = yaw ?? rng() * Math.PI * 2;
    if (opts.scaleXZ) { m.scale.x *= opts.scaleXZ; m.scale.z *= opts.scaleXZ; }
    const b = new THREE.Box3().setFromObject(m);
    if (opts.check && overlapsAny(b)) return null;
    add(type, m, collide, opts.pad ?? 0.05);
    placedBoxes.push({ minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z });
    return m;
  };

  // ── 1·2 전봇대 + 전선 ──
  const wireMat = sharedMat('shared-metal');
  const metalMat = sharedMat('shared-metal');
  const poleTops = [];
  for (const sx of [-66, 0, 66]) {
    for (let zBase = -75; zBase <= 60; zBase += 27) {
      // 가로 골목 노면 위(z=33 등)에 서는 것 방지 — 골목에 걸치면 밀어냄
      let z = zBase;
      for (const s of STREETS) {
        if (Math.abs(z - s) < ROAD_HALF + 1) {
          z = s + (z >= s ? 1 : -1) * (ROAD_HALF + 1.2);
          break;
        }
      }
      const px = sx + ROAD_HALF + 0.6;
      const py = H(px, z);
      // 실제 전봇대 비율로 슬림하게 (모델이 통짜로 굵게 나옴)
      place('전봇대', 'pole', px, z, rng() * Math.PI * 2, false, { scaleXZ: 0.42 });
      colliders.push({
        minX: px - 0.15, maxX: px + 0.15,
        minY: py, maxY: py + 7.5,
        minZ: z - 0.15, maxZ: z + 0.15,
      });
      poleTops.push(new THREE.Vector3(px, py + 7.1, z));
    }
  }
  // 전선: 인접 전봇대끼리 처진 곡선 (§7.7)
  for (let i = 0; i + 1 < poleTops.length; i++) {
    const a = poleTops[i], b = poleTops[i + 1];
    if (a.distanceTo(b) > 40) continue;
    for (const off of [0, 0.25]) {
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y -= 1.1;
      const curve = new THREE.QuadraticBezierCurve3(
        a.clone().setY(a.y - off), mid, b.clone().setY(b.y - off),
      );
      const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.025, 4), wireMat);
      add('전선', wire);
    }
  }

  // ── 3 가로등 ──
  for (const sz of [-33, 33]) {
    for (let xBase = -70; xBase <= 70; xBase += 38) {
      // 세로 골목 노면 위에 서는 것 방지 — 도로에 걸치면 가장자리로 밀어냄
      let x = xBase;
      for (const s of STREETS) {
        if (Math.abs(x - s) < ROAD_HALF + 1) {
          x = s + (x >= s ? 1 : -1) * (ROAD_HALF + 1.2);
          break;
        }
      }
      const pz = sz + ROAD_HALF + 0.6;
      const y = H(x, pz);
      place('가로등', 'streetlamp', x, pz, Math.PI);
      colliders.push({
        minX: x - 0.15, maxX: x + 0.15,
        minY: y, maxY: y + 4.6,
        minZ: pz - 0.15, maxZ: pz + 0.15,
      });
    }
  }

  // ── 4 쓰레기봉투 더미 ──
  const trashSpots = [];
  for (let i = 0; i < 14; i++) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const sx = STREETS[Math.floor(rng() * STREETS.length)] + (rng() < 0.5 ? -1 : 1) * (ROAD_HALF - 0.6);
      const sz = -75 + rng() * 140;
      if (STREETS.some((s) => Math.abs(sz - s) < 3.2)) continue; // §16.3 교차 가로 차선 회피
      if (place('쓰레기봉투', 'trashpile', sx, sz, null, false, { check: true })) {
        trashSpots.push(new THREE.Vector3(sx, H(sx, sz), sz));
        break;
      }
    }
  }

  // ── 5 화분 줄 ──
  for (const v of world.villas) {
    if (rng() < 0.45) continue;
    for (let k = 0; k < 3; k++) {
      place('화분', 'planter', v.door.x + v.faceDir * 0.3, v.door.z + 1 + k * 0.6);
    }
  }

  // ── 6 평상 ──
  for (let i = 0; i < 5; i++) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = STREETS[1 + Math.floor(rng() * 3)] + (rng() < 0.5 ? -5 : 5);
      const z = -60 + rng() * 110;
      if (STREETS.some((s) => Math.abs(z - s) < 3.2)) continue; // §16.3 교차 가로 차선 회피
      if (place('평상', 'pyeongsang', x, z, null, true, { check: true })) break;
    }
  }

  // ── 7 실외기 (빌라 벽) ──
  const acMat = sharedMat('prop-aircon');
  const acSideMat = sharedMat('shared-metal');
  for (const v of world.villas) {
    if (rng() < 0.5) continue;
    const ac = boxFaced(0.85, 0.6, 0.35, acMat, acSideMat);
    ac.rotation.y = v.faceDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    ac.position.set(
      v.cx + v.faceDir * (v.w / 2 + 0.2),
      v.base + 1.1 + Math.floor(rng() * 2) * 2.6,
      v.cz + (rng() - 0.5) * v.d * 0.5,
    );
    add('실외기', ac);
  }

  // ── 8 옥상 물탱크: citymap 빌라 생성부에 포함 ──
  typeSet.add('옥상물탱크');

  // ── 9 철제 대문 (현관 옆) ──
  const gateMat = sharedMat('prop-gate');
  for (const v of world.villas) {
    if (rng() < 0.55) continue;
    const g = plane(1.7, 1.9, gateMat);
    g.position.set(v.door.x - v.faceDir * 0.55, H(v.door.x, v.door.z) + 0.95, v.door.z - 1.4);
    g.rotation.y = v.faceDir > 0 ? -Math.PI / 2 : Math.PI / 2;
    add('철제대문', g);
  }

  // ── 10 담벼락 (블록 모서리 낮은 벽) ──
  const wallMat = sharedMat('shared-brick', { repeatX: 3, repeatY: 0.7 });
  for (let i = 0; i < 10; i++) {
    const bx = STREETS[Math.floor(rng() * 4)] + ROAD_HALF + 2;
    const bz = STREETS[Math.floor(rng() * 4)] + ROAD_HALF + 1;
    const len = 5 + rng() * 5;
    const y = H(bx + len / 2, bz);
    const wall = box(len, 1.4, 0.25, wallMat);
    wall.position.set(bx + len / 2, y + 0.7, bz);
    add('담벼락', wall, true);
  }

  // ── 11 계단 난간 (Meshy 3D — 계단 양측 타일링) ──
  {
    const pb = new THREE.Box3().setFromObject(M.railing);
    const ps = pb.getSize(new THREE.Vector3());
    const alongX = ps.x >= ps.z; // 모델 장축 판별
    const unit = Math.max(ps.x, ps.z);
    for (const s of STAIR_PASSAGES) {
      const zMin = Math.min(s.z0, s.z1) + 1.6; // 볼라드 자리 비움
      const span = Math.abs(s.z1 - s.z0) - 3.2;
      const n = Math.max(1, Math.round(span / unit));
      const step = span / n;
      for (const off of [-1.35, 1.35]) {
        for (let i = 0; i < n; i++) {
          const z = zMin + (i + 0.5) * step;
          const m = M.railing.clone(true);
          m.position.set(s.x + off, H(s.x + off, z), z);
          m.rotation.y = alongX ? Math.PI / 2 : 0; // 장축을 계단 진행축(z)에 정렬
          const stretch = step / unit;
          if (alongX) m.scale.x *= stretch; else m.scale.z *= stretch;
          add('계단난간', m);
        }
      }
    }
  }

  // ── 12 돌출 간판 (상가 측면) — 넓은 양면만 간판, 나머지 금속 ──
  // §14.2 사방 상가 위치 기준: 파사드 축으로 6.2m 비껴 벽면에 부착
  const signMat = sharedMat('prop-sign-vertical');
  for (let i = 0; i < 8; i++) {
    const def = SHOP_DEFS[i];
    const fx = Math.sin(def.yaw), fz = Math.cos(def.yaw); // 전면 법선
    const ax = Math.cos(def.yaw), az = -Math.sin(def.yaw); // 파사드 축
    const sx = def.x + ax * 6.2 + fx * 2;
    const sz = def.z + az * 6.2 + fz * 2;
    const y = H(sx, sz);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 2.2, 0.7),
      [signMat, signMat, metalMat, metalMat, metalMat, metalMat],
    );
    sign.position.set(sx, y + 3.4, sz);
    sign.rotation.y = def.yaw;
    add('돌출간판', sign);
  }

  // ── 13 자판기 ──
  // §16.3 (FR-42) 구 좌표(z=66 골목 차선 안) → 상가 프롬나드 위로 이전
  for (const [vx, vz] of [[-52, 74.2], [-22, 74.2], [8, 74.2], [-8, -74.2], [22, -74.2], [52, -74.2]]) {
    place('자판기', 'vending', vx, vz, vz > 0 ? Math.PI : 0, true);
  }

  // ── 14 우편함 ──
  for (const v of world.villas) {
    if (rng() < 0.7) continue;
    place('우편함', 'mailbox', v.door.x - v.faceDir * 0.2, v.door.z + 0.9,
      v.faceDir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }

  // ── 15·16 주차 차량: Meshy 3D 모델 — 로드 후 placeParkedVehicles()에서 배치 ──
  typeSet.add('주차세단');
  typeSet.add('주차트럭');

  // ── 17 벤치 ──
  // §16.3 (FR-42) 구 좌표(z=66 골목 차선 안) → 상가 프롬나드 위로 이전
  for (const [bx2, bz2] of [[-50, 75.4], [-17, 75.4], [16, -75.4], [49, -75.4]]) {
    place('벤치', 'bench', bx2, bz2, bz2 > 0 ? Math.PI : 0, true);
  }

  // ── 18 소화전 ──
  for (let i = 0; i < 5; i++) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const s = STREETS[Math.floor(rng() * STREETS.length)];
      const t = STREETS[Math.floor(rng() * STREETS.length)];
      if (place('소화전', 'hydrant', s + ROAD_HALF + 0.7, t + ROAD_HALF + 0.7, null, false, { check: true })) break;
    }
  }

  // ── 19 맨홀 (도로 데칼) ──
  const manholeMat = sharedMat('prop-manhole');
  for (let i = 0; i < 8; i++) {
    const s = STREETS[Math.floor(rng() * STREETS.length)];
    const t = -60 + rng() * 120;
    const vertical = rng() < 0.5;
    const x = vertical ? s : t;
    const z = vertical ? t : s;
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), manholeMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, H(x, z) + 0.06, z);
    add('맨홀', m);
  }

  // ── 20 볼라드 (상가 프롬나드 가장자리) ──
  // §16.3 (FR-42) 구 좌표(차선 안) → 프롬나드 남측 경계로. 세로 골목 차선 자리는 건너뜀
  const bolMat = sharedMat('prop-bollard');
  for (let x = -70; x <= 70; x += 10) {
    if (STREETS.some((s) => Math.abs(x - s) < 2.6)) continue;
    const z = SHOP_Z - 3.9;
    const y = H(x, z);
    const b = cyl(0.14, 0.6, bolMat);
    b.position.set(x, y + 0.3, z);
    add('볼라드', b);
  }

  // ── 21 현수막 (골목 가로질러) ──
  const bannerMat = sharedMat('prop-banner');
  bannerMat.side = THREE.DoubleSide;
  for (const [bx, bz] of [[0, 50], [-33, -10], [33, 20]]) {
    const y = H(bx, bz) + 4.2; // 카메라(높이 ~2.7)와 겹치지 않게
    // 텍스처는 밴드만 크롭된 2.7:1 (정방 원본은 회색 여백까지 렌더됐음) —
    // plane 4:1로 가로 스트레치 1.5배 이내 유지
    const banner = plane(5.2, 1.3, bannerMat);
    banner.position.set(bx, y, bz);
    banner.rotation.y = rng() < 0.5 ? 0.15 : -0.1;
    add('현수막', banner);
    for (const off of [-2.9, 2.9]) {
      const p = cyl(0.06, 4.6, wireMat);
      p.position.set(bx + off, H(bx + off, bz) + 2.3, bz);
      add('현수막', p);
    }
  }

  // ── 22 배달 상자 더미 (상가 입구 옆 — §14.2 사방 상가 대응) ──
  for (let i = 0; i < 6; i++) {
    const def = SHOP_DEFS[i];
    const fx = Math.sin(def.yaw), fz = Math.cos(def.yaw);
    const ax = Math.cos(def.yaw), az = -Math.sin(def.yaw);
    place('배달상자', 'boxes', def.x - ax * 5 + fx * 5.3, def.z - az * 5 + fz * 5.3);
  }

  // ── 23 고양이 ──
  for (let i = 0; i < 4; i++) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const spot = trashSpots[Math.floor(rng() * trashSpots.length)];
      // §16.3 (FR-42) x 드리프트가 차선 쪽으로 밀던 것을 골목 진행 방향(z) 오프셋으로
      if (place('고양이', 'cat', spot.x + (rng() - 0.5) * 0.8, spot.z + 1.2 + rng(), null, false, { check: true })) break;
    }
  }

  // ── 24 자전거 거치대 (난간 3D 모델 축소 재활용) ──
  {
    const rb = new THREE.Box3().setFromObject(M.railing);
    const rs = rb.getSize(new THREE.Vector3());
    const rAlongX = rs.x >= rs.z;
    // §16.3 (FR-42) 구 좌표(z=66 차선 안) → 프롬나드 위. 세로 차선 교차 지점 회피
    for (const [x, z] of [[-40, 73.6], [-8, 73.6], [40, -73.6]]) {
      const m = M.railing.clone(true);
      m.scale.multiplyScalar(0.7);
      m.position.set(x, H(x, z), z);
      m.rotation.y = rAlongX ? 0 : Math.PI / 2; // 장축을 x축(상가 평행)으로
      add('자전거거치대', m);
    }
  }

  // ── 25 반지하 창살 ──
  const grillMat = sharedMat('prop-grill');
  for (const v of world.villas) {
    if (rng() < 0.6) continue;
    const g = plane(0.95, 0.6, grillMat);
    const gx = v.cx + v.faceDir * (Math.max(v.w, v.d) / 2 + 0.06);
    const gz = v.cz + (rng() - 0.5) * v.d * 0.4;
    g.position.set(gx, v.base + 0.75, gz);
    g.rotation.y = v.faceDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    add('반지하창살', g);
  }

  // ── 26 가스배관 (빌라 외벽) ──
  const pipeMat = sharedMat('shared-metal', { repeatX: 0.3, repeatY: 3 });
  for (const v of world.villas) {
    if (rng() < 0.65) continue;
    const p = cyl(0.05, v.h - 0.4, pipeMat, 6);
    p.position.set(
      v.cx + v.faceDir * (Math.max(v.w, v.d) / 2 + 0.08),
      v.base + v.h / 2,
      v.cz + v.d * 0.32,
    );
    add('가스배관', p);
  }

  // ── 27 파라솔 (상가 앞) ──
  // §16.3 (FR-42) 캐노피가 차선 위로 걸치던 구 좌표 → 프롬나드 위로
  for (const [px2, pz2] of [[-37, 75], [8, 75], [53, -75]]) {
    place('파라솔', 'parasol', px2, pz2);
  }

  // ── 28 빨래건조대 (옥상) ──
  let laundryCount = 0;
  for (const v of world.villas) {
    if (laundryCount >= 6 || rng() < 0.75) continue;
    const l = M.laundry.clone(true);
    l.position.set(v.cx, v.base + v.h, v.cz);
    l.rotation.y = rng() * Math.PI;
    add('빨래건조대', l);
    laundryCount++;
  }

  // ── 29 나무 (십자 빌보드, 계절 교체) ──
  const treeMat = new THREE.MeshLambertMaterial({
    map: tex('tree-spring'), alphaTest: 0.5, side: THREE.DoubleSide,
  });
  const treeSpots = [];
  for (let i = 0; i < 14; i++) {
    const s = STREETS[Math.floor(rng() * STREETS.length)];
    const t = -70 + rng() * 140;
    const vertical = rng() < 0.5;
    // §16.3 (FR-42) 구 코드는 가로 골목 케이스에서 lateral 오프셋이 1.5라 차선 안 식재.
    // lateral은 도로 밖(±4.2), 골목 진행축은 ±1.5 지터 + 교차 차선 회피 밀어내기
    const lat = (rng() < 0.5 ? -1 : 1) * (ROAD_HALF + 1.2);
    let a = t + (rng() < 0.5 ? -1 : 1) * 1.5;
    for (const c of STREETS) {
      if (Math.abs(a - c) < 3.4) { a = c + (a >= c ? 1 : -1) * 3.4; break; }
    }
    const x = vertical ? s + lat : a;
    const z = vertical ? a : s + lat;
    treeSpots.push([x, z, 4 + rng() * 2]);
  }
  // 외곽 원경 실루엣 나무 (§7.3 안개 속 실루엣)
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const r = MAP_HALF + 18 + rng() * 18;
    treeSpots.push([Math.cos(ang) * r, Math.sin(ang) * r, 6 + rng() * 3]);
  }
  for (const [x, z, s] of treeSpots) {
    const y = H(x, z);
    for (const rot of [0, Math.PI / 2]) {
      const t = plane(s, s, treeMat);
      t.position.set(x, y + s / 2 - 0.1, z);
      t.rotation.y = rot;
      add('나무', t);
    }
  }

  // ── 30 어린이보호구역 표지판 (구 어닝은 간판 하단 떠 있음 피드백으로 제거) ──
  const signFaceMat = new THREE.MeshLambertMaterial({
    map: tex('prop-sign-schoolzone'), side: THREE.DoubleSide,
  });
  // 후보 중 건물·소품과 안 겹치는 자리만 채택.
  // 계단 샛길 ±7m는 빌라 생성이 스킵되는 확정 공터라 갓길 가시성이 보장됨
  // [x, z, yaw] — yaw는 앞면이 인접 도로를 향하게
  const signCandidates = [
    [19.2, -62.2, Math.PI], [13.8, -36.8, 0], [-46.8, 4.0, Math.PI],
    [25, -36.6, 0], [-58, -29.4, Math.PI], [37, 36.6, Math.PI],
  ];
  let signsPlaced = 0;
  for (const [px, pz, yaw] of signCandidates) {
    if (signsPlaced >= 3) break;
    const y = H(px, pz);
    const b = new THREE.Box3(
      new THREE.Vector3(px - 0.5, y, pz - 0.5),
      new THREE.Vector3(px + 0.5, y + 2.6, pz + 0.5),
    );
    if (overlapsAny(b, 1.0)) continue;
    const pole = cyl(0.05, 2.6, metalMat, 6);
    pole.position.set(px, y + 1.3, pz);
    add('표지판', pole);
    const face = plane(0.8, 0.8, signFaceMat);
    // 기둥과 z-파이팅·겹침 방지 — 앞면 방향으로 살짝 밀착
    face.position.set(px + 0.07 * Math.sin(yaw), y + 2.2, pz + 0.07 * Math.cos(yaw));
    face.rotation.y = yaw;
    add('표지판', face);
    colliders.push({
      minX: px - 0.1, maxX: px + 0.1,
      minY: y, maxY: y + 2.6,
      minZ: pz - 0.1, maxZ: pz + 0.1,
    });
    signsPlaced++;
  }

  scene.add(group);
  return { group, treeMat, typeCount: typeSet.size, types: [...typeSet] };
}

// Meshy 주차 차량 배치 (게임 초기화에서 모델 로드 후 호출)
export function placeParkedVehicles(world, scene, { sedan, truck }) {
  const group = new THREE.Group();
  group.name = 'parked-vehicles';
  let seed = 777;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  // 소품·건물·다른 차와 겹치면 재시도 (자판기 위에 차 얹히는 사고 방지)
  const propBoxes = world.propBoxes ?? [];
  const overlaps = (b, margin = 0.3) => {
    for (const c of world.colliders) {
      if (b.min.x < c.maxX + margin && b.max.x > c.minX - margin
        && b.min.z < c.maxZ + margin && b.max.z > c.minZ - margin
        && b.min.y < c.maxY && b.max.y > c.minY) return true;
    }
    for (const p of propBoxes) {
      if (b.min.x < p.maxX + margin && b.max.x > p.minX - margin
        && b.min.z < p.maxZ + margin && b.max.z > p.minZ - margin) return true;
    }
    return false;
  };
  for (let i = 0; i < 12; i++) {
    const isTruck = i % 3 === 2;
    for (let attempt = 0; attempt < 20; attempt++) {
      const vertical = rng() < 0.5;
      const line = STREETS[Math.floor(rng() * STREETS.length)];
      const t = -70 + rng() * 130;
      // §16.3 (FR-42) 차폭(1.65)이 차선(±1.9)을 침범하지 않게 인도 걸침 주차로:
      // 구 offset 1.95는 차체 절반이 차선 안이었다. 교차 골목 차선 구간도 회피
      const offset = (rng() < 0.5 ? -1 : 1) * (ROAD_HALF - 0.15);
      if (STREETS.some((s) => Math.abs(t - s) < 5)) continue;
      const x = vertical ? line + offset : t;
      const z = vertical ? t : line + offset;
      const car = (isTruck ? truck : sedan).clone(true);
      car.position.set(x, H(x, z), z);
      // 길이축을 골목 방향으로 + 약간의 주차 각 오차
      car.rotation.y = (vertical ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.12 + (rng() < 0.5 ? Math.PI : 0);
      const b = new THREE.Box3().setFromObject(car);
      if (overlaps(b)) continue;
      group.add(car);
      world.colliders.push({
        minX: b.min.x - 0.05, maxX: b.max.x + 0.05,
        minY: b.min.y, maxY: b.max.y,
        minZ: b.min.z - 0.05, maxZ: b.max.z + 0.05,
      });
      break;
    }
  }
  scene.add(group);
}
