// §7.4 계절 팔레트. 하늘=안개 동일색이 룩의 핵심 (§7.3).
export const PALETTES = {
  spring: {
    name: '봄',
    sky: 0xddd8d2,
    ground: 0xc6c2b4,
    road: 0x8d8d89,
    foliage: 0xa9b78d,
    accent: 0xe5c6cd, // 벚꽃
  },
  summer: {
    name: '여름',
    sky: 0xccd4cd,
    ground: 0x9daf8b,
    road: 0x77776f,
    foliage: 0x5f7a55,
    accent: 0x4f6d8f, // 파라솔
  },
  autumn: {
    name: '가을',
    sky: 0xd6cec2,
    ground: 0xb3a48e,
    road: 0x84817b,
    foliage: 0x8f5a3a,
    accent: 0xc9a13b, // 은행
  },
  winter: {
    name: '겨울',
    sky: 0xc9c9c5,
    ground: 0xe6e5e0,
    groundShade: 0xb9bab6,
    road: 0x8a8a86,
    roadWet: 0x6f6f6b,
    foliage: 0x4e5a4c,
    accent: null, // 모노톤 유지
  },
};

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

// 공통 한계값: 순검정·순백 금지 (§7.4)
export const DARKEST = 0x3a3a38;
export const LIGHTEST = 0xefeeea;
export const MARKER_RED = 0xb5372f;

export const FOG_NEAR = 25;
export const FOG_FAR = 140;
