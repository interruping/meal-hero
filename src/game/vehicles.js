// FR-2 탈것 4종. 스테이지가 오를수록 빠르고(§5) 관성이 커져 조작이 어렵다.
// accelRate/brakeRate: 목표 속도 수렴 지수 계수 (클수록 즉각 반응)
export const VEHICLES = {
  run: {
    label: '구보',
    speedMult: 1,
    maxSpeed: 6.5,
    accelRate: 10,
    brakeRate: 12,
    turnRate: 14,
    jumpVel: 8,
  },
  kickboard: {
    label: '킥보드',
    speedMult: 1.25,
    maxSpeed: 8.125,
    accelRate: 5,
    brakeRate: 7,
    turnRate: 9,
    jumpVel: 8,
  },
  bicycle: {
    label: '자전거',
    speedMult: 1.5,
    maxSpeed: 9.75,
    accelRate: 3.2,
    brakeRate: 5,
    turnRate: 6.5,
    jumpVel: 8.5,
  },
  scooter: {
    label: '스쿠터',
    speedMult: 2,
    maxSpeed: 13,
    accelRate: 3.4, // §17.6 코너링 응답 +30% (2.6 → 3.4)
    brakeRate: 4,
    turnRate: 6.5, // 몸 방향이 이동 방향을 따라오게 시각 정렬 (5 → 6.5)
    jumpVel: 9,
  },
};
