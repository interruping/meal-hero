// FR-5 스테이지 구성 (§5) + §12 경제 개편.
// 스테이지당 제한 10분 — 10분 순수익 × 120일(한 계절 분기)로 정산해 빚 2,000만원을 갚는다.
export const STAGES = [
  {
    id: 1, season: 'spring', vehicle: 'run',
    orderGap: 2.5,
    obstacles: ['flyer'],
    intro: '봄 — 벚꽃 흩날리는 첫 출근. 오늘부터 빚 갚는다.',
  },
  {
    id: 2, season: 'summer', vehicle: 'kickboard',
    orderGap: 2.2,
    obstacles: ['flyer', 'kid'],
    intro: '여름 — 킥보드 입수! 발보다 빠르고, 사고도 빠르다.',
  },
  {
    id: 3, season: 'autumn', vehicle: 'bicycle',
    orderGap: 2,
    obstacles: ['flyer', 'kid', 'pigeon'],
    intro: '가을 — 자전거로 업그레이드. 낙엽길 조심.',
  },
  {
    id: 4, season: 'winter', vehicle: 'scooter',
    orderGap: 1.8,
    obstacles: ['flyer', 'kid', 'pigeon', 'drunk'],
    slippery: true,
    intro: '겨울 — 스쿠터 최종 진화. 눈길, 취객, 마지막 상환.',
  },
];

export const TOTAL_DEBT = 20_000_000; // §12.4 전체 빚
export const STAGE_TIME = 600; // §12.4 스테이지 제한 10분 (초)
export const SEASON_DAYS = 120; // 정산 환산: 한 계절 분기 = 120일
export const DELIVERY_PAY = 5_000; // §12.3 배달 건당 보수
export const BONUS_TIME_RATIO = 0.7; // 제한 시간 70% 이내 완료 시 보너스
export const BONUS_MULT = 1.5; // 스피드 보너스 +50%
export const LATE_FEE = 3_000; // §12.3 지각 수수료

export const MAX_HP = 5;
