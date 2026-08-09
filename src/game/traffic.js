import * as THREE from 'three';
import { STREETS, MAP_HALF, LANE_HALF } from './citymap.js';
import { VEHICLES } from './vehicles.js';

// §15.4 (FR-36) 차도 주행 차량 — 플레이어 스쿠터 최고 속도의 3배로, 브레이크를
// 전혀 밟지 않고 격자 차도를 직진하는 코믹한 존재. 치이면 즉시 체력 1 차감.
// 접근로·상가골목은 주행하지 않는다. 소품·볼라드와의 충돌 판정 없음(무자비함).
export const CAR_SPEED = VEHICLES.scooter.maxSpeed * 3; // 13 × 3 = 39
const LANE = 0.7; // 진행 방향별 차선 오프셋 (차도 반폭 1.9 안)
const COUNT = 6;
const HIT_HALF_LEN = 2.4; // 차 로컬 충돌 반경 (길이/폭)
const HIT_HALF_WID = 1.15;

export class Traffic {
  constructor(scene, world, models, onHit) {
    this.world = world;
    this.onHit = onHit;
    this.group = new THREE.Group();
    this.group.name = 'traffic';
    scene.add(this.group);
    this.cars = [];
    for (let i = 0; i < COUNT; i++) {
      const model = (i % 3 === 2 ? models.truck : models.sedan).clone(true);
      this.group.add(model);
      const car = { model, axis: 'z', line: 0, dir: 1, t: 0 };
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
  }

  update(dt, player, playing) {
    const H = this.world.groundHeight;
    for (const car of this.cars) {
      car.t += car.dir * CAR_SPEED * dt;
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
      if (Math.abs(along) < HIT_HALF_LEN && Math.abs(across) < HIT_HALF_WID && dy < 1.5) {
        this.onHit(car, fx, fz);
      }
    }
  }
}
