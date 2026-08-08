// Meshy text-to-3d 배치 파이프라인: preview(5cr) → refine(10cr) → GLB 다운로드.
// 사용: node scripts/meshy-batch.mjs
// 진행 상황은 stdout 한 줄씩, 결과는 scripts/meshy-report.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(ROOT, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const KEY = env.MESHY_AI_API_KEY;
if (!KEY) { console.error('MESHY_AI_API_KEY missing'); process.exit(1); }

const API = 'https://api.meshy.ai/openapi/v2/text-to-3d';
const HEADERS = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const OUT_DIR = resolve(ROOT, 'assets/models');
const REPORT_PATH = resolve(ROOT, 'scripts/meshy-report.json');
mkdirSync(OUT_DIR, { recursive: true });

const STYLE = 'chunky cute proportions, low poly, PS1 retro game style, muted desaturated colors';

const MODELS = [
  { name: 'character-hero', polycount: 3000, prompt: `cartoon Korean delivery rider character, young man wearing baseball cap and windbreaker jacket, standing upright, short stubby legs and slightly big head, ${STYLE}` },
  { name: 'prop-delivery-bag', polycount: 600, prompt: `square insulated food delivery backpack bag, cube-shaped with top flap and shoulder straps, muted dark red fabric, ${STYLE}` },
  { name: 'vehicle-kickboard', polycount: 1500, prompt: `stand-up electric kick scooter with tall handlebar and flat deck, two small wheels, muted teal frame, ${STYLE}` },
  { name: 'vehicle-bicycle', polycount: 2000, prompt: `city bicycle with front basket and rear rack, muted olive green frame, ${STYLE}` },
  { name: 'vehicle-scooter', polycount: 2000, prompt: `delivery moped scooter with big square delivery box on rear rack, muted light blue body, ${STYLE}` },
  { name: 'obstacle-flyer-worker', polycount: 3000, prompt: `cartoon flyer distributor part-time worker, person wearing visor cap and sash, holding stack of paper flyers with one arm extended offering a flyer, ${STYLE}` },
  { name: 'obstacle-kid-bike', polycount: 3000, prompt: `cartoon child riding a small bicycle, kid with tiny backpack leaning forward pedaling fast, single combined model of kid on bike, ${STYLE}` },
  { name: 'obstacle-pigeon', polycount: 800, prompt: `plump pigeon bird standing on ground, round fat body small head, muted gray purple feathers, ${STYLE}` },
  { name: 'obstacle-drunk', polycount: 3000, prompt: `cartoon drunk middle-aged office worker in rumpled gray suit with loosened red necktie, swaying stumbling pose holding small green bottle, red cheeks, ${STYLE}` },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path = '', body) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(API + path, {
        method,
        headers: HEADERS,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 429) { await sleep(15000); continue; }
      const json = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
      return json;
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(5000 * (attempt + 1));
    }
  }
}

async function waitTask(id, label) {
  for (;;) {
    const t = await api('GET', `/${id}`);
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

async function generateOne(m) {
  const dest = resolve(OUT_DIR, `${m.name}.glb`);
  if (existsSync(dest)) { console.log(`SKIP ${m.name} (exists)`); return { name: m.name, skipped: true, credits: 0 }; }

  const prev = await api('POST', '', {
    mode: 'preview',
    prompt: m.prompt,
    ai_model: 'meshy-5',
    topology: 'triangle',
    target_polycount: m.polycount,
    should_remesh: true,
  });
  console.log(`PREVIEW submitted ${m.name}`);
  const prevTask = await waitTask(prev.result, `${m.name} preview`);
  console.log(`PREVIEW done ${m.name} (${prevTask.consumed_credits ?? '?'}cr)`);

  const ref = await api('POST', '', {
    mode: 'refine',
    preview_task_id: prev.result,
    texture_resolution: '2k',
    enable_pbr: false,
  });
  console.log(`REFINE submitted ${m.name}`);
  const refTask = await waitTask(ref.result, `${m.name} refine`);
  const glbUrl = refTask.model_urls?.glb;
  if (!glbUrl) throw new Error(`${m.name}: no glb url`);
  await download(glbUrl, dest);
  const credits = (prevTask.consumed_credits ?? 5) + (refTask.consumed_credits ?? 10);
  console.log(`DONE ${m.name} (${credits}cr total)`);
  return { name: m.name, prompt: m.prompt, previewId: prev.result, refineId: ref.result, credits };
}

const results = [];
let failed = 0;
// 동시 제출은 큐 한도 고려해 3개씩
const queue = [...MODELS];
const workers = Array.from({ length: 3 }, async () => {
  for (;;) {
    const m = queue.shift();
    if (!m) return;
    try {
      results.push(await generateOne(m));
    } catch (e) {
      console.log(`FAILED ${m.name}: ${e.message}`);
      // 1회 재시도
      try {
        results.push(await generateOne(m));
        console.log(`RETRY-OK ${m.name}`);
      } catch (e2) {
        failed++;
        console.log(`FAILED-FINAL ${m.name}: ${e2.message}`);
        results.push({ name: m.name, error: e2.message, credits: 0 });
      }
    }
  }
});
await Promise.all(workers);

const total = results.reduce((s, r) => s + (r.credits ?? 0), 0);
writeFileSync(REPORT_PATH, JSON.stringify({ results, totalCredits: total, failed }, null, 2));
console.log(`ALL DONE credits=${total} failed=${failed}`);
process.exit(failed > 0 ? 2 : 0);
