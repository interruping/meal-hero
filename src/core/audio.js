// FR-12→FR-25 (§12.6) 사운드: 프로시저럴 신스 폐기, 생성/외부 에셋 샘플 재생으로 전환.
// BGM 5곡: Juhani Junkala 칩튠 (OpenGameArt, CC0) — 메뉴 + 4계절, 심리스 루프
// SFX: Kenney 오디오 팩 (CC0) — 돈소리·충돌·UI 등 / 방해요소 보이스 4종: gpt-audio-mini 생성
const SFX = {
  order: 'sfx-order.mp3', // 의뢰 수락
  pickup: 'sfx-pickup.mp3', // 픽업 (봉지 부스럭)
  deliver: 'sfx-coin.mp3', // 배달 완료 돈소리
  bonus: 'sfx-coin-bonus.mp3', // 스피드 보너스 돈소리
  miss: 'sfx-fee.mp3', // 시간 초과 수수료 부저
  hit: 'sfx-hit.mp3', // 체력 피격
  crash: 'sfx-crash.mp3', // 과속 충돌 (금속 쾅)
  receipt: 'sfx-receipt.mp3', // 수령 코드 영수증 촤르륵
  codeBad: 'sfx-code-bad.mp3', // 코드 오답
  clear: 'sfx-clear.mp3', // 분기 정산 (돈 세는 소리 + 확인음)
  gameover: 'sfx-gameover.mp3', // 게임오버 (공 + 부저)
  jump: 'sfx-jump.mp3',
  skill: 'sfx-skill.mp3',
  glass: 'sfx-glass.mp3', // §19.2 과속 충돌 파손 (유리 깨짐)
  horn: 'sfx-horn.mp3', // §19.4 차량 니어미스 경적
  voiceSafe: 'voice-safe.mp3', // §19.1 정답 "안전히 배달해주세요~"
  voiceWrong: 'voice-wrong.mp3', // §19.1 오답 "기사님 잘못 가져가셨어요~!"
  voiceEnjoy: 'voice-enjoy.mp3', // §19.3 전달 "맛있게 드세요"
  voiceFast: 'voice-fast.mp3', // §19.3 보너스 전달 "와우 빨리 오셔서 감사해요!"
  flyer: 'voice-flyer.mp3', // "전단지 받아가세요~!"
  kid: 'voice-kid.mp3', // "따르릉 따르릉! 비켜주세요!!"
  drunk: 'voice-drunk.mp3', // 취객 웅얼거림
  pigeon: 'voice-pigeon.mp3', // 구구!! 푸드드득
};

const BGM = {
  menu: 'bgm-menu.mp3',
  spring: 'bgm-spring.mp3',
  summer: 'bgm-summer.mp3',
  autumn: 'bgm-autumn.mp3',
  winter: 'bgm-winter.mp3',
};

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.buffers = new Map();
    this.bgmSource = null;
    this.bgmKey = null;
    this._bgmToken = 0;
    // 브라우저 정책: 첫 사용자 제스처에서 컨텍스트 재개 + 대기 중 BGM 시작
    const resume = () => {
      if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
      if (this.bgmKey && !this.bgmSource) this.startBGM(this.bgmKey);
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      // §12.6 음량 밸런스: BGM은 SFX보다 낮게
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.30;
      this.bgmGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }

  async buffer(file) {
    if (this.buffers.has(file)) return this.buffers.get(file);
    const promise = fetch(`${import.meta.env.BASE_URL}audio/${file}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
      .then((ab) => this.ctx.decodeAudioData(ab))
      .catch(() => null);
    this.buffers.set(file, promise);
    return promise;
  }

  play(name, gain = 1) {
    const file = SFX[name];
    if (this.muted || !file || !this.ensure()) return;
    this.buffer(file).then((buf) => {
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(this.master);
      src.start();
    });
  }

  // BGM 지연 로딩 + 루프 (§12.6 — 초기 로딩 예산 보호)
  startBGM(key) {
    if (!BGM[key]) return;
    this.bgmKey = key;
    if (this.muted || !this.ensure()) return;
    const token = ++this._bgmToken;
    this._stopSource();
    this.buffer(BGM[key]).then((buf) => {
      if (!buf || token !== this._bgmToken || this.bgmKey !== key) return;
      if (this.ctx.state === 'suspended') return; // 제스처 리스너가 재시작
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.bgmGain);
      src.start();
      this.bgmSource = src;
    });
  }

  stopBGM() {
    this.bgmKey = null;
    this._bgmToken++;
    this._stopSource();
  }

  _stopSource() {
    try { this.bgmSource?.stop(); } catch { /* 이미 정지 */ }
    this.bgmSource = null;
  }
}
