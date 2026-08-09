// gpt-image-2 (OpenRouter) 텍스처 배치 생성. 품질 low 고정 (≈$0.006/장).
// 사용: node scripts/gen-textures.mjs [--only name1,name2]
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
const KEY = env.OPENROUTER_API_KEY;
if (!KEY) { console.error('OPENROUTER_API_KEY missing'); process.exit(1); }

const OUT = resolve(ROOT, 'assets/generated');
mkdirSync(OUT, { recursive: true });

const PS1 = 'retro PS1 videogame texture, pixelated low-resolution look, muted desaturated colors, flat even lighting, no photorealism';
const TILE = `seamless repeating tile, top-down view, ${PS1}`;
const FACADE = (desc) => `flat orthographic front view facade texture for a low-poly game building, ${desc}, fills entire image edge to edge, no sky no ground no perspective, ${PS1}`;
const PROP = (desc) => `${desc}, game texture on plain neutral background, ${PS1}`;

export const MANIFEST = [
  // 계절: 지면
  { name: 'ground-spring', prompt: `dirt path with patchy fresh green grass and small fallen cherry blossom petals, ${TILE}` },
  { name: 'ground-summer', prompt: `dense summer grass, deep green lawn, ${TILE}` },
  { name: 'ground-autumn', prompt: `fallen brown and orange leaves covering dry soil, ${TILE}` },
  { name: 'ground-winter', prompt: `snow covered ground with faint footprints, slightly gray-white, ${TILE}` },
  // 계절: 도로
  { name: 'road-spring', prompt: `worn gray asphalt alley road with cracks and faded patches, ${TILE}` },
  { name: 'road-summer', prompt: `dark asphalt road with heat-worn patches and tar lines, ${TILE}` },
  { name: 'road-autumn', prompt: `gray asphalt road with scattered fallen leaves at edges, ${TILE}` },
  { name: 'road-winter', prompt: `snowy asphalt road with wet dark tire tracks down the middle, ${TILE}` },
  // 계절: 나무 빌보드 (십자 빌보드용, 배경 단색)
  { name: 'tree-spring', prompt: PROP('single cherry blossom tree in full pale pink bloom, whole tree visible, flat solid light gray background') },
  { name: 'tree-summer', prompt: PROP('single lush green zelkova tree, whole tree visible, flat solid light gray background') },
  { name: 'tree-autumn', prompt: PROP('single maple tree with orange red autumn leaves, whole tree visible, flat solid light gray background') },
  { name: 'tree-winter', prompt: PROP('single bare deciduous tree with snow on branches, whole tree visible, flat solid light gray background') },
  // 계절: 하늘 (§7.3 배경은 안개색 단색이지만 §7.10 수량 요구 대응 — 은은한 상층 그라데이션)
  { name: 'sky-spring', prompt: `soft overcast sky gradient, warm pale gray beige, very subtle clouds, ${PS1}` },
  { name: 'sky-summer', prompt: `overcast humid sky gradient, pale gray green tint, ${PS1}` },
  { name: 'sky-autumn', prompt: `overcast sky gradient, pale warm gray, thin high clouds, ${PS1}` },
  { name: 'sky-winter', prompt: `heavy overcast winter sky gradient, flat cold light gray, ${PS1}` },
  // 빌라 파사드 12종 (서로 다른 층수·색·창 배열 — AC-17 구분성)
  { name: 'villa-01', prompt: FACADE('Korean red brick multi-family villa house, 3 stories, green metal entrance gate, half-basement windows with steel bars, white window frames') },
  { name: 'villa-02', prompt: FACADE('Korean orange-brown brick villa, 4 stories, dark brown balconies with laundry, external gas pipes, silver entrance door') },
  { name: 'villa-03', prompt: FACADE('Korean dark red brick villa, 2 stories, arched brick entrance, potted plants by door, old air conditioner units on wall') },
  { name: 'villa-04', prompt: FACADE('Korean beige tile villa, 3 stories, brown window frames, blue metal gate, electric meter boxes on wall') },
  { name: 'villa-05', prompt: FACADE('Korean gray concrete villa with exposed brick corners, 4 stories, green rooftop railing, laundry lines on balconies') },
  { name: 'villa-06', prompt: FACADE('Korean pale pink brick villa, 3 stories, rounded corner windows, dark green gate, satellite dish') },
  { name: 'villa-07', prompt: FACADE('Korean brown brick villa, 2 stories with rooftop room (oktapbang), external metal staircase, yellow water tank on roof') },
  { name: 'villa-08', prompt: FACADE('Korean reddish brick villa, 4 stories, protruding bay windows, ivy on one side wall, weathered stains') },
  { name: 'villa-09', prompt: FACADE('Korean mixed brick and stucco villa, 3 stories, blue awning over entrance, mailboxes cluster by door') },
  { name: 'villa-10', prompt: FACADE('Korean yellow-beige brick villa, 3 stories, dark red window frames, bicycle parked by entrance, cracked wall patches') },
  { name: 'villa-11', prompt: FACADE('Korean gray brick modern-ish villa, 4 stories, glass block stairwell windows, silver railings') },
  { name: 'villa-12', prompt: FACADE('Korean old red brick villa, 2 stories, corrugated metal add-on on roof, faded persimmon-color gate') },
  { name: 'villa-side', prompt: FACADE('plain Korean villa brick side wall, small frosted bathroom windows, gas pipes running vertically, weather stains') },
  { name: 'villa-side-2', prompt: FACADE('Korean villa concrete side wall with patched cement, single small window, drain pipe') },
  // 상가 전면 10종 (간판 한글)
  { name: 'shop-chicken', prompt: FACADE(`Korean fried chicken restaurant storefront, single story, red sign with Korean text "왕밤빵 치킨", glass door with chicken posters`) },
  { name: 'shop-chinese', prompt: FACADE(`Korean-Chinese restaurant storefront, red and gold sign with Korean text "만리장성", red lanterns, menu photos on window`) },
  { name: 'shop-bunsik', prompt: FACADE(`Korean street snack diner storefront, orange awning, sign with Korean text "김밥분식", steamy window with tteokbokki photos`) },
  { name: 'shop-convenience', prompt: FACADE(`Korean convenience store storefront, bright green and white striped sign with Korean text "열린마트 24시", glass front full of products`) },
  { name: 'shop-pizza', prompt: FACADE(`pizza shop storefront, green and red sign with Korean text "피자나라", pizza slice decal on glass`) },
  { name: 'shop-jokbal', prompt: FACADE(`Korean braised pork trotter restaurant storefront, brown sign with Korean text "원조족발", warm yellow lit window`) },
  { name: 'shop-cafe', prompt: FACADE(`small Korean coffee shop storefront, minimal cream sign with Korean text "다방", potted plant by door, chalkboard menu`) },
  { name: 'shop-dosirak', prompt: FACADE(`Korean lunchbox takeout shop storefront, blue sign with Korean text "한솥도시락", menu board with prices`) },
  { name: 'shop-tteokbokki', prompt: FACADE(`Korean tteokbokki specialty shop storefront, red awning, sign with Korean text "매운떡볶이", cartoon rice cake mascot`) },
  { name: 'shop-burger', prompt: FACADE(`retro burger joint storefront, yellow sign with Korean text "왕버거", burger photo poster in window`) },
  // §14.2 구멍가게 (빌라 사이 소형 가게)
  { name: 'shop-super', prompt: FACADE(`tiny old Korean corner store (gumeonggage), faded blue sign with Korean text "동네슈퍼", stacked crates of drinks and snacks by door, single sliding glass door`) },
  { name: 'shop-baekban', prompt: FACADE(`small humble Korean home-style meal diner storefront, worn white sign with Korean text "엄마손 백반", handwritten menu paper on window, sliding aluminum door`) },
  // 소품 (§7.10 장식 오브젝트용)
  { name: 'prop-pole', prompt: PROP('weathered gray concrete utility pole surface with small posted ads and stapled flyers, vertical texture strip') },
  { name: 'prop-trashbags', prompt: PROP('pile of white and green Korean garbage bags (jongnyangje bags) stacked against wall') },
  { name: 'prop-planter', prompt: PROP('rows of humble plastic and ceramic flower pots with green onions and flowers, Korean street garden style') },
  { name: 'prop-pyeongsang', prompt: PROP('low wooden platform bench (Korean pyeongsang), worn wood planks texture') },
  { name: 'prop-aircon', prompt: PROP('outdoor air conditioner condenser unit front grille, beige weathered metal') },
  { name: 'prop-watertank', prompt: PROP('yellow rooftop water tank cylinder surface, faded plastic with Korean label') },
  { name: 'prop-gate', prompt: PROP('green painted steel double gate of Korean villa, slightly rusted, vertical bars') },
  { name: 'prop-vending', prompt: PROP('Korean drink vending machine front, red and white, rows of canned drinks behind glass') },
  { name: 'prop-mailbox', prompt: PROP('cluster of small green metal mailboxes with unit numbers, Korean villa style') },
  { name: 'prop-car-sedan', prompt: PROP('side view of dull silver-gray compact sedan car, unfolded flat game texture with side front back views') },
  { name: 'prop-car-truck', prompt: PROP('side view of small blue Korean flatbed truck (1-ton porter), unfolded flat game texture side front back') },
  { name: 'prop-moto', prompt: PROP('side view of old red delivery motorcycle with rear box, flat game texture') },
  { name: 'prop-laundry', prompt: PROP('metal laundry drying rack with hanging white and colored clothes') },
  { name: 'prop-bench', prompt: PROP('old wooden public bench with green metal frame') },
  { name: 'prop-hydrant', prompt: PROP('red fire hydrant, slightly faded paint') },
  { name: 'prop-manhole', prompt: PROP('round metal manhole cover top view with Korean city emblem pattern') },
  { name: 'prop-bollard', prompt: PROP('gray concrete bollard post with faded yellow reflective band') },
  { name: 'prop-banner', prompt: PROP(`horizontal vinyl banner with Korean text "축! 개업 반값 할인", red text on white, slightly wrinkled`) },
  { name: 'prop-boxes', prompt: PROP('stack of white styrofoam delivery boxes and brown cardboard boxes') },
  { name: 'prop-cat', prompt: PROP('orange tabby street cat sitting, side view, flat solid light gray background') },
  { name: 'prop-grill', prompt: PROP('dark steel window security bars grid for half-basement window, front view') },
  { name: 'prop-sign-vertical', prompt: PROP(`vertical protruding shop signs stack: Korean text "노래방", "PC방", "세탁", colorful boxes, front view`) },
  { name: 'prop-parasol', prompt: PROP('faded blue-white striped market parasol umbrella top, from above') },
  { name: 'prop-scaffold-stairs', prompt: PROP('worn granite stone steps surface with moss edges, top-down') },
  { name: 'prop-railing', prompt: PROP('green painted metal pipe railing, horizontal bars, slightly chipped paint') },
  { name: 'prop-lamp', prompt: PROP('gray street lamp post with arm and rectangular lamp head, side view') },
  // 공용 재질
  { name: 'shared-brick', prompt: `old Korean red brick wall, slightly uneven bricks, ${TILE.replace('top-down view, ', '')}` },
  { name: 'shared-concrete', prompt: `weathered gray concrete wall with stains, ${TILE.replace('top-down view, ', '')}` },
  { name: 'shared-metal', prompt: `dark brushed metal surface with scratches, ${TILE.replace('top-down view, ', '')}` },
];

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1].split(',')
  : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genOne(item) {
  const dest = resolve(OUT, `${item.name}.png`);
  if (existsSync(dest)) { console.log(`SKIP ${item.name}`); return { name: item.name, skipped: true }; }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-image-2',
          prompt: item.prompt,
          size: '1024x1024',
          quality: item.quality ?? 'low',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) {
        const url = json.data?.[0]?.url;
        if (url) {
          const img = await fetch(url);
          writeFileSync(dest, Buffer.from(await img.arrayBuffer()));
        } else {
          throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 200)}`);
        }
      } else {
        writeFileSync(dest, Buffer.from(b64, 'base64'));
      }
      console.log(`DONE ${item.name}`);
      return { name: item.name, ok: true };
    } catch (e) {
      console.log(`RETRY ${item.name} (${attempt + 1}): ${e.message}`);
      await sleep(4000 * (attempt + 1));
    }
  }
  console.log(`FAILED-FINAL ${item.name}`);
  return { name: item.name, failed: true };
}

const list = only ? MANIFEST.filter((m) => only.includes(m.name)) : MANIFEST;
console.log(`generating ${list.length} images`);
const results = [];
// 동시 4개
const queue = [...list];
await Promise.all(Array.from({ length: 4 }, async () => {
  for (;;) {
    const item = queue.shift();
    if (!item) return;
    results.push(await genOne(item));
  }
}));
const failed = results.filter((r) => r.failed).length;
const generated = results.filter((r) => r.ok).length;
writeFileSync(resolve(ROOT, 'scripts/texture-report.json'), JSON.stringify({ results, generated, failed }, null, 2));
console.log(`ALL DONE generated=${generated} failed=${failed} est_cost=$${(generated * 0.006).toFixed(2)}`);
process.exit(failed > 0 ? 2 : 0);
