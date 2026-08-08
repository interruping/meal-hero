// FR-12 사운드: 외부 에셋 없이 WebAudio 프로시저럴 생성.
// BGM: 계절별 템포·음계 8스텝 루프 / SFX: 픽업·전달·충돌·시간초과 등

const SEASON_TUNES = {
  spring: { tempo: 100, root: 220, bass: [0, 0, 5, 0, 7, 0, 5, 3], mel: [12, 14, 16, 19, 16, 14, 12, 14] },
  summer: { tempo: 116, root: 233, bass: [0, 0, 3, 0, 5, 0, 3, 0], mel: [12, 15, 17, 19, 17, 15, 12, 10] },
  autumn: { tempo: 84, root: 196, bass: [0, 0, 3, 0, 8, 0, 7, 0], mel: [12, 10, 8, 7, 8, 10, 12, 15] },
  winter: { tempo: 70, root: 174, bass: [0, 0, 0, 0, 5, 0, 0, 0], mel: [12, 0, 15, 0, 14, 0, 10, 0] },
};

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.bgmTimer = null;
    this.muted = false;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.11;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      this.bgmGain.connect(lp);
      lp.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }

  note(freq, t0, dur, type = 'square', gainVal = 0.5, dest = null) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(dest ?? this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  noise(t0, dur, gainVal = 0.3, freq = 800) {
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  play(name) {
    if (this.muted || !this.ensure()) return;
    const t = this.ctx.currentTime + 0.01;
    const semi = (n) => 220 * Math.pow(2, n / 12);
    switch (name) {
      case 'pickup':
        this.note(semi(7), t, 0.08, 'square', 0.25);
        this.note(semi(12), t + 0.09, 0.12, 'square', 0.25);
        break;
      case 'deliver':
        this.note(semi(7), t, 0.09, 'square', 0.22);
        this.note(semi(11), t + 0.09, 0.09, 'square', 0.22);
        this.note(semi(14), t + 0.18, 0.2, 'square', 0.22);
        break;
      case 'order':
        this.note(semi(14), t, 0.07, 'triangle', 0.3);
        this.note(semi(14), t + 0.12, 0.07, 'triangle', 0.3);
        break;
      case 'hit':
        this.noise(t, 0.18, 0.4, 500);
        this.note(semi(-10), t, 0.2, 'sawtooth', 0.3);
        break;
      case 'miss':
        this.note(semi(5), t, 0.14, 'sawtooth', 0.2);
        this.note(semi(1), t + 0.15, 0.14, 'sawtooth', 0.2);
        this.note(semi(-4), t + 0.3, 0.3, 'sawtooth', 0.2);
        break;
      case 'pigeon':
        for (let i = 0; i < 6; i++) this.noise(t + i * 0.07, 0.05, 0.22, 1600);
        break;
      case 'jump':
        this.note(semi(0), t, 0.1, 'triangle', 0.18);
        break;
      case 'skill':
        this.note(semi(0), t, 0.05, 'square', 0.15);
        this.note(semi(5), t + 0.05, 0.05, 'square', 0.15);
        this.note(semi(10), t + 0.1, 0.15, 'square', 0.15);
        break;
      case 'clear':
        [0, 4, 7, 12, 16].forEach((n, i) => this.note(semi(n + 12), t + i * 0.12, 0.25, 'triangle', 0.3));
        break;
      case 'gameover':
        [7, 3, 0, -5].forEach((n, i) => this.note(semi(n), t + i * 0.22, 0.3, 'sawtooth', 0.22));
        break;
    }
  }

  startBGM(season) {
    if (!this.ensure()) return;
    this.stopBGM();
    const tune = SEASON_TUNES[season] ?? SEASON_TUNES.spring;
    const stepDur = 60 / tune.tempo / 2; // 8분음표
    let step = 0;
    let nextTime = this.ctx.currentTime + 0.1;
    const semi = (n) => tune.root * Math.pow(2, n / 12);
    this.bgmTimer = setInterval(() => {
      while (nextTime < this.ctx.currentTime + 0.25) {
        const i = step % 8;
        const bass = tune.bass[i];
        if (bass !== 0 || i === 0) {
          this.note(semi(bass - 12), nextTime, stepDur * 0.9, 'triangle', 0.5, this.bgmGain);
        }
        const mel = tune.mel[i];
        if (mel !== 0) {
          this.note(semi(mel), nextTime, stepDur * 0.85, 'square', 0.28, this.bgmGain);
        }
        nextTime += stepDur;
        step++;
      }
    }, 90);
  }

  stopBGM() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}
