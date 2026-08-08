import * as THREE from 'three';
import { RENDER_W, RENDER_H } from '../core/renderer.js';
import { FOG_FAR } from './palettes.js';

// §7.2 3인칭 추적 카메라: 뒤 7m, 높이 3m, lerp 지연 추적
export class FollowCamera {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(60, RENDER_W / RENDER_H, 0.1, FOG_FAR + 40);
    this.yaw = Math.PI;
    this.pitch = 0.18; // ≈10° 내려다봄
    this.dist = 7;
    this.height = 3;
    this.current = new THREE.Vector3();
    this.initialized = false;
    this.shakeAmp = 0;
    this.shakeTime = 0;
  }

  shake(intensity, duration) {
    this.shakeAmp = Math.max(this.shakeAmp, intensity);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  update(dt, input, targetPos) {
    const m = input.consumeMouse();
    this.yaw -= m.x * 0.0025;
    this.pitch = Math.min(Math.max(this.pitch + m.y * 0.0018, -0.05), 0.55);

    const behind = new THREE.Vector3(
      Math.sin(this.yaw) * -this.dist * Math.cos(this.pitch),
      this.height + Math.sin(this.pitch) * this.dist,
      Math.cos(this.yaw) * -this.dist * Math.cos(this.pitch),
    );
    const ideal = targetPos.clone().add(behind);

    if (!this.initialized) {
      this.current.copy(ideal);
      this.initialized = true;
    } else {
      this.current.lerp(ideal, 1 - Math.exp(-8 * dt));
    }
    this.camera.position.copy(this.current);
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeTime);
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
      if (this.shakeTime <= 0) this.shakeAmp = 0;
    }
    this.camera.lookAt(targetPos.x, targetPos.y + 1.6, targetPos.z);
  }
}
