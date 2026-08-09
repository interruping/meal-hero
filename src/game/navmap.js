import { MAP_HALF, STREETS, ROAD_HALF } from './citymap.js';
import { DELIVERY_COLORS_CSS } from './delivery.js';

// FR-20 네비게이션 지도 (§12.2): 격자 도로망 위 다익스트라 최단 경로.
// 세로 골목 x∈STREETS (z -85~85), 가로 골목 z∈STREETS (x -85~85).
// §16.1 (FR-38) 외곽 순환 접근로 제거 — 상가는 격자 골목 투영 후 직결 구간으로 안내
const EXT = MAP_HALF; // 골목 끝
const lineLimit = () => EXT;

export class NavMap {
  constructor() {
    // 노드: 세로 골목 × 가로 골목 교차점
    this.xLines = [...STREETS];
    this.zLines = [...STREETS];
    this.nodes = [];
    this.key = (xi, zi) => `${xi},${zi}`;
    this.idx = new Map();
    for (let xi = 0; xi < this.xLines.length; xi++) {
      for (let zi = 0; zi < this.zLines.length; zi++) {
        this.idx.set(this.key(xi, zi), this.nodes.length);
        this.nodes.push({ x: this.xLines[xi], z: this.zLines[zi] });
      }
    }
    this.adj = this.nodes.map(() => []);
    const link = (a, b) => {
      const d = Math.hypot(this.nodes[a].x - this.nodes[b].x, this.nodes[a].z - this.nodes[b].z);
      this.adj[a].push([b, d]);
      this.adj[b].push([a, d]);
    };
    for (let xi = 0; xi < this.xLines.length; xi++) {
      for (let zi = 0; zi + 1 < this.zLines.length; zi++) {
        link(this.idx.get(this.key(xi, zi)), this.idx.get(this.key(xi, zi + 1)));
      }
    }
    for (let zi = 0; zi < this.zLines.length; zi++) {
      for (let xi = 0; xi + 1 < this.xLines.length; xi++) {
        link(this.idx.get(this.key(xi, zi)), this.idx.get(this.key(xi + 1, zi)));
      }
    }
  }

  // 도로망 위 최근접 투영점 + 그 투영점이 놓인 도로의 양끝 이웃 노드
  project(p) {
    let best = null;
    // 세로 골목
    for (let xi = 0; xi < this.xLines.length; xi++) {
      const lim = lineLimit(this.xLines[xi]);
      const z = Math.max(-lim, Math.min(lim, p.z));
      const dist = Math.hypot(p.x - this.xLines[xi], p.z - z);
      if (!best || dist < best.dist) best = { dist, x: this.xLines[xi], z, vertical: true, line: xi };
    }
    // 가로 골목
    for (let zi = 0; zi < this.zLines.length; zi++) {
      const lim = lineLimit(this.zLines[zi]);
      const x = Math.max(-lim, Math.min(lim, p.x));
      const dist = Math.hypot(p.z - this.zLines[zi], p.x - x);
      if (dist < best.dist) best = { dist, x, z: this.zLines[zi], vertical: false, line: zi };
    }
    return best;
  }

  // 투영점 이웃 노드 (해당 도로 위에서 앞뒤 교차점)
  anchors(proj) {
    const out = [];
    if (proj.vertical) {
      for (let zi = 0; zi < this.zLines.length; zi++) {
        out.push([this.idx.get(this.key(proj.line, zi)), Math.abs(this.zLines[zi] - proj.z)]);
      }
    } else {
      for (let xi = 0; xi < this.xLines.length; xi++) {
        out.push([this.idx.get(this.key(xi, proj.line)), Math.abs(this.xLines[xi] - proj.x)]);
      }
    }
    // 같은 도로 위 모든 교차점을 후보로 하되 가까운 2개만 연결 (경로 자연스러움)
    return out.sort((a, b) => a[1] - b[1]).slice(0, 2);
  }

