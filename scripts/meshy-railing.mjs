// 계단 난간 3D 모델 1종: preview(5cr) → refine(10cr) → GLB.
// 사용: node scripts/meshy-railing.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
const OUT = resolve(ROOT, 'assets/models/prop3d-railing.glb');
mkdirSync(resolve(ROOT, 'assets/models'), { recursive: true });

const STYLE = 'low poly, PS1 retro game style, muted desaturated colors';
const PROMPT = `single straight section of old Korean street stair handrail fence, three cylindrical vertical posts with small flat base plates, connected by three horizontal round pipe bars, weathered green painted metal with chipped paint spots, ${STYLE}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path = '', body) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(API + path, {
        method, headers: HEADERS,
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

const prev = await api('POST', '', {
  mode: 'preview', prompt: PROMPT, ai_model: 'meshy-5',
  topology: 'triangle', target_polycount: 600, should_remesh: true,
});
console.log('PREVIEW submitted');
const prevTask = await waitTask(prev.result, 'preview');
console.log(`PREVIEW done (${prevTask.consumed_credits ?? '?'}cr)`);

const ref = await api('POST', '', {
  mode: 'refine', preview_task_id: prev.result,
  texture_resolution: '2k', enable_pbr: false,
});
console.log('REFINE submitted');
const refTask = await waitTask(ref.result, 'refine');
const url = refTask.model_urls?.glb;
if (!url) throw new Error('no glb url');
const res = await fetch(url);
if (!res.ok) throw new Error(`download HTTP ${res.status}`);
writeFileSync(OUT, Buffer.from(await res.arrayBuffer()));
const credits = (prevTask.consumed_credits ?? 5) + (refTask.consumed_credits ?? 10);
console.log(`DONE prop3d-railing.glb (${credits}cr) preview=${prev.result} refine=${ref.result}`);
