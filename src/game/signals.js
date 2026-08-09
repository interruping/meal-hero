import * as THREE from 'three';
import { terrainHeight } from './heightfield.js';
import { STREETS, ROAD_HALF, LANE_HALF } from './citymap.js';
import { tex, sharedMat } from './textures.js';

// §16.2 (FR-41) 교차로 신호 체계 — 횡단보도·정지선·보행/차량 신호등.
// 전 교차로(5×5) 공통의 전역 주기 하나로 동기: 구현 단순 + "일제히 서는" 코믹 연출.
// 행인은 차도에 내려서지 않으므로(§15.4) 신호 준수 대상은 차량뿐.
//
// 배치 원칙 (피드백 반영):
// - 차량 신호등은 5m 마스트 기둥 + 수평 암으로 차로 위 높이에 매달고, 등화면이
//   해당 골목의 양방향 주행 차량을 정면으로 마주본다 (앞뒤 양면 등화)
// - 보행자 신호등은 별도의 낮은 기둥(2.6m)에 분리 — 차량등과 섞어 쌓지 않는다
// - 횡단보도·정지선은 도로와 같은 방식으로 지형에 정합(버텍스 스냅) — 경사에서
//   평판이 노면 아래로 파묻혀 중간이 끊겨 보이던 문제 제거
export const CYCLE = 14; // 전체 주기 (초)
export const PED_GREEN = 5; // 뒤쪽 5초가 보행 파란불 (차량 정지)
export const STOP_OFF = ROAD_HALF + 2.6; // 교차로 중심 → 정지선 거리 (횡단보도 앞)

const CROSS_OFF = ROAD_HALF + 1.15; // 횡단보도 중심 오프셋
const CORNER = 3.35; // 신호 기둥의 모서리 오프셋 (도로 반폭 3 밖)
const MAST_H = 5.0; // 차량등 기둥 높이
const HEAD_H = 4.55; // 차량등 등화 높이 (암 끝)
const H = terrainHeight;

// 아틀라스 좌/우 반쪽 텍스처 (좌=빨강, 우=초록) — r135+는 clone이 Source 공유라 로드 전 clone 안전
function atlasHalf(name, right) {
  const t = tex(name).clone();
  t.repeat.set(0.5, 1);
  t.offset.set(right ? 0.5 : 0, 0);
  t.needsUpdate = true;
  return t;
}

// 등화 전면: 텍스처 자발광 (어두운 하우징 픽셀은 그대로 어둡다)
function faceMat(map) {
  return new THREE.MeshLambertMaterial({
    map, emissive: 0xffffff, emissiveMap: map,
  });
}

const HOUSING = new THREE.MeshLambertMaterial({ color: 0x2b2b28 });

export class Signals {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'signals';
    scene.add(this.group);
    this.time = 0;
    this.carHeads = [];
    this.pedHeads = [];
    this.mats = {
      carRed: faceMat(atlasHalf('prop-signal-car', false)),
      carGreen: faceMat(atlasHalf('prop-signal-car', true)),
      pedRed: faceMat(atlasHalf('prop-signal-ped', false)),
      pedGreen: faceMat(atlasHalf('prop-signal-ped', true)),
    };

    // 횡단보도 줄무늬(텍스처의 가로 밴드)는 차량 진행 방향과 평행해야 한다.
    // 세로 골목(z축 주행)용은 텍스처를 90° 회전해 밴드를 z축으로
    const crossTexRot = tex('texture-crosswalk').clone();
    crossTexRot.center.set(0.5, 0.5);
    crossTexRot.rotation = Math.PI / 2;
    crossTexRot.needsUpdate = true;
    this.crossMatV = new THREE.MeshLambertMaterial({ map: crossTexRot });
    this.crossMatH = new THREE.MeshLambertMaterial({ map: tex('texture-crosswalk') });
    this.stopMat = new THREE.MeshLambertMaterial({ color: 0xd9d6cc }); // 노면 도색

    const poleMat = sharedMat('prop-pole');
    this.geo = {
      mast: new THREE.CylinderGeometry(0.07, 0.1, MAST_H, 8),
      arm: new THREE.CylinderGeometry(0.05, 0.05, CORNER - 0.7 + 0.2, 6),
      pedPole: new THREE.CylinderGeometry(0.055, 0.08, 2.6, 8),
      carHead: new THREE.BoxGeometry(0.5, 0.95, 0.26),
      pedHead: new THREE.BoxGeometry(0.42, 0.5, 0.2),
    };
    this.poleMat = poleMat;

