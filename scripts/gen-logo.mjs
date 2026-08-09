// §15.5 (FR-37) 타이틀 비트맵 로고 — gpt-image-2 low, 마젠타 배경 생성 후
// 코너 평균 키잉(gen-fx.mjs 방식)으로 알파 추출.
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'assets/generated');
const env = Object.fromEntries(
  readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const KEY = env.OPENROUTER_API_KEY;
if (!KEY) { console.error('OPENROUTER_API_KEY missing'); process.exit(1); }

const PROMPT = 'retro PS1 era bitmap video game logo, big bold chunky pixel lettering '
  + '"MEAL HERO" on top, smaller pixel subtitle "delivery simulator" underneath, '
  + 'muted brick red and cream colors with thick dark outline, slight blocky 3d bevel, '
  + 'tiny delivery scooter silhouette accent, low-fi desaturated palette, '
  + 'centered on solid flat magenta background, no photo, no gradient background';

const dest = resolve(OUT, 'logo-title.png');
if (existsSync(dest)) { console.log('SKIP logo-title'); process.exit(0); }

async function keyAlpha(buf) {
  const img = sharp(buf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const corners = [0, (width - 1) * channels, (height - 1) * width * channels, ((height - 1) * width + width - 1) * channels];
  let br = 0, bg = 0, bb = 0;
  for (const c of corners) { br += data[c]; bg += data[c + 1]; bb += data[c + 2]; }
  br /= 4; bg /= 4; bb /= 4;
  const TH = 60;
  for (let i = 0; i < data.length; i += channels) {
    const d = Math.hypot(data[i] - br, data[i + 1] - bg, data[i + 2] - bb);
    if (d < TH) data[i + 3] = 0;
    else if (d < TH * 2) data[i + 3] = Math.round(((d - TH) / TH) * 255);
  }
  // 여백 트림 후 저장 (레터링만 남게)
  return sharp(data, { raw: { width, height, channels } }).png().trim().toBuffer();
}

const res = await fetch('https://openrouter.ai/api/v1/images/generations', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'openai/gpt-image-2', prompt: PROMPT, size: '1024x1024', quality: 'low' }),
});
const json = await res.json();
if (!res.ok) { console.error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`); process.exit(1); }
const b64 = json.data?.[0]?.b64_json;
const raw = b64 ? Buffer.from(b64, 'base64') : Buffer.from(await (await fetch(json.data[0].url)).arrayBuffer());
writeFileSync(dest, await keyAlpha(raw));
console.log('DONE logo-title (est $0.006)');
