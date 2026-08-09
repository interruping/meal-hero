// §7.8 UI: 픽셀 폰트 + 단순 사각 패널. DOM 오버레이 방식.
// 화면: 타이틀(FR-8), 오프닝(FR-7), 스테이지 인트로, 클리어/게임오버(FR-6), 엔딩(FR-16), HUD(FR-10)

const CSS = `
@font-face {
  font-family: 'Galmuri11';
  src: url('fonts/Galmuri11.woff2') format('woff2');
  font-display: swap;
}
#ui { position: absolute; inset: 0; pointer-events: none; font-family: 'Galmuri11', monospace;
  color: #3a3a38; user-select: none; overflow: hidden; }
#ui * { box-sizing: border-box; }
.mh-screen { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 18px; pointer-events: auto; background: rgba(58,58,56,0.55); text-align: center; }
.mh-panel { background: #efeeea; border: 3px solid #3a3a38; box-shadow: 6px 6px 0 rgba(58,58,56,0.5);
  padding: 22px 30px; max-width: 560px; image-rendering: pixelated; }
.mh-title { font-size: 44px; letter-spacing: 4px; margin: 0; color: #3a3a38; }
.mh-sub { font-size: 15px; margin: 6px 0 0; color: #6a6a66; }
.mh-btn { pointer-events: auto; font-family: inherit; font-size: 19px; padding: 12px 26px; margin: 4px;
  background: #3a3a38; color: #efeeea; border: 2px solid #3a3a38; cursor: pointer; }
.mh-btn:hover { background: #b5372f; border-color: #b5372f; }
.mh-btn.small { font-size: 16px; padding: 8px 14px; }
.mh-controls { font-size: 15px; line-height: 1.9; color: #4a4a46; text-align: left; display: inline-block; }
.mh-caption { font-size: 22px; line-height: 1.8; }
.mh-hint { font-size: 14px; color: #7a7a76; }
/* HUD */
#hud { position: absolute; inset: 0; display: none; }
.hud-panel { position: absolute; background: rgba(246,245,241,0.96); border: 2px solid #3a3a38;
  padding: 8px 12px; font-size: 17px; box-shadow: 3px 3px 0 rgba(58,58,56,0.45); }
#hud-money { top: 12px; left: 12px; line-height: 1.55; }
#hud-hp { top: 12px; right: 12px; font-size: 22px; letter-spacing: 2px; color: #b5372f; }
#hud-timer { top: 12px; left: 50%; transform: translateX(-50%); text-align: center; min-width: 220px; }
#hud-timer .bar { height: 10px; background: #c6c2b4; margin-top: 5px; border: 1px solid #3a3a38; }
#hud-timer .fill { height: 100%; background: #4f6d8f; width: 100%; }
#hud-timer.low .fill { background: #b5372f; }
#hud-stage { bottom: 12px; left: 12px; font-size: 15px; }
#hud-hint { bottom: 14px; left: 50%; transform: translateX(-50%); font-size: 19px; display: none;
  background: #3a3a38; color: #efeeea; border-color: #efeeea; }
#hud-arrow { position: absolute; top: 76px; left: 50%; width: 40px; height: 40px; margin-left: -20px;
  font-size: 36px; color: #b5372f; text-align: center; line-height: 40px;
  text-shadow: 2px 2px 0 #efeeea, -1px -1px 0 #efeeea; }
#hud-banner { position: absolute; top: 30%; left: 50%; transform: translate(-50%, -50%); font-size: 24px;
  background: rgba(246,245,241,0.97); border: 3px solid #3a3a38; padding: 14px 30px; display: none;
  text-align: center; box-shadow: 4px 4px 0 rgba(58,58,56,0.45); }
#hud-toast { position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%); font-size: 18px;
  color: #efeeea; text-shadow: 2px 2px 0 #3a3a38, -1px -1px 0 #3a3a38, 1px -1px 0 #3a3a38, -1px 1px 0 #3a3a38;
  display: none; text-align: center; }
/* 비둘기 시야 방해 */
.pigeon-wing { position: absolute; width: 160px; height: 90px; background: #5c5c58; border-radius: 50%;
  opacity: 0.9; animation: wing-fly 1.4s ease-out forwards; }
@keyframes wing-fly {
  0% { transform: translate(0, 40vh) scale(0.6) rotate(0deg); opacity: 0.95; }
  50% { transform: translate(var(--dx), -10vh) scale(1.4) rotate(20deg); opacity: 0.9; }
  100% { transform: translate(calc(var(--dx) * 2), -70vh) scale(0.8) rotate(-15deg); opacity: 0; }
}
`;

export class UI {
  constructor(container) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'ui';
    container.appendChild(this.root);

