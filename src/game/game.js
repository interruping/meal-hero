import * as THREE from 'three';
import { RetroRenderer } from '../core/renderer.js';
import { Input } from '../core/input.js';
import { UI } from './ui.js';
import { PALETTES, FOG_NEAR, FOG_FAR } from './palettes.js';
import { buildCity } from './citymap.js';
import { Player } from './player.js';
import { FollowCamera } from './camera.js';
import { DeliveryManager, DeliveryPhase } from './delivery.js';
import { ObstacleManager } from './obstacles.js';
import { STAGES, MAX_HP, MAX_MISSES, TOTAL_DEBT } from './stages.js';
import { VEHICLES } from './vehicles.js';
import { loadModel, loadAnimated, instantiateAnimated, addSkinnedOutline } from '../core/loader.js';
import { buildProps, placeParkedVehicles } from './props.js';
import { Pedestrians } from './pedestrians.js';
import { tex } from './textures.js';
import { AudioSys } from '../core/audio.js';
import { setupWalkAnimation, addOutline } from './walkanim.js';

const SAVE_KEY = 'mealhero-save-v1';

const OPENING_LINES = [
  '2026년 봄. 사업이 망했다.',
  '남은 것은 빚 4,000만 원과 튼튼한 두 다리뿐.',
  '「Meal Hero」 — 가입만 하면 누구나 오늘부터 배달 히어로!',
  '…가입 완료. 봄부터 겨울까지, 1년 안에 다 갚는다.',
];

// Meshy 모델별 전방(+z) 보정 회전 — 스크린샷 확인 후 조정
const MODEL_YAW = {
  hero: 0,
  kickboard: 0,
  bicycle: 0,
  scooter: 0,
  bag: 0,
};

export class Game {
  constructor(container) {
    this.container = container;
    this.retro = new RetroRenderer(container);
    this.input = new Input(this.retro.renderer.domElement);
    this.ui = new UI(container);
    this.state = 'boot';
    this._hadLock = false;
    this.stageIdx = 0;
    this.career = { deliveries: 0, revenue: 0, hits: 0, debt: TOTAL_DEBT };

    this.scene = new THREE.Scene();
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 0.25);
    this.sun.position.set(30, 50, 20);
    this.scene.add(this.sun);

    this.world = buildCity(this.scene);
    // 소품은 Meshy 모델 로드 후 init()에서 배치
    this.applySeason('spring'); // 타이틀 배경도 팔레트 적용
    this.player = new Player(this.world, this.scene);
    // 탈것 과속 정면 충돌: 최고속 근접 상태로 벽·소품에 박으면 체력 0.25 차감 + 빨간 점멸.
    // 법선 진입 속도 기준이라 벽에 스치는 주행은 면제. 구보는 면제
    this.player.onWallImpact = (impact) => {
      const p = this.player;
      if (this.state !== 'playing' || p.vehicleKey === 'run' || !p.vehicleKey) return;
      if (impact < p.vehicle.maxSpeed * 0.75) return;
      if (p.time < (p.crashCooldownUntil ?? 0)) return;
      p.crashCooldownUntil = p.time + 1.0;
      p.flashUntil = p.time + 0.45;
      p.vel.x *= 0.25;
      p.vel.z *= 0.25;
      this.damage(0.25, 'crash');
      this.ui.toast('쾅! 과속 충돌 (-체력 ¼)');
    };
    this.cam = new FollowCamera(this.world);
    this.delivery = new DeliveryManager(this.world, this.player, this.scene, {
      onOrder: (o) => {
        this.ui.banner(`새 주문! <b>${o.shop.name}</b> → ${o.door.name}<br><span style="font-size:13px">보수 ₩${o.pay.toLocaleString()}</span>`, 2600);
        this.audio.play('order');
      },
      onPickedUp: () => {
        this.ui.banner('픽업 완료! 배달 시작', 1500);
        this.audio.play('pickup');
      },
      onDelivered: (o) => {
        this.stage_.revenue += o.pay;
        this.career.revenue += o.pay;
        this.stage_.deliveries++;
        this.career.deliveries++;
        this.ui.banner(`배달 완료! +₩${o.pay.toLocaleString()}`, 1800);
        this.audio.play('deliver');
        if (this.stage_.revenue >= this.stageCfg.goal) this.stageClear();
      },
      onExpired: () => {
        this.stage_.misses++;
        this.ui.toast(`배달 시간 초과! (${this.stage_.misses}/${MAX_MISSES})`, 2200);
        this.audio.play('miss');
        if (this.stage_.misses >= MAX_MISSES) {
          this.gameOver('배달 시간 초과가 누적됐다. 고객 평점 바닥…');
        }
      },
    });
    this.obstacles = new ObstacleManager(this.world, this.scene, this.player, this);
    this.audio = new AudioSys();
    this.player.audio = this.audio;

