import * as THREE from 'three';
import { terrainHeight } from './heightfield.js';
import { STREETS, ROAD_HALF, LANE_HALF } from './citymap.js';
import { tex, sharedMat } from './textures.js';

// §16.2 (FR-41) 교차로 신호 체계 — 횡단보도·정지선·보행/차량 신호등.
// 전 교차로(5×5) 공통의 전역 주기 하나로 동기: 구현 단순 + "일제히 서는" 코믹 연출.
// 행인은 차도에 내려서지 않으므로(§15.4) 신호 준수 대상은 차량뿐.
//
// 배치 원칙 (피드백 반영):
// - 신호등 헤드는 Meshy 3D 모델 (텍스처 박스 금지 피드백): 차량등은 한국식
//   가로형 3구 헤드를 5m 마스트+수평 암으로 차로 위에 매달고 양방향 각각
//   정면 헤드(등을 맞댄 2기), 보행등은 세로 2칸 헤드를 별도 낮은 기둥에 축 정렬
// - 등화 상태는 모델 소켓 위 자발광 오버레이(원반·픽토그램)의 가시성 토글 —
//   베이크드 텍스처는 상태 전환이 불가하기 때문
// - 횡단보도·정지선은 도로와 같은 방식으로 지형에 정합(버텍스 스냅)
export const CYCLE = 14; // 전체 주기 (초)
export const PED_GREEN = 5; // 뒤쪽 5초가 보행 파란불 (차량 정지)
export const STOP_OFF = ROAD_HALF + 2.6; // 교차로 중심 → 정지선 거리 (횡단보도 앞)

const CROSS_OFF = ROAD_HALF + 1.15; // 횡단보도 중심 오프셋
const CORNER = 3.35; // 신호 기둥의 모서리 오프셋 (도로 반폭 3 밖)
const MAST_H = 5.0; // 차량등 기둥 높이
const HEAD_H = 4.55; // 차량등 등화 중심 높이 (암 끝 아래)
const H = terrainHeight;

// 아틀라스 좌/우 반쪽 텍스처 (좌=빨강 서있는 / 우=초록 걷는 픽토그램)
// r135+는 clone이 Source를 공유해 로드 전 clone도 안전
function atlasHalf(name, right) {
  const t = tex(name).clone();
  t.repeat.set(0.5, 1);
  t.offset.set(right ? 0.5 : 0, 0);
  t.needsUpdate = true;
  return t;
}

