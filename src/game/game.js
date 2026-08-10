import * as THREE from 'three';
import { RetroRenderer } from '../core/renderer.js';
import { Input } from '../core/input.js';
import { UI } from './ui.js';
import { PALETTES, FOG_NEAR, FOG_FAR } from './palettes.js';
import { buildCity } from './citymap.js';
import { Player } from './player.js';
import { FollowCamera } from './camera.js';
import { DeliveryManager, MAX_ACTIVE, DELIVERY_COLORS_CSS } from './delivery.js';
import { ObstacleManager } from './obstacles.js';
import {
  STAGES, MAX_HP, TOTAL_DEBT, STAGE_TIME, SEASON_DAYS,
  BONUS_TIME_RATIO, BONUS_MULT, LATE_FEE, DRINK_COST, OBSTACLE_INFO,
} from './stages.js';
import { DASH_COOLDOWN } from './player.js';
import { ModelViewer } from './modelview.js';
import { VEHICLES } from './vehicles.js';
import { loadModel, loadAnimated, instantiateAnimated, addSkinnedOutline } from '../core/loader.js';
import { buildProps, placeParkedVehicles } from './props.js';
import { Pedestrians } from './pedestrians.js';
import { tex } from './textures.js';
import { AudioSys } from '../core/audio.js';
import { setupWalkAnimation, addOutline } from './walkanim.js';
import { NavMap } from './navmap.js';
import { ArrowGuide } from './arrow.js';
import { WindFX } from './windfx.js';
import { Traffic } from './traffic.js';
import { Signals } from './signals.js';

const SAVE_KEY = 'mealhero-save-v2'; // §12 경제 개편으로 세이브 포맷 리셋

