// 행인 10종 가분수(chibi) 재생성 — 주인공·알바생과 톤앤매너 통일.
// 1차 결과가 정상 비율로 나와 프롬프트를 머리 크기 강조로 강화.
// 체인: preview(a-pose) → refine → rig → walk 애니메이션. 상태는 rig-report-chibi.json.
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
const REPORT = resolve(ROOT, 'scripts/rig-report-chibi.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const state = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, 'utf8')) : {};
const save = () => writeFileSync(REPORT, JSON.stringify(state, null, 2));
const st = (name) => (state[name] ??= {});

// 주인공 프롬프트(short stubby legs, slightly big head)가 가분수로 잘 나옴 — 같은 계열로 강화
const STYLE = 'cute chibi cartoon character with oversized big head taking one third of total height, short stubby legs and stubby arms, small chunky body, low poly, PS1 retro game style, muted desaturated colors, standing A-pose';
const WALK_M = 30, WALK_F = 1;
const PEDS = [
  { name: 'ped-ajumma', walk: WALK_F, prompt: 'middle-aged Korean woman with short curly perm hair, flower pattern blouse and loose pants, carrying small market bag' },
  { name: 'ped-grandpa', walk: WALK_M, prompt: 'elderly Korean man with flat cap and beige vest, holding wooden cane' },
  { name: 'ped-schoolgirl', walk: WALK_F, prompt: 'Korean high school girl in navy uniform with skirt and red backpack' },
  { name: 'ped-schoolboy', walk: WALK_M, prompt: 'Korean high school boy in slouchy dark uniform with untucked shirt and sports bag' },
  { name: 'ped-officeman', walk: WALK_M, prompt: 'young Korean office worker man in gray suit holding briefcase' },
  { name: 'ped-officewoman', walk: WALK_F, prompt: 'Korean office worker woman in navy blazer and skirt holding coffee cup' },
  { name: 'ped-jogger', walk: WALK_M, prompt: 'young Korean man in mint tracksuit and headband' },
  { name: 'ped-shopkeeper', walk: WALK_M, prompt: 'middle-aged Korean shopkeeper man in orange apron and rolled-up sleeves' },
  { name: 'ped-rider', walk: WALK_M, prompt: 'Korean food delivery rider in yellow helmet and padded jacket' },
  { name: 'ped-hoodie', walk: WALK_F, prompt: 'young Korean woman in oversized beige hoodie looking at smartphone' },
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
  const dest = resolve(OUT, `${j.name}-walk.glb`);
  if (s.done && existsSync(dest)) { console.log(`SKIP ${j.name}`); return; }
  if (!s.refineId) {
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
  if (!s.rigId) {
    const rig = await api('POST', '/v1/rigging', { input_task_id: s.refineId, height_meters: 1.4 });
    await waitTask('/v1/rigging', rig.result, `${j.name} rig`);
    s.rigId = rig.result; save();
    console.log(`RIG done ${j.name}`);
  }
  const anim = await api('POST', '/v1/animations', { rig_task_id: s.rigId, action_id: j.walk });
  const t = await waitTask('/v1/animations', anim.result, `${j.name} anim`);
  const url = t.result?.animation_glb_url;
  if (!url) throw new Error(`${j.name} anim: no glb url`);
  await download(url, dest);
  s.done = true; save();
  console.log(`ANIM done ${j.name}-walk`);
}

let failed = 0;
const queue = [...PEDS];
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
