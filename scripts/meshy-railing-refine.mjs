// 기존 preview(019fe62f...)에서 refine만 재개 — 1k 불가로 2k 재시도
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
const PREVIEW_ID = '019fe634-40d7-7793-bc0b-27b81459ec64';
const OUT = resolve(ROOT, 'assets/models/prop3d-railing.glb');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path = '', body) {
  const res = await fetch(API + path, { method, headers: HEADERS, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

const ref = await api('POST', '', {
  mode: 'refine', preview_task_id: PREVIEW_ID,
  texture_resolution: '2k', enable_pbr: false,
});
console.log('REFINE submitted', ref.result);
for (;;) {
  const t = await api('GET', `/${ref.result}`);
  if (t.status === 'SUCCEEDED') {
    const res = await fetch(t.model_urls.glb);
    if (!res.ok) throw new Error(`download HTTP ${res.status}`);
    writeFileSync(OUT, Buffer.from(await res.arrayBuffer()));
    console.log(`DONE prop3d-railing.glb refine=${ref.result} credits=${t.consumed_credits ?? 10}`);
    break;
  }
  if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`refine ${t.status}: ${t.task_error?.message ?? ''}`);
  await sleep(10000);
}
