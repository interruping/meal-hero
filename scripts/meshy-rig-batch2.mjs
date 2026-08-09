// Meshy 리깅+애니메이션 2차: 1차(action_id 오류)에서 복구.
// - 완료된 리그 6종은 애니메이션만, 미생성 행인 4종은 풀 체인, 주인공·취객은 rig부터.
// - 진행 상태를 scripts/rig-report.json에 단계마다 기록 (재실행 시 이어서).
// action_id: Casual_Walk=30, Walking_Woman=1, Run_02=14, Idle=0, Stumble_Walk=562
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const KEY = env.MESHY_AI_API_KEY;
const BASE = 'https://api.meshy.ai/openapi';
const HEADERS = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const OUT = resolve(ROOT, 'assets/models');
const REPORT = resolve(ROOT, 'scripts/rig-report.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const state = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, 'utf8')) : {};
const save = () => writeFileSync(REPORT, JSON.stringify(state, null, 2));
const st = (name) => (state[name] ??= {});

const STYLE = 'chunky cute proportions, low poly, PS1 retro game style, muted desaturated colors, standing A-pose';
const WALK_M = 30, WALK_F = 1, RUN = 14, IDLE = 0, STUMBLE = 562;

// 1차 실행에서 복구한 태스크 ID (Meshy 리스트 API 대조)
const JOBS = [
  { name: 'character-hero', refineId: '019fe3ac-4737-7e11-b9ed-2239127396c4', height: 1.65,
    anims: [['-run', RUN], ['-idle', IDLE]] },
  { name: 'obstacle-drunk', refineId: '019fe3b0-4ef5-78d4-a16a-27cc76ee5ba4', height: 1.7,
    anims: [['-walk', STUMBLE]] },
  { name: 'ped-grandpa', rigId: '019fe40e-8af5-7b2b-9e1b-12c92e24800b', anims: [['-walk', WALK_M]] },
  { name: 'ped-ajumma', rigId: '019fe40e-dc18-756b-a176-036bddd95fd8', anims: [['-walk', WALK_F]] },
  { name: 'ped-schoolgirl', rigId: '019fe40f-2bf6-72a8-821d-877600cf4d97', anims: [['-walk', WALK_F]] },
  { name: 'ped-schoolboy', rigId: '019fe411-fcdc-75e3-92d2-2f26bdd6dca2', anims: [['-walk', WALK_M]] },
  { name: 'ped-officeman', rigId: '019fe412-9aaf-7bc9-af86-c3d137a2edad', anims: [['-walk', WALK_M]] },
  { name: 'ped-officewoman', rigId: '019fe412-c4bc-75f8-8894-d06c8f27e5ec', anims: [['-walk', WALK_F]] },
  { name: 'ped-jogger', prompt: 'young Korean man in mint tracksuit and headband', height: 1.7, anims: [['-walk', WALK_M]] },
  { name: 'ped-shopkeeper', prompt: 'middle-aged Korean shopkeeper man in orange apron and rolled-up sleeves', height: 1.7, anims: [['-walk', WALK_M]] },
  { name: 'ped-rider', prompt: 'Korean food delivery rider in yellow helmet and padded jacket', height: 1.7, anims: [['-walk', WALK_M]] },
  { name: 'ped-hoodie', prompt: 'young Korean woman in oversized beige hoodie looking at smartphone', height: 1.6, anims: [['-walk', WALK_F]] },
];

async function api(method, path, body) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(BASE + path, { method, headers: HEADERS, body: body ? JSON.stringify(body) : undefined });
      if (res.status === 429) { await sleep(15000); continue; }
      const json = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${path}: ${JSON.stringify(json).slice(0, 250)}`);
      return json;
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(6000 * (attempt + 1));
    }
  }
}

async function waitTask(path, id, label) {
  for (;;) {
    const t = await api('GET', `${path}/${id}`);
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED') {
      throw new Error(`${label} ${t.status}: ${t.task_error?.message ?? ''}`);
    }
    await sleep(10000);
  }
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function runJob(j) {
  const s = st(j.name);
  // 1. 생성 (프롬프트만 있는 신규 행인)
  if (!j.refineId && !j.rigId && !s.refineId) {
    const prev = await api('POST', '/v2/text-to-3d', {
      mode: 'preview', prompt: `${j.prompt}, ${STYLE}`, ai_model: 'meshy-5',
      topology: 'triangle', target_polycount: 3000, should_remesh: true, pose_mode: 'a-pose',
    });
    await waitTask('/v2/text-to-3d', prev.result, `${j.name} preview`);
    s.previewId = prev.result; save();
    console.log(`PREVIEW done ${j.name}`);
    const ref = await api('POST', '/v2/text-to-3d', {
      mode: 'refine', preview_task_id: prev.result, texture_resolution: '2k', enable_pbr: false,
    });
    await waitTask('/v2/text-to-3d', ref.result, `${j.name} refine`);
    s.refineId = ref.result; save();
    console.log(`REFINE done ${j.name}`);
  }
  // 2. 리깅
  let rigId = j.rigId ?? s.rigId;
  if (!rigId) {
    const input = j.refineId ?? s.refineId;
    const rig = await api('POST', '/v1/rigging', { input_task_id: input, height_meters: j.height ?? 1.65 });
    await waitTask('/v1/rigging', rig.result, `${j.name} rig`);
    rigId = rig.result;
    s.rigId = rigId; save();
    console.log(`RIG done ${j.name}`);
  }
  // 3. 애니메이션
  for (const [suffix, actionId] of j.anims) {
    const dest = resolve(OUT, `${j.name}${suffix}.glb`);
    if (existsSync(dest)) { console.log(`SKIP ${j.name}${suffix}`); continue; }
    const anim = await api('POST', '/v1/animations', { rig_task_id: rigId, action_id: actionId });
    const t = await waitTask('/v1/animations', anim.result, `${j.name} anim ${actionId}`);
    const url = t.result?.animation_glb_url;
    if (!url) throw new Error(`${j.name} anim ${actionId}: no glb url — result keys: ${JSON.stringify(Object.keys(t.result ?? {}))}`);
    await download(url, dest);
    (s.anims ??= {})[suffix] = anim.result; save();
    console.log(`ANIM done ${j.name}${suffix} (action ${actionId})`);
  }
}

let failed = 0;
const queue = [...JOBS];
await Promise.all(Array.from({ length: 3 }, async () => {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    try {
      await runJob(job);
    } catch (e) {
      failed++;
      console.log(`FAILED ${job.name}: ${e.message}`);
    }
  }
}));
console.log(`ALL DONE failed=${failed}`);
process.exit(failed > 0 ? 2 : 0);