  // a→b 도로망 경로 폴리라인 (월드 좌표 {x,z} 배열)
  route(a, b) {
    const pa = this.project(a);
    const pb = this.project(b);
    const N = this.nodes.length;
    const START = N;
    const GOAL = N + 1;
    const adj = this.adj.map((list) => [...list]);
    adj.push([]); // START
    adj.push([]); // GOAL
    for (const [n, d] of this.anchors(pa)) {
      adj[START].push([n, d]);
      adj[n].push([START, d]);
    }
    for (const [n, d] of this.anchors(pb)) {
      adj[GOAL].push([n, d]);
      adj[n].push([GOAL, d]);
    }
    // 같은 도로 위면 직통 허용
    if (pa.vertical === pb.vertical && pa.line === pb.line) {
      const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
      adj[START].push([GOAL, d]);
    }
    // 다익스트라 (노드 32개 — 선형 탐색으로 충분)
    const dist = new Array(N + 2).fill(Infinity);
    const prev = new Array(N + 2).fill(-1);
    const done = new Array(N + 2).fill(false);
    dist[START] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < dist.length; i++) {
        if (!done[i] && dist[i] < (u < 0 ? Infinity : dist[u])) u = i;
      }
      if (u < 0 || u === GOAL) break;
      done[u] = true;
      for (const [v, w] of adj[u]) {
        if (dist[u] + w < dist[v]) {
          dist[v] = dist[u] + w;
          prev[v] = u;
        }
      }
    }
    const pts = [{ x: b.x, z: b.z }, { x: pb.x, z: pb.z }];
    for (let u = prev[GOAL]; u >= 0 && u !== START; u = prev[u]) pts.push(this.nodes[u]);
    pts.push({ x: pa.x, z: pa.z });
    pts.push({ x: a.x, z: a.z });
    return pts.reverse();
  }

  // 스마트폰 지도 렌더 (2D 캔버스)
  draw(ctx, player, active) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const M = MAP_HALF + 6;
    const pad = 10;
    const sx = (x) => pad + ((x + M) / (2 * M)) * (W - pad * 2);
    const sy = (z) => pad + ((z + M) / (2 * M)) * (H - pad * 2);
    const roadW = Math.max(4, ((ROAD_HALF * 2) / (2 * M)) * (W - pad * 2));

    ctx.fillStyle = '#e9e7e0';
    ctx.fillRect(0, 0, W, H);
    // 도로망
    ctx.strokeStyle = '#c2beb1';
    ctx.lineCap = 'round';
    ctx.lineWidth = roadW;
    for (const s of STREETS) {
      ctx.beginPath();
      ctx.moveTo(sx(s), sy(-EXT));
      ctx.lineTo(sx(s), sy(EXT));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx(-EXT), sy(s));
      ctx.lineTo(sx(EXT), sy(s));
      ctx.stroke();
    }
    // 배달 루트 + 목적지 핀 + 남은 시간 (색상별 — §12.2)
    for (const d of active) {
      const color = DELIVERY_COLORS_CSS[d.colorIdx];
      const target = d.phase === 'pickup' ? d.shop.pos : d.door.pos;
      const pts = this.route(player.pos, target);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.setLineDash(d.phase === 'pickup' ? [7, 4] : []);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.z)) : ctx.moveTo(sx(p.x), sy(p.z))));
      ctx.stroke();
      ctx.setLineDash([]);
      // 핀
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx(target.x), sy(target.z), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#efeeea';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 남은 시간 라벨
      const label = `${Math.max(0, Math.ceil(d.timeLeft))}초`;
      ctx.font = 'bold 13px Galmuri11, monospace';
      const tw = ctx.measureText(label).width + 8;
      const lx = Math.min(W - tw - 2, sx(target.x) + 9);
      const ly = Math.max(14, sy(target.z) - 8);
      ctx.fillStyle = color;
      ctx.fillRect(lx, ly - 11, tw, 16);
      ctx.fillStyle = '#efeeea';
      ctx.fillText(label, lx + 4, ly + 1);
    }

    // 플레이어 (진행 방향 삼각형)
    const px = sx(player.pos.x);
    const py = sy(player.pos.z);
    ctx.save();
    ctx.translate(px, py);
    // heading=atan2(vx,vz), 캔버스 y=+z: 삼각형(위 방향 기준) 회전 보정
    ctx.rotate(Math.PI - (player.heading ?? 0));
    ctx.fillStyle = '#3a3a38';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#efeeea';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}
