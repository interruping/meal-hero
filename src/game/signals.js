import * as THREE from 'three';
import { terrainHeight } from './heightfield.js';
import { STREETS, ROAD_HALF, LANE_HALF } from './citymap.js';
import { tex, sharedMat } from './textures.js';

// §16.2 (FR-41) 교차로 신호 체계 — 횡단보도·정지선·보행/차량 신호등.
// 전 교차로(5×5) 공통의 전역 주기 하나로 동기: 구현 단순 + "일제히 서는" 코믹 연출.
// 행인은 차도에 내려서지 않으므로(§15.4) 신호 준수 대상은 차량뿐.
export const CYCLE = 14; // 전체 주기 (초)
export const PED_GREEN = 5; // 뒤쪽 5초가 보행 파란불 (차량 정지)
export const STOP_OFF = ROAD_HALF + 2.6; // 교차로 중심 → 정지선 거리 (횡단보도 앞)

const CROSS_OFF = ROAD_HALF + 1.15; // 횡단보도 중심 오프셋
const H = terrainHeight;

// 아틀라스 좌/우 반쪽 텍스처 (좌=빨강, 우=초록)
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

    // 줄무늬(텍스처의 가로 밴드)는 차량 진행 방향과 평행해야 한다.
    // 세로 골목(z축 주행): 풋프린트 x3.8×z2.1 + 텍스처 90° 회전 (밴드 → z)
    // 가로 골목(x축 주행): 풋프린트 x2.1×z3.8 + 원본 텍스처 (밴드 → x)
    const crossGeoV = new THREE.PlaneGeometry(LANE_HALF * 2, 2.1);
    crossGeoV.rotateX(-Math.PI / 2);
    const crossGeoH = new THREE.PlaneGeometry(2.1, LANE_HALF * 2);
    crossGeoH.rotateX(-Math.PI / 2);
    const crossTexRot = tex('texture-crosswalk').clone();
    crossTexRot.center.set(0.5, 0.5);
    crossTexRot.rotation = Math.PI / 2;
    crossTexRot.needsUpdate = true;
    const crossMatV = new THREE.MeshLambertMaterial({ map: crossTexRot });
    const crossMatH = new THREE.MeshLambertMaterial({ map: tex('texture-crosswalk') });
    const stopGeoV = new THREE.PlaneGeometry(LANE_HALF * 2, 0.36);
    stopGeoV.rotateX(-Math.PI / 2);
    const stopGeoH = new THREE.PlaneGeometry(0.36, LANE_HALF * 2);
    stopGeoH.rotateX(-Math.PI / 2);
    const stopMat = new THREE.MeshLambertMaterial({ color: 0xd9d6cc }); // 노면 도색 (정지선)
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 3.1, 8);
    const poleMat = sharedMat('prop-pole');
    const carHeadGeo = new THREE.BoxGeometry(0.5, 0.95, 0.26);
    const pedHeadGeo = new THREE.BoxGeometry(0.5, 0.55, 0.22);

    for (const cx of STREETS) {
      for (const cz of STREETS) {
        // 횡단보도 4방 + 정지선 4방 (진행 방향별 — 정지선은 접근 차선 쪽)
        for (const dir of [-1, 1]) {
          this.flat(crossGeoV, crossMatV, cx, cz + dir * CROSS_OFF, 0.055);
          this.flat(crossGeoH, crossMatH, cx + dir * CROSS_OFF, cz, 0.055);
          this.flat(stopGeoV, stopMat, cx, cz + dir * STOP_OFF, 0.06);
          this.flat(stopGeoH, stopMat, cx + dir * STOP_OFF, cz, 0.06);
        }
        // 신호등 기둥 2개 (대각 모서리) — 차량등 2방향 + 보행등
        for (const corner of [1, -1]) {
          const px = cx + corner * 3.35;
          const pz = cz + corner * 3.35;
          const base = H(px, pz);
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(px, base + 1.55, pz);
          this.group.add(pole);
          // 차량등: 세로 골목 주행 차량용(z축을 바라봄) + 가로 골목용(x축을 바라봄)
          // 같은 자리에 겹치면 z-fighting으로 등화면이 가려진다 — 높이 분리 스택
          this.head(carHeadGeo, this.carHeads, px, base + 2.85, pz, corner > 0 ? Math.PI : 0);
          this.head(carHeadGeo, this.carHeads, px, base + 2.42, pz, corner > 0 ? -Math.PI / 2 : Math.PI / 2);
          // 보행등: 교차로 안쪽을 바라봄
          this.head(pedHeadGeo, this.pedHeads, px, base + 1.92, pz, corner > 0 ? Math.PI * 0.75 : -Math.PI * 0.25);
        }
      }
    }
    this.lastState = null;
    this.applyState(true);
  }

  flat(geo, mat, x, z, lift) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, H(x, z) + lift, z);
    this.group.add(m);
  }

  head(geo, list, x, y, z, yaw) {
    // BoxGeometry 면 순서: +x,-x,+y,-y,+z,-z — 전면(+z)만 등화 아틀라스
    const m = new THREE.Mesh(geo, [HOUSING, HOUSING, HOUSING, HOUSING, this.mats.carRed, HOUSING]);
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    this.group.add(m);
    list.push(m);
  }

  // 차량 진행 허용 여부 (traffic.js가 매 프레임 조회)
  carsGo() {
    return (this.time % CYCLE) < CYCLE - PED_GREEN;
  }

  applyState(go) {
    this.lastState = go;
    for (const m of this.carHeads) m.material[4] = go ? this.mats.carGreen : this.mats.carRed;
    for (const m of this.pedHeads) m.material[4] = go ? this.mats.pedRed : this.mats.pedGreen;
  }

  update(dt) {
    this.time += dt;
    const now = this.carsGo();
    if (now !== this.lastState) this.applyState(now);
  }
}
