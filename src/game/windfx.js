import * as THREE from 'three';

// §17.5 (FR-51) 대시 바람 이펙트 — 캐릭터 주변 스피드 라인.
// 가는 스트릭이 진행 방향 반대로 흘러가 "빠르다 + 대시 중" 상태를 시각화.
// 이펙트류는 §7.10 단색 금지의 예외 (UI·이펙트 제외)
const COUNT = 12;

export class WindFX {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'windfx';
    this.group.visible = false;
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xeef2f4, transparent: true, opacity: 0.5, depthWrite: false,
    });
    this.streaks = [];
    for (let i = 0; i < COUNT; i++) {
      const len = 0.7 + Math.random() * 1.1;
      const geo = new THREE.CylinderGeometry(0.022, 0.022, len, 5);
      geo.rotateX(Math.PI / 2); // 길이 축을 진행축(z)으로
      const m = new THREE.Mesh(geo, this.mat);
      const ang = Math.random() * Math.PI * 2;
      const rad = 0.55 + Math.random() * 0.5;
      m.position.set(Math.cos(ang) * rad, 0.55 + Math.random() * 1.0, 0);
      this.streaks.push({ mesh: m, t: Math.random() * 5, speed: 9 + Math.random() * 5 });
      this.group.add(m);
    }
    scene.add(this.group);
  }

  update(dt, player) {
    const on = !!player.isDashing;
    this.group.visible = on;
    if (!on) return;
    this.group.position.copy(player.pos);
    // 속도 벡터 방향 정렬 — 스트릭은 앞(+z)에서 뒤로 순환하며 흘러간다
    const vx = player.vel.x;
    const vz = player.vel.z;
    if (vx * vx + vz * vz > 0.5) this.group.rotation.y = Math.atan2(vx, vz);
    for (const s of this.streaks) {
      s.t += dt * s.speed;
      s.mesh.position.z = 2.5 - (s.t % 5);
    }
  }
}
