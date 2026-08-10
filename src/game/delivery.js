import * as THREE from 'three';
import { DELIVERY_PAY, NEAR_PAY, SURGE_ADD, SURGE_WINDOW } from './stages.js';

// FR-19 다중 배달 (§12.1): 상단 의뢰 슬롯 4개 — 랜덤 노출, 10초 미수락 시 소멸,
// 1~4 키 수락, 동시 진행 최대 3건. 제한 시간은 수락 시점의
// (플레이어→가게→목적지) 거리 기반으로 계산하고 수락 직후부터 카운트다운.
const INTERACT_DIST = 3.2;
const DETOUR_COEF = 1.7; // 직선거리 → 골목 우회 보정
const TIME_BUFFER = 8; // 초
export const NUM_SLOTS = 4;
export const MAX_ACTIVE = 3;
export const OFFER_TTL = 10;
// 동시 배달 3건 구분 색 (§7.4 포인트 컬러 계열)
export const DELIVERY_COLORS = [0xb5372f, 0x4f6d8f, 0xc9a13b];
export const DELIVERY_COLORS_CSS = ['#b5372f', '#4f6d8f', '#c9a13b'];

// 목적지 마커: 역원뿔 + 광선 기둥 (배달 색상별 3세트)
function makeMarker(scene, color) {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1, 6),
    new THREE.MeshBasicMaterial({ color }),
  );
  cone.rotation.x = Math.PI;
  cone.position.y = 2.6;
  g.add(cone);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 26, 6, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  beam.position.y = 13;
  g.add(beam);
  g.visible = false;
  scene.add(g);
  return { group: g, cone };
}

export class DeliveryManager {
  constructor(world, player, scene, events) {
    this.world = world;
    this.player = player;
    // { onAccept, onFull, onPickupRequest, onPickedUp, onDelivered(d), onExpired(d) }
    this.events = events;
    this.slots = new Array(NUM_SLOTS).fill(null);
    this.slotCooldown = new Array(NUM_SLOTS).fill(0);
    this.active = [];
    this.markers = DELIVERY_COLORS.map((c) => makeMarker(scene, c));
    this.time = 0;
    this._seq = 0;
  }

  reset(stage) {
    this.slots.fill(null);
    this.active = [];
    for (const m of this.markers) m.group.visible = false;
    // 시작 웨이브: 2~4개가 랜덤 슬롯에 등장, 나머지는 쿨다운 대기
    const initial = 2 + Math.floor(Math.random() * (NUM_SLOTS - 1));
    const order = [...Array(NUM_SLOTS).keys()].sort(() => Math.random() - 0.5);
    for (let k = 0; k < NUM_SLOTS; k++) {
      const i = order[k];
      if (k < initial) {
        this.slotCooldown[i] = 0.6 + k * 0.35; // 순차 등장 연출
      } else {
        this.slotCooldown[i] = this.refillDelay(stage);
      }
    }
  }

  refillDelay(stage) {
    // orderGap이 작을수록(후반 스테이지) 의뢰가 자주 뜬다. TTL 10초와 조합해
    // 화면엔 보통 2~3개, 가끔 4개 풀로 차는 리듬
    const gap = stage?.orderGap ?? 2.2;
    return gap * 2 + Math.random() * 6;
  }

  spawnOffer(i) {
    // §17.3 (FR-49) 다른 슬롯에 노출 중인 가게 제외 — 같은 가게 의뢰 동시 노출 금지.
    // 진행 중(active) 배달의 가게와는 중복 허용. 가게 14곳 ≥ 슬롯 4개라 풀은 항상 남는다
    const used = new Set(this.slots.filter(Boolean).map((o) => o.shop));
    const pool = this.world.shops.filter((s) => !used.has(s));
    const shop = pool[Math.floor(Math.random() * pool.length)];
    const door = this.world.doors[Math.floor(Math.random() * this.world.doors.length)];
    const dist = shop.pos.distanceTo(door.pos);
    // §18.1 (FR-54) 단가는 동적 — 최근접·급등 여부에 따라 update()가 매 프레임 갱신
    this.slots[i] = { id: ++this._seq, shop, door, dist, pay: DELIVERY_PAY, surge: false, ttl: OFFER_TTL };
  }

  acceptSlot(i, vehicle) {
    const offer = this.slots[i];
    if (!offer) return;
    if (this.active.length >= MAX_ACTIVE) {
      this.events.onFull?.();
      return;
    }
    this.slots[i] = null;
    this.slotCooldown[i] = this.refillDelay(this._stage);
    const approach = this.player.pos.distanceTo(offer.shop.pos);
    const limit = ((approach + offer.dist) * DETOUR_COEF) / vehicle.maxSpeed + TIME_BUFFER;
    const used = new Set(this.active.map((d) => d.colorIdx));
    const colorIdx = [0, 1, 2].find((c) => !used.has(c));
    const d = { ...offer, limit, timeLeft: limit, phase: 'pickup', colorIdx };
    this.active.push(d);
    this.events.onAccept?.(d);
  }

