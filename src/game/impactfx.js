import * as THREE from 'three';
import { ASSET_BASE } from '../core/loader.js';

// §20.2 (FR-65) 대시 넉백 "쿵" 임팩트 — 만화 스타버스트 빌보드 팝.
// gpt-image-2 스프라이트(검정 배경)를 additive 블렌딩으로 발광 합성
const LIFE = 0.45;

export class ImpactFX {
  constructor(scene) {
    const map = new THREE.TextureLoader().load(`${ASSET_BASE}generated/fx-impact-star-256.png`);
    map.colorSpace = THREE.SRGBColorSpace;
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    this.pool = Array.from({ length: 4 }, () => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
      }));
      sprite.visible = false;
      scene.add(sprite);
      return { sprite, t: 0 };
    });
  }

  spawn(pos) {
    const p = this.pool.find((x) => x.t <= 0) ?? this.pool[0];
    p.t = LIFE;
    p.sprite.position.copy(pos);
    p.sprite.material.rotation = Math.random() * Math.PI * 2;
    p.sprite.material.opacity = 1;
    p.sprite.scale.setScalar(1.6);
    p.sprite.visible = true;
  }

  update(dt) {
    for (const p of this.pool) {
      if (p.t <= 0) continue;
      p.t -= dt;
      const k = 1 - Math.max(p.t, 0) / LIFE;
      p.sprite.scale.setScalar(1.6 + k * 2.8); // 팝 확대
      p.sprite.material.opacity = p.t < 0.18 ? Math.max(p.t, 0) / 0.18 : 1;
      if (p.t <= 0) p.sprite.visible = false;
    }
  }
}
