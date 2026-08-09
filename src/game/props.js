import * as THREE from 'three';
import { terrainHeight } from './heightfield.js';
import { tex, sharedMat } from './textures.js';
import { STREETS, ROAD_HALF, SHOP_Z, MAP_HALF } from './citymap.js';

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

export function buildProps(world, scene) {
  const group = new THREE.Group();
  group.name = 'props';
  const colliders = world.colliders;
  const rng = world.rng;
  const typeSet = new Set();
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

  // ── 1·2 전봇대 + 전선 ──
  const poleMat = sharedMat('prop-pole', { repeatX: 1, repeatY: 4 });
  const wireMat = sharedMat('shared-metal');
  const metalMat = sharedMat('shared-metal');
  const poleTops = [];
  for (const sx of [-66, 0, 66]) {
    for (let z = -75; z <= 60; z += 27) {
      const px = sx + (ROAD_HALF + 0.6) * (z % 2 === 0 ? 1 : 1);
      const py = H(px, z);
      const pole = cyl(0.13, 7.5, poleMat);
      pole.position.set(px, py + 3.75, z);
      const arm = box(1.6, 0.1, 0.1, poleMat);
      arm.position.set(px, py + 6.9, z);
      add('전봇대', pole, true, 0.02);
      add('전봇대', arm);
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
  const lampMat = sharedMat('prop-lamp');
  for (const sz of [-33, 33]) {
    for (let x = -70; x <= 70; x += 38) {
      const pz = sz + ROAD_HALF + 0.6;
      const y = H(x, pz);
      const pole = cyl(0.09, 4.6, lampMat);
      pole.position.set(x, y + 2.3, pz);
      const head = box(0.7, 0.22, 0.3, lampMat);
      head.position.set(x, y + 4.6, pz - 0.25);
      add('가로등', pole, true, 0.02);
      add('가로등', head);
    }
  }

  // ── 4 쓰레기봉투 더미 ──
  const trashMat = sharedMat('prop-trashbags');
  const trashSpots = [];
  for (let i = 0; i < 14; i++) {
    const sx = STREETS[Math.floor(rng() * STREETS.length)] + (rng() < 0.5 ? -1 : 1) * (ROAD_HALF - 0.6);
    const sz = -75 + rng() * 140;
    const y = H(sx, sz);
    for (let k = 0; k < 2 + Math.floor(rng() * 2); k++) {
      const s = 0.5 + rng() * 0.3;
      const bag = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 5), trashMat);
      bag.scale.y = 0.75;
      bag.position.set(sx + (rng() - 0.5) * 1.2, y + s * 0.55, sz + (rng() - 0.5) * 1.2);
      add('쓰레기봉투', bag);
    }
    trashSpots.push(new THREE.Vector3(sx, y, sz));
  }

  // ── 5 화분 줄 ──
  const planterMat = sharedMat('prop-planter');
  for (const v of world.villas) {
    if (rng() < 0.45) continue;
    for (let k = 0; k < 3; k++) {
      const p = box(0.45, 0.5, 0.45, planterMat);
      p.position.set(
        v.door.x + v.faceDir * 0.3,
        H(v.door.x, v.door.z + 1 + k * 0.6) + 0.25,
        v.door.z + 1 + k * 0.6,
      );
      add('화분', p);
    }
  }

  // ── 6 평상 ──
  const pyMat = sharedMat('prop-pyeongsang');
  for (let i = 0; i < 5; i++) {
    const x = STREETS[1 + Math.floor(rng() * 3)] + (rng() < 0.5 ? -5 : 5);
    const z = -60 + rng() * 110;
    const y = H(x, z);
    const top = box(1.9, 0.12, 1.3, pyMat);
    top.position.set(x, y + 0.42, z);
    add('평상', top, true);
    for (const [ox, oz] of [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]]) {
      const leg = box(0.1, 0.4, 0.1, pyMat);
      leg.position.set(x + ox, y + 0.2, z + oz);
      add('평상', leg);
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

  // ── 11 계단 난간: citymap 계단부에 포함 ──
  typeSet.add('계단난간');

  // ── 12 돌출 간판 (상가 측면) — 넓은 양면만 간판, 나머지 금속 ──
  const signMat = sharedMat('prop-sign-vertical');
  for (let i = 0; i < 8; i++) {
    const sx = -67 + i * 15 + 6.2;
    const sz = SHOP_Z + 4;
    const y = H(sx, sz);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 2.2, 0.7),
      [signMat, signMat, metalMat, metalMat, metalMat, metalMat],
    );
    sign.position.set(sx, y + 3.4, sz);
    add('돌출간판', sign);
  }

  // ── 13 자판기 (전면만 상품, 측·상면 금속) ──
  const vendMat = sharedMat('prop-vending');
  for (let i = 0; i < 6; i++) {
    const sx = -60 + i * 24;
    const sz = SHOP_Z - 8.6;
    const y = H(sx, sz);
    const v = boxFaced(1.05, 1.9, 0.8, vendMat, metalMat);
    v.rotation.y = Math.PI; // 전면(-z, 마을쪽)
    v.position.set(sx, y + 0.95, sz);
    add('자판기', v, true);
  }

  // ── 14 우편함 ──
  const mailMat = sharedMat('prop-mailbox');
  for (const v of world.villas) {
    if (rng() < 0.7) continue;
    const m = boxFaced(0.5, 0.7, 0.25, mailMat, metalMat);
    m.rotation.y = v.faceDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    m.position.set(v.door.x - v.faceDir * 0.2, H(v.door.x, v.door.z) + 1.1, v.door.z + 0.9);
    add('우편함', m);
  }

  // ── 15·16 주차 차량: Meshy 3D 모델 — 로드 후 placeParkedVehicles()에서 배치 ──
  typeSet.add('주차세단');
  typeSet.add('주차트럭');

  // ── 17 벤치 ──
  const benchMat = sharedMat('prop-bench');
  for (let i = 0; i < 4; i++) {
    const x = -50 + i * 33;
    const z = SHOP_Z - 9.5;
    const y = H(x, z);
    const b = box(1.7, 0.1, 0.5, benchMat);
    b.position.set(x, y + 0.45, z);
    const back = box(1.7, 0.5, 0.08, benchMat);
    back.position.set(x, y + 0.8, z + 0.24);
    add('벤치', b, true);
    add('벤치', back);
  }

  // ── 18 소화전 ──
  const hydMat = sharedMat('prop-hydrant');
  for (let i = 0; i < 5; i++) {
    const s = STREETS[Math.floor(rng() * STREETS.length)];
    const t = STREETS[Math.floor(rng() * STREETS.length)];
    const x = s + ROAD_HALF + 0.7;
    const z = t + ROAD_HALF + 0.7;
    const y = H(x, z);
    const h = cyl(0.22, 0.75, hydMat, 8);
    h.position.set(x, y + 0.37, z);
    add('소화전', h);
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

  // ── 20 볼라드 (상가골목 입구) ──
  const bolMat = sharedMat('prop-bollard');
  for (let x = -70; x <= 70; x += 10) {
    const z = SHOP_Z - 10.5;
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
    const banner = plane(5.6, 0.85, bannerMat);
    banner.position.set(bx, y, bz);
    banner.rotation.y = rng() < 0.5 ? 0.15 : -0.1;
    add('현수막', banner);
    for (const off of [-2.9, 2.9]) {
      const p = cyl(0.06, 4.6, wireMat);
      p.position.set(bx + off, H(bx + off, bz) + 2.3, bz);
      add('현수막', p);
    }
  }

  // ── 22 배달 상자 더미 (상가 뒤) ──
  const boxMat = sharedMat('prop-boxes');
  for (let i = 0; i < 6; i++) {
    const x = -60 + i * 22;
    const z = SHOP_Z + 11;
    const y = H(x, z);
    const b1 = box(0.8, 0.55, 0.6, boxMat);
    b1.position.set(x, y + 0.27, z);
    const b2 = box(0.7, 0.5, 0.55, boxMat);
    b2.position.set(x + 0.15, y + 0.8, z);
    add('배달상자', b1);
    add('배달상자', b2);
  }

  // ── 23 고양이 (빌보드) ──
  const catMat = sharedMat('prop-cat', { alpha: true });
  for (let i = 0; i < 4; i++) {
    const spot = trashSpots[Math.floor(rng() * trashSpots.length)];
    const c = plane(0.55, 0.55, catMat);
    c.position.set(spot.x + 1.2, spot.y + 0.28, spot.z + 1.2);
    c.rotation.y = rng() * Math.PI * 2;
    add('고양이', c);
  }

  // ── 24 자전거 거치대 ──
  const rackMat = sharedMat('prop-railing', { repeatX: 2, repeatY: 0.4 });
  for (let i = 0; i < 3; i++) {
    const x = -40 + i * 40;
    const z = SHOP_Z - 11.5;
    const y = H(x, z);
    for (let k = 0; k < 4; k++) {
      const r = box(0.06, 0.75, 0.9, rackMat);
      r.position.set(x + k * 0.5, y + 0.37, z);
      add('자전거거치대', r);
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
  const parasolMat = sharedMat('prop-parasol');
  for (let i = 0; i < 3; i++) {
    const x = -37 + i * 45;
    const z = SHOP_Z - 7.5;
    const y = H(x, z);
    const pole = cyl(0.05, 2.2, wireMat, 6);
    pole.position.set(x, y + 1.1, z);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.55, 10), parasolMat);
    top.position.set(x, y + 2.35, z);
    add('파라솔', pole);
    add('파라솔', top);
  }

  // ── 28 빨래건조대 (옥상) ──
  const laundryMat = sharedMat('prop-laundry', { alpha: true });
  let laundryCount = 0;
  for (const v of world.villas) {
    if (laundryCount >= 6 || rng() < 0.75) continue;
    const l = plane(1.5, 1.05, laundryMat);
    l.position.set(v.cx, v.base + v.h + 0.55, v.cz);
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
    const x = (vertical ? s : t) + (rng() < 0.5 ? -1 : 1) * (ROAD_HALF + 1.2);
    const z = (vertical ? t : s) + (rng() < 0.5 ? -1 : 1) * 1.5;
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

  // ── 30 상가 어닝 (차양) ──
  const awningMat = sharedMat('prop-parasol', { repeatX: 2, repeatY: 1 });
  for (let i = 0; i < 10; i += 2) {
    const sx = -67 + i * 15;
    const sz = SHOP_Z + 1.2;
    const y = H(sx, sz);
    const a = box(6, 0.12, 1.6, awningMat);
    a.position.set(sx, y + 3.1, sz);
    a.rotation.x = 0.25;
    add('어닝', a);
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
  for (let i = 0; i < 12; i++) {
    const isTruck = i % 3 === 2;
    const vertical = rng() < 0.5;
    const line = STREETS[Math.floor(rng() * STREETS.length)];
    const t = -70 + rng() * 130;
    const offset = (rng() < 0.5 ? -1 : 1) * (ROAD_HALF - 1.05);
    const x = vertical ? line + offset : t;
    const z = vertical ? t : line + offset;
    const car = (isTruck ? truck : sedan).clone(true);
    car.position.set(x, H(x, z), z);
    // 길이축을 골목 방향으로 + 약간의 주차 각 오차
    car.rotation.y = (vertical ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.12 + (rng() < 0.5 ? Math.PI : 0);
    group.add(car);
    const b = new THREE.Box3().setFromObject(car);
    world.colliders.push({
      minX: b.min.x - 0.05, maxX: b.max.x + 0.05,
      minY: b.min.y, maxY: b.max.y,
      minZ: b.min.z - 0.05, maxZ: b.max.z + 0.05,
    });
  }
  scene.add(group);
}
