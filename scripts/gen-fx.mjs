// 비둘기 화면 충돌 FX 스프라이트 2종 — gpt-image-2 low, 마젠타 배경 생성 후
// 코너 평균 키잉(process-textures.mjs 방식)으로 알파 추출.
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

const STYLE = 'cartoon PS1 retro low-fi game sprite, muted desaturated colors, thick clean silhouette, isolated centered on solid flat magenta background, no shadow';
const ITEMS = [
  {
    name: 'fx-pigeon-splat', size: 512,
    prompt: `plump gray pigeon comically splatted flat against glass windshield seen from inside, spread wings and belly pressed wide on the glass, dazed crossed eyes, squished orange beak, splayed pink feet, symmetric full front view, ${STYLE}`,
  },
  {
    name: 'fx-feather', size: 128,
    prompt: `single fluffy gray pigeon feather, soft downy edges, gentle curve, ${STYLE}`,
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function keyAlpha(buf, size) {
  const img = sharp(buf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const corners = [0, (width - 1) * channels, (height - 1) * width * channels, ((height - 1) * width + width - 1) * channels];
  let br = 0, bg = 0, bb = 0;
  for (const c of corners) { br += data[c]; bg += data[c + 1]; bb += data[c + 2]; }
  br /= 4; bg /= 4; bb /= 4;
  const TH = 60; // 마젠타는 소재색(회색·주황)과 거리 커서 임계 넉넉히
  for (let i = 0; i < data.length; i += channels) {
    const d = Math.hypot(data[i] - br, data[i + 1] - bg, data[i + 2] - bb);
    if (d < TH) data[i + 3] = 0;
    else if (d < TH * 2) data[i + 3] = Math.round(((d - TH) / TH) * 255);
  }
  return sharp(data, { raw: { width, height, channels } })
    .resize(size, size, { kernel: 'nearest' })
    .png()
    .toBuffer();
}

for (const item of ITEMS) {
  const dest = resolve(OUT, `${item.name}.png`);
  if (existsSync(dest)) { console.log(`SKIP ${item.name}`); continue; }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai/gpt-image-2', prompt: item.prompt, size: '1024x1024', quality: 'low' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
      let raw;
      const b64 = json.data?.[0]?.b64_json;
      if (b64) raw = Buffer.from(b64, 'base64');
      else {
        const url = json.data?.[0]?.url;
        if (!url) throw new Error(`no image: ${JSON.stringify(json).slice(0, 200)}`);
        raw = Buffer.from(await (await fetch(url)).arrayBuffer());
      }
      writeFileSync(dest, await keyAlpha(raw, item.size));
      console.log(`DONE ${item.name}`);
      break;
    } catch (e) {
      console.log(`RETRY ${item.name} (${attempt + 1}): ${e.message}`);
      if (attempt === 2) { console.log(`FAILED-FINAL ${item.name}`); process.exit(1); }
      await sleep(4000 * (attempt + 1));
    }
  }
}
