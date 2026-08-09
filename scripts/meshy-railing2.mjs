// 난간 재시도: preview만 생성(5cr) 후 썸네일 저장 — 검수 통과 시 refine 별도 실행
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(ROOT, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const API = 'https://api.meshy.ai/openapi/v2/text-to-3d';
const HEADERS = { Authorization: `Bearer ${env.MESHY_AI_API_KEY}`, 'Content-Type': 'application/json' };

const PROMPT = 'straight green metal fence panel, stair handrail section, three vertical posts and two horizontal rails all aligned in one single flat vertical plane, weathered green paint with chipped spots, clean simple structure, low poly, PS1 retro game style, muted desaturated colors';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, path = '', body) {
  const res = await fetch(API + path, { method, headers: HEADERS, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

const prev = await api('POST', '', {
  mode: 'preview', prompt: PROMPT, ai_model: 'meshy-5',
  topology: 'triangle', target_polycount: 1000, should_remesh: true,
});
console.log('PREVIEW submitted', prev.result);
for (;;) {
  const t = await api('GET', `/${prev.result}`);
  if (t.status === 'SUCCEEDED') {
    if (t.thumbnail_url) {
      const r = await fetch(t.thumbnail_url);
      writeFileSync(process.argv[2] ?? resolve(ROOT, 'railing2-thumb.png'), Buffer.from(await r.arrayBuffer()));
    }
    console.log(`PREVIEW done id=${prev.result} credits=${t.consumed_credits ?? 5}`);
    break;
  }
  if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`preview ${t.status}: ${t.task_error?.message ?? ''}`);
  await sleep(8000);
}
