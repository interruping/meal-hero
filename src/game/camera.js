import * as THREE from 'three';
import { RENDER_W, RENDER_H } from '../core/renderer.js';
import { FOG_FAR } from './palettes.js';

// §7.2 3인칭 추적 카메라: 뒤 7m, 높이 3m, lerp 지연 추적
export class FollowCamera {
  constructor(world = null) {
    this.world = world;
    this.camera = new THREE.PerspectiveCamera(60, RENDER_W / RENDER_H, 0.1, FOG_FAR + 40);
    this.yaw = Math.PI;
    this.pitch = 0.18; // ≈10° 내려다봄
    this.dist = 6.2;
    this.height = 2.7;
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
    let ideal = targetPos.clone().add(behind);

    // 건물·지형에 카메라가 묻히지 않게: 시선 세그먼트를 따라 첫 장애물 앞까지 당김
    if (this.world) {
      const eye = targetPos.clone();
      eye.y += 1.6;
      const blocked = (p) => {
        if (p.y < this.world.groundHeight(p.x, p.z) + 0.35) return true;
        for (const c of this.world.colliders) {
          if (
            p.x > c.minX - 0.25 && p.x < c.maxX + 0.25 &&
            p.y > c.minY && p.y < c.maxY + 0.25 &&
            p.z > c.minZ - 0.25 && p.z < c.maxZ + 0.25
          ) return true;
        }
        return false;
      };
      let t = 1;
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        const s = i / steps;
        const p = eye.clone().lerp(ideal, s);
        if (blocked(p)) { t = Math.max(0.12, (i - 1) / steps); break; }
      }
      if (t < 1) ideal = eye.clone().lerp(ideal, t);
    }

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
