import * as THREE from 'three';
import { STREETS, MAP_HALF, LANE_HALF } from './citymap.js';
import { VEHICLES } from './vehicles.js';
import { STOP_OFF } from './signals.js';

// §15.4 (FR-36) 차도 주행 차량 — 플레이어 스쿠터 최고 속도의 3배로 격자 차도를
// 직진하는 코믹한 존재. 치이면 즉시 체력 1 차감. §16.2 (FR-41): 유일한 예외로
// 보행 신호 파란불에는 정지선 앞에 급정거한다 (그 외 구간은 무브레이크 유지).
// 접근로·상가골목은 주행하지 않는다. 소품·볼라드와의 충돌 판정 없음(무자비함).
export const CAR_SPEED = VEHICLES.scooter.maxSpeed * 3; // 13 × 3 = 39
const LANE = 0.7; // 진행 방향별 차선 오프셋 (차도 반폭 1.9 안)
const COUNT = 6;
const HIT_HALF_LEN = 2.4; // 차 로컬 충돌 반경 (길이/폭)
const HIT_HALF_WID = 1.15;
// §19.4 (FR-62) 니어미스: 차체 바운딩에서 1m 여유 존을 스치면 경적 (치임과 별개)
const NEAR_MARGIN = 1.0;
const NEAR_COOLDOWN = 2.5; // 같은 차량 연속 트리거 방지 (초)
const BRAKE = 130; // 급정거 감속 (정지 거리 ≈ 5.9m — 정지선 간격 안)
const ACCEL = 30; // 재출발 가속

export class Traffic {
  constructor(scene, world, models, onHit, signals = null, onNearMiss = null) {
    this.world = world;
    this.onHit = onHit;
    this.onNearMiss = onNearMiss;
    this.signals = signals;
    this.group = new THREE.Group();
    this.group.name = 'traffic';
    scene.add(this.group);
    this.cars = [];
    for (let i = 0; i < COUNT; i++) {
      const model = (i % 3 === 2 ? models.truck : models.sedan).clone(true);
      this.group.add(model);
      const car = { model, axis: 'z', line: 0, dir: 1, t: 0, speed: CAR_SPEED, hornCd: 0 };
      this.respawn(car, true);
      this.cars.push(car);
    }
  }

  respawn(car, scatter = false) {
    car.axis = Math.random() < 0.5 ? 'x' : 'z';
    car.line = STREETS[Math.floor(Math.random() * STREETS.length)];
    car.dir = Math.random() < 0.5 ? -1 : 1;
    // 진입: 맵 반대편 끝에서. 초기 배치만 전 구간 산개
    car.t = scatter ? -MAP_HALF + Math.random() * MAP_HALF * 2 : -car.dir * (MAP_HALF + 6);
    car.speed = CAR_SPEED;
  }

  // §16.2 다음 정지선까지 진행 방향 거리 (이미 지난 선·교차로 내부는 무시)
  nextStopDist(car) {
    let best = Infinity;
    for (const c of STREETS) {
      const line = c - car.dir * STOP_OFF;
      const d = (line - car.t) * car.dir;
      if (d >= -0.3 && d < best) best = d;
    }
    return best;
  }

  update(dt, player, playing) {
    const H = this.world.groundHeight;
    for (const car of this.cars) {
      // 자기 축이 빨간불이면 정지선 앞 급정거, 녹색이면 최고속 복귀 — 그 외 무브레이크
      const go = this.signals ? this.signals.carsGo(car.axis) : true;
      if (!go) {
        const d = this.nextStopDist(car);
        if (d < (car.speed * car.speed) / (2 * BRAKE) + 1.0) {
          car.speed = Math.max(0, car.speed - BRAKE * dt);
          if (d <= 0.2 && car.speed < 3) car.speed = 0;
        } else {
          car.speed = Math.min(CAR_SPEED, car.speed + ACCEL * dt);
        }
      } else {
        car.speed = Math.min(CAR_SPEED, car.speed + ACCEL * dt);
      }
      car.t += car.dir * car.speed * dt;
      if (Math.abs(car.t) > MAP_HALF + 8) this.respawn(car);
      const lat = car.line + car.dir * LANE;
      const x = car.axis === 'z' ? lat : car.t;
      const z = car.axis === 'z' ? car.t : lat;
      car.model.position.set(x, H(x, z) + 0.03, z);
      const fx = car.axis === 'z' ? 0 : car.dir;
      const fz = car.axis === 'z' ? car.dir : 0;
      // 진행 방향 정렬 — Meshy 차량 GLB는 앞머리가 -x축 (vehicle 3종과 동일)
      car.model.rotation.y = Math.atan2(fz, -fx);

      if (!playing || !player) continue;
      // 플레이어 충돌: 차 로컬 프레임 박스 판정 (점프 중이면 높이로 회피 가능)
      const dx = player.pos.x - x;
      const dz = player.pos.z - z;
      const along = dx * fx + dz * fz;
      const across = dx * fz - dz * fx;
      const dy = player.pos.y - car.model.position.y;
      // 정지·서행(신호 대기) 중에는 무해 — 주행 중에만 치임
      car.hornCd = Math.max(0, car.hornCd - dt);
      if (car.speed > 3 && Math.abs(along) < HIT_HALF_LEN && Math.abs(across) < HIT_HALF_WID && dy < 1.5) {
        car.hornCd = NEAR_COOLDOWN; // 치인 직후 경적 억제 — 연출은 치임(§15.4+§19.2)이 담당
        this.onHit(car, fx, fz);
      } else if (
        // §19.4 (FR-62) 니어미스: 주행 차량이 충돌 박스 밖 1m 여유 존을 스칠 때 경적 1회
        car.speed > 3 && car.hornCd <= 0 && dy < 1.5
        && Math.abs(along) < HIT_HALF_LEN + NEAR_MARGIN && Math.abs(across) < HIT_HALF_WID + NEAR_MARGIN
      ) {
        car.hornCd = NEAR_COOLDOWN;
        this.onNearMiss?.(car);
      }
    }
  }
}