export class Signals {
  // models: { car, ped } — loadModel 정규화(원점 발밑) 완료된 Meshy 헤드 유닛
  constructor(scene, models) {
    this.group = new THREE.Group();
    this.group.name = 'signals';
    scene.add(this.group);
    this.time = 0;
    this.carTpl = models.car;
    this.pedTpl = models.ped;
    this.carSize = new THREE.Box3().setFromObject(models.car).getSize(new THREE.Vector3());
    this.pedSize = new THREE.Box3().setFromObject(models.ped).getSize(new THREE.Vector3());
    // 등화 오버레이를 bbox 전면(차양 끝)이 아니라 실제 렌즈 표면에 밀착 —
    // 소켓 위치로 -z 레이캐스트해 표면 z를 실측 (차양 돌출 때문에 bbox는 뜬다)
    const probe = (tpl, pts, fallback) => {
      tpl.updateMatrixWorld(true);
      const rc = new THREE.Raycaster();
      return pts.map(([x, y]) => {
        rc.set(new THREE.Vector3(x, y, 10), new THREE.Vector3(0, 0, -1));
        const hit = rc.intersectObject(tpl, true)[0];
        return (hit ? hit.point.z : fallback) + 0.012;
      });
    };
    this.carLampZ = probe(this.carTpl,
      [[-this.carSize.x * 0.3, this.carSize.y * 0.5], [this.carSize.x * 0.3, this.carSize.y * 0.5]],
      this.carSize.z * 0.2);
    this.pedLampZ = probe(this.pedTpl,
      [[0, this.pedSize.y * 0.76], [0, this.pedSize.y * 0.50]],
      this.pedSize.z * 0.3);
    // 등화 오버레이 목록 (전역 상태 토글)
    this.carRedL = [];
    this.carGreenL = [];
    this.pedStandL = []; // 빨강 서있는 사람 (보행 금지 = 차량 녹색일 때)
    this.pedWalkL = []; // 초록 걷는 사람

    this.pedStandMat = new THREE.MeshBasicMaterial({ map: atlasHalf('prop-signal-ped', false) });
    this.pedWalkMat = new THREE.MeshBasicMaterial({ map: atlasHalf('prop-signal-ped', true) });
    this.lampRedMat = new THREE.MeshBasicMaterial({ color: 0xd2372b });
    this.lampGreenMat = new THREE.MeshBasicMaterial({ color: 0x2fae4e });

    // 횡단보도 줄무늬(텍스처의 가로 밴드)는 차량 진행 방향과 평행해야 한다.
    // 세로 골목(z축 주행)용은 텍스처를 90° 회전해 밴드를 z축으로
    const crossTexRot = tex('texture-crosswalk').clone();
    crossTexRot.center.set(0.5, 0.5);
    crossTexRot.rotation = Math.PI / 2;
    crossTexRot.needsUpdate = true;
    this.crossMatV = new THREE.MeshLambertMaterial({ map: crossTexRot });
    this.crossMatH = new THREE.MeshLambertMaterial({ map: tex('texture-crosswalk') });
    this.stopMat = new THREE.MeshLambertMaterial({ color: 0xd9d6cc }); // 노면 도색

    this.poleMat = sharedMat('prop-pole');
    this.geo = {
      mast: new THREE.CylinderGeometry(0.07, 0.1, MAST_H, 8),
      arm: new THREE.CylinderGeometry(0.05, 0.05, CORNER - 0.7 + 0.2, 6),
      pedPole: new THREE.CylinderGeometry(0.055, 0.08, 2.6, 8),
      lamp: new THREE.CircleGeometry(this.carSize.y * 0.24, 12),
      pict: new THREE.PlaneGeometry(this.pedSize.y * 0.30, this.pedSize.y * 0.30),
    };

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
        // 보행등 기둥 2기 (남은 대각 모서리) — 헤드는 골목 축에 정렬
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

  // 차량등 헤드 유닛: Meshy 가로형 3구 모델 + 좌(적)/우(녹) 자발광 원반 오버레이.
  // 로컬 전면 = +z 가정, 운전자 시점(전면에서 바라봄) 좌측이 빨강 — 한국 가로형 배열
  carHeadUnit() {
    const g = new THREE.Group();
    g.add(this.carTpl.clone(true));
    const W = this.carSize.x;
    const Hh = this.carSize.y;
    const mk = (mat, dx, z) => {
      const d = new THREE.Mesh(this.geo.lamp, mat);
      d.position.set(dx, Hh * 0.5, z);
      g.add(d);
      return d;
    };
    // 운전자(전면에서 바라보는) 시점 좌측이 빨강 — 실측으로 부호 확정
    this.carRedL.push(mk(this.lampRedMat, -W * 0.3, this.carLampZ[0]));
    this.carGreenL.push(mk(this.lampGreenMat, W * 0.3, this.carLampZ[1]));
    return g;
  }

  // 보행등 헤드 유닛: Meshy 세로 2칸 모델 + 위(빨강 서있는)/아래(초록 걷는) 픽토그램 오버레이
  pedHeadUnit() {
    const g = new THREE.Group();
    g.add(this.pedTpl.clone(true));
    const Hh = this.pedSize.y;
    const mk = (mat, hy, z) => {
      const p = new THREE.Mesh(this.geo.pict, mat);
      p.position.set(0, hy, z);
      g.add(p);
      return p;
    };
    this.pedStandL.push(mk(this.pedStandMat, Hh * 0.76, this.pedLampZ[0]));
    this.pedWalkL.push(mk(this.pedWalkMat, Hh * 0.50, this.pedLampZ[1]));
    return g;
  }

  // 차량 신호등 마스트: 모서리 기둥 + 차로 위로 뻗는 수평 암 + 양방향 정면 헤드 2기.
  // servesVertical=true면 세로 골목(z축 주행) 차로 위에서 ±z 방향을 마주본다
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
      arm.rotation.z = Math.PI / 2;
      arm.position.set(cx + armMidLane, base + MAST_H - 0.1, pz);
    } else {
      arm.rotation.x = Math.PI / 2;
      arm.position.set(px, base + MAST_H - 0.1, cz + armMidLane);
    }
    this.group.add(arm);

    const bottomY = base + HEAD_H - this.carSize.y * 0.5;
    for (const side of [-1, 1]) {
      const head = this.carHeadUnit();
      if (servesVertical) {
        head.position.set(cx + laneT, bottomY, pz + side * (this.carSize.z * 0.5 + 0.01));
        head.rotation.y = side > 0 ? 0 : Math.PI; // 전면(+z)이 바깥 → 양방향 정면
      } else {
        head.position.set(px + side * (this.carSize.z * 0.5 + 0.01), bottomY, cz + laneT);
        head.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      this.group.add(head);
    }
  }

  // 보행자 신호등: 낮은 별도 기둥 + 골목 축에 정렬된 세로 2칸 헤드 2기
  // (한 기둥이 인접 두 횡단보도를 각각 정면으로 담당)
  pedSignal(cx, cz, sx, sz) {
    const px = cx + sx * CORNER;
    const pz = cz + sz * CORNER;
    const base = H(px, pz);
    const pole = new THREE.Mesh(this.geo.pedPole, this.poleMat);
    pole.position.set(px, base + 1.3, pz);
    this.group.add(pole);
    const bottomY = base + 2.62 - this.pedSize.y; // 헤드 상단을 기둥 꼭대기에 정렬
    const h1 = this.pedHeadUnit(); // ±x 골목을 바라봄
    h1.position.set(px - sx * 0.13, bottomY, pz);
    h1.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    this.group.add(h1);
    const h2 = this.pedHeadUnit(); // ±z 골목을 바라봄
    h2.position.set(px, bottomY, pz - sz * 0.13);
    h2.rotation.y = sz > 0 ? Math.PI : 0;
    this.group.add(h2);
  }

  // 차량 진행 허용 여부 (traffic.js가 매 프레임 조회)
  carsGo() {
    return (this.time % CYCLE) < CYCLE - PED_GREEN;
  }

  applyState(go) {
    this.lastState = go;
    for (const m of this.carRedL) m.visible = !go;
    for (const m of this.carGreenL) m.visible = go;
    for (const m of this.pedStandL) m.visible = go;
    for (const m of this.pedWalkL) m.visible = !go;
  }

  update(dt) {
    this.time += dt;
    const now = this.carsGo();
    if (now !== this.lastState) this.applyState(now);
  }
}
