// §7.8 UI: 픽셀 폰트 + 단순 사각 패널. DOM 오버레이 방식.
// 화면: 타이틀(FR-8), 오프닝(FR-7), 스테이지 인트로, 클리어/게임오버(FR-6), 엔딩(FR-16), HUD(FR-10)
import { DELIVERY_COLORS_CSS, OFFER_TTL } from './delivery.js';

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
#hud-stage { bottom: 12px; left: 12px; font-size: 15px; }
/* FR-19 의뢰 슬롯 4개 (상단 중앙) */
#hud-offers { position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 6px; }
.offer-slot { width: 150px; background: rgba(246,245,241,0.96); border: 2px solid #3a3a38;
  box-shadow: 3px 3px 0 rgba(58,58,56,0.45); padding: 4px 6px 5px; font-size: 12px;
  line-height: 1.35; position: relative; }
.offer-slot .key { display: inline-block; background: #3a3a38; color: #efeeea; font-size: 12px;
  padding: 0 5px; margin-right: 4px; }
.offer-slot .o-pay { color: #b5372f; }
.offer-slot .o-ttl { height: 5px; background: #c6c2b4; border: 1px solid #3a3a38; margin-top: 3px; }
.offer-slot .o-ttl i { display: block; height: 100%; background: #4f6d8f; }
.offer-slot.empty { opacity: 0.45; }
.offer-slot.empty .o-ttl { visibility: hidden; }
.offer-slot.blocked { filter: grayscale(1); opacity: 0.6; }
/* FR-19 진행 중 배달 목록 (좌측, 매출 패널 아래) */
#hud-active { position: absolute; top: 86px; left: 12px; display: flex;
  flex-direction: column; gap: 5px; }
.active-row { background: rgba(246,245,241,0.96); border: 2px solid #3a3a38;
  box-shadow: 3px 3px 0 rgba(58,58,56,0.45); padding: 4px 8px; font-size: 13px;
  display: flex; align-items: center; gap: 6px; min-width: 210px; }
.active-row .dot { width: 10px; height: 10px; flex: none; border: 1px solid #3a3a38; }
.active-row .a-sec { margin-left: auto; }
.active-row.low .a-sec { color: #b5372f; font-weight: bold; }
#hud-hint { bottom: 14px; left: 50%; transform: translateX(-50%); font-size: 19px; display: none;
  background: #3a3a38; color: #efeeea; border-color: #efeeea; }
#hud-arrow { position: absolute; top: 86px; left: 50%; width: 40px; height: 40px; margin-left: -20px;
  font-size: 36px; color: #b5372f; text-align: center; line-height: 40px;
  text-shadow: 2px 2px 0 #efeeea, -1px -1px 0 #efeeea; }
#hud-banner { position: absolute; top: 30%; left: 50%; transform: translate(-50%, -50%); font-size: 24px;
  background: rgba(246,245,241,0.97); border: 3px solid #3a3a38; padding: 14px 30px; display: none;
  text-align: center; box-shadow: 4px 4px 0 rgba(58,58,56,0.45); }
#hud-toast { position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%); font-size: 18px;
  color: #efeeea; text-shadow: 2px 2px 0 #3a3a38, -1px -1px 0 #3a3a38, 1px -1px 0 #3a3a38, -1px 1px 0 #3a3a38;
  display: none; text-align: center; }
/* 부분 하트 (과속 충돌 0.25 단위 차감) */
.hp-part { background: linear-gradient(90deg, #b5372f var(--f), rgba(181,55,47,0.25) var(--f));
  -webkit-background-clip: text; background-clip: text; color: transparent; }
/* 비둘기 시야 방해: 화면(앞유리)에 부딪힌 비둘기 + 잔류 깃털 */
.pigeon-splat { position: absolute; left: 50%; top: 50%; width: min(46vmin, 380px);
  image-rendering: pixelated; pointer-events: none; z-index: 5;
  animation: splat-hit 2.1s ease-in forwards; }
@keyframes splat-hit {
  0% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
  7% { transform: translate(-50%, -50%) scale(0.94); opacity: 1; }
  12% { transform: translate(-50%, -51%) scale(1.05); }
  17% { transform: translate(-50%, -50%) scale(1); }
  72% { transform: translate(-50%, -47%) scale(1) rotate(2deg); opacity: 1; }
  100% { transform: translate(-50%, 65%) rotate(10deg); opacity: 0; }
}
.pigeon-feather { position: absolute; width: 64px; image-rendering: pixelated;
  pointer-events: none; z-index: 4; opacity: 0;
  animation: feather-stay 2.3s ease-in forwards; }
@keyframes feather-stay {
  0% { transform: translateY(-24px) rotate(var(--r)) scale(var(--s)); opacity: 0; }
  10% { opacity: 0.95; }
  74% { transform: translateY(14px) rotate(calc(var(--r) + 18deg)) scale(var(--s)); opacity: 0.95; }
  100% { transform: translateY(52px) rotate(calc(var(--r) + 38deg)) scale(var(--s)); opacity: 0; }
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
        <div id="hud-offers">${[1, 2, 3, 4].map((n) => `
          <div class="offer-slot empty" data-slot="${n}">
            <span class="key">${n}</span><span class="o-route">의뢰 대기</span><br>
            <span class="o-pay"></span>
            <div class="o-ttl"><i></i></div>
          </div>`).join('')}
        </div>
        <div id="hud-active"></div>
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

  updateHUD({ revenue, goal, hp, maxHp, stageLabel, vehicleLabel, offers, active, full }) {
    this.el('#hud-money').innerHTML =
      `매출 ₩${revenue.toLocaleString()}<br>목표 ₩${goal.toLocaleString()}`;
    // 과속 충돌이 0.25 단위로 깎으므로 부분 하트는 그라데이션 텍스트로 표현
    if (hp !== this._lastHp) {
      this._lastHp = hp;
      let hearts = '';
      for (let i = 0; i < maxHp; i++) {
        const f = Math.max(0, Math.min(1, hp - i));
        if (f >= 1) hearts += '♥';
        else if (f <= 0) hearts += '♡';
        else hearts += `<span class="hp-part" style="--f:${f * 100}%">♥</span>`;
      }
      this.el('#hud-hp').innerHTML = hearts;
    }
    this.el('#hud-stage').textContent = `${stageLabel} · ${vehicleLabel}`;

    // 의뢰 슬롯 4개 (FR-19)
    if (!this._slotEls) this._slotEls = [...this.root.querySelectorAll('.offer-slot')];
    offers.forEach((offer, i) => {
      const el = this._slotEls[i];
      el.classList.toggle('empty', !offer);
      el.classList.toggle('blocked', !!offer && full);
      if (offer) {
        el.querySelector('.o-route').textContent = `${offer.shop.name} → ${offer.door.name}`;
        el.querySelector('.o-pay').textContent = `₩${offer.pay.toLocaleString()}`;
        el.querySelector('.o-ttl i').style.width = `${(offer.ttl / OFFER_TTL) * 100}%`;
      } else {
        el.querySelector('.o-route').textContent = '의뢰 대기';
        el.querySelector('.o-pay').textContent = '';
      }
    });

    // 진행 중 배달 목록 (최대 3건, 색상 = 마커 색)
    const holder = this.el('#hud-active');
    const sig = active.map((d) => `${d.id}${d.phase}`).join(',');
    if (sig !== this._activeSig) {
      this._activeSig = sig;
      holder.innerHTML = active.map((d) => `
        <div class="active-row" data-id="${d.id}">
          <span class="dot" style="background:${DELIVERY_COLORS_CSS[d.colorIdx]}"></span>
          <span>${d.phase === 'pickup' ? `픽업 → ${d.shop.name}` : `전달 → ${d.door.name}`}</span>
          <span class="a-sec"></span>
        </div>`).join('');
    }
    for (const d of active) {
      const row = holder.querySelector(`[data-id="${d.id}"]`);
      if (!row) continue;
      row.querySelector('.a-sec').textContent = `${Math.ceil(d.timeLeft)}초`;
      row.classList.toggle('low', d.timeLeft < 8);
    }
  }

  setArrow(angleRad, visible, color = '#b5372f') {
    const a = this.el('#hud-arrow');
    a.style.display = visible ? 'block' : 'none';
    a.style.transform = `rotate(${angleRad}rad)`;
    a.style.color = color;
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

  // 비둘기 충돌: 앞유리에 부딪힌 스플랫을 화면 중앙에, 깃털은 중앙 피해 산개 후 2초 잔류
  pigeonFlash() {
    const base = import.meta.env.BASE_URL;
    const splat = document.createElement('img');
    splat.className = 'pigeon-splat';
    splat.src = `${base}generated/fx-pigeon-splat.png`;
    this.hud.appendChild(splat);
    setTimeout(() => splat.remove(), 2200);
    for (let i = 0; i < 10; i++) {
      const f = document.createElement('img');
      f.className = 'pigeon-feather';
      f.src = `${base}generated/fx-feather.png`;
      // 중앙(스플랫 영역) 밖 빈 곳에 배치 — 극좌표로 중심 반경 26vmin 이상
      const ang = (i / 10) * Math.PI * 2 + Math.random() * 0.6;
      const r = 26 + Math.random() * 22;
      f.style.left = `calc(50% + ${Math.cos(ang) * r}vmin)`;
      f.style.top = `calc(50% + ${Math.sin(ang) * r * 0.72}vmin)`;
      f.style.setProperty('--r', `${Math.random() * 360}deg`);
      f.style.setProperty('--s', `${0.6 + Math.random() * 0.9}`);
      f.style.animationDelay = `${Math.random() * 0.3}s`;
      this.hud.appendChild(f);
      setTimeout(() => f.remove(), 2800);
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
