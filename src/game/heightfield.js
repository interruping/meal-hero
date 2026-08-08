// 맵 지형 높이 함수 (§5 언덕 지형). 남쪽(z+) 상가 저지대 → 북쪽(z-) 언덕 빌라촌.
// 해석적 함수라 raycast 없이 어디서든 지면 높이·경사 계산 가능.

function gauss(dx, dz, radius) {
  const d2 = dx * dx + dz * dz;
  return Math.exp(-d2 / (radius * radius));
}

// z=60~90 상가 구역은 평지로 블렌드
function slopeBase(z) {
  const t = Math.min(Math.max((60 - z) / 40, 0), 1); // z<20이면 1, z>60이면 0
  const smooth = t * t * (3 - 2 * t);
  return (60 - z) * 0.06 * smooth + Math.max(0, 60 - z) * 0.02 * (1 - smooth);
}

export function terrainHeight(x, z) {
  let h = slopeBase(z);
  h += Math.sin(x * 0.045) * Math.cos(z * 0.038) * 1.1;
  h += Math.sin(x * 0.012 + 1.7) * 1.6;
  h += gauss(x - 70, z + 20, 45) * 4;
  h += gauss(x + 75, z - 55, 40) * 3.5;
  return h;
}

// 이동 방향 경사 계수: 오르막 감속, 내리막 가속
export function slopeFactor(x, z, dirX, dirZ) {
  const e = 0.5;
  const gx = (terrainHeight(x + e, z) - terrainHeight(x - e, z)) / (2 * e);
  const gz = (terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e);
  const alongSlope = gx * dirX + gz * dirZ; // 양수 = 오르막
  return Math.min(Math.max(1 - alongSlope * 1.4, 0.55), 1.35);
}
