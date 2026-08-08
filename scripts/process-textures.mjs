// 생성 원본(1024) → 게임용 256px 다운스케일 + 빌보드 알파 키잉.
// 원본은 scratchpad에 백업, assets/generated는 처리본으로 교체.
import sharp from 'sharp';
import { readdirSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'assets/generated');
const BACKUP = process.env.TEXTURE_BACKUP_DIR
  ?? '/private/tmp/claude-501/-Users-gylim-meal-hero/03ee5793-d89d-43ff-a99a-2fbb72e31927/scratchpad/textures-orig';
mkdirSync(BACKUP, { recursive: true });

// 균일 배경 → 알파 (빌보드용)
const KEYED = ['tree-spring', 'tree-summer', 'tree-autumn', 'tree-winter', 'prop-cat', 'prop-laundry'];
const SIZE = 256;

async function keyAlpha(buf) {
  const img = sharp(buf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  // 네 모서리 평균을 배경색으로
  const corners = [0, (width - 1) * channels, (height - 1) * width * channels, ((height - 1) * width + width - 1) * channels];
  let br = 0, bg = 0, bb = 0;
  for (const c of corners) { br += data[c]; bg += data[c + 1]; bb += data[c + 2]; }
  br /= 4; bg /= 4; bb /= 4;
  const TH = 38;
  for (let i = 0; i < data.length; i += channels) {
    const d = Math.hypot(data[i] - br, data[i + 1] - bg, data[i + 2] - bb);
    if (d < TH) data[i + 3] = 0;
    else if (d < TH * 2) data[i + 3] = Math.round(((d - TH) / TH) * 255);
  }
  return sharp(data, { raw: { width, height, channels } }).png();
}

for (const file of readdirSync(SRC).filter((f) => f.endsWith('.png'))) {
  const full = resolve(SRC, file);
  const backupPath = resolve(BACKUP, file);
  if (!existsSync(backupPath)) copyFileSync(full, backupPath);
  const name = file.replace('.png', '');
  let pipeline = sharp(backupPath).resize(SIZE, SIZE, { kernel: 'lanczos3' });
  if (KEYED.includes(name)) {
    const buf = await pipeline.toBuffer();
    pipeline = await keyAlpha(buf);
  }
  await pipeline.png({ compressionLevel: 9, palette: true }).toFile(full + '.tmp');
  const { renameSync } = await import('node:fs');
  renameSync(full + '.tmp', full);
  console.log(`processed ${file}`);
}
console.log('ALL DONE');
