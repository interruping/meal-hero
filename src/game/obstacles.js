import * as THREE from 'three';
import { loadModel, loadAnimated, instantiateAnimated, addSkinnedOutline, inflateHead, applyHeadRatio } from '../core/loader.js';
import { makeBlobShadow } from './shadow.js';
import { addOutline } from './walkanim.js';
import { sharedMat } from './textures.js';

// FR-4 방해요소 4종 (§6 사양). 스테이지 누적 등장 + 밀도 소폭 상승.

const STREETS = [-66, -33, 0, 33, 66];

// 전단지 배포 알바생: 접근하면 전단지를 "발사"한다 — 맞으면 이동 속도 감소 (§6 판정 소형)
class FlyerWorker {
  constructor(model, pos, game, throwPaper) {
    this.model = model;
    this.home = pos.clone(); // 원래 자리 — 추적 끝나면 복귀
    this.pos = pos;
    this.game = game;
    this.throwPaper = throwPaper;
    this.throwCooldown = Math.random() * 1.5;
    model.position.copy(pos);
    this.baseRot = Math.random() * Math.PI * 2;
    model.rotation.y = this.baseRot;
    this.time = Math.random() * 10;
    this.anim = null; // 스켈레톤 걷기/대기 (리깅 GLB 있을 때)
    this.moveSpeed = 0; // 이번 프레임 이동 속도 — 보행 사이클 동기화용
    this.windup = 0; // 던지기 직전 젖히기 연출
    this.chaseTime = 0; // 이번 추적 누적 시간 (최대 10초)
    this.rested = true; // 추적 소진 후 홈 복귀해야 재추적 가능
    this.chaseCooldownUntil = 0; // 전단지 명중 시 추적 쿨타임
  }

  // 던진 전단지가 주인공에게 명중 — 추적 중단 + 5초 쿨타임
  onPaperHit() {
    this.chaseCooldownUntil = this.time + 5;
    this.chaseTime = 0;
    this.rested = true;
  }

  update(dt, player) {
    this.time += dt;
    this.throwCooldown -= dt;
    this.moveSpeed = 0;
    const d = player.pos.distanceTo(this.pos);

    // 추적: 5m 안에서 발견하면 1m 거리까지 따라붙음, 최대 10초 (명중 후 5초는 쉼)
    const chasing = this.rested && this.time >= this.chaseCooldownUntil
      ? d < 5 && this.chaseTime < 10
      : false;
    if (chasing) {
      this.chaseTime += dt;
      this.rested = this.chaseTime < 10;
      if (d > 1) {
        const speed = 2.6;
        const dirX = (player.pos.x - this.pos.x) / d;
        const dirZ = (player.pos.z - this.pos.z) / d;
        this.pos.x += dirX * speed * dt;
        this.pos.z += dirZ * speed * dt;
        this.pos.y = this.game.world.groundHeight(this.pos.x, this.pos.z);
        this.moveSpeed = speed;
      }
    } else if (d > 7 || !this.rested) {
      // 놓쳤거나 지침 — 홈으로 복귀, 도착하면 추적 게이지 리셋
      const dh = this.home.distanceTo(this.pos);
      if (dh > 0.3) {
        const speed = 1.6;
        this.pos.x += ((this.home.x - this.pos.x) / dh) * speed * dt;
        this.pos.z += ((this.home.z - this.pos.z) / dh) * speed * dt;
        this.pos.y = this.game.world.groundHeight(this.pos.x, this.pos.z);
        this.moveSpeed = speed;
      } else {
        this.chaseTime = 0;
        this.rested = true;
      }
    }

    if (d < 9) {
      // 플레이어 조준
      this.model.rotation.y = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      if (this.throwCooldown <= 0 && d > 1.2) {
        this.throwCooldown = 1.4;
        this.windup = 0.22;
        const origin = this.pos.clone();
        origin.y += 1.35;
        origin.x += Math.sin(this.model.rotation.y) * 0.45;
        origin.z += Math.cos(this.model.rotation.y) * 0.45;
        this.throwPaper(origin, player, this);
      }
      // 던지는 모션: 몸 젖혔다 앞으로 확
      this.windup = Math.max(0, this.windup - dt);
      this.model.rotation.x = this.windup > 0.1 ? -0.35 : this.windup > 0 ? 0.3 : 0;
      this.model.position.copy(this.pos);
      // 추적 중 종종걸음 바운스 (정적 폴백 전용 — 스켈레톤은 보행 사이클이 대체)
      if (chasing && !this.anim) this.model.position.y = this.pos.y + Math.abs(Math.sin(this.time * 9)) * 0.07;
    } else {
      // 조준 범위 밖: 복귀 중엔 진행 방향, 서 있으면 원래 방향
      this.model.rotation.y = this.moveSpeed > 0.1
        ? Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z)
        : this.baseRot;
      this.model.rotation.x = 0;
      this.model.position.copy(this.pos);
      if (!this.anim) this.model.position.y = this.pos.y + Math.abs(Math.sin(this.time * 2)) * 0.03;
    }

