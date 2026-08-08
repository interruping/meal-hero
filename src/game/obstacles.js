import * as THREE from 'three';
import { loadModel } from '../core/loader.js';
import { makeBlobShadow } from './shadow.js';

// FR-4 방해요소 4종 (§6 사양). 스테이지 누적 등장 + 밀도 소폭 상승.

const STREETS = [-66, -33, 0, 33, 66];

// 전단지 배포 알바생: 고정 위치, 접근 시 전단지 들이밀기 → 이동 속도 감소
class FlyerWorker {
  constructor(model, pos, game) {
    this.model = model;
    this.pos = pos;
    this.game = game;
    this.cooldown = 0;
    model.position.copy(pos);
    this.baseRot = Math.random() * Math.PI * 2;
    model.rotation.y = this.baseRot;
    this.time = Math.random() * 10;
  }

  update(dt, player) {
    this.time += dt;
    this.cooldown -= dt;
    const d = player.pos.distanceTo(this.pos);
    if (d < 6) {
      // 플레이어 쪽으로 몸 돌리며 들이밀기
      this.model.rotation.y = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      const lunge = Math.max(0, Math.sin(this.time * 6)) * 0.35;
      this.model.position.copy(this.pos);
      this.model.position.x += Math.sin(this.model.rotation.y) * lunge;
      this.model.position.z += Math.cos(this.model.rotation.y) * lunge;
      if (d < 1.6 && this.cooldown <= 0) {
        this.cooldown = 3;
        player.applySlowdown(1.6);
        this.game.onObstacleHit('flyer', { slow: true });
      }
    } else {
      this.model.rotation.y = this.baseRot;
      this.model.position.copy(this.pos);
      this.model.position.y = this.pos.y + Math.abs(Math.sin(this.time * 2)) * 0.03;
    }
  }
}

// 브레이크 없는 자전거 초딩: 골목 직진 고속 횡단, 충돌 시 넘어짐+체력·시간 손실
class KidRider {
  constructor(model, world) {
    this.model = model;
    this.world = world;
    this.active = false;
  }

  spawn() {
    // 세로 골목(내리막) 위주로 달린다 (§5 배치 가이드)
    const vertical = Math.random() < 0.75;
    const line = STREETS[Math.floor(Math.random() * STREETS.length)];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const speed = 11 + Math.random() * 3;
    if (vertical) {
      this.pos = new THREE.Vector3(line + (Math.random() - 0.5) * 3, 0, dir > 0 ? -82 : 82);
      this.vel = new THREE.Vector3(0, 0, dir * speed);
    } else {
      this.pos = new THREE.Vector3(dir > 0 ? -82 : 82, 0, line + (Math.random() - 0.5) * 3);
      this.vel = new THREE.Vector3(dir * speed, 0, 0);
    }
    this.active = true;
    this.hitCooldown = 0;
    this.model.visible = true;
    this.model.rotation.y = Math.atan2(this.vel.x, this.vel.z);
  }

  update(dt, player, game) {
    if (!this.active) return;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y = this.world.groundHeight(this.pos.x, this.pos.z);
    this.model.position.copy(this.pos);
    this.hitCooldown -= dt;
    if (Math.abs(this.pos.x) > 84 || Math.abs(this.pos.z) > 84) {
      this.active = false;
      this.model.visible = false;
      return;
    }
    const d = player.pos.distanceTo(this.pos);
    if (d < 1.3 && this.hitCooldown <= 0) {
      this.hitCooldown = 2;
      player.applyStun(1.2);
      game.damage(1, 'kid');
      game.delivery.loseTime(5);
      game.onObstacleHit('kid', {});
    }
  }
}

// 비둘기: 무리 지어 있다가 접근 시 날아오름 → 시야 방해 + 조작 흔들림
class PigeonFlock {
  constructor(models, spot, game) {
    this.models = models;
    this.spot = spot;
    this.game = game;
    this.state = 'idle'; // idle | flying | gone
    this.timer = 0;
    this.offsets = models.map(() => new THREE.Vector3(
      (Math.random() - 0.5) * 2.4, 0, (Math.random() - 0.5) * 2.4,
    ));
    this.place();
  }