const OPENING_LINES = [
  '2026년 봄. 사업이 망했다.',
  '남은 것은 빚 2,000만 원과 튼튼한 두 다리뿐.',
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
      onAccept: (d) => {
        this.ui.toast(`의뢰 수락! ${d.shop.name} → ${d.door.name}`, 1400);
        this.audio.play('order');
      },
      onFull: () => this.ui.toast('가방이 가득! 동시 배달은 3건까지', 1400),
      // FR-24 수령 코드 매칭 (§12.5): E 수령 시 영수증 4장 중 내 코드 고르기
      onPickupRequest: (d) => this.startCodeMatch(d),
      onPickedUp: (d) => {
        this.ui.banner(`픽업 완료! <b>${d.door.name}</b>으로`, 1400);
        this.audio.play('pickup');
      },
      onDelivered: (d) => {
        // §12.3 스피드 보너스: 제한 시간 70% 이내 완료 시 +50%
        const fast = (d.limit - d.timeLeft) <= d.limit * BONUS_TIME_RATIO;
        const paid = fast ? Math.round(d.pay * BONUS_MULT) : d.pay;
        this.stage_.revenue += paid;
        this.career.revenue += paid;
        this.stage_.deliveries++;
        this.career.deliveries++;
        this.ui.banner(
          fast
            ? `배달 완료! +₩${paid.toLocaleString()} <span style="color:#b5372f">스피드 보너스!</span>`
            : `배달 완료! +₩${paid.toLocaleString()}`,
          1800,
        );
        this.audio.play(fast ? 'bonus' : 'deliver');
      },
      onExpired: (d) => {
        // §12.3 지각 수수료 — 순수익이 음수가 되는 순간 게임오버
        this.stage_.fees += LATE_FEE;
        this.ui.toast(`${d.door.name} 배달 시간 초과! 수수료 -₩${LATE_FEE.toLocaleString()}`, 2200);
        this.audio.play('miss');
        if (this.stage_.revenue - this.stage_.fees < 0) {
          this.gameOver('매출보다 수수료가 커졌다. 이번 분기는 적자…');
        }
      },
    });
    this.obstacles = new ObstacleManager(this.world, this.scene, this.player, this);
    this.navMap = new NavMap(); // FR-20 네비게이션
    this.arrow = new ArrowGuide(this.scene); // FR-33 (§15.1) 3D 안내 화살표
    this.windfx = new WindFX(this.scene); // FR-51 (§17.5) 대시 바람 이펙트
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
      parasol: 2.4, laundry: 1.4, cat: 0.45, railing: 1.05,
      'signal-car': 0.5, 'signal-ped': 0.8, // §16.2 신호등 헤드 (Meshy — 텍스처 박스 교체 피드백)
    };
    const propEntries = await Promise.all(
      Object.entries(PROP_HEIGHTS).map(async ([k, h]) => [k, await loadModel(`prop3d-${k}`, h)]),
    );
    this.props = buildProps(this.world, this.scene, Object.fromEntries(propEntries));
    // 차량은 소품 뒤에 배치 — 소품 풋프린트(world.propBoxes)와 겹침 회피
    placeParkedVehicles(this.world, this.scene, { sedan: parkedSedan, truck: parkedTruck });
    // §16.2 (FR-41) 교차로 신호 — 횡단보도·정지선·신호등(Meshy 헤드), 전역 주기
    const propModels = Object.fromEntries(propEntries);
    this.signals = new Signals(this.scene, {
      car: propModels['signal-car'],
      ped: propModels['signal-ped'],
    });
    // §15.4 (FR-36) 차도 주행 차량 — 주차 차량과 같은 Meshy 모델 재사용
    this.traffic = new Traffic(this.scene, this.world, { sedan: parkedSedan, truck: parkedTruck },
      (car, fx, fz) => this.onCarHit(fx, fz), this.signals);
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
    this.arrow.hide();
    this.ui.setArrowLabel(null);
    this.input.exitPointerLock();
    this.audio.startBGM('menu'); // §12.6 메뉴 BGM (첫 제스처 시 재생 시작)
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
    // §14.5 대사 UI에 주인공 모델 턴테이블 (FR-31)
    this.modelView ??= new ModelViewer(200, 200);
    const heroCanvas = this.modelView.show(this.models.hero.clone(true), { spin: 0.7 });
    this.ui.showOpening(OPENING_LINES, () => {
      this.modelView.stop();
      this._offerTutorial = true; // §14.6 처음 시작 플로우에서만 튜토리얼 제안 (FR-32)
      this.startStage(0);
    }, heroCanvas);
  }

  startStage(idx) {
    this.stageIdx = idx;
    this.stageCfg = STAGES[idx];
    this.stage_ = { revenue: 0, fees: 0, deliveries: 0, hp: MAX_HP, timeLeft: STAGE_TIME };
    this.codeMatch = null;
    this.tutorial = null; // §14.6 재시작·재진입 시 튜토리얼 상태 해제
    this.ui.tutorialGuide(null);
    this.ui.hideCodeMatch();
    this.applySeason(this.stageCfg.season);
    this.player.setVehicle(this.stageCfg.vehicle);
    this.player.slippery = !!this.stageCfg.slippery;
    this.player.reset();
    this.attachVehicleVisual(this.stageCfg.vehicle);
    this.delivery.reset(this.stageCfg);
    this.obstacles.setup(this.stageCfg);
    this.cam.initialized = false;
    this.state = 'intro';
    this.ui.setHudVisible(false);
    // §14.4 신규 방해요소 3D 소개 (FR-30): 스테이지 첫 진입에만, 재시작 시 생략
    this._obsIntroShown ??= new Set();
    let obstacleIntro = null;
    const newType = this.stageCfg.obstacles[this.stageCfg.obstacles.length - 1];
    if (!this._obsIntroShown.has(idx) && this.obstacles.proto(newType)) {
      this._obsIntroShown.add(idx);
      this.obstacles.introduced.add(newType); // 인게임 자막 1줄 배너는 모달이 대체
      this.modelView ??= new ModelViewer(200, 200);
      obstacleIntro = {
        ...OBSTACLE_INFO[newType],
        canvas: this.modelView.show(this.obstacles.proto(newType).clone(true)),
      };
    }
    this.ui.showStageIntro(this.stageCfg, VEHICLES[this.stageCfg.vehicle].label, this.career.debt, () => {
      this.modelView?.stop();
      // §14.6 튜토리얼 제안 (FR-32): 오프닝 경유 첫 시작 + 봄 스테이지에서만
      if (this._offerTutorial && idx === 0) {
        this._offerTutorial = false;
        this.ui.showTutorialAsk({
          onYes: () => { this.beginPlay(); this.startTutorial(); },
          onNo: () => this.beginPlay(),
        });
      } else {
        this.beginPlay();
      }
    }, obstacleIntro);
  }

  beginPlay() {
    this.ui.clearScreen();
    this.state = 'playing';
    this.ui.setHudVisible(true);
    this.input.requestPointerLock();
    this.audio.startBGM(this.stageCfg.season);
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
    // §15.4 인도 보도블럭 계절 교체 (FR-36)
    this.world.sidewalks.children.forEach((m) => {
      m.material.map = tex(`sidewalk-${key}`);
      m.material.needsUpdate = true;
    });
    if (this.props) {
      this.props.treeMat.map = tex(`tree-${key}`);
      this.props.treeMat.needsUpdate = true;
    }
  }

  // §12.4 스테이지 정산: 10분 순수익 × 120일 = 스테이지 매출 → 빚 탕감
  stageSettle() {
    if (this.state !== 'playing') return;
    this.state = 'clear';
    const net = this.stage_.revenue - this.stage_.fees;
    const settlement = Math.max(0, net) * SEASON_DAYS;
    const debtBefore = this.career.debt;
    this.career.debt = Math.max(0, this.career.debt - settlement);
    this._debtBeforeStage = debtBefore; // 배드 엔딩 재도전 시 복원용
    this.input.exitPointerLock();
    this.ui.setHudVisible(false);
    this.arrow.hide();
    this.ui.setArrowLabel(null);
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
    this.ui.showSettlement(
      {
        stage: this.stageCfg,
        revenue: this.stage_.revenue,
        fees: this.stage_.fees,
        net,
        days: SEASON_DAYS,
        settlement,
        debtBefore,
        debtAfter: this.career.debt,
        deliveries: this.stage_.deliveries,
        isLast,
        nextVehicle,
      },
      () => (isLast ? this.showEnding() : this.startStage(this.stageIdx + 1)),
    );
  }

  gameOver(reason) {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.input.exitPointerLock();
    this.ui.setHudVisible(false);
    this.arrow.hide();
    this.ui.setArrowLabel(null);
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

  // §12.4 엔딩 분기: 겨울 정산 후 빚 완납 여부에 따라 해피/배드 엔딩
  showEnding() {
    this.state = 'ending';
    const debtLeft = this.career.debt;
    this.ui.showEnding(
      { ...this.career, totalDebt: TOTAL_DEBT, debtLeft },
      () => this.showTitle(),
      debtLeft > 0
        ? () => {
            // 겨울 재도전: 정산 전 빚으로 복원
            this.career.debt = this._debtBeforeStage ?? debtLeft;
            this.ui.clearScreen();
            this.startStage(STAGES.length - 1);
          }
        : null,
    );
  }

  // ── 튜토리얼 (FR-32 §14.6) ─────────────────
  // 4단계: 수락(1~4) → 픽업(E+코드) → 네비(M 홀드) → 전달(E).
  // 실제 조작 수행을 감지해 다음 단계로. 진행 중 스테이지·의뢰 타이머 정지

  startTutorial() {
    this.tutorial = { step: 0, mHold: 0 };
    this.ui.tutorialGuide(0,
      '상단 의뢰 슬롯에서 <b>[1~4]</b> 키를 눌러<br>배달 의뢰를 수락해보세요', '#hud-offers');
  }

  updateTutorial(dt) {
    const t = this.tutorial;
    const d = this.delivery;
    if (t.step === 0 && d.active.length > 0) {
      t.step = 1;
      this.ui.tutorialGuide(1,
        '화살표를 따라 가게 앞에서 <b>[E]</b> —<br>접수증과 같은 영수증을 <b>[1~4]</b>로 골라 픽업!', '#arrow-label');
    } else if (t.step === 1 && d.active.some((a) => a.phase === 'carry')) {
      t.step = 2;
      this.ui.tutorialGuide(2,
        '<b>[M]</b>을 1초 이상 길게 눌러<br>네비게이션으로 배달 루트를 확인해보세요', '#navphone');
    } else if (t.step === 2) {
      if (this._navOpen) t.mHold += dt;
      if (t.mHold >= 1) {
        t.step = 3;
        this.ui.tutorialGuide(3,
          '지도의 색깔 마커가 목적지!<br>빌라 현관 앞에서 <b>[E]</b>로 전달하면 완료', '#hud-active');
      }
    } else if (t.step === 3 && this.stage_.deliveries > 0) {
      this.tutorial = null;
      this.ui.tutorialGuide(null);
      this.ui.toast('튜토리얼 완료! 지금부터 10분 타이머 시작', 2600);
    }
  }

  // ── 수령 코드 매칭 (FR-24 §12.5) ───────────

  startCodeMatch(d) {
    if (this.codeMatch) return;
    const gen = () => {
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      let s = '';
      for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    };
    const codes = new Set([gen()]);
    while (codes.size < 4) codes.add(gen());
    const pool = [...codes];
    const myCode = pool[0];
    const list = [...pool].sort(() => Math.random() - 0.5);
    this.codeMatch = { d, correctIdx: list.indexOf(myCode), timeLeft: 3 };
    this.ui.showCodeMatch(list, myCode);
    this.audio.play('receipt');
  }

  updateCodeMatch(dt) {
    const cm = this.codeMatch;
    cm.timeLeft -= dt;
    for (let i = 0; i < 4; i++) {
      if (this.input.justPressed(`Digit${i + 1}`) || this.input.justPressed(`Numpad${i + 1}`)) {
        this.resolveCodeMatch(i === cm.correctIdx);
        return;
      }
    }
    if (cm.timeLeft <= 0) {
      this.resolveCodeMatch(false); // 미선택 = 오답과 동일 (§12.5)
      return;
    }
    this.ui.updateCodeMatch(cm.timeLeft / 3, Math.ceil(cm.timeLeft));
  }

  resolveCodeMatch(correct) {
    const cm = this.codeMatch;
    this.codeMatch = null;
    this.ui.hideCodeMatch();
    this.delivery.confirmPickup(cm.d, correct ? 0 : 5);
    if (!correct) {
      this.ui.toast('영수증 불일치! 배달 시간 -5초', 1800);
      this.audio.play('codeBad');
    }
  }

  // ── 인게임 이벤트 ──────────────────────────

  // FR-27 에너지 드링크 (§14.1): 순수익 1,500 이상 + 대시 쿨타임 중일 때만
  drinkEnergy() {
    const p = this.player;
    const net = this.stage_.revenue - this.stage_.fees;
    const onCooldown = p.time >= (p.dashUntil ?? 0) && p.time < (p.dashReadyAt ?? 0);
    if (!onCooldown) {
      this.ui.toast('대시 쿨타임이 없을 땐 마실 필요 없음', 1300);
      return;
    }
    if (net < DRINK_COST) {
      this.ui.toast(`잔액 부족! 에너지 드링크는 ₩${DRINK_COST.toLocaleString()}`, 1500);
      return;
    }
    this.stage_.revenue -= DRINK_COST;
    p.resetDashCooldown();
    this.ui.toast(`에너지 드링크! 대시 쿨타임 초기화 (-₩${DRINK_COST.toLocaleString()})`, 1500);
    this.audio.play('pickup');
  }

  // §15.4 (FR-36) 차에 치임: 즉시 하트 1 + 진행 방향으로 코믹하게 튕겨나감
  onCarHit(fx, fz) {
    const p = this.player;
    if (this.state !== 'playing') return;
    if (this.codeMatch) return; // §17.7 (FR-53) 코드 매칭 중 무적
    if (p.time < (p.carHitCooldownUntil ?? 0)) return;
    p.carHitCooldownUntil = p.time + 1.2;
    p.flashUntil = p.time + 0.6;
    p.vel.x = fx * 16;
    p.vel.z = fz * 16;
    p.vel.y = 5.5;
    this.ui.toast('빵빵!! 무자비한 차에 치였다 (-체력 1)', 1800);
    this.damage(1, 'crash');
  }

  damage(n, cause) {
    if (this.state !== 'playing') return;
    this.stage_.hp -= n;
    this.career.hits++;
    this.cam.shake(0.5, 0.35);
    this.audio.play(cause === 'crash' ? 'crash' : 'hit');
    if (this.stage_.hp <= 0) this.gameOver('체력이 바닥났다. 병원비가 더 나오게 생겼다…');
  }

  onObstacleHit(type) {
    switch (type) {
      case 'flyer':
        this.ui.toast('전단지를 받아버렸다… (감속)');
        this.audio.play('flyer'); // §12.6 방해요소 보이스
        break;
      case 'kid':
        this.ui.toast('쿵! 자전거 초딩과 충돌 (-체력, -5초)');
        this.audio.play('kid');
        break;
      case 'pigeon':
        this.ui.pigeonFlash();
        this.cam.shake(0.8, 0.5);
        this.ui.toast('푸드덕!! 앞이 안 보인다');
        this.audio.play('pigeon');
        break;
      case 'drunk':
        this.ui.toast('취객과 충돌! 조작이 반대로 꼬인다');
        this.audio.play('drunk');
        break;
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
        // §17.7 (FR-53) 수령 코드 매칭 중 이동 잠금 + 무적 — 종료 즉시 해제
        const cmLock = !!this.codeMatch;
        this.player.locked = cmLock;
        this.player.invulnerable = cmLock;
        this.player.update(dt, this.input, this.cam.yaw);
        if (this.input.justPressed('KeyQ')) this.drinkEnergy();
        // 코드 매칭 중엔 1~4·E를 미니게임이 가져간다 (게임 자체는 계속 진행 — §12.5)
        this.delivery.update(dt, this.input, this.stageCfg, this.player.vehicle, {
          acceptKeys: !this.codeMatch,
          freezeTimers: !!this.tutorial, // §14.6 튜토리얼 중 의뢰 TTL·배달 시간 정지
        });
        if (this.codeMatch) this.updateCodeMatch(dt);
        if (this.tutorial) this.updateTutorial(dt);
        this.obstacles.update(dt);
        // §12.4 스테이지 제한 10분 — 소진 시 정산으로 (튜토리얼 중 정지 — §14.6)
        if (!this.tutorial) this.stage_.timeLeft -= dt;
        if (this.stage_.timeLeft <= 0) {
          this.stage_.timeLeft = 0;
          this.stageSettle();
        } else {
          this.updateHUD();
        }
      }
    } else if (this.state === 'paused') {
      if (this.input.justPressed('Escape')) this._resumePause?.();
    } else if (this.state === 'gameover') {
      if (this.input.justPressed('KeyR')) this.retry();
    }

    // FR-20 네비게이션: M 홀드 동안 스마트폰 확대 + 지도 갱신 (게임은 계속 진행)
    const navOpen = this.state === 'playing' && this.input.down('KeyM');
    if (navOpen !== this._navOpen) {
      this._navOpen = navOpen;
      this.ui.setNav(navOpen);
    }
    if (navOpen) {
      this.navMap.draw(this.ui.navCtx(), this.player, this.delivery.active);
      this.ui.updateNavLegend(this.delivery.active, DELIVERY_COLORS_CSS);
    }

    // 앰비언트 애니메이션: 일시정지 외 상시 (타이틀 배경에도 생활감)
    if (this.state !== 'paused') {
      this.updateHeroAnim(dt);
      this.updateHitFlash();
      this.windfx.update(dt, this.player);
      this.peds?.update(dt);
      // §15.4 차량은 상시 주행, 충돌 판정은 플레이 중에만. §16.2 신호 주기 상시 순환
      this.signals?.update(dt);
      this.traffic?.update(dt, this.player, this.state === 'playing');
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
    // §14.1 좌하단 스킬 UI 상태: 대시 쿨타임 게이지 + 드링크 사용 가능 여부
    const p = this.player;
    const dashActive = p.time < (p.dashUntil ?? 0);
    const cdLeft = dashActive ? 0 : Math.max(0, (p.dashReadyAt ?? 0) - p.time);
    this.ui.updateHUD({
      revenue: this.stage_.revenue,
      fees: this.stage_.fees,
      hp: this.stage_.hp,
      maxHp: MAX_HP,
      stageTimeLeft: this.stage_.timeLeft,
      stageLabel: `STAGE ${this.stageCfg.id} · ${PALETTES[this.stageCfg.season].name}`,
      vehicleLabel: VEHICLES[this.stageCfg.vehicle].label,
      offers: d.slots,
      active: d.active,
      full: d.active.length >= MAX_ACTIVE,
      playerPos: p.pos,
      skill: {
        dashActive,
        cdLeft,
        cdTotal: DASH_COOLDOWN,
        drinkOk: cdLeft > 0 && this.stage_.revenue - this.stage_.fees >= DRINK_COST,
      },
    });

    // §15.1 (FR-33) 3D 화살표: 가장 급박한 진행 건 방향 (해당 배달 색) + 대상 라벨
    const urgent = d.urgent();
    if (urgent) {
      const target = d.targetOf(urgent);
      const color = DELIVERY_COLORS_CSS[urgent.colorIdx];
      this.arrow.update(p.time, p.pos, target, color, this.cam.camera, this.world.groundHeight);
      // 라벨은 화살표 밑을 화면 좌표로 투영 (#ui는 캔버스 rect와 일치 — §15.2)
      const v = this.arrow.group.position.clone();
      v.y -= 0.55;
      v.project(this.cam.camera);
      this.ui.setArrowLabel(
        urgent.phase === 'pickup' ? `${urgent.shop.name} 픽업` : `${urgent.door.name} 배달`,
        color,
        (v.x * 0.5 + 0.5) * this.ui.root.offsetWidth,
        (-v.y * 0.5 + 0.5) * this.ui.root.offsetHeight,
      );
    } else {
      this.arrow.hide();
      this.ui.setArrowLabel(null);
    }

    const near = d.nearestInteractable();
    if (near) {
      this.ui.showHint(near.phase === 'pickup' ? `[E] ${near.shop.name} 픽업` : `[E] ${near.door.name} 전달`);
    } else {
      this.ui.hideHint();
    }
  }
}
