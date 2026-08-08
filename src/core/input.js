// 키/마우스 입력. 포인터록 기반 마우스 시점 + 키 엣지 검출.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // 이번 프레임에 눌린 키 (엣지)
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.pointerLocked = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  requestPointerLock() {
    if (!this.pointerLocked) this.canvas.requestPointerLock();
  }

  exitPointerLock() {
    if (this.pointerLocked) document.exitPointerLock();
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