    this.retro.setDither(true, 6); // §7.9 포스터라이즈+디더 (FR-15)
    this._lastFrameAt = performance.now();
    this.retro.renderer.domElement.addEventListener('click', () => {
      if (this.state === 'playing') this.input.requestPointerLock();
    });
  }

  async init() {
    const [hero, bag, kickboard, bicycle, scooter, parkedSedan, parkedTruck] = await Promise.all([
      loadModel('character-hero', 1.6),
      loadModel('prop-delivery-bag', 0.55),
      loadModel('vehicle-kickboard', 1.05),
      loadModel('vehicle-bicycle', 1.1),
      loadModel('vehicle-scooter', 1.15),
      loadModel('prop-parked-sedan', 1.4),
      loadModel('prop-parked-truck', 1.9),
    ]);
    // 소품 3D 모델 로드 → 배치 (§7.10 장식 오브젝트)
    const PROP_HEIGHTS = {
      vending: 1.9, hydrant: 0.75, bench: 0.85, pyeongsang: 0.5, trashpile: 0.85,
      planter: 0.5, mailbox: 0.9, streetlamp: 4.6, pole: 7.5, boxes: 1.1,
      parasol: 2.4, laundry: 1.4, cat: 0.45,
    };
    const propEntries = await Promise.all(
      Object.entries(PROP_HEIGHTS).map(async ([k, h]) => [k, await loadModel(`prop3d-${k}`, h)]),
    );
    this.props = buildProps(this.world, this.scene, Object.fromEntries(propEntries));
    // 차량은 소품 뒤에 배치 — 소품 풋프린트(world.propBoxes)와 겹침 회피
    placeParkedVehicles(this.world, this.scene, { sedan: parkedSedan, truck: parkedTruck });
    this.applySeason('spring');
    this.models = { hero, bag, kickboard, bicycle, scooter };
    for (const [k, m] of Object.entries(this.models)) m.rotation.y = MODEL_YAW[k] ?? 0;
    // 실루엣 아웃라인 (배경 분리)
    for (const m of Object.values(this.models)) addOutline(m);

    // 주인공 스켈레톤 애니메이션 (Meshy 리깅): 달리기+대기 크로스페이드.
    // 리깅 GLB 없으면 정적 모델 + 버텍스 쉬어 폴백
    try {
      const [runAsset, idleAsset] = await Promise.all([
        loadAnimated('character-hero-run', 1.6),
        loadAnimated('character-hero-idle', 1.6),
      ]);
      const inst = instantiateAnimated(runAsset);
      addSkinnedOutline(inst.model, 0.02);
      const run = inst.mixer.clipAction(runAsset.clips[0]);
      const idle = inst.mixer.clipAction(idleAsset.clips[0]);
      run.play(); idle.play();
      run.setEffectiveWeight(0); idle.setEffectiveWeight(1);
      this.heroAnim = { model: inst.model, mixer: inst.mixer, run, idle, sit: null };
      // 앉기 (자전거·스쿠터 탑승) — 없으면 서있기 유지
      try {
        const sitAsset = await loadAnimated('character-hero-sit', 1.6);
        const sit = inst.mixer.clipAction(sitAsset.clips[0]);
        sit.play(); sit.setEffectiveWeight(0);
        // Chair_Sit 루프는 앞으로 깊이 숙이는 스웨이 포함 — 가장 곧은 프레임(9.36s)에
        // 고정해 탑승 정자세로 쓴다 (전 구간 피치 실측 0.20~1.37rad, 최소가 9.36)
        sit.time = 9.36; sit.paused = true;
        this.heroAnim.sit = sit;
      } catch { /* 폴백: idle */ }
      this.heroVisual = inst.model;
    } catch {
      this.heroAnim = null;
      this.heroVisual = hero;
      this.walkRig = setupWalkAnimation(hero);
      this.player.onWalkUpdate = (phase, amp) => this.walkRig.set(phase, amp);
    }

    // 행인 배회 시스템 (리깅 GLB 있는 종류만 자동 포함)
    this.peds = new Pedestrians(this.scene, this.world);
    await this.peds.init();

    await this.obstacles.init();
    this.attachVehicleVisual('run'); // 블록아웃 캡슐 제거 (AC-19)
    this.showTitle();
  }

  // ── 상태 전환 ──────────────────────────────

  showTitle() {
    this.state = 'title';
    this.ui.setHudVisible(false);
    this.input.exitPointerLock();
    this.audio.stopBGM();
    const save = this.loadSave();
    this.ui.showTitle({
      onStart: () => this.startOpening(),
      onStage: (n) => { this.resetCareer(); this.startStage(n); },
      save,
      onContinue: save
        ? () => {
            this.career = save.career;
            this.startStage(save.nextStage);
          }
        : null,
    });
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (typeof s.nextStage !== 'number' || s.nextStage < 1 || s.nextStage >= STAGES.length) return null;
      return s;
    } catch {
      return null;
    }
  }

  saveProgress() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ nextStage: this.stageIdx + 1, career: this.career }));
    } catch { /* 저장 불가 환경 무시 */ }
  }

  resetCareer() {
    this.career = { deliveries: 0, revenue: 0, hits: 0, debt: TOTAL_DEBT };
  }

  startOpening() {
    this.state = 'opening';
    this.resetCareer();
    this.ui.showOpening(OPENING_LINES, () => this.startStage(0));
  }

  startStage(idx) {
    this.stageIdx = idx;
    this.stageCfg = STAGES[idx];
    this.stage_ = { revenue: 0, deliveries: 0, misses: 0, hp: MAX_HP };
    this.applySeason(this.stageCfg.season);
    this.player.setVehicle(this.stageCfg.vehicle);
    this.player.slippery = !!this.stageCfg.slippery;
    this.player.reset();
    this.attachVehicleVisual(this.stageCfg.vehicle);
    this.delivery.reset();
    this.obstacles.setup(this.stageCfg);
    this.cam.initialized = false;
    this.state = 'intro';
    this.ui.setHudVisible(false);
    this.ui.showStageIntro(this.stageCfg, VEHICLES[this.stageCfg.vehicle].label, () => {
      this.ui.clearScreen();
      this.state = 'playing';
      this.ui.setHudVisible(true);
      this.input.requestPointerLock();
      this.audio.startBGM(this.stageCfg.season);
    });
  }

  // 배달가방을 히어로 가슴 본에 부착 — 정적 부착은 두리번·달리기 애니메이션과
  // 몸이 따로 놀아 가방이 어긋나 보임(피드백). 본에 달면 상체를 그대로 따라간다.
  mountBagToSpine() {
    if (this._bagMount || !this.heroAnim) return;
    const inst = this.heroAnim.model;
    let bone = null, boneY = -Infinity;
    const v = new THREE.Vector3();
    this.heroAnim.mixer.update(0);
    inst.updateMatrixWorld(true);
    inst.traverse((o) => {
      if (o.isBone && /spine|chest/i.test(o.name)) {
        o.getWorldPosition(v);
        if (v.y > boneY) { boneY = v.y; bone = o; }
      }
    });
    if (!bone) return;
    // 가방 모델은 +z가 본체, -z가 끈 — 180° 돌려 본체가 등 밖(-z)으로 나오게 한다.
    // 본체 근접면(로컬 +0.07)이 등판(-0.17)에 닿도록 z -0.10 (끈은 몸속에 묻힘)
    const local = new THREE.Matrix4().makeTranslation(0, 0.68, -0.1)
      .multiply(new THREE.Matrix4().makeRotationY(Math.PI));
    const desired = new THREE.Matrix4().multiplyMatrices(inst.matrixWorld, local);
    const m = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(desired);
    const mount = new THREE.Group();
    m.decompose(mount.position, mount.quaternion, mount.scale);
    bone.add(mount);
    const bag = this.models.bag;
    bag.position.set(0, 0, 0);
    bag.rotation.set(0, 0, 0);
    mount.add(bag);
    this._bagMount = mount;
  }

  attachVehicleVisual(vehicleKey) {
    const holder = this.player.bodyHolder;
    holder.clear();
    const hero = this.heroVisual ?? this.models.hero;
    if (vehicleKey === 'run') {
      hero.position.set(0, 0, 0);
      hero.rotation.x = 0;
      holder.add(hero);
      const bag = this.models.bag;
      if (this.heroAnim) {
        this.mountBagToSpine();
        bag.visible = true;
      } else {
        bag.position.set(0, 0.75, -0.3);
        holder.add(bag);
      }
    } else {
      if (this._bagMount) this.models.bag.visible = false;
      const vehicle = this.models[vehicleKey];
      vehicle.position.set(0, 0, 0);
      // 차량 GLB 3종 모두 앞머리(핸들바)가 -x — 진행 방향(+z)으로 90° 정렬
      vehicle.rotation.y = Math.PI / 2;
      holder.add(vehicle);
      // 탑승 자세: 킥보드는 발판에 서고, 자전거·스쿠터는 안장 착좌 (앉기 클립과 세트 튜닝)
      const pose = {
        kickboard: { y: 0.14, z: -0.05, rx: 0 },
        bicycle: { y: 0.33, z: 0.1, rx: -0.06 },
        scooter: { y: 0.30, z: 0.22, rx: -0.06 },
      }[vehicleKey];
      hero.position.set(0, pose.y, pose.z);
      hero.rotation.x = pose.rx;
      holder.add(hero);
    }
  }

  // 피격 빨간 점멸 — 주인공 재질 emissive 깜빡임
  updateHitFlash() {
    const p = this.player;
    const hero = this.heroVisual ?? this.models.hero;
    if (!this._heroMats) {
      this._heroMats = [];
      hero.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m && m.emissive) this._heroMats.push(m);
        }
      });
    }
    const flashing = p.time < (p.flashUntil ?? 0);
    const on = flashing && Math.floor((p.flashUntil - p.time) * 14) % 2 === 0;
    if (on !== this._flashOn) {
      this._flashOn = on;
      for (const m of this._heroMats) m.emissive.setHex(on ? 0xcc1111 : 0x000000);
    }
  }

  // 스켈레톤 달리기·대기 크로스페이드 — 속도 비례 가중치/재생속도
  updateHeroAnim(dt) {
    const a = this.heroAnim;
    if (!a) return;
    const p = this.player;
    const speed2D = Math.hypot(p.vel.x, p.vel.z);
    const isRun = p.vehicleKey === 'run' || !p.vehicleKey;
    const runT = isRun && p.grounded && speed2D > 0.4
      ? Math.min(speed2D / p.vehicle.maxSpeed, 1) : 0;
    // 안장 있는 탈것은 앉은 자세 (킥보드는 서서 타는 게 맞음)
    const sitT = a.sit && (p.vehicleKey === 'bicycle' || p.vehicleKey === 'scooter') ? 1 : 0;
    const k = Math.min(1, dt * 10);
    const rw = a.run.getEffectiveWeight() + (runT - a.run.getEffectiveWeight()) * k;
    const sw = a.sit ? a.sit.getEffectiveWeight() + (sitT - a.sit.getEffectiveWeight()) * k : 0;
    a.run.setEffectiveWeight(rw);
    a.sit?.setEffectiveWeight(sw);
    a.idle.setEffectiveWeight(Math.max(0, 1 - rw - sw));
    a.run.timeScale = 0.55 + (speed2D / p.vehicle.maxSpeed) * 0.75;
    a.mixer.update(dt);
  }

  applySeason(key) {
    const pal = PALETTES[key];
    this.scene.background = new THREE.Color(pal.sky);
    this.scene.fog = new THREE.Fog(pal.sky, FOG_NEAR, FOG_FAR);
    this.hemi.color.set(pal.sky);
    this.hemi.groundColor.set(pal.ground);
    // 겨울 후반 어둑함 (§7.6)
    this.hemi.intensity = key === 'winter' ? 0.78 : 0.9;
    this.sun.intensity = key === 'winter' ? 0.18 : 0.25;
    // 계절 텍스처 교체 (FR-5): 지면·도로·나무
    this.world.terrain.material.map = tex(`ground-${key}`);
    this.world.terrain.material.needsUpdate = true;
    this.world.roads.children.forEach((m) => {
      m.material.map = tex(`road-${key}`);
      m.material.needsUpdate = true;
    });
    if (this.props) {
      this.props.treeMat.map = tex(`tree-${key}`);
      this.props.treeMat.needsUpdate = true;
    }
  }

  stageClear() {
    if (this.state !== 'playing') return;
    this.state = 'clear';
    this.career.debt -= this.stageCfg.goal;
    this.input.exitPointerLock();
    this.ui.setHudVisible(false);
    this.audio.stopBGM();
    this.audio.play('clear');
    const isLast = this.stageIdx >= STAGES.length - 1;
    if (isLast) {
      try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    } else {
      this.saveProgress(); // FR-13 진행 저장
    }
    // FR-17 브릿지: 계절 전환 + 다음 탈것 안내
    const nextVehicle = isLast ? null : VEHICLES[STAGES[this.stageIdx + 1].vehicle].label;
    this.ui.showClear(
      { stage: this.stageCfg, revenue: this.stage_.revenue, deliveries: this.stage_.deliveries, isLast, nextVehicle },
      () => (isLast ? this.showEnding() : this.startStage(this.stageIdx + 1)),
    );
  }

  gameOver(reason) {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.input.exitPointerLock();
    this.ui.setHudVisible(false);
    this.audio.stopBGM();
    this.audio.play('gameover');
    this.ui.showGameOver(reason, () => this.retry());
  }

  retry() {
    this.ui.clearScreen();
    this.startStage(this.stageIdx); // FR-9 상태 완전 초기화 재시작
  }

  pauseGame() {
    this.state = 'paused';
    this._resumePause = () => {
      this.ui.clearScreen();
      this.state = 'playing';
      this.input.requestPointerLock();
    };
    this.ui.showPause({
      onResume: this._resumePause,
      onRestart: () => this.retry(),
      onMenu: () => {
        this.ui.clearScreen();
        this.showTitle();
      },
    });
  }

  showEnding() {
    this.state = 'ending';
    this.ui.showEnding({ ...this.career, debt: TOTAL_DEBT }, () => this.showTitle());
  }

  // ── 인게임 이벤트 ──────────────────────────

  damage(n, cause) {
    if (this.state !== 'playing') return;
    this.stage_.hp -= n;
    this.career.hits++;
    this.cam.shake(0.5, 0.35);
    this.audio.play('hit');
    if (this.stage_.hp <= 0) this.gameOver('체력이 바닥났다. 병원비가 더 나오게 생겼다…');
  }

  onObstacleHit(type) {
    switch (type) {
      case 'flyer': this.ui.toast('전단지를 받아버렸다… (감속)'); break;
      case 'kid': this.ui.toast('쿵! 자전거 초딩과 충돌 (-체력, -5초)'); break;
      case 'pigeon':
        this.ui.pigeonFlash();
        this.cam.shake(0.8, 0.5);
        this.ui.toast('푸드덕!! 앞이 안 보인다');
        this.audio.play('pigeon');
        break;
      case 'drunk': this.ui.toast('취객과 충돌! 조작이 반대로 꼬인다'); break;
    }
  }

  // ── 프레임 루프 ────────────────────────────

  frame() {
    const now = performance.now();
    const dt = Math.min((now - this._lastFrameAt) / 1000, 0.05);
    this._lastFrameAt = now;

    // 락 없이도 시점 조작 가능하게 (락 실패 폴백)
    this.input.freeLook = this.state === 'playing';

    if (this.state === 'playing') {
      // Esc 일시정지: 포인터록 중엔 브라우저가 Esc를 락 해제로 소비하므로
      // 락 상실로 감지, 락 없는 환경(폴백·?nolock)은 keydown으로 감지
      const locked = this.input.pointerLocked;
      if ((this._hadLock && !locked) || this.input.justPressed('Escape')) {
        this._hadLock = false;
        this.pauseGame();
      } else {
        this._hadLock = locked;
        this.player.update(dt, this.input, this.cam.yaw);
        this.delivery.update(dt, this.input, this.stageCfg, this.player.vehicle);
        this.obstacles.update(dt);
        this.updateHUD();
      }
    } else if (this.state === 'paused') {
      if (this.input.justPressed('Escape')) this._resumePause?.();
    } else if (this.state === 'gameover') {
      if (this.input.justPressed('KeyR')) this.retry();
    }

    // 앰비언트 애니메이션: 일시정지 외 상시 (타이틀 배경에도 생활감)
    if (this.state !== 'paused') {
      this.updateHeroAnim(dt);
      this.updateHitFlash();
      this.peds?.update(dt);
    }

    this.cam.update(dt, this.input, this.player.pos, {
      heading: this.player.heading,
      moving: this.state === 'playing'
        && Math.hypot(this.player.vel.x, this.player.vel.z) > 1,
    });
    this.retro.render(this.scene, this.cam.camera);
    this.input.endFrame();
  }

  updateHUD() {
    const d = this.delivery;
    let timer = null;
    if (d.phase === DeliveryPhase.CARRY) {
      timer = {
        text: `배달까지 ${Math.ceil(d.timeLeft)}초`,
        ratio: d.timeLeft / d.order.limit,
        low: d.timeLeft < 8,
      };
    } else if (d.phase === DeliveryPhase.PICKUP) {
      timer = { text: `${d.order.shop.name}에서 픽업`, ratio: 1, low: false };
    }
    this.ui.updateHUD({
      revenue: this.stage_.revenue,
      goal: this.stageCfg.goal,
      hp: this.stage_.hp,
      maxHp: MAX_HP,
      stageLabel: `STAGE ${this.stageCfg.id} · ${PALETTES[this.stageCfg.season].name}`,
      vehicleLabel: VEHICLES[this.stageCfg.vehicle].label,
      timer,
    });

    const target = d.targetPos();
    if (target) {
      const worldAngle = Math.atan2(target.x - this.player.pos.x, target.z - this.player.pos.z);
      let rel = worldAngle - this.cam.yaw;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      this.ui.setArrow(-rel, true);
      const dist = this.player.pos.distanceTo(target);
      if (dist < 4) {
        this.ui.showHint(d.phase === DeliveryPhase.PICKUP ? '[E] 픽업' : '[E] 전달');
      } else {
        this.ui.hideHint();
      }
    } else {
      this.ui.setArrow(0, false);
      this.ui.hideHint();
    }
  }
}