    for (const cx of STREETS) {
      for (const cz of STREETS) {
        // 노면 표식: 횡단보도 4방 + 정지선 4방 (전부 지형 정합)
        for (const dir of [-1, 1]) {
          this.paint(cx, cz + dir * CROSS_OFF, LANE_HALF * 2, 2.1, this.crossMatV, 0.055);
          this.paint(cx + dir * CROSS_OFF, cz, 2.1, LANE_HALF * 2, this.crossMatH, 0.055);
          this.paint(cx, cz + dir * STOP_OFF, LANE_HALF * 2, 0.36, this.stopMat, 0.06);
          this.paint(cx + dir * STOP_OFF, cz, 0.36, LANE_HALF * 2, this.stopMat, 0.06);
        }
        // 차량등 마스트 2기 (대각 모서리): +모서리는 세로 골목 차로 위, −모서리는 가로 골목 차로 위
        this.mast(cx, cz, +1, true);
        this.mast(cx, cz, -1, false);
        // 보행등 기둥 2기 (남은 대각 모서리) — 교차로 중심을 바라봄
        this.pedSignal(cx, cz, +1, -1);
        this.pedSignal(cx, cz, -1, +1);
      }
    }
    this.lastState = null;
    this.applyState(true);
  }

  // 노면 표식: 도로 스트립과 동일하게 버텍스를 지형 높이에 스냅 (경사 파묻힘 방지)
  paint(cx, cz, w, d, mat, lift) {
    const geo = new THREE.PlaneGeometry(w, d, Math.max(1, Math.ceil(w / 1.2)), Math.max(1, Math.ceil(d / 1.2)));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = cx + pos.getX(i);
      const z = cz + pos.getZ(i);
      pos.setX(i, x);
      pos.setY(i, H(x, z) + lift);
      pos.setZ(i, z);
    }
    geo.computeVertexNormals();
    this.group.add(new THREE.Mesh(geo, mat));
  }

  // 차량 신호등 마스트: 모서리 기둥 + 차로 위로 뻗는 수평 암 + 양면 등화 헤드.
  // servesVertical=true면 세로 골목(z축 주행) 차로 위에 매달려 ±z 방향을 마주본다
  mast(cx, cz, corner, servesVertical) {
    const px = cx + corner * CORNER;
    const pz = cz + corner * CORNER;
    const base = H(px, pz);
    const pole = new THREE.Mesh(this.geo.mast, this.poleMat);
    pole.position.set(px, base + MAST_H / 2, pz);
    this.group.add(pole);

    const laneT = corner * 0.7; // 암 끝 = 가까운 차선 중심 위
    const arm = new THREE.Mesh(this.geo.arm, this.poleMat);
    const armMidLane = (corner * CORNER + laneT) / 2;
    if (servesVertical) {
      arm.rotation.z = Math.PI / 2; // 암을 x축으로
      arm.position.set(cx + armMidLane, base + MAST_H - 0.1, pz);
    } else {
      arm.rotation.x = Math.PI / 2; // 암을 z축으로
      arm.position.set(px, base + MAST_H - 0.1, cz + armMidLane);
    }
    this.group.add(arm);

    // 등화 헤드: +z/−z(또는 ±x) 양면 등화 — 해당 골목 양방향 차량이 정면으로 본다
    const head = new THREE.Mesh(this.geo.carHead, [
      HOUSING, HOUSING, HOUSING, HOUSING, this.mats.carRed, this.mats.carRed,
    ]);
    if (servesVertical) {
      head.position.set(cx + laneT, base + HEAD_H, pz);
    } else {
      head.position.set(px, base + HEAD_H, cz + laneT);
      head.rotation.y = Math.PI / 2; // 등화면을 ±x로
    }
    this.group.add(head);
    this.carHeads.push(head);
  }

  // 보행자 신호등: 낮은 별도 기둥, 등화면이 교차로 중심(횡단보도들)을 바라봄
  pedSignal(cx, cz, sx, sz) {
    const px = cx + sx * CORNER;
    const pz = cz + sz * CORNER;
    const base = H(px, pz);
    const pole = new THREE.Mesh(this.geo.pedPole, this.poleMat);
    pole.position.set(px, base + 1.3, pz);
    this.group.add(pole);
    const head = new THREE.Mesh(this.geo.pedHead, [
      HOUSING, HOUSING, HOUSING, HOUSING, this.mats.pedRed, HOUSING,
    ]);
    head.position.set(px, base + 2.3, pz);
    head.rotation.y = Math.atan2(cx - px, cz - pz); // 전면(+z)이 교차로 중심을 향해
    this.group.add(head);
    this.pedHeads.push(head);
  }

  // 차량 진행 허용 여부 (traffic.js가 매 프레임 조회)
  carsGo() {
    return (this.time % CYCLE) < CYCLE - PED_GREEN;
  }

  applyState(go) {
    this.lastState = go;
    const car = go ? this.mats.carGreen : this.mats.carRed;
    const ped = go ? this.mats.pedRed : this.mats.pedGreen;
    for (const m of this.carHeads) {
      m.material[4] = car;
      m.material[5] = car;
    }
    for (const m of this.pedHeads) m.material[4] = ped;
  }

  update(dt) {
    this.time += dt;
    const now = this.carsGo();
    if (now !== this.lastState) this.applyState(now);
  }
}