  // 픽업 확정 (FR-24 수령 코드 매칭 결과에 따라 game이 호출. 페널티 초 차감 가능)
  confirmPickup(d, timePenalty = 0) {
    if (d.phase !== 'pickup' || !this.active.includes(d)) return;
    d.phase = 'carry';
    if (timePenalty > 0) d.timeLeft = Math.max(0.01, d.timeLeft - timePenalty);
    this.events.onPickedUp?.(d);
  }

  removeActive(d) {
    const idx = this.active.indexOf(d);
    if (idx >= 0) this.active.splice(idx, 1);
  }

  targetOf(d) {
    return d.phase === 'pickup' ? d.shop.pos : d.door.pos;
  }

  // 남은 시간이 가장 급박한 진행 건 (HUD 화살표 대상)
  urgent() {
    if (!this.active.length) return null;
    return this.active.reduce((a, b) => (a.timeLeft <= b.timeLeft ? a : b));
  }

  // E 상호작용 후보: 가장 가까운 픽업 가게 or 전달 현관
  nearestInteractable() {
    const p = this.player.pos;
    let best = null;
    let bestDist = INTERACT_DIST;
    for (const d of this.active) {
      const dist = p.distanceTo(this.targetOf(d));
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
  }

  update(dt, input, stage, vehicle, opts = {}) {
    this.time += dt;
    this._stage = stage;

    // 의뢰 슬롯: TTL 소멸 + 빈 슬롯 리필.
    // §14.6 튜토리얼 중(freezeTimers)엔 TTL·진행 카운트다운 정지, 신규 노출은 허용
    for (let i = 0; i < NUM_SLOTS; i++) {
      const offer = this.slots[i];
      if (offer) {
        if (opts.freezeTimers) continue;
        offer.ttl -= dt;
        if (offer.ttl <= 0) {
          this.slots[i] = null;
          this.slotCooldown[i] = this.refillDelay(stage);
        }
      } else {
        this.slotCooldown[i] -= dt;
        if (this.slotCooldown[i] <= 0) this.spawnOffer(i);
      }
    }

    // §18.1 (FR-54) 동적 단가: 최근접 뱃지 슬롯 3,000원·나머지 5,000원,
    // TTL 1초 이하부터 소멸까지 +2,000 급등. 수락은 아래에서 처리되므로
    // 수락 시점 {...offer} 복사에 이 프레임의 표기 단가가 그대로 잠긴다
    this.nearestIdx = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < NUM_SLOTS; i++) {
      const offer = this.slots[i];
      if (!offer) continue;
      const d = Math.hypot(this.player.pos.x - offer.shop.pos.x, this.player.pos.z - offer.shop.pos.z);
      offer.playerDist = d;
      if (d < nearestDist) { nearestDist = d; this.nearestIdx = i; } // 동률은 앞 슬롯 우선
    }
    for (let i = 0; i < NUM_SLOTS; i++) {
      const offer = this.slots[i];
      if (!offer) continue;
      offer.surge = offer.ttl <= SURGE_WINDOW;
      offer.pay = (i === this.nearestIdx ? NEAR_PAY : DELIVERY_PAY) + (offer.surge ? SURGE_ADD : 0);
    }

    // 1~4 수락 (수령 코드 매칭 중엔 game이 acceptKeys를 꺼서 키를 넘긴다)
    if (opts.acceptKeys !== false) {
      for (let i = 0; i < NUM_SLOTS; i++) {
        if (input.justPressed(`Digit${i + 1}`) || input.justPressed(`Numpad${i + 1}`)) {
          this.acceptSlot(i, vehicle);
        }
      }
    }

    // 진행 건 카운트다운 + 만료 (튜토리얼 중엔 정지 — §14.6)
    if (!opts.freezeTimers) {
      for (const d of [...this.active]) {
        d.timeLeft -= dt;
        if (d.timeLeft <= 0) {
          this.removeActive(d);
          this.events.onExpired?.(d);
        }
      }
    }

    // E 상호작용: 픽업 요청(코드 매칭 진입점) / 전달
    if (opts.acceptKeys !== false && input.justPressed('KeyE')) {
      const d = this.nearestInteractable();
      if (d) {
        if (d.phase === 'pickup') {
          this.events.onPickupRequest?.(d);
        } else {
          this.removeActive(d);
          this.events.onDelivered?.(d);
        }
      }
    }

    // 마커: 진행 건 목표 지점 추적 + 바운스
    for (let c = 0; c < this.markers.length; c++) {
      const m = this.markers[c];
      const d = this.active.find((a) => a.colorIdx === c);
      if (d) {
        m.group.visible = true;
        m.group.position.copy(this.targetOf(d));
        m.cone.position.y = 2.6 + Math.sin(this.time * 3 + c) * 0.25;
        m.cone.rotation.y += dt * 2;
      } else {
        m.group.visible = false;
      }
    }
  }

  // 시간 손실 페널티 (초딩·취객 충돌 등) — 가장 급박한 진행 건에 적용
  loseTime(seconds) {
    const d = this.urgent();
    if (d) d.timeLeft = Math.max(0.01, d.timeLeft - seconds);
  }
}
