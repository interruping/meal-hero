// 키/마우스 입력. 포인터록 기반 마우스 시점 + 키 엣지 검출.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // 이번 프레임에 눌린 키 (엣지)
    this.mouseDX = 0;
    this.mouseDY = 0;
    this._locked = false;
    // 포인터록 실패·미지원 환경 폴백: 플레이 중이면 락 없이도 마우스 시점 동작
    this.freeLook = false;
    // 자동화 테스트용: 포인터록 없이 플레이 (?nolock)
    this.noLock = new URLSearchParams(window.location.search).has('nolock');

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this._locked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this._locked && !this.freeLook) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  get pointerLocked() {
    return this.noLock || this._locked;
  }

  requestPointerLock() {
    if (this.noLock || this._locked) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // 포인터록 미지원 환경 (테스트 등) — 무시
    }
  }

  exitPointerLock() {
    if (this._locked) document.exitPointerLock();
  }

  down(code) { return this.keys.has(code); }
  justPressed(code) { return this.pressed.has(code); }

  consumeMouse() {
    const d = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  endFrame() {
    this.pressed.clear();
  }
}
