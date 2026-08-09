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

// §14.4 방해요소 소개 모달 (FR-30) — §6 표 기반 외형·행동·대처 설명
export const OBSTACLE_INFO = {
  flyer: {
    name: '전단지 알바생',
    desc: '상가 골목에 서 있다가 다가가면 쫓아와 전단지를 던진다.<br>맞으면 잠깐 느려지고 밀려난다. 거리를 두고 지나가자.',
  },
  kid: {
    name: '브레이크 없는 자전거 초딩',
    desc: '도로를 빠른 속도로 직진 횡단한다. 경로는 읽히지만 빠르다.<br>부딪히면 넘어져 체력이 깎이고 배달 시간을 잃는다.',
  },
  pigeon: {
    name: '비둘기',
    desc: '길바닥에 무리 지어 있다가 다가가면 화면으로 날아오른다.<br>시야가 가려지고 조작이 잠깐 흔들린다.',
  },
  drunk: {
    name: '취객',
    desc: '골목을 지그재그로 비틀거리며 이쪽으로 다가온다.<br>부딪히면 체력이 깎이고 잠깐 조작이 반대로 꼬인다.',
  },
};

export const TOTAL_DEBT = 20_000_000; // §12.4 전체 빚
export const STAGE_TIME = 600; // §12.4 스테이지 제한 10분 (초)
export const SEASON_DAYS = 120; // 정산 환산: 한 계절 분기 = 120일
export const DELIVERY_PAY = 5_000; // §12.3 배달 건당 보수
export const BONUS_TIME_RATIO = 0.7; // 제한 시간 70% 이내 완료 시 보너스
export const BONUS_MULT = 1.5; // 스피드 보너스 +50%
export const LATE_FEE = 3_000; // §12.3 지각 수수료
export const DRINK_COST = 1_500; // §14.1 에너지 드링크 — 대시 쿨타임 초기화

export const MAX_HP = 5;
