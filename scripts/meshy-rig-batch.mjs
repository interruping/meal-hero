// Meshy 리깅+애니메이션 파이프라인:
// - 행인 10종: text-to-3d(a-pose) → rig(5cr) → Walking(-2) 애니메이션(3cr)
// - 주인공: 기존 refine 태스크 → rig → Running(-1) + Idle(0)
// - 취객: 기존 refine 태스크 → rig → Walking(-2)
// 사용: node scripts/meshy-rig-batch.mjs
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STYLE = 'chunky cute proportions, low poly, PS1 retro game style, muted desaturated colors, standing A-pose';
const PEDS = [
  { name: 'ped-ajumma', prompt: 'middle-aged Korean woman with short curly perm hair, flower pattern blouse and loose pants, carrying small market bag' },
  { name: 'ped-grandpa', prompt: 'elderly Korean man with flat cap and beige vest, slightly hunched, holding wooden cane' },
  { name: 'ped-schoolgirl', prompt: 'Korean high school girl in navy uniform with skirt and red backpack' },
  { name: 'ped-schoolboy', prompt: 'Korean high school boy in slouchy dark uniform with untucked shirt and sports bag' },
  { name: 'ped-officeman', prompt: 'young Korean office worker man in gray suit holding briefcase' },
  { name: 'ped-officewoman', prompt: 'Korean office worker woman in navy blazer and skirt holding coffee cup' },
  { name: 'ped-jogger', prompt: 'young Korean man in mint tracksuit and headband' },
  { name: 'ped-shopkeeper', prompt: 'middle-aged Korean shopkeeper man in orange apron and rolled-up sleeves' },
  { name: 'ped-rider', prompt: 'Korean food delivery rider in yellow helmet and padded jacket' },
  { name: 'ped-hoodie', prompt: 'young Korean woman in oversized beige hoodie looking at smartphone' },
];
const WALK = -2, RUN = -1, IDLE = 0;

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

let credits = 0;

async function rigAndAnimate(taskId, name, heightMeters, actions) {
  const rig = await api('POST', '/v1/rigging', { input_task_id: taskId, height_meters: heightMeters });
  const rigTask = await waitTask('/v1/rigging', rig.result, `${name} rig`);
  credits += 5;
  console.log(`RIG done ${name}`);
  for (const [suffix, actionId] of actions) {
    const dest = resolve(OUT, `${name}${suffix}.glb`);
    if (existsSync(dest)) { console.log(`SKIP ${name}${suffix}`); continue; }
    const anim = await api('POST', '/v1/animations', { rig_task_id: rig.result, action_id: actionId });
    const animTask = await waitTask('/v1/animations', anim.result, `${name} anim ${actionId}`);
    const url = animTask.result?.animation_glb_url;
    if (!url) throw new Error(`${name} anim ${actionId}: no glb url`);
    await download(url, dest);
    credits += 3;
    console.log(`ANIM done ${name}${suffix} (action ${actionId})`);
  }
}

async function genPed(p) {
  const done = resolve(OUT, `${p.name}-walk.glb`);
  if (existsSync(done)) { console.log(`SKIP ${p.name}`); return; }
  const prev = await api('POST', '/v2/text-to-3d', {
    mode: 'preview', prompt: `${p.prompt}, ${STYLE}`, ai_model: 'meshy-5',
    topology: 'triangle', target_polycount: 3000, should_remesh: true, pose_mode: 'a-pose',
  });
  await waitTask('/v2/text-to-3d', prev.result, `${p.name} preview`);
  credits += 5;
  console.log(`PREVIEW done ${p.name}`);
  const ref = await api('POST', '/v2/text-to-3d', {
    mode: 'refine', preview_task_id: prev.result, texture_resolution: '2k', enable_pbr: false,
  });
  await waitTask('/v2/text-to-3d', ref.result, `${p.name} refine`);
  credits += 10;
  console.log(`REFINE done ${p.name}`);
  await rigAndAnimate(ref.result, p.name, 1.65, [['-walk', WALK]]);
}

// 기존 태스크 ID 로드 (1차 배치 리포트)
const report = JSON.parse(readFileSync(resolve(ROOT, 'scripts/meshy-report.json'), 'utf8'));
const refineIdOf = (name) => report.results.find((r) => r.name === name)?.refineId;

const jobs = [];
// 주인공: Running + Idle
const heroRefine = refineIdOf('character-hero');
if (heroRefine && !existsSync(resolve(OUT, 'character-hero-run.glb'))) {
  jobs.push(() => rigAndAnimate(heroRefine, 'character-hero', 1.65, [['-run', RUN], ['-idle', IDLE]]));
}
// 취객: Walking
const drunkRefine = refineIdOf('obstacle-drunk');
if (drunkRefine && !existsSync(resolve(OUT, 'obstacle-drunk-walk.glb'))) {
  jobs.push(() => rigAndAnimate(drunkRefine, 'obstacle-drunk', 1.7, [['-walk', WALK]]));
}
for (const p of PEDS) jobs.push(() => genPed(p));

let failed = 0;
const queue = [...jobs];
await Promise.all(Array.from({ length: 3 }, async () => {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    try {
      await job();
    } catch (e) {
      failed++;
      console.log(`FAILED: ${e.message}`);
    }
  }
}));
console.log(`ALL DONE credits=${credits} failed=${failed}`);
process.exit(failed > 0 ? 2 : 0);
