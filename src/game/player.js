import * as THREE from 'three';
import { slopeFactor } from './heightfield.js';
import { VEHICLES } from './vehicles.js';
import { makeBlobShadow } from './shadow.js';

const GRAVITY = 24;
const RADIUS = 0.45;

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

    // Shift 스킬: 부스트 (쿨다운 5초, 지속 1.8초)
    if (input.down('ShiftLeft') && this.time >= (this.skillReadyAt ?? 0) && hasInput) {
      this.skillActiveUntil = this.time + 1.8;
      this.skillReadyAt = this.time + 5;
      this.audio?.play('skill');
    }

    // 목표 속도: 경사·페널티 반영
    let maxSpeed = v.maxSpeed;
    if (this.time < (this.skillActiveUntil ?? 0)) maxSpeed *= 1.5;
    if (this.time < this.speedPenaltyUntil) maxSpeed *= 0.45;
    if (hasInput) maxSpeed *= slopeFactor(this.pos.x, this.pos.z, dirX, dirZ);

    // 관성 수렴 (겨울 노면은 수렴 계수 급감 = 미끄러짐)
    const slip = this.slippery ? 0.32 : 1;
    const rate = (hasInput ? v.accelRate : v.brakeRate) * slip;
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
    const bob = this.grounded && speed2D > 0.5 ? Math.abs(Math.sin(this.time * 10)) * 0.06 : 0;
    this.bodyHolder.position.y = bob;
    this.bodyHolder.rotation.z = this.grounded && speed2D > 1 ? Math.sin(this.time * 10) * 0.04 : 0;
  }

  resolveCollisions() {
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
        this.pos.x += exits[0].x * exits[0].d;
        this.pos.z += exits[0].z * exits[0].d;
      }
    }
  }

  applySlowdown(seconds) { this.speedPenaltyUntil = this.time + seconds; }
  applyReverse(seconds) { this.controlsReversedUntil = this.time + seconds; }
  applyStun(seconds) {
    this.stunnedUntil = this.time + seconds;
    this.vel.x *= 0.2;
    this.vel.z *= 0.2;
  }
}