    this.root.innerHTML = `
      <div id="hud">
        <div id="hud-money" class="hud-panel"></div>
        <div id="hud-timer" class="hud-panel"><span id="hud-timer-text">주문 대기 중…</span><div class="bar"><div class="fill"></div></div></div>
        <div id="hud-hp" class="hud-panel"></div>
        <div id="hud-stage" class="hud-panel"></div>
        <div id="hud-hint" class="hud-panel"></div>
        <div id="hud-arrow">▲</div>
        <div id="hud-banner"></div>
        <div id="hud-toast"></div>
      </div>
      <div id="screen-holder"></div>
    `;
    this.hud = this.root.querySelector('#hud');
    this.holder = this.root.querySelector('#screen-holder');
    this.el = (id) => this.root.querySelector(id);
    this.bannerTimeout = null;
    this.toastTimeout = null;
  }

  clearScreen() { this.holder.innerHTML = ''; }

  screen(html) {
    this.clearScreen();
    const div = document.createElement('div');
    div.className = 'mh-screen';
    div.innerHTML = html;
    this.holder.appendChild(div);
    return div;
  }

  showTitle({ onStart, onStage, save, onContinue }) {
    const continueBtn = save
      ? `<button class="mh-btn" id="btn-continue">이어하기 (STAGE ${save.nextStage + 1})</button>`
      : '';
    const s = this.screen(`
      <div class="mh-panel">
        <h1 class="mh-title">MEAL HERO</h1>
        <p class="mh-sub">빚 4,000만원, 두 다리, 그리고 사계절 — 서울 빌라촌 배달 러너</p>
        <div style="margin-top:16px"><button class="mh-btn" id="btn-start">배달 시작</button>${continueBtn}</div>
        <div style="margin-top:14px" class="mh-controls">
          [W A S D] 이동 · [마우스] 시점 · [Space] 점프<br>
          [E] 픽업 / 전달 · [Shift] 스킬(탈것) · [R] 재시작(게임오버 시)
        </div>
        <div style="margin-top:14px">
          <div class="mh-hint">심사 모드 — 스테이지 바로가기</div>
          <button class="mh-btn small" data-stage="0">1 봄</button>
          <button class="mh-btn small" data-stage="1">2 여름</button>
          <button class="mh-btn small" data-stage="2">3 가을</button>
          <button class="mh-btn small" data-stage="3">4 겨울</button>
        </div>
      </div>
    `);
    s.querySelector('#btn-start').addEventListener('click', onStart);
    if (save && onContinue) s.querySelector('#btn-continue').addEventListener('click', onContinue);
    s.querySelectorAll('[data-stage]').forEach((b) =>
      b.addEventListener('click', () => onStage(Number(b.dataset.stage))));
  }

  showOpening(lines, onDone) {
    let i = 0;
    const s = this.screen(`
      <div class="mh-panel" style="min-width:480px">
        <div class="mh-caption" id="op-line"></div>
        <div class="mh-hint" style="margin-top:16px">클릭 또는 [Space] — 다음</div>
      </div>
    `);
    const lineEl = s.querySelector('#op-line');
    const show = () => { lineEl.textContent = lines[i]; };
    const advance = () => {
      i++;
      if (i >= lines.length) { cleanup(); onDone(); } else show();
    };
    const onKey = (e) => { if (e.code === 'Space' || e.code === 'Enter') advance(); };
    const cleanup = () => window.removeEventListener('keydown', onKey);
    s.addEventListener('click', advance);
    window.addEventListener('keydown', onKey);
    show();
  }

  showStageIntro(stage, vehicleLabel, onGo) {
    const s = this.screen(`
      <div class="mh-panel">
        <div class="mh-sub">STAGE ${stage.id}</div>
        <div class="mh-caption" style="margin:10px 0">${stage.intro}</div>
        <div class="mh-sub">이동 수단: ${vehicleLabel} · 목표 상환액: ₩${stage.goal.toLocaleString()}</div>
        <div style="margin-top:14px"><button class="mh-btn" id="btn-go">출발</button></div>
      </div>
    `);
    s.querySelector('#btn-go').addEventListener('click', onGo);
  }

  showClear({ stage, revenue, deliveries, isLast, nextVehicle }, onNext) {
    const bridge = isLast
      ? ''
      : `<div class="mh-caption" style="margin:8px 0; font-size:16px">계절이 바뀐다… 새 이동 수단 <b>${nextVehicle}</b> 획득!</div>`;
    const s = this.screen(`
      <div class="mh-panel">
        <div class="mh-title" style="font-size:30px">할당액 상환 완료!</div>
        <div class="mh-sub" style="margin:12px 0">
          ${stage.intro.split('—')[0].trim()} 매출 ₩${revenue.toLocaleString()} / 배달 ${deliveries}건
        </div>
        ${bridge}
        <button class="mh-btn" id="btn-next">${isLast ? '엔딩 보기' : '다음 계절로'}</button>
      </div>
    `);
    s.querySelector('#btn-next').addEventListener('click', onNext);
  }

  showGameOver(reason, onRetry) {
    const s = this.screen(`
      <div class="mh-panel">
        <div class="mh-title" style="font-size:30px; color:#b5372f">배달 실패…</div>
        <div class="mh-sub" style="margin:12px 0">${reason}</div>
        <button class="mh-btn" id="btn-retry">[R] 다시 도전</button>
      </div>
    `);
    s.querySelector('#btn-retry').addEventListener('click', onRetry);
  }

  showEnding(career, onTitle) {
    const s = this.screen(`
      <div class="mh-panel">
        <div class="mh-title" style="font-size:30px">빚 완납!</div>
        <div class="mh-caption" style="margin:12px 0; font-size:16px; line-height:2">
          1년간의 배달 대장정 끝에 빚 ₩${career.debt.toLocaleString()}을 모두 갚았다.<br>
          총 배달: ${career.deliveries}건<br>
          총 수입: ₩${career.revenue.toLocaleString()}<br>
          충돌 사고: ${career.hits}회
        </div>
        <div class="mh-sub">주인공은 이제… 자기 가게를 차리기로 했다. 아마도.</div>
        <div style="margin-top:14px"><button class="mh-btn" id="btn-title">타이틀로</button></div>
      </div>
    `);
    s.querySelector('#btn-title').addEventListener('click', onTitle);
  }

  showPause({ onResume, onRestart, onMenu }) {
    const s = this.screen(`
      <div class="mh-panel">
        <div class="mh-caption">일시 정지</div>
        <div style="margin-top:14px; display:flex; flex-direction:column; gap:8px; align-items:center">
          <button class="mh-btn" id="btn-resume">계속하기</button>
          <button class="mh-btn small" id="btn-restart">스테이지 재시작</button>
          <button class="mh-btn small" id="btn-menu">메인 메뉴로 돌아가기</button>
        </div>
        <div class="mh-hint" style="margin-top:10px">[ESC] 계속하기</div>
      </div>
    `);
    s.querySelector('#btn-resume').addEventListener('click', onResume);
    s.querySelector('#btn-restart').addEventListener('click', onRestart);
    s.querySelector('#btn-menu').addEventListener('click', onMenu);
  }

  setHudVisible(v) { this.hud.style.display = v ? 'block' : 'none'; if (!v) this.hideHint(); }

  updateHUD({ revenue, goal, hp, maxHp, stageLabel, vehicleLabel, timer }) {
    this.el('#hud-money').innerHTML =
      `매출 ₩${revenue.toLocaleString()}<br>목표 ₩${goal.toLocaleString()}`;
    this.el('#hud-hp').textContent = '♥'.repeat(hp) + '♡'.repeat(Math.max(0, maxHp - hp));
    this.el('#hud-stage').textContent = `${stageLabel} · ${vehicleLabel}`;
    const timerEl = this.el('#hud-timer');
    const fill = timerEl.querySelector('.fill');
    if (timer) {
      this.el('#hud-timer-text').textContent = timer.text;
      fill.style.width = `${Math.max(0, Math.min(1, timer.ratio)) * 100}%`;
      timerEl.classList.toggle('low', timer.low);
    } else {
      this.el('#hud-timer-text').textContent = '주문 대기 중…';
      fill.style.width = '0%';
      timerEl.classList.remove('low');
    }
  }

  setArrow(angleRad, visible) {
    const a = this.el('#hud-arrow');
    a.style.display = visible ? 'block' : 'none';
    a.style.transform = `rotate(${angleRad}rad)`;
  }

  showHint(text) {
    const h = this.el('#hud-hint');
    h.textContent = text;
    h.style.display = 'block';
  }
  hideHint() { this.el('#hud-hint').style.display = 'none'; }

  banner(text, ms = 2200) {
    const b = this.el('#hud-banner');
    b.innerHTML = text;
    b.style.display = 'block';
    clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => { b.style.display = 'none'; }, ms);
  }

  pigeonFlash() {
    for (let i = 0; i < 7; i++) {
      const w = document.createElement('div');
      w.className = 'pigeon-wing';
      w.style.left = `${10 + Math.random() * 80}%`;
      w.style.top = `${30 + Math.random() * 50}%`;
      w.style.setProperty('--dx', `${(Math.random() - 0.5) * 300}px`);
      w.style.animationDelay = `${Math.random() * 0.25}s`;
      this.hud.appendChild(w);
      setTimeout(() => w.remove(), 1800);
    }
  }

  toast(text, ms = 1600) {
    const t = this.el('#hud-toast');
    t.innerHTML = text;
    t.style.display = 'block';
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => { t.style.display = 'none'; }, ms);
  }
}
