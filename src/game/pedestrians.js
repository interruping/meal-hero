import * as THREE from 'three';
import { loadAnimated, instantiateAnimated, addSkinnedOutline, applyHeadRatio } from '../core/loader.js';
import { terrainHeight } from './heightfield.js';
import { STREETS, MAP_HALF, WALK_MID, LANE_HALF } from './citymap.js';

// 행인 10종 — Meshy 리깅+걷기 애니메이션 GLB를 골목 그리드 위에서 배회시킨다.
// 게임플레이 영향 없음(통과 가능): 동네 생활감 연출용 (§7.7)
// §15.4 (FR-36): 인도(|lateral| 1.9~3.0)로만 다닌다 — 차도 진입 금지

const PED_NAMES = [
  'ped-ajumma', 'ped-grandpa', 'ped-schoolgirl', 'ped-schoolboy', 'ped-officeman',
  'ped-officewoman', 'ped-jogger', 'ped-shopkeeper', 'ped-rider', 'ped-hoodie',
];
const H = terrainHeight;
const LIMIT = MAP_HALF - 8;

export class Pedestrians {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'pedestrians';
    scene.add(this.group);
    this.walkers = [];
  }

  async init() {
    const assets = [];
    for (const n of PED_NAMES) {
      try {
        assets.push(await loadAnimated(`${n}-walk`, 1.38 + Math.random() * 0.14));
      } catch {
        // 아직 생성 안 된 모델은 건너뜀 — 배치 완료 후 자동 포함
      }
    }
    if (!assets.length) return;
    // 종별 1~2명, 총 ~14명
    let count = 0;
    for (let i = 0; count < 14; i++) {
      const asset = assets[i % assets.length];
      this.spawn(asset);
      count++;
      if (i >= assets.length - 1 && count >= Math.min(14, assets.length * 2)) break;
    }
  }

  spawn(asset) {
    const { model, mixer, clips } = instantiateAnimated(asset);
    // 클립의 Head scale 트랙 제거 — 안 하면 mixer가 매 프레임 머리 스케일을 원복시킴
    for (const c of clips) {
      c.tracks = c.tracks.filter((t) => !/head\.scale$/i.test(t.name));
    }
    // 주인공 머리 비중(실측 0.316)에 맞춰 가분수 정합
    applyHeadRatio(model, 0.316, asset.targetHeight);
    addSkinnedOutline(model, 0.02);
    const action = mixer.clipAction(clips[0]);
    action.play();
    action.timeScale = 0.85 + Math.random() * 0.35;
    const w = {
      model, mixer,
      axis: 'z', line: 0, lateral: WALK_MID, t: 0,
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: 1.15 + Math.random() * 0.5,
      yaw: 0,
      nextCross: null,
    };
    // 산발 스폰: 다른 행인들과 가장 멀리 떨어지는 후보 선택 (한곳 몰림 방지)
    let best = null, bestD = -1;
    for (let attempt = 0; attempt < 16; attempt++) {
      const cand = {
        axis: Math.random() < 0.5 ? 'x' : 'z',
        line: STREETS[Math.floor(Math.random() * STREETS.length)],
        lateral: (Math.random() < 0.5 ? -1 : 1) * WALK_MID,
        t: -LIMIT + Math.random() * LIMIT * 2,
      };
      const x = cand.axis === 'z' ? cand.line + cand.lateral : cand.t;
      const z = cand.axis === 'z' ? cand.t : cand.line + cand.lateral;
      if (this.blocked(x, z)) continue;
      let dMin = Infinity;
      for (const o of this.walkers) {
        const dx = o.model.position.x - x;
        const dz = o.model.position.z - z;
        dMin = Math.min(dMin, dx * dx + dz * dz);
      }
      if (dMin > bestD) { bestD = dMin; best = cand; }
      if (dMin > 20 * 20) break; // 충분히 멀면 즉시 채택
    }
    if (best) Object.assign(w, best);
    this.place(w);
    w.model.rotation.y = w.yaw = this.targetYaw(w);
    this.group.add(model);
    this.walkers.push(w);
  }

  pos(w) {
    const x = w.axis === 'z' ? w.line + w.lateral : w.t;
    const z = w.axis === 'z' ? w.t : w.line + w.lateral;
    return [x, z];
  }

  place(w) {
    const [x, z] = this.pos(w);
    w.model.position.set(x, H(x, z), z);
  }

  targetYaw(w) {
    if (w.axis === 'z') return w.dir > 0 ? 0 : Math.PI;
    return w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  blocked(x, z) {
    const r = 0.45;
    for (const c of this.world.colliders) {
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r
        && H(x, z) + 0.8 > c.minY && H(x, z) < c.maxY) return true;
    }
    return false;
  }

  update(dt) {
    for (const w of this.walkers) {
      w.mixer.update(dt);
      const step = w.speed * dt;
      const nt = w.t + w.dir * step;
      const [nx, nz] = w.axis === 'z' ? [w.line + w.lateral, nt] : [nt, w.line + w.lateral];
      if (nt > LIMIT || nt < -LIMIT) {
        w.dir *= -1;
      } else if (this.blocked(nx, nz)) {
        // 막히면 인도 안쪽 경계(차도 연석 직전)로 붙어보고, 그래도 막히면 회차 —
        // 차도(|lateral| < LANE_HALF)로는 절대 내려서지 않는다 (§15.4)
        const inner = Math.sign(w.lateral || 1) * (LANE_HALF + 0.12);
        const [ix, iz] = w.axis === 'z' ? [w.line + inner, nt] : [nt, w.line + inner];
        if (!this.blocked(ix, iz)) w.lateral = inner;
        else w.dir *= -1;
      } else {
        w.t = nt;
        // 사거리에서 확률적으로 방향 전환
        for (const s of STREETS) {
          if (Math.abs(w.t - s) < step && Math.random() < 0.35) {
            const newLine = s;
            const newT = w.line + w.lateral;
            w.axis = w.axis === 'z' ? 'x' : 'z';
            w.line = newLine;
            w.t = newT;
            w.dir = Math.random() < 0.5 ? -1 : 1;
            break;
          }
        }
        // 인도 중심선으로 서서히 복귀
        const edge = Math.sign(w.lateral || 1) * WALK_MID;
        w.lateral += (edge - w.lateral) * Math.min(1, dt * 0.4);
      }
      this.place(w);
      const ty = this.targetYaw(w);
      let d = ty - w.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      w.yaw += d * Math.min(1, dt * 8);
      w.model.rotation.y = w.yaw;
    }
  }
}
