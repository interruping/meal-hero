import * as THREE from 'three';
import { slopeFactor } from './heightfield.js';
import { VEHICLES } from './vehicles.js';
import { makeBlobShadow } from './shadow.js';

const GRAVITY = 24;
const RADIUS = 0.45;

// FR-26 대시 (§14.1): 3초간 부스트, 쿨타임 10초(종료 시점부터), 대시 중 조향 감쇠
export const DASH_DURATION = 3;
export const DASH_COOLDOWN = 10;
const DASH_MULT = 2.25; // §17.5 (FR-51) 1.5 → 2.25 (+50%)
const DASH_STEER = 0.12; // 대시 중 속도 벡터 수렴 계수 — 회전 반경 확대

// FR-1 이동·점프·중력 + FR-2 탈것 관성 + FR-14 겨울 미끄러짐
export class Player {
  constructor(world, scene) {
    this.world = world;
    this.pos = world.spawn.clone();
    this.vel = new THREE.Vector3();
    this.heading = 0; // 바라보는 방향 (rad)
    this.grounded = true;
    this.vehicle = VEHICLES.run;
    this.slippery = false; // 겨울 노면
    this.speedPenaltyUntil = 0; // 전단지 알바생 등 감속 효과 만료 시각
    this.controlsReversedUntil = 0; // 취객 조작 반전
    this.stunnedUntil = 0; // 충돌 경직
    this.time = 0;

    // 비주얼 홀더 — 블록아웃 캡슐, FR-18에서 Meshy GLB 교체
    this.rig = new THREE.Group();
    this.bodyHolder = new THREE.Group();
    this.rig.add(this.bodyHolder);
    const placeholder = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x777777 }),
    );
    placeholder.position.y = 0.8;
    placeholder.name = 'placeholder';
    this.bodyHolder.add(placeholder);
    scene.add(this.rig);
    this.shadow = makeBlobShadow(0.55);
    scene.add(this.shadow);
  }

  setVehicle(key) {
    this.vehicle = VEHICLES[key];
    this.vehicleKey = key;
  }

  reset(pos) {
    this.pos.copy(pos ?? this.world.spawn);
    this.vel.set(0, 0, 0);
    this.heading = Math.PI; // 마을 쪽(-z) 바라보기
    this.speedPenaltyUntil = 0;
    this.controlsReversedUntil = 0;
    this.stunnedUntil = 0;
    this.dashUntil = 0;
    this.dashReadyAt = 0;
  }

  // FR-27 에너지 드링크: 대시 쿨타임 즉시 초기화
  resetDashCooldown() {
    this.dashUntil = 0;
    this.dashReadyAt = 0;
  }

  update(dt, input, camYaw) {
    this.time += dt;
    const v = this.vehicle;

    // 입력 → 카메라 기준 이동 방향
    let ix = 0, iz = 0;
    if (input.down('KeyW')) iz -= 1;
    if (input.down('KeyS')) iz += 1;
    if (input.down('KeyA')) ix -= 1;
    if (input.down('KeyD')) ix += 1;
    if (this.time < this.controlsReversedUntil) { ix = -ix; iz = -iz; }
    if (this.time < this.stunnedUntil) { ix = 0; iz = 0; }

    const hasInput = ix !== 0 || iz !== 0;
    let dirX = 0, dirZ = 0;
    if (hasInput) {
      const len = Math.hypot(ix, iz);
      // 카메라 전방 F=(sin yaw, cos yaw), 우측 R=(-cos yaw, sin yaw)
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      dirX = (-ix * cos - iz * sin) / len;
      dirZ = (ix * sin - iz * cos) / len;
    }

    // FR-26 대시 (§14.1): Shift — 3초간 1.5×, 종료 후 쿨타임 10초
    if (input.down('ShiftLeft') && this.time >= (this.dashReadyAt ?? 0) && hasInput) {
      this.dashUntil = this.time + DASH_DURATION;
      this.dashReadyAt = this.time + DASH_DURATION + DASH_COOLDOWN;
      this.audio?.play('skill');
    }
    const dashing = this.time < (this.dashUntil ?? 0);
    this.isDashing = dashing; // §17.5 바람 이펙트(windfx)가 조회

    // 목표 속도: 경사·페널티 반영
    let maxSpeed = v.maxSpeed;
    if (dashing) maxSpeed *= DASH_MULT;
    if (this.time < this.speedPenaltyUntil) maxSpeed *= 0.45;
    if (hasInput) maxSpeed *= slopeFactor(this.pos.x, this.pos.z, dirX, dirZ);

    // 관성 수렴 (겨울 노면은 수렴 계수 급감 = 미끄러짐).
    // 대시 중엔 수렴이 느려져 코너링이 완만해진다 — 속도의 대가 (§14.1)
    const slip = this.slippery ? 0.32 : 1;
    const steer = dashing ? DASH_STEER : 1;
    const rate = (hasInput ? v.accelRate : v.brakeRate) * slip * steer;
    const k = 1 - Math.exp(-rate * dt);
    this.vel.x += (dirX * maxSpeed - this.vel.x) * k;
    this.vel.z += (dirZ * maxSpeed - this.vel.z) * k;

    // 점프·중력
    const gh = this.world.groundHeight(this.pos.x, this.pos.z);
    if (this.grounded && input.justPressed('Space') && this.time >= this.stunnedUntil) {
      this.vel.y = v.jumpVel;
      this.grounded = false;
      this.audio?.play('jump');
    }
    this.vel.y -= GRAVITY * dt;

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;

    // 지면 판정
    const gh2 = this.world.groundHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= gh2) {
      this.pos.y = gh2;
      this.vel.y = 0;
      this.grounded = true;
    } else if (this.pos.y > gh2 + 0.05) {
      this.grounded = false;
    }

    this.resolveCollisions();

    // 바라보는 방향은 이동 방향으로 부드럽게
    const speed2D = Math.hypot(this.vel.x, this.vel.z);
    if (speed2D > 0.5) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let diff = target - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * (1 - Math.exp(-v.turnRate * dt));
    }

    // 블롭 섀도: 지면에 고정, 공중에 뜨면 축소 (§7.6)
    const shadowY = this.world.groundHeight(this.pos.x, this.pos.z);
    this.shadow.position.set(this.pos.x, shadowY + 0.05, this.pos.z);
    const airGap = Math.min(this.pos.y - shadowY, 4);
    this.shadow.scale.setScalar(Math.max(0.4, 1 - airGap * 0.15));

    // 비주얼 동기화 + 통짜 바운스 (§7.7 관절 애니메이션 최소)
    this.rig.position.copy(this.pos);
    this.rig.rotation.y = this.heading;

    // 걷기 애니메이션 (구보): 속도 비례 다리 스윙 위상
    const isRun = this.vehicleKey === 'run' || !this.vehicleKey;
    this.walkPhase = (this.walkPhase ?? 0) + speed2D * dt * 2.6;
    const targetAmp = isRun && this.grounded && speed2D > 0.4
      ? Math.min(speed2D / v.maxSpeed, 1)
      : 0;
    this.walkAmp = (this.walkAmp ?? 0) + (targetAmp - (this.walkAmp ?? 0)) * (1 - Math.exp(-10 * dt));
    this.onWalkUpdate?.(this.walkPhase, this.walkAmp);

    const bob = this.grounded && speed2D > 0.5 ? Math.abs(Math.sin(this.walkPhase)) * (isRun ? 0.05 : 0.03) : 0;
    this.bodyHolder.position.y = bob;

    // 탈것: 코너링 기울임(뱅킹), 구보: 좌우 사보 흔들림
    if (!isRun) {
      const headingRate = (this.heading - (this._prevHeading ?? this.heading)) / Math.max(dt, 1e-4);
      const targetLean = Math.max(-0.35, Math.min(0.35, -headingRate * 0.05 * Math.min(speed2D / 8, 1)));
      this._lean = (this._lean ?? 0) + (targetLean - (this._lean ?? 0)) * (1 - Math.exp(-8 * dt));
      this.bodyHolder.rotation.z = this._lean;
    } else {
      this.bodyHolder.rotation.z = this.grounded && speed2D > 1 ? Math.sin(this.walkPhase) * 0.03 : 0;
    }
    this._prevHeading = this.heading;
  }

  resolveCollisions() {
    // 벽 법선 방향 진입 속도 최대값 — 과속 정면 충돌 판정용 (스치는 접촉은 법선 성분 작음).
    // 신규 접촉만 집계: 벽에 밀착한 채 전진키를 유지하면 속도 벡터가 다시 차올라
    // 접촉 프레임마다 재판정되므로, 떨어졌다 다시 부딪힐 때만 충돌로 친다
    let maxImpact = 0;
    const touching = new Set();
    for (const c of this.world.colliders) {
      if (this.pos.y > c.maxY || this.pos.y + 1.6 < c.minY) continue;
      const nx = Math.max(c.minX, Math.min(this.pos.x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(this.pos.z, c.maxZ));
      const dx = this.pos.x - nx;
      const dz = this.pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= RADIUS * RADIUS) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = RADIUS - d;
        const into = -(this.vel.x * (dx / d) + this.vel.z * (dz / d));
        touching.add(c);
        if (into > maxImpact && !this._touching?.has(c)) maxImpact = into;
        this.pos.x += (dx / d) * push;
        this.pos.z += (dz / d) * push;
      } else {
        // 박스 내부: 가장 가까운 면으로 밀어냄
        const exits = [
          { d: this.pos.x - c.minX + RADIUS, x: -1, z: 0 },
          { d: c.maxX - this.pos.x + RADIUS, x: 1, z: 0 },
          { d: this.pos.z - c.minZ + RADIUS, x: 0, z: -1 },
          { d: c.maxZ - this.pos.z + RADIUS, x: 0, z: 1 },
        ];
        exits.sort((a, b) => a.d - b.d);
        const into = -(this.vel.x * exits[0].x + this.vel.z * exits[0].z);
        touching.add(c);
        if (into > maxImpact && !this._touching?.has(c)) maxImpact = into;
        this.pos.x += exits[0].x * exits[0].d;
        this.pos.z += exits[0].z * exits[0].d;
      }
    }
    this._touching = touching;
    if (maxImpact > 0) this.onWallImpact?.(maxImpact);
  }

  applySlowdown(seconds) { this.speedPenaltyUntil = this.time + seconds; }

  // 전단지 피격: 날아온 방향 그대로 밀려남(맞은 방향 반대) + 잠깐 조작 불능 + 빨간 점멸
  applyPaperHit(vel) {
    const len = Math.hypot(vel.x, vel.z) || 1;
    this.stunnedUntil = this.time + 0.55; // applyStun과 달리 넉백 속도를 살린다
    this.vel.x = (vel.x / len) * 4.2;
    this.vel.z = (vel.z / len) * 4.2;
    this.flashUntil = this.time + 0.45;
  }
  applyReverse(seconds) { this.controlsReversedUntil = this.time + seconds; }
  applyStun(seconds) {
    this.stunnedUntil = this.time + seconds;
    this.vel.x *= 0.2;
    this.vel.z *= 0.2;
  }
}
