import * as THREE from 'three';

// §15.1 (FR-33) 3D 안내 화살표 — 화살촉 있는 입체 화살표를 캐릭터 바로 하단
// (플레이어 발치, 카메라 쪽 1.35m)에 렌더. 가장 급박한 배달의 목적지 방향으로
// 회전하고 해당 배달 색을 입는다. 라벨(#arrow-label)은 game이 위치를 투영해 표시.
// UI 안내 요소라 텍스처 면제 대상 (§7.10 "UI 제외").
export class ArrowGuide {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.mat = new THREE.MeshLambertMaterial({
      color: 0xb5372f, emissive: 0xb5372f, emissiveIntensity: 0.45,
    });
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x26262a, side: THREE.BackSide });

    // 화살촉: 4각뿔을 +z로 눕혀 납작하게 — 위에서 봐도 방향이 읽히는 "머리"
    const headGeo = new THREE.ConeGeometry(0.62, 1.05, 4)
      .rotateY(Math.PI / 4).rotateX(Math.PI / 2).scale(1, 0.38, 1);
    const head = new THREE.Mesh(headGeo, this.mat);
    head.position.z = 0.5;
    // 몸통(샤프트) — 머리보다 좁게
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.2, 1.0), this.mat);
    shaft.position.z = -0.5;
    for (const m of [head, shaft]) {
      const o = new THREE.Mesh(m.geometry, outlineMat);
      o.scale.setScalar(1.16);
      m.add(o);
      this.group.add(m);
    }
    // §17.1 (FR-47) 캐릭터 발치 대비 과대 피드백 — 전체 0.8배 축소
    this.group.scale.setScalar(0.8);
    scene.add(this.group);
    this._color = '';
  }

  // playerPos 발치에서 카메라 쪽으로 밀어 화면상 캐릭터 바로 아래에 보이게 한다
  update(time, playerPos, target, cssColor, camera, groundHeight) {
    const dx = camera.position.x - playerPos.x;
    const dz = camera.position.z - playerPos.z;
    const len = Math.hypot(dx, dz) || 1;
    const ax = playerPos.x + (dx / len) * 1.35;
    const az = playerPos.z + (dz / len) * 1.35;
    this.group.position.set(ax, groundHeight(ax, az) + 0.32 + Math.sin(time * 4) * 0.07, az);
    this.group.rotation.y = Math.atan2(target.x - ax, target.z - az);
    if (cssColor !== this._color) {
      this._color = cssColor;
      this.mat.color.set(cssColor);
      this.mat.emissive.set(cssColor);
    }
    this.group.visible = true;
  }

  hide() { this.group.visible = false; }
}
