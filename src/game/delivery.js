import * as THREE from 'three';
import { MARKER_RED } from './palettes.js';

// FR-3 배달 루프: 주문 → E 픽업 → 목적지 안내 → E 전달 → 보수
const INTERACT_DIST = 3.2;
const DETOUR_COEF = 1.7; // 직선거리 → 골목 우회 보정
const TIME_BUFFER = 8; // 초

export const DeliveryPhase = {
  WAITING: 'waiting', // 다음 주문 대기
  PICKUP: 'pickup', // 가게로 이동 중
  CARRY: 'carry', // 배달 중 (제한 시간)
};

export class DeliveryManager {
  constructor(world, player, scene, events) {
    this.world = world;
    this.player = player;
    this.events = events; // { onPickedUp, onDelivered(pay), onExpired, onOrder }
    this.phase = DeliveryPhase.WAITING;
    this.orderTimer = 1.5;
    this.order = null;
    this.timeLeft = 0;

    // 목적지 마커: 빨간 역원뿔 (§7.4 포인트 컬러)
    this.marker = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 1, 6),
      new THREE.MeshBasicMaterial({ color: MARKER_RED }),
    );
    cone.rotation.x = Math.PI;
    cone.position.y = 2.6;
    this.marker.add(cone);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 26, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: MARKER_RED, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    beam.position.y = 13;
    this.marker.add(beam);
    this.markerCone = cone;
    this.marker.visible = false;
    scene.add(this.marker);
    this.time = 0;
  }

  targetPos() {
    if (!this.order) return null;
    return this.phase === DeliveryPhase.PICKUP ? this.order.shop.pos : this.order.door.pos;
  }

  startOrder(orderGap, vehicle, incomeMult) {
    const shops = this.world.shops;
    const doors = this.world.doors;
    const shop = shops[Math.floor(Math.random() * shops.length)];
    const door = doors[Math.floor(Math.random() * doors.length)];
    const dist = shop.pos.distanceTo(door.pos);
    const pay = Math.round((300_000 + dist * 3_000) * incomeMult / 10_000) * 10_000;
    const limit = (dist * DETOUR_COEF) / vehicle.maxSpeed + TIME_BUFFER;
    this.order = { shop, door, dist, pay, limit };
    this.phase = DeliveryPhase.PICKUP;
    this.setMarker(shop.pos);
    this.events.onOrder?.(this.order);
  }

  setMarker(pos) {
    this.marker.position.copy(pos);
    this.marker.visible = true;
  }

  reset() {
    this.phase = DeliveryPhase.WAITING;
    this.order = null;
    this.orderTimer = 1.5;
    this.marker.visible = false;
  }

  update(dt, input, stage, vehicle) {
    this.time += dt;
    this.markerCone.position.y = 2.6 + Math.sin(this.time * 3) * 0.25;
    this.markerCone.rotation.y += dt * 2;

    const p = this.player.pos;

    switch (this.phase) {
      case DeliveryPhase.WAITING:
        this.orderTimer -= dt;
        if (this.orderTimer <= 0) {
          this.startOrder(stage.orderGap, vehicle, vehicle.incomeMult);
        }
        break;

      case DeliveryPhase.PICKUP: {
        if (input.justPressed('KeyE') && p.distanceTo(this.order.shop.pos) < INTERACT_DIST) {
          this.phase = DeliveryPhase.CARRY;
          this.timeLeft = this.order.limit;
          this.setMarker(this.order.door.pos);
          this.events.onPickedUp?.(this.order);
        }
        break;
      }

      case DeliveryPhase.CARRY: {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          const expired = this.order;
          this.phase = DeliveryPhase.WAITING;
          this.orderTimer = stage.orderGap;
          this.order = null;
          this.marker.visible = false;
          this.events.onExpired?.(expired);
          break;
        }
        if (input.justPressed('KeyE') && p.distanceTo(this.order.door.pos) < INTERACT_DIST) {
          const done = this.order;
          this.phase = DeliveryPhase.WAITING;
          this.orderTimer = stage.orderGap;
          this.order = null;
          this.marker.visible = false;
          this.events.onDelivered?.(done);
        }
        break;
      }
    }
  }

  // 시간 손실 페널티 (초딩 충돌 등)
  loseTime(seconds) {
    if (this.phase === DeliveryPhase.CARRY) this.timeLeft = Math.max(0.01, this.timeLeft - seconds);
  }
}
