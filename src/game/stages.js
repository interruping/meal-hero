// FR-5 스테이지 구성 (§5). 빚 총액 4,000만원 — 계절마다 할당액 상환.
export const STAGES = [
  {
    id: 1, season: 'spring', vehicle: 'run',
    goal: 4_000_000, orderGap: 2.5,
    obstacles: ['flyer'],
    intro: '봄 — 벚꽃 흩날리는 첫 출근. 오늘부터 빚 갚는다.',
  },
  {
    id: 2, season: 'summer', vehicle: 'kickboard',
    goal: 8_000_000, orderGap: 2.2,
    obstacles: ['flyer', 'kid'],
    intro: '여름 — 킥보드 입수! 속도가 두 배, 사고도 두 배.',
  },
  {
    id: 3, season: 'autumn', vehicle: 'bicycle',
    goal: 12_000_000, orderGap: 2,
    obstacles: ['flyer', 'kid', 'pigeon'],
    intro: '가을 — 자전거로 업그레이드. 낙엽길 조심.',
  },
  {
    id: 4, season: 'winter', vehicle: 'scooter',
    goal: 16_000_000, orderGap: 1.8,
    obstacles: ['flyer', 'kid', 'pigeon', 'drunk'],
    slippery: true,
    intro: '겨울 — 스쿠터 최종 진화. 눈길, 취객, 마지막 상환.',
  },
];

export const TOTAL_DEBT = STAGES.reduce((s, st) => s + st.goal, 0);

export const MAX_HP = 5;
export const MAX_MISSES = 3; // 배달 시간 초과 누적 한도 (§12 오픈이슈 → 3회 확정)
