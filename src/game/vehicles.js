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
    incomeMult: 1,
  },
  kickboard: {
    label: '킥보드',
    speedMult: 1.25,
    maxSpeed: 8.125,
    accelRate: 5,
    brakeRate: 7,
    turnRate: 9,
    jumpVel: 8,
    incomeMult: 2,
  },
  bicycle: {
    label: '자전거',
    speedMult: 1.5,
    maxSpeed: 9.75,
    accelRate: 3.2,
    brakeRate: 5,
    turnRate: 6.5,
    jumpVel: 8.5,
    incomeMult: 3,
  },
  scooter: {
    label: '스쿠터',
    speedMult: 2,
    maxSpeed: 13,
    accelRate: 2.6,
    brakeRate: 4,
    turnRate: 5,
    jumpVel: 9,
    incomeMult: 4,
  },
};