  place() {
    this.models.forEach((m, i) => {
      m.visible = true;
      m.position.copy(this.spot).add(this.offsets[i]);
      m.rotation.y = Math.random() * Math.PI * 2;
    });
  }

  update(dt, player) {
    if (this.state === 'idle') {
      // 바닥 쪼기
      this.models.forEach((m, i) => {
        m.rotation.x = Math.max(0, Math.sin(performance.now() / 300 + i * 2)) * 0.25;
      });
      if (player.pos.distanceTo(this.spot) < 3.5) {
        this.state = 'flying';
        this.timer = 0;
        this.game.onObstacleHit('pigeon', {});
      }
    } else if (this.state === 'flying') {
      this.timer += dt;
      // 플레이어(카메라) 쪽으로 퍼덕이며 상승
      this.models.forEach((m, i) => {
        const toPlayer = player.pos.clone().sub(m.position).normalize();
        m.position.y += dt * (3 + i * 0.4);
        m.position.x += toPlayer.x * dt * 2 + Math.sin(this.timer * 20 + i) * dt * 2;
        m.position.z += toPlayer.z * dt * 2;
        m.rotation.z = Math.sin(this.timer * 25 + i) * 0.5;
      });
      if (this.timer > 1.6) {
        this.state = 'gone';
        this.timer = 0;
        this.models.forEach((m) => { m.visible = false; });
      }
    } else {
      // 잠시 후 다른 곳 재배치
      this.timer += dt;
      if (this.timer > 12) {
        this.state = 'idle';
        this.place();
      }
    }
  }
}

// 취객: 지그재그 배회, 접근 시 플레이어 쪽으로 비틀 → 충돌 시 체력 감소+조작 반전
class Drunk {
  constructor(model, home, world, game) {
    this.model = model;
    this.home = home;
    this.world = world;
    this.game = game;
    this.pos = home.clone();
    this.heading = Math.random() * Math.PI * 2;
    this.time = Math.random() * 100;
    this.cooldown = 0;
  }

  update(dt, player) {
    this.time += dt;
    this.cooldown -= dt;
    // 지그재그: 헤딩이 사인파로 흔들림
    this.heading += Math.sin(this.time * 1.3) * dt * 2.2 + (Math.random() - 0.5) * dt * 2;
    const d = player.pos.distanceTo(this.pos);
    if (d < 7) {
      // 플레이어 방향으로 비틀거림
      const target = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      let diff = target - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * dt * 2.5;
    }
    // 홈에서 너무 멀어지면 귀환 성향
    const dHome = this.pos.distanceTo(this.home);
    if (dHome > 14) {
      const back = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z);
      let diff = back - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * dt * 1.5;
    }
    const speed = 1.6 + Math.sin(this.time * 0.7) * 0.5;
    this.pos.x += Math.sin(this.heading) * speed * dt;
    this.pos.z += Math.cos(this.heading) * speed * dt;
    this.pos.y = this.world.groundHeight(this.pos.x, this.pos.z);
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.heading;
    this.model.rotation.z = Math.sin(this.time * 2.1) * 0.12; // 비틀비틀
    if (d < 1.4 && this.cooldown <= 0) {
      this.cooldown = 3;
      player.applyReverse(2.5);
      this.game.damage(1, 'drunk');
      this.game.onObstacleHit('drunk', {});
    }
  }
}

const INTRO_LINES = {
  flyer: '전단지 알바생 등장! 가까이 가면 전단지를 받느라 느려진다',
  kid: '브레이크 없는 자전거 초딩! 부딪히면 넘어진다 — 경로를 읽어라',
  pigeon: '비둘기 무리! 놀라면 날아올라 시야를 가린다',
  drunk: '취객 등장… 부딪히면 조작이 꼬인다',
};

export class ObstacleManager {
  constructor(world, scene, player, game) {
    this.world = world;
    this.scene = scene;
    this.player = player;
    this.game = game;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.flyers = [];
    this.kids = [];
    this.flocks = [];
    this.drunks = [];
    this.kidSpawnTimer = 0;
    this.introduced = new Set();
    this.active = [];
  }

