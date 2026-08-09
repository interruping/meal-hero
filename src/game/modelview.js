import * as THREE from 'three';

// §14.4·§14.5 모달 안 3D 모델 턴테이블 미니 렌더러 (FR-30, FR-31).
// 메인 씬과 별개의 소형 WebGL 컨텍스트 하나를 만들어 재사용한다.
export class ModelViewer {
  constructor(width = 200, height = 200) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    this.renderer.setPixelRatio(1); // PS1 룩 유지 — 저해상도 그대로
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.imageRendering = 'pixelated';
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 0.4);
    sun.position.set(2, 4, 3);
    this.scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(35, width / height, 0.05, 50);
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this._raf = 0;
  }

  // object를 턴테이블로 회전 렌더. 반환된 canvas를 모달에 붙여 쓴다
  show(object, { spin = 0.9 } = {}) {
    this.stop();
    this.holder.clear();
    this.holder.rotation.y = 0;
    this.holder.add(object);
    // 바운딩 박스 기준 자동 프레이밍 (비둘기 0.3m~취객 1.7m 모두 대응)
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z);
    this.camera.position.set(0, mid.y + r * 0.22, r * 1.9);
    this.camera.lookAt(0, mid.y, 0);
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      this.holder.rotation.y += spin * dt;
      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
    return this.renderer.domElement;
  }

  stop() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
  }
}
