// 주인공 앉기 애니메이션 (Chair_Sit_Idle_M=33, 3cr) — 자전거·스쿠터 탑승 자세.
// 기존 rig(rig-report.json character-hero) 재사용, 리깅 재과금 없음.
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
const REPORT = resolve(ROOT, 'scripts/rig-report.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SIT = 33;
const DEST = resolve(ROOT, 'assets/models', 'character-hero-sit.glb');

const state = JSON.parse(readFileSync(REPORT, 'utf8'));
const s = state['character-hero'];
if (!s?.rigId) throw new Error('character-hero rigId not in rig-report.json');

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

if (existsSync(DEST)) {
  console.log('SKIP already exists');
  process.exit(0);
}
const anim = await api('POST', '/v1/animations', { rig_task_id: s.rigId, action_id: SIT });
const t = await waitTask('/v1/animations', anim.result, 'anim');
const url = t.result?.animation_glb_url;
if (!url) throw new Error(`no glb url — result keys: ${JSON.stringify(Object.keys(t.result ?? {}))}`);
const res = await fetch(url);
if (!res.ok) throw new Error(`download HTTP ${res.status}`);
writeFileSync(DEST, Buffer.from(await res.arrayBuffer()));
(s.anims ??= {})['-sit'] = anim.result;
writeFileSync(REPORT, JSON.stringify(state, null, 2));
console.log('ANIM done — saved', DEST);