  async init() {
    this.protoFlyer = await loadModel('obstacle-flyer-worker', 1.65);
    this.protoKid = await loadModel('obstacle-kid-bike', 1.35);
    this.protoPigeon = await loadModel('obstacle-pigeon', 0.32);
    this.protoDrunk = await loadModel('obstacle-drunk', 1.7);
    // 블롭 섀도 부착 (비둘기는 생략)
    for (const [proto, r] of [[this.protoFlyer, 0.5], [this.protoKid, 0.6], [this.protoDrunk, 0.5]]) {
      const s = makeBlobShadow(r);
      s.position.y = 0.04;
      proto.add(s);
    }
  }

  clear() {
    this.group.clear();
    this.flyers = [];
    this.kids = [];
    this.flocks = [];
    this.drunks = [];
  }

  introBanner(type) {
    if (this.introduced.has(type)) return;
    this.introduced.add(type);
    this.game.ui.banner(INTRO_LINES[type], 3000);
  }

  setup(stage) {
    this.clear();
    const kinds = stage.obstacles;
    const density = stage.id; // 스테이지 오를수록 소폭 상승
    this.active = kinds;

    if (kinds.includes('flyer')) {
      // 상가 골목 위주 + 골목 모퉁이
      const spots = [];
      for (let i = 0; i < 3 + density; i++) {
        const x = -60 + Math.random() * 120;
        const z = 66 + Math.random() * 6; // 상가 앞
        spots.push(new THREE.Vector3(x, this.world.groundHeight(x, z), z));
      }
      for (let i = 0; i < density; i++) {
        const s = STREETS[Math.floor(Math.random() * STREETS.length)];
        const t = -60 + Math.random() * 120;
        const x = Math.random() < 0.5 ? s + 2 : t;
        const z = x === t ? s + 2 : t;
        spots.push(new THREE.Vector3(x, this.world.groundHeight(x, z), z));
      }
      for (const p of spots) {
        const m = this.protoFlyer.clone(true);
        this.group.add(m);
        this.flyers.push(new FlyerWorker(m, p, this.game));
      }
      this.introBanner('flyer');
    }

    if (kinds.includes('kid')) {
      const n = 1 + Math.floor(density / 2);
      for (let i = 0; i < n; i++) {
        const m = this.protoKid.clone(true);
        m.visible = false;
        this.group.add(m);
        this.kids.push(new KidRider(m, this.world));
      }
      this.kidSpawnTimer = 2;
      this.introBanner('kid');
    }

    if (kinds.includes('pigeon')) {
      const n = 3 + density;
      for (let i = 0; i < n; i++) {
        const s1 = STREETS[Math.floor(Math.random() * STREETS.length)];
        const t = -70 + Math.random() * 140;
        const vertical = Math.random() < 0.5;
        const x = vertical ? s1 : t;
        const z = vertical ? t : s1;
        const spot = new THREE.Vector3(x, this.world.groundHeight(x, z), z);
        const birds = Array.from({ length: 4 }, () => {
          const b = this.protoPigeon.clone(true);
          this.group.add(b);
          return b;
        });
        this.flocks.push(new PigeonFlock(birds, spot, this.game));
      }
      this.introBanner('pigeon');
    }

    if (kinds.includes('drunk')) {
      const n = 2 + density;
      for (let i = 0; i < n; i++) {
        const s1 = STREETS[Math.floor(Math.random() * STREETS.length)];
        const t = -70 + Math.random() * 100; // 북쪽 골목 위주
        const vertical = Math.random() < 0.5;
        const x = vertical ? s1 : t;
        const z = vertical ? t : s1 - 10;
        const home = new THREE.Vector3(x, 0, z);
        home.y = this.world.groundHeight(x, z);
        const m = this.protoDrunk.clone(true);
        this.group.add(m);
        this.drunks.push(new Drunk(m, home, this.world, this.game));
      }
      this.introBanner('drunk');
    }
  }

  update(dt) {
    const p = this.player;
    for (const f of this.flyers) f.update(dt, p);
    if (this.kids.length) {
      this.kidSpawnTimer -= dt;
      if (this.kidSpawnTimer <= 0) {
        const idle = this.kids.find((k) => !k.active);
        if (idle) idle.spawn();
        this.kidSpawnTimer = 5 + Math.random() * 5;
      }
      for (const k of this.kids) k.update(dt, p, this.game);
    }
    for (const fl of this.flocks) fl.update(dt, p);
    for (const d of this.drunks) d.update(dt, p);
  }
}
