// 키/마우스 입력. 포인터록 기반 마우스 시점 + 키 엣지 검출.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // 이번 프레임에 눌린 키 (엣지)
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseX = -1; // 커서 화면 좌표 (포인터록 폴백 에지 스크롤용, -1 = 미확인)
    this.mouseY = -1;
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
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (!this._locked && !this.freeLook) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    // 커서가 창 밖으로 나가면 에지 스크롤 중지
    document.documentElement.addEventListener('mouseleave', () => {
      this.mouseX = -1;
      this.mouseY = -1;
    });
  }

  // 포인터록 폴백(락 없음) 상태에서 커서가 화면 가장자리에 닿으면
  // 그 방향으로 계속 회전하도록 -1/0/1 푸시 벡터 반환
  edgePush() {
    if (this._locked || !this.freeLook || this.mouseX < 0) return { x: 0, y: 0 };
    const m = 28;
    let x = 0, y = 0;
    if (this.mouseX <= m) x = -1;
    else if (this.mouseX >= window.innerWidth - m) x = 1;
    if (this.mouseY <= m) y = -1;
    else if (this.mouseY >= window.innerHeight - m) y = 1;
    return { x, y };
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