    // 스켈레톤 걷기/대기 크로스페이드 — 이동 속도에 보행 사이클 동기화
    if (this.anim) {
      const target = this.moveSpeed > 0.1 ? 1 : 0;
      const w = this.anim.walk.getEffectiveWeight();
      const nw = w + (target - w) * Math.min(1, dt * 8);
      this.anim.walk.setEffectiveWeight(nw);
      this.anim.idle.setEffectiveWeight(1 - nw);
      this.anim.walk.timeScale = 0.5 + this.moveSpeed * 0.5;
      this.anim.mixer.update(dt);
    }
  }
}

// 날아가는 전단지 발사체 풀
class PaperPool {
  constructor(scene, game, size = 14) {
    this.game = game;
    const mat = sharedMat('flyer-paper');
    mat.side = THREE.DoubleSide;
    this.papers = Array.from({ length: size }, () => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), mat);
      m.visible = false;
      scene.add(m);
      return { mesh: m, vel: new THREE.Vector3(), life: 0, spin: 0 };
    });
  }

  throwAt(origin, player, owner = null) {
    const p = this.papers.find((x) => x.life <= 0);
    if (!p) return;
    p.owner = owner; // 명중 시 던진 알바생에게 통지 (추적 쿨타임)
    // 예측 조준 + 약간 위로 아치
    const target = player.pos.clone().addScaledVector(player.vel, 0.25);
    target.y += 1.1;
    const dir = target.sub(origin);
    const dist = dir.length();
    dir.normalize();
    p.mesh.position.copy(origin);
    p.vel.copy(dir).multiplyScalar(Math.min(11, 7 + dist * 0.5));
    p.vel.y += 2.2;
    p.life = 1.6;
    p.spin = 8 + Math.random() * 6;
    p.mesh.visible = true;
  }

  update(dt, player) {
    for (const p of this.papers) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= 5.5 * dt; // 종이라 가볍게 낙하
      p.vel.multiplyScalar(1 - 0.6 * dt); // 공기 저항
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.y += p.spin * 0.7 * dt;
      // 명중 판정 (소형)
      const dx = p.mesh.position.x - player.pos.x;
      const dy = p.mesh.position.y - (player.pos.y + 1);
      const dz = p.mesh.position.z - player.pos.z;
      if (dx * dx + dy * dy + dz * dz < 0.55 * 0.55) {
        p.life = 0;
        p.mesh.visible = false;
        player.applySlowdown(1.6);
        player.applyPaperHit(p.vel);
        p.owner?.onPaperHit();
        this.game.onObstacleHit('flyer', {});
      }
      if (p.life <= 0) p.mesh.visible = false;
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
    this.mixer?.update(dt);
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
  flyer: '전단지 알바생 등장! 날아오는 전단지에 맞으면 느려진다 — 피해라',
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
    // 주인공 대비 얼굴 비중 소폭 부족 — 머리 영역 버텍스 확대로 가분수 강화 (크레딧 0)
    inflateHead(this.protoFlyer, 1.3, 0.66, 1.65);
    // 알바생 스켈레톤 걷기(Casual_Walk)+대기(Idle) — 리깅 GLB 없으면 정적 폴백
    try {
      const [walk, idle] = await Promise.all([
        loadAnimated('obstacle-flyer-worker-walk', 1.65),
        loadAnimated('obstacle-flyer-worker-idle', 1.65),
      ]);
      this.flyerAsset = { walk, idle };
    } catch {
      this.flyerAsset = null;
    }
    this.protoKid = await loadModel('obstacle-kid-bike', 1.35);
    this.protoPigeon = await loadModel('obstacle-pigeon', 0.32);
    this.protoDrunk = await loadModel('obstacle-drunk', 1.7);
    // 취객 스켈레톤 비틀걸음 (Meshy Stumble_Walk) — 리깅 GLB 없으면 정적 폴백
    try {
      this.drunkAsset = await loadAnimated('obstacle-drunk-walk', 1.7);
    } catch {
      this.drunkAsset = null;
    }
    // 실루엣 아웃라인 (블롭 섀도보다 먼저 — 섀도 평면은 헐 제외)
    for (const proto of [this.protoFlyer, this.protoKid, this.protoPigeon, this.protoDrunk]) {
      addOutline(proto);
    }
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
    if (this.paperPool) {
      for (const p of this.paperPool.papers) {
        p.life = 0;
        p.mesh.visible = false;
      }
    }
  }

  // 스테이지 신규 방해요소는 §14.4 소개 모달(FR-30)이 대체 — game이 introduced에
  // 미리 넣어 배너를 막는다. 심사 모드 직행 시 이전 스테이지 요소만 배너로 안내
  introBanner(type) {
    if (this.introduced.has(type)) return;
    this.introduced.add(type);
    this.game.ui.banner(INTRO_LINES[type], 3000);
  }

  proto(type) {
    return {
      flyer: this.protoFlyer, kid: this.protoKid,
      pigeon: this.protoPigeon, drunk: this.protoDrunk,
    }[type];
  }

  setup(stage) {
    this.clear();
    const kinds = stage.obstacles;
    const density = stage.id; // 스테이지 오를수록 소폭 상승
    this.active = kinds;

    if (kinds.includes('flyer')) {
      // 맵 전역 골목에 분산 — 서로 최소 18m 간격 (상가 앞 몰림 방지)
      const spots = [];
      const total = 5 + density * 2;
      for (let i = 0; i < total; i++) {
        for (let attempt = 0; attempt < 12; attempt++) {
          const s = STREETS[Math.floor(Math.random() * STREETS.length)];
          const t = -72 + Math.random() * 144;
          const vertical = Math.random() < 0.5;
          const x = vertical ? s + (Math.random() < 0.5 ? -2 : 2) : t;
          const z = vertical ? t : s + (Math.random() < 0.5 ? -2 : 2);
          if (spots.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 18 * 18)) continue;
          spots.push(new THREE.Vector3(x, this.world.groundHeight(x, z), z));
          break;
        }
      }
      if (!this.paperPool) this.paperPool = new PaperPool(this.scene, this.game);
      for (const p of spots) {
        let m, anim = null;
        if (this.flyerAsset) {
          const inst = instantiateAnimated(this.flyerAsset.walk);
          applyHeadRatio(inst.model, 0.316, 1.65); // 행인과 동일 가분수 정합
          addSkinnedOutline(inst.model, 0.02);
          const sh = makeBlobShadow(0.5);
          sh.position.y = 0.04;
          inst.model.add(sh);
          const walk = inst.mixer.clipAction(inst.clips[0]);
          const idle = inst.mixer.clipAction(this.flyerAsset.idle.clips[0]);
          walk.play(); idle.play();
          walk.setEffectiveWeight(0); idle.setEffectiveWeight(1);
          m = inst.model;
          anim = { mixer: inst.mixer, walk, idle };
        } else {
          m = this.protoFlyer.clone(true);
        }
        this.group.add(m);
        const f = new FlyerWorker(m, p, this.game, (o, pl, w) => this.paperPool.throwAt(o, pl, w));
        f.anim = anim;
        this.flyers.push(f);
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
        let m, mixer = null;
        if (this.drunkAsset) {
          const inst = instantiateAnimated(this.drunkAsset);
          addSkinnedOutline(inst.model, 0.02);
          const s = makeBlobShadow(0.5);
          s.position.y = 0.04;
          inst.model.add(s);
          const act = inst.mixer.clipAction(inst.clips[0]);
          act.play();
          act.timeScale = 0.9 + Math.random() * 0.2;
          m = inst.model;
          mixer = inst.mixer;
        } else {
          m = this.protoDrunk.clone(true);
        }
        this.group.add(m);
        const d = new Drunk(m, home, this.world, this.game);
        d.mixer = mixer;
        this.drunks.push(d);
      }
      this.introBanner('drunk');
    }
  }

  update(dt) {
    const p = this.player;
    for (const f of this.flyers) f.update(dt, p);
    this.paperPool?.update(dt, p);
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
