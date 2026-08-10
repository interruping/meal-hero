// §7.8 UI: 픽셀 폰트 + 단순 사각 패널. DOM 오버레이 방식.
// 화면: 타이틀(FR-8), 오프닝(FR-7), 스테이지 인트로, 클리어/게임오버(FR-6), 엔딩(FR-16), HUD(FR-10)
import { DELIVERY_COLORS_CSS, OFFER_TTL } from './delivery.js';

const CSS = `
@font-face {
  font-family: 'Galmuri11';
  src: url('fonts/Galmuri11.woff2') format('woff2');
  font-display: swap;
}
/* §15.2 (FR-34): #ui는 뷰포트가 아니라 캔버스(16:9 레터박스) rect에 동기화 —
   초광폭 모니터에서도 HUD가 그래픽 드로우 영역 안에 머문다 (syncRect) */
#ui { position: absolute; left: 0; top: 0; width: 100%; height: 100%;
  pointer-events: none; font-family: 'Galmuri11', monospace;
  color: #3a3a38; user-select: none; overflow: hidden; }
#ui * { box-sizing: border-box; }
.mh-screen { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 18px; pointer-events: auto; background: rgba(58,58,56,0.55); text-align: center;
  z-index: 9; /* 튜토리얼 하이라이트(z6)·코드매칭(z8)보다 위 — 일시정지 등 전체 화면 우선 */ }
.mh-panel { background: #efeeea; border: 3px solid #3a3a38; box-shadow: 6px 6px 0 rgba(58,58,56,0.5);
  padding: 22px 30px; max-width: 560px; image-rendering: pixelated; }
.mh-title { font-size: 44px; letter-spacing: 4px; margin: 0; color: #3a3a38; }
.mh-sub { font-size: 15px; margin: 6px 0 0; color: #6a6a66; }
/* §15.3 (FR-35) 버튼 체계: 크기 전부 동일, 기본 선택지 1개만 .primary 악센트 */
.mh-btn { pointer-events: auto; font-family: inherit; font-size: 17px; padding: 11px 22px; margin: 4px;
  background: #6a6a66; color: #efeeea; border: 2px solid #3a3a38; cursor: pointer; }
.mh-btn:hover { background: #7a7a76; }
.mh-btn.primary { background: #b5372f; border-color: #7e2620; font-weight: bold; }
.mh-btn.primary:hover { background: #c9463d; }
/* §16.5 (FR-44) 세로 스택 버튼 열: 글자 수와 무관하게 전부 동일 폭 */
.btn-col { display: flex; flex-direction: column; gap: 8px; align-items: center; }
.btn-col .mh-btn { width: 280px; margin: 0; box-sizing: border-box; }
/* §16.6 (FR-45) 심사용 전용 식별색 — 게임 악센트(빨강)와 구분되는 파랑 */
.mh-btn.judge { background: #2e5f8f; border-color: #1e4265; }
.mh-btn.judge:hover { background: #3b74aa; }
.mh-controls { font-size: 15px; line-height: 1.9; color: #4a4a46; text-align: left; display: inline-block;
  word-break: keep-all; }
.mh-controls b { color: #b5372f; } /* §15.3 키 이름 악센트 */
.mh-caption { font-size: 22px; line-height: 1.8; }
.mh-hint { font-size: 14px; color: #7a7a76; }
/* §16.4 (FR-43) 분기 정산 영수증: 항목별 1행, 항목명 좌 / 금액 우, 결론은 마지막 줄 강조 */
.receipt { width: 330px; margin: 14px auto 4px; text-align: left; font-size: 15px;
  background: #f7f5ee; border: 2px solid #8b8779; padding: 12px 16px; }
.receipt .r-row { display: flex; justify-content: space-between; gap: 14px; padding: 3px 0; }
.receipt .r-row span:last-child { text-align: right; white-space: nowrap; }
.receipt .r-sep { border-top: 2px dashed #8b8779; margin: 7px 0; }
.receipt .r-total { font-weight: bold; font-size: 18px; }
.receipt .r-total .neg { color: #b5372f; }
/* §14.6 튜토리얼 (FR-32): 배경 디밍 + 대상 UI 테두리 강조 + 안내 패널 */
#tut-dim { position: absolute; inset: 0; background: rgba(38,38,42,0.35); display: none;
  z-index: 5; pointer-events: none; }
.tut-glow { z-index: 6 !important; outline: 3px solid #c9a13b; outline-offset: 3px;
  animation: tut-pulse 1s ease-in-out infinite; }
@keyframes tut-pulse { 0%, 100% { outline-color: #c9a13b; } 50% { outline-color: #efeeea; } }
#tut-panel { position: absolute; top: 33%; left: 50%; transform: translate(-50%, -50%);
  z-index: 6; background: #efeeea; border: 3px solid #3a3a38; padding: 12px 24px;
  box-shadow: 4px 4px 0 rgba(58,58,56,0.5); font-size: 17px; display: none;
  text-align: center; max-width: 480px; line-height: 1.7; }
#tut-panel .t-step { font-size: 12px; color: #b5372f; margin-bottom: 4px; }
/* §14.5 오프닝: 주인공 모델 + 타자기 대사 */
.op-row { display: flex; gap: 16px; align-items: center; text-align: left; }
.op-hero { flex: none; width: 150px; height: 150px; background: #d8d5cb;
  border: 2px solid #3a3a38; overflow: hidden; }
.op-hero canvas { width: 100%; height: 100%; display: block; }
#op-line { flex: 1; min-height: 3.6em; }
#op-line .caret { display: inline-block; width: 0.55em; background: #3a3a38;
  height: 1em; vertical-align: -0.1em; animation: caret-blink 0.8s steps(1) infinite; }
@keyframes caret-blink { 50% { opacity: 0; } }
/* §14.4 방해요소 소개 (스테이지 인트로 내 3D 턴테이블) */
.intro-obstacle { display: flex; gap: 14px; margin: 14px auto 4px; border: 2px solid #3a3a38;
  background: #e5e3dc; padding: 10px 12px; align-items: center; text-align: left; max-width: 470px; }
.intro-obstacle .io-view { flex: none; width: 150px; height: 150px; background: #d8d5cb;
  border: 2px solid #3a3a38; overflow: hidden; }
.intro-obstacle .io-view canvas { width: 100%; height: 100%; display: block; }
.intro-obstacle .io-tag { font-size: 12px; color: #b5372f; }
.intro-obstacle .io-name { font-size: 18px; margin: 3px 0 5px; }
.intro-obstacle .io-desc { font-size: 13px; color: #4a4a46; line-height: 1.65; }
/* HUD */
#hud { position: absolute; inset: 0; display: none; }
.hud-panel { position: absolute; background: rgba(246,245,241,0.96); border: 2px solid #3a3a38;
  padding: 8px 12px; font-size: 17px; box-shadow: 3px 3px 0 rgba(58,58,56,0.45); }
#hud-money { top: 12px; left: 12px; line-height: 1.55; }
#hud-hp { top: 12px; right: 12px; font-size: 22px; letter-spacing: 2px; color: #b5372f; }
#hud-stage { bottom: 12px; left: 12px; font-size: 15px; }
/* FR-23 스테이지 10분 시계 — 체력 하단, 잔여 1분부터 빨강 + 10% 펄스 */
#hud-clock { top: 58px; right: 12px; font-size: 18px; letter-spacing: 1px; }
#hud-clock .c-icon { margin-right: 5px; }
#hud-clock.low { color: #b5372f; border-color: #b5372f;
  animation: clock-pulse 0.7s ease-in-out infinite; }
@keyframes clock-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
/* FR-19 의뢰 슬롯 4개 (상단 중앙) */
#hud-offers { position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 6px; }
.offer-slot { width: 150px; background: rgba(246,245,241,0.96); border: 2px solid #3a3a38;
  box-shadow: 3px 3px 0 rgba(58,58,56,0.45); padding: 4px 6px 5px; font-size: 12px;
  line-height: 1.35; position: relative; }
.offer-slot .key { display: inline-block; background: #3a3a38; color: #efeeea; font-size: 12px;
  padding: 0 5px; margin-right: 4px; }
.offer-slot .o-pay { color: #b5372f; }
/* §18.1 (FR-54) 만료 임박 단가 급등: 굵게 + 펄스 확대 (뱃지·TTL 바와 별개 강조) */
.offer-slot .o-pay.surge { display: inline-block; font-weight: bold; color: #7e2620;
  background: #e5c6cd; padding: 0 3px; animation: pay-surge 0.45s ease-in-out infinite; }
@keyframes pay-surge { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.22); } }
/* FR-29 (§14.3) 플레이어→가게 거리 + 최근접 뱃지 */
.offer-slot .o-dist { float: right; color: #4a4a46; }
.offer-slot .o-near { position: absolute; top: -9px; right: -5px; background: #b5372f;
  color: #efeeea; font-size: 10px; padding: 1px 5px; border: 1px solid #efeeea;
  box-shadow: 2px 2px 0 rgba(58,58,56,0.45); display: none; }
.offer-slot.nearest .o-near { display: block; }
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
/* §14.1+§15.2 좌측 하단 스킬 UI: 대시 쿨타임 게이지 + 에너지 드링크 키·가격 안내.
   아이콘은 SVG (FR-34 — 이모지 금지) */
#hud-skills { position: absolute; bottom: 54px; left: 12px; display: flex; gap: 6px; }
.skill-box { width: 96px; background: rgba(246,245,241,0.96); border: 2px solid #3a3a38;
  box-shadow: 3px 3px 0 rgba(58,58,56,0.45); padding: 6px 4px 5px; font-size: 12px;
  text-align: center; line-height: 1.5; position: relative; overflow: hidden; }
.skill-box .s-icon { display: block; height: 30px; margin: 0 auto 2px; }
.skill-box .s-icon svg { width: 30px; height: 30px; display: block; margin: 0 auto; }
.skill-box .s-key { display: inline-block; background: #3a3a38; color: #efeeea;
  padding: 0 5px; font-size: 11px; }
.skill-box .s-cd { position: absolute; left: 0; bottom: 0; width: 100%; height: 0%;
  background: rgba(58,58,56,0.3); pointer-events: none; }
.skill-box.off { filter: grayscale(1); opacity: 0.6; }
.skill-box.active { border-color: #b5372f; color: #b5372f; }
/* §15.1 (FR-33) 3D 화살표 하단 대상 라벨 — game이 화살표 월드 좌표를 투영해 배치 */
#arrow-label { position: absolute; left: 0; top: 0; transform: translate(-50%, 10px);
  font-size: 14px; padding: 2px 9px; background: rgba(246,245,241,0.95);
  border: 2px solid #b5372f; color: #3a3a38; white-space: nowrap; display: none;
  box-shadow: 2px 2px 0 rgba(58,58,56,0.45); font-weight: bold; }
#hud-banner { position: absolute; top: 30%; left: 50%; transform: translate(-50%, -50%); font-size: 24px;
  background: rgba(246,245,241,0.97); border: 3px solid #3a3a38; padding: 14px 30px; display: none;
  text-align: center; box-shadow: 4px 4px 0 rgba(58,58,56,0.45); }
#hud-toast { position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%); font-size: 18px;
  color: #efeeea; text-shadow: 2px 2px 0 #3a3a38, -1px -1px 0 #3a3a38, 1px -1px 0 #3a3a38, -1px 1px 0 #3a3a38;
  display: none; text-align: center; }
/* 부분 하트 (과속 충돌 0.25 단위 차감) */
.hp-part { background: linear-gradient(90deg, #b5372f var(--f), rgba(181,55,47,0.25) var(--f));
  -webkit-background-clip: text; background-clip: text; color: transparent; }
/* FR-20 네비게이션 스마트폰: 평시 하단 peek → M 홀드 시 중앙으로 슬라이드 업 + 배경 블러 */
#app > canvas { transition: filter 0.25s; }
body.nav-open #app > canvas { filter: blur(7px) brightness(0.9); }
#navphone { position: absolute; left: 50%; top: 100%; width: 344px;
  transform: translate(-50%, -52px); z-index: 7;
  transition: transform 0.32s cubic-bezier(0.2, 1.25, 0.4, 1);
  background: #3a3a38; border: 3px solid #26262a; border-bottom: none;
  border-radius: 14px 14px 0 0; padding: 8px 10px 16px;
  box-shadow: 0 0 0 2px rgba(239,238,234,0.25), 6px 6px 0 rgba(38,38,42,0.4); }
#navphone.up { transform: translate(-50%, calc(-50% - 50vh)); }
#navphone .np-head { color: #efeeea; font-size: 14px; text-align: center;
  padding: 2px 0 7px; letter-spacing: 3px; }
#navphone .np-map { display: block; width: 100%; background: #e9e7e0;
  border: 2px solid #26262a; image-rendering: pixelated; }
#navphone .np-legend { margin-top: 8px; display: flex; flex-direction: column; gap: 3px;
  font-size: 13px; color: #efeeea; min-height: 18px; }
#navphone .np-legend .row { display: flex; gap: 7px; align-items: center; }
#navphone .np-legend .dot { width: 10px; height: 10px; flex: none; border: 1px solid #efeeea; }
#navphone .np-legend .sec { margin-left: auto; }
/* FR-24 수령 코드 매칭: 영수증 4장 + 전폭 3초 바 + 우측 하단 접수증 */
#codematch { position: absolute; inset: 0; display: none; z-index: 8;
  background: rgba(58,58,56,0.62); }
#codematch .cm-msg { position: absolute; top: 17%; left: 0; right: 0; text-align: center;
  font-size: 21px; color: #efeeea;
  text-shadow: 2px 2px 0 #3a3a38, -1px -1px 0 #3a3a38, 1px -1px 0 #3a3a38, -1px 1px 0 #3a3a38; }
#codematch .cm-bar { position: absolute; top: 23%; left: 0; right: 0; height: 14px;
  background: rgba(58,58,56,0.8); border-top: 2px solid #efeeea; border-bottom: 2px solid #efeeea; }
#codematch .cm-bar i { display: block; height: 100%; background: #5f7a55; width: 100%; }
#codematch .cm-receipts { position: absolute; top: 30%; left: 50%; transform: translateX(-50%);
  display: flex; gap: 14px; }
.cm-receipt { width: 150px; background: #efeeea; border: 2px solid #3a3a38; padding: 10px 8px 12px;
  text-align: center; box-shadow: 4px 4px 0 rgba(58,58,56,0.5); font-size: 13px; color: #6a6a66;
  background-image: linear-gradient(rgba(58,58,56,0.06) 1px, transparent 1px);
  background-size: 100% 7px; }
.cm-receipt .key { display: inline-block; background: #3a3a38; color: #efeeea; font-size: 15px;
  padding: 1px 8px; margin-bottom: 6px; }
.cm-receipt .cm-code { font-size: 19px; letter-spacing: 2px; color: #3a3a38; margin-top: 6px;
  border-top: 1px dashed #9a9a96; padding-top: 7px; }
#codematch .cm-mine { position: absolute; right: 26px; bottom: 26px; width: 190px;
  background: #efeeea; border: 3px solid #b5372f; padding: 12px 10px; text-align: center;
  transform: rotate(-3deg); box-shadow: 5px 5px 0 rgba(58,58,56,0.55); font-size: 13px; }
#codematch .cm-mine .cm-code { font-size: 22px; letter-spacing: 3px; color: #b5372f; margin: 6px 0; }
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
            <span class="o-pay"></span><span class="o-dist"></span>
            <div class="o-ttl"><i></i></div>
            <span class="o-near">제일 가까운</span>
          </div>`).join('')}
        </div>
        <div id="hud-active"></div>
        <div id="hud-hp" class="hud-panel"></div>
        <div id="hud-clock" class="hud-panel"><span class="c-icon">🕐</span><span id="hud-clock-text">10:00</span></div>
        <div id="hud-stage" class="hud-panel"></div>
        <div id="hud-skills">
          <div class="skill-box" id="skill-dash">
            <span class="s-icon"><svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.5 4.5 L11 12 L2.5 19.5 V15 L6 12 L2.5 9 Z" fill="#4f6d8f" stroke="#26262a" stroke-width="1"/>
              <path d="M11.5 4.5 L20 12 L11.5 19.5 V15 L15 12 L11.5 9 Z" fill="#b5372f" stroke="#26262a" stroke-width="1"/>
              <rect x="20.5" y="7" width="2.5" height="2" fill="#4f6d8f"/>
              <rect x="20.5" y="11" width="2.5" height="2" fill="#b5372f"/>
              <rect x="20.5" y="15" width="2.5" height="2" fill="#4f6d8f"/>
            </svg></span>
            <span class="s-key">Shift</span> 대시
            <div class="s-cd"></div>
          </div>
          <div class="skill-box" id="skill-drink">
            <span class="s-icon"><svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="7" y="5.5" width="10" height="15.5" rx="1.5" fill="#b5372f" stroke="#26262a" stroke-width="1"/>
              <rect x="7.6" y="3" width="8.8" height="2.6" fill="#c6c2b4" stroke="#26262a" stroke-width="1"/>
              <rect x="10" y="1.6" width="4" height="1.6" fill="#8a8a86"/>
              <path d="M13.6 7.5 L9.6 13.2 H12 L10.6 19 L15.2 12 H12.6 Z" fill="#c9a13b" stroke="#26262a" stroke-width="0.7"/>
            </svg></span>
            <span class="s-key">Q</span> ₩1,500
            <div class="s-cd"></div>
          </div>
        </div>
        <div id="hud-hint" class="hud-panel"></div>
        <div id="arrow-label"></div>
        <div id="hud-banner"></div>
        <div id="hud-toast"></div>
        <div id="navphone">
          <div class="np-head">MEAL NAV [M]</div>
          <canvas class="np-map" width="320" height="380"></canvas>
          <div class="np-legend"></div>
        </div>
        <div id="tut-dim"></div>
        <div id="tut-panel"></div>
        <div id="codematch">
          <div class="cm-msg"></div>
          <div class="cm-bar"><i></i></div>
          <div class="cm-receipts"></div>
          <div class="cm-mine">
            <div>내 배달 접수증</div>
            <div class="cm-code"></div>
            <div style="color:#6a6a66">일치하는 영수증을 [1~4]로!</div>
          </div>
        </div>
      </div>
      <div id="screen-holder"></div>
    `;
    this.hud = this.root.querySelector('#hud');
    this.holder = this.root.querySelector('#screen-holder');
    this.el = (id) => this.root.querySelector(id);
    this.bannerTimeout = null;
    this.toastTimeout = null;

    // §15.2 (FR-34): 렌더 캔버스는 16:9 레터박스 — #ui를 캔버스 rect에 맞춰
    // 모든 HUD가 그래픽 드로우 영역 안에 위치하게 한다.
    // RetroRenderer의 resize 리스너가 먼저 등록되어 있어 캔버스 갱신 후 실행됨
    this.container = container;
    this._syncRect = () => {
      const c = container.querySelector(':scope > canvas');
      if (!c) return;
      this.root.style.left = `${c.offsetLeft}px`;
      this.root.style.top = `${c.offsetTop}px`;
      this.root.style.width = `${c.offsetWidth}px`;
      this.root.style.height = `${c.offsetHeight}px`;
    };
    window.addEventListener('resize', this._syncRect);
    this._syncRect();
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

  // §16.6 (FR-45, FR-46) 메인메뉴: 조작법·심사용 스테이지 선택은 한 뎁스 안으로.
  // 첫 화면은 로고 + 시작·이어하기 + 조작 방법 + 심사용 메뉴(파랑)만
  showTitle({ onStart, onStage, save, onContinue }) {
    const render = (view) => {
      if (view === 'controls') {
        const s = this.screen(`
          <div class="mh-panel">
            <div class="mh-title" style="font-size:26px">조작 방법</div>
            <div style="margin-top:12px" class="mh-controls">
              <b>[W A S D]</b> 이동 · <b>[마우스]</b> 시점 · <b>[Space]</b> 점프<br>
              <b>[1~4]</b> 배달 의뢰 수락 / 수령 영수증 선택 · <b>[E]</b> 픽업 / 전달<br>
              <b>[Shift]</b> 대시 (3초 가속, 쿨 10초) · <b>[Q]</b> 에너지 드링크 ₩1,500 (쿨 초기화)<br>
              <b>[M]</b> 누르고 있으면 네비게이션 · <b>[R]</b> 재시작 · <b>[ESC]</b> 일시정지
            </div>
            <div style="margin-top:14px"><button class="mh-btn primary" id="btn-close">닫기</button></div>
          </div>
        `);
        s.querySelector('#btn-close').addEventListener('click', () => render('main'));
        return;
      }
      if (view === 'judge') {
        const s = this.screen(`
          <div class="mh-panel">
            <div class="mh-title" style="font-size:26px">심사용 메뉴</div>
            <div class="mh-hint" style="margin-top:6px">스테이지 바로가기 — 선택한 계절을 처음부터 시작 (FR-11)</div>
            <div style="margin-top:12px">
              <button class="mh-btn" data-stage="0">1 봄</button>
              <button class="mh-btn" data-stage="1">2 여름</button>
              <button class="mh-btn" data-stage="2">3 가을</button>
              <button class="mh-btn" data-stage="3">4 겨울</button>
            </div>
            <div style="margin-top:10px"><button class="mh-btn" id="btn-back">뒤로</button></div>
          </div>
        `);
        s.querySelectorAll('[data-stage]').forEach((b) =>
          b.addEventListener('click', () => onStage(Number(b.dataset.stage))));
        s.querySelector('#btn-back').addEventListener('click', () => render('main'));
        return;
      }
      const continueBtn = save
        ? `<button class="mh-btn" id="btn-continue">이어하기 (STAGE ${save.nextStage + 1})</button>`
        : '';
      const s = this.screen(`
        <div class="mh-panel">
          <img id="title-logo" src="${import.meta.env.BASE_URL}generated/logo-title.png"
            alt="MEAL HERO : delivery simulator"
            style="width:400px; max-width:100%; display:block; margin:0 auto; image-rendering:pixelated">
          <p class="mh-sub">빚 2,000만원, 두 다리, 그리고 사계절 — 서울 빌라촌 배달 러너</p>
          <div style="margin-top:16px"><button class="mh-btn primary" id="btn-start">배달 시작</button>${continueBtn}</div>
          <div style="margin-top:6px">
            <button class="mh-btn" id="btn-controls">조작 방법</button>
            <button class="mh-btn judge" id="btn-judge">심사용 메뉴</button>
          </div>
        </div>
      `);
      s.querySelector('#btn-start').addEventListener('click', onStart);
      if (save && onContinue) s.querySelector('#btn-continue').addEventListener('click', onContinue);
      s.querySelector('#btn-controls').addEventListener('click', () => render('controls'));
      s.querySelector('#btn-judge').addEventListener('click', () => render('judge'));
    };
    render('main');
  }

  // FR-31 (§14.5): 초당 10자 타자기 + 주인공 모델 캔버스.
  // 입력 — 표시 중이면 문장 즉시 완성, 완성 상태면 다음 문장
  showOpening(lines, onDone, heroCanvas = null) {
    let i = 0;
    let shown = 0;
    let timer = null;
    const s = this.screen(`
      <div class="mh-panel" style="min-width:560px">
        <div class="op-row">
          ${heroCanvas ? '<div class="op-hero"></div>' : ''}
          <div class="mh-caption" id="op-line"></div>
        </div>
        <div class="mh-hint" style="margin-top:16px">클릭 또는 [Space] — 다음</div>
      </div>
    `);
    if (heroCanvas) s.querySelector('.op-hero').appendChild(heroCanvas);
    const lineEl = s.querySelector('#op-line');
    const render = () => {
      lineEl.innerHTML = shown < lines[i].length
        ? `${lines[i].slice(0, shown)}<span class="caret"></span>`
        : lines[i];
    };
    const startLine = () => {
      shown = 0;
      clearInterval(timer);
      timer = setInterval(() => {
        shown++;
        render();
        if (shown >= lines[i].length) clearInterval(timer);
      }, 100); // 초당 10글자 (§14.5)
      render();
    };
    const advance = () => {
      if (shown < lines[i].length) {
        clearInterval(timer);
        shown = lines[i].length;
        render();
        return;
      }
      i++;
      if (i >= lines.length) { cleanup(); onDone(); } else startLine();
    };
    const onKey = (e) => { if (e.code === 'Space' || e.code === 'Enter') advance(); };
    const cleanup = () => { clearInterval(timer); window.removeEventListener('keydown', onKey); };
    s.addEventListener('click', advance);
    window.addEventListener('keydown', onKey);
    startLine();
  }

  // obstacle: { name, desc, canvas } | null — §14.4 신규 방해요소 3D 턴테이블 소개 (FR-30)
  showStageIntro(stage, vehicleLabel, debt, onGo, obstacle = null) {
    const obsHtml = obstacle
      ? `<div class="intro-obstacle">
          <div class="io-view"></div>
          <div class="io-text">
            <div class="io-tag">이번 계절의 신규 방해요소</div>
            <div class="io-name">${obstacle.name}</div>
            <div class="io-desc">${obstacle.desc}</div>
          </div>
        </div>`
      : '';
    const s = this.screen(`
      <div class="mh-panel">
        <div class="mh-title" style="font-size:30px">STAGE ${stage.id}</div>
        <div class="mh-caption" style="margin:10px 0; font-size:19px">${stage.intro}</div>
        <div class="mh-sub">이동 수단: <b>${vehicleLabel}</b> · 남은 빚 <b>₩${debt.toLocaleString()}</b> · 제한 시간 <b>10분</b></div>
        ${obsHtml}
        <div style="margin-top:14px"><button class="mh-btn primary" id="btn-go">출발</button></div>
      </div>
    `);
    if (obstacle) s.querySelector('.io-view').appendChild(obstacle.canvas);
    s.querySelector('#btn-go').addEventListener('click', onGo);
  }

  // §12.4 정산: 10분 순수익 × 120일 = 스테이지 매출 → 빚 탕감
  showSettlement({ stage, revenue, fees, net, days, settlement, debtBefore, debtAfter, deliveries, isLast, nextVehicle }, onNext) {
    const bridge = isLast
      ? ''
      : `<div class="mh-caption" style="margin:8px 0; font-size:16px">계절이 바뀐다… 새 이동 수단 <b>${nextVehicle}</b> 획득!</div>`;
    // §16.4 (FR-43) 영수증 형식 — 항목별 1행, 결론(남은 빚)은 마지막 줄
    const won = (v) => `₩${v.toLocaleString()}`;
    const repaid = debtBefore - debtAfter;
    const row = (k, v) => `<div class="r-row"><span>${k}</span><span>${v}</span></div>`;
    const s = this.screen(`
      <div class="mh-panel">
        <div class="mh-title" style="font-size:28px">${stage.intro.split('—')[0].trim()} 분기 정산</div>
        <div class="receipt">
          ${row('배달 완료', `${deliveries}건`)}
          ${row('매출', won(revenue))}
          ${row('플랫폼 수수료', `-${won(fees)}`)}
          <div class="r-sep"></div>
          ${row('10분 순수익', won(net))}
          ${row('분기 환산', `× ${days}일`)}
          ${row('분기 매출', `<b>${won(settlement)}</b>`)}
          <div class="r-sep"></div>
          ${row('빚 상환', `-${won(repaid)}`)}
          <div class="r-row r-total"><span>남은 빚</span><span class="${debtAfter > 0 ? 'neg' : ''}">${
            debtAfter > 0 ? won(debtAfter) : `${won(0)} — 완납!`
          }</span></div>
        </div>
        ${bridge}
        <button class="mh-btn primary" id="btn-next">${isLast ? '엔딩 보기' : '다음 계절로'}</button>
      </div>
    `);
    s.querySelector('#btn-next').addEventListener('click', onNext);
  }

  showGameOver(reason, onRetry) {
    const s = this.screen(`
      <div class="mh-panel">
        <div class="mh-title" style="font-size:30px; color:#b5372f">배달 실패…</div>
        <div class="mh-sub" style="margin:12px 0">${reason}</div>
        <button class="mh-btn primary" id="btn-retry">[R] 다시 도전</button>
      </div>
    `);
    s.querySelector('#btn-retry').addEventListener('click', onRetry);
  }

  // §12.4 엔딩 분기: 완납 = 해피 / 잔액 = 배드 (겨울 재도전 제공)
  showEnding(career, onTitle, onRetryWinter) {
    const paid = !career.debtLeft;
    const head = paid
      ? '<div class="mh-title" style="font-size:30px">빚 완납!</div>'
      : '<div class="mh-title" style="font-size:30px; color:#b5372f">빚이… 남았다</div>';
    const body = paid
      ? `1년간의 배달 대장정 끝에 빚 ₩${career.totalDebt.toLocaleString()}을 모두 갚았다.`
      : `1년을 꼬박 달렸지만 빚이 ₩${career.debtLeft.toLocaleString()} 남았다.<br>사장님이 겨울 한 분기를 더 뛰어보라며 어깨를 두드린다…`;
    const tail = paid
      ? '<div class="mh-sub">주인공은 이제… 자기 가게를 차리기로 했다. 아마도.</div>'
      : '';
    // §15.3: 기본 선택지 1개만 악센트 — 재도전이 있으면 재도전, 없으면 타이틀로
    const retryBtn = onRetryWinter
      ? '<button class="mh-btn primary" id="btn-retry-winter">겨울 재도전</button>'
      : '';
    const titleCls = onRetryWinter ? 'mh-btn' : 'mh-btn primary';
    const s = this.screen(`
      <div class="mh-panel">
        ${head}
        <div class="mh-caption" style="margin:12px 0; font-size:16px; line-height:2">
          ${body}<br>
          총 배달: ${career.deliveries}건<br>
          총 수입: ₩${career.revenue.toLocaleString()}<br>
          충돌 사고: ${career.hits}회
        </div>
        ${tail}
        <div style="margin-top:14px">${retryBtn}<button class="${titleCls}" id="btn-title">타이틀로</button></div>
      </div>
    `);
    s.querySelector('#btn-title').addEventListener('click', onTitle);
    if (onRetryWinter) s.querySelector('#btn-retry-winter').addEventListener('click', onRetryWinter);
  }

  // §14.6 튜토리얼 제안 (FR-32)
  showTutorialAsk({ onYes, onNo }) {
    const s = this.screen(`
      <div class="mh-panel">
        <div class="mh-title" style="font-size:26px">튜토리얼을 할까요?</div>
        <div class="mh-sub" style="margin:8px 0">배달 수락부터 전달까지 4단계로 안내합니다 (진행 중 타이머 정지)</div>
        <div style="margin-top:14px">
          <button class="mh-btn primary" id="btn-tut-yes">예, 배워볼게요</button>
          <button class="mh-btn" id="btn-tut-no">아니오, 바로 시작</button>
        </div>
      </div>
    `);
    s.querySelector('#btn-tut-yes').addEventListener('click', onYes);
    s.querySelector('#btn-tut-no').addEventListener('click', onNo);
  }

  // step=null이면 튜토리얼 UI 전부 해제
  tutorialGuide(step, text = '', targetSel = null) {
    this.root.querySelectorAll('.tut-glow').forEach((el) => el.classList.remove('tut-glow'));
    const dim = this.el('#tut-dim');
    const panel = this.el('#tut-panel');
    if (step == null) {
      dim.style.display = 'none';
      panel.style.display = 'none';
      return;
    }
    dim.style.display = 'block';
    panel.style.display = 'block';
    panel.innerHTML = `<div class="t-step">튜토리얼 ${step + 1} / 4</div>${text}`;
    if (targetSel) this.root.querySelector(targetSel)?.classList.add('tut-glow');
  }

  showPause({ onResume, onRestart, onMenu }) {
    const s = this.screen(`
      <div class="mh-panel">
        <div class="mh-title" style="font-size:26px">일시 정지</div>
        <div class="btn-col" style="margin-top:14px">
          <button class="mh-btn primary" id="btn-resume">계속하기</button>
          <button class="mh-btn" id="btn-restart">스테이지 재시작</button>
          <button class="mh-btn" id="btn-menu">메인 메뉴로 돌아가기</button>
        </div>
        <div class="mh-hint" style="margin-top:10px">[ESC] 계속하기</div>
      </div>
    `);
    s.querySelector('#btn-resume').addEventListener('click', onResume);
    s.querySelector('#btn-restart').addEventListener('click', onRestart);
    s.querySelector('#btn-menu').addEventListener('click', onMenu);
  }

  setHudVisible(v) { this.hud.style.display = v ? 'block' : 'none'; if (!v) this.hideHint(); }

  updateHUD({ revenue, fees, hp, maxHp, stageTimeLeft, stageLabel, vehicleLabel, offers, active, full, nearestIdx, skill }) {
    this.el('#hud-money').innerHTML =
      `매출 ₩${revenue.toLocaleString()} · 수수료 -₩${fees.toLocaleString()}<br><b>순수익 ₩${(revenue - fees).toLocaleString()}</b>`;
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

    // 스킬 UI (§14.1): 대시 쿨타임 세로 게이지 + 드링크 사용 가능 여부
    if (skill) {
      const dash = this.el('#skill-dash');
      dash.classList.toggle('active', skill.dashActive);
      dash.classList.toggle('off', !skill.dashActive && skill.cdLeft > 0);
      dash.querySelector('.s-cd').style.height = `${(skill.cdLeft / skill.cdTotal) * 100}%`;
      this.el('#skill-drink').classList.toggle('off', !skill.drinkOk);
    }

    // 스테이지 시계 (FR-23): 잔여 1분부터 빨강 + 펄스
    const clock = this.el('#hud-clock');
    const secs = Math.max(0, Math.ceil(stageTimeLeft));
    this.el('#hud-clock-text').textContent =
      `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    clock.classList.toggle('low', stageTimeLeft <= 60);

    // 의뢰 슬롯 4개 (FR-19) + 거리·최근접 뱃지 (FR-29) + 동적 단가 (FR-54)
    // 거리·최근접·단가는 delivery.update()가 산출 — 뱃지와 단가가 항상 동기
    if (!this._slotEls) this._slotEls = [...this.root.querySelectorAll('.offer-slot')];
    offers.forEach((offer, i) => {
      const el = this._slotEls[i];
      el.classList.toggle('empty', !offer);
      el.classList.toggle('blocked', !!offer && full);
      el.classList.toggle('nearest', i === nearestIdx);
      if (offer) {
        el.querySelector('.o-route').textContent = `${offer.shop.name} → ${offer.door.name}`;
        const payEl = el.querySelector('.o-pay');
        payEl.textContent = `₩${offer.pay.toLocaleString()}`;
        payEl.classList.toggle('surge', !!offer.surge);
        el.querySelector('.o-dist').textContent =
          offer.playerDist != null ? `${Math.round(offer.playerDist)}m` : '';
        el.querySelector('.o-ttl i').style.width = `${(offer.ttl / OFFER_TTL) * 100}%`;
      } else {
        el.querySelector('.o-route').textContent = '의뢰 대기';
        const payEl = el.querySelector('.o-pay');
        payEl.textContent = '';
        payEl.classList.remove('surge');
        el.querySelector('.o-dist').textContent = '';
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

  // §15.1 (FR-33) 화살표 대상 라벨: x/y는 #ui(=캔버스) 좌표계 px
  setArrowLabel(text, color, x, y) {
    const a = this.el('#arrow-label');
    if (!text) { a.style.display = 'none'; return; }
    a.textContent = text;
    a.style.display = 'block';
    a.style.borderColor = color;
    a.style.left = `${Math.round(x)}px`;
    a.style.top = `${Math.round(y)}px`;
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

  // FR-20 네비게이션 스마트폰: M 홀드 시 중앙 확대 + 배경 블러
  setNav(open) {
    this.el('#navphone').classList.toggle('up', open);
    document.body.classList.toggle('nav-open', open);
  }

  navCtx() {
    if (!this._navCtx) this._navCtx = this.el('#navphone .np-map').getContext('2d');
    return this._navCtx;
  }

  updateNavLegend(active, colors) {
    const rows = active.map((d) => `
      <div class="row">
        <span class="dot" style="background:${colors[d.colorIdx]}"></span>
        <span>${d.phase === 'pickup' ? `픽업 ${d.shop.name}` : `배달 ${d.door.name}`}</span>
        <span class="sec">${Math.max(0, Math.ceil(d.timeLeft))}초</span>
      </div>`).join('');
    this.el('#navphone .np-legend').innerHTML = rows || '<div class="row">진행 중인 배달 없음 — [1~4]로 의뢰 수락</div>';
  }

  // FR-24 수령 코드 매칭 오버레이
  showCodeMatch(codes, myCode) {
    const cm = this.el('#codematch');
    cm.querySelector('.cm-receipts').innerHTML = codes.map((c, i) => `
      <div class="cm-receipt">
        <span class="key">${i + 1}</span>
        <div>주문 영수증</div>
        <div class="cm-code">${c}</div>
      </div>`).join('');
    cm.querySelector('.cm-mine .cm-code').textContent = myCode;
    cm.style.display = 'block';
    this.updateCodeMatch(1, 3);
  }

  updateCodeMatch(ratio, secs) {
    const cm = this.el('#codematch');
    cm.querySelector('.cm-msg').innerHTML = `어떤 주문인지 골라주세요. <b>${secs}</b>초 남았습니다.`;
    const bar = cm.querySelector('.cm-bar i');
    bar.style.width = `${Math.max(0, ratio) * 100}%`;
    // 녹색 → 노란색 → 빨간색 (§12.5)
    bar.style.background = ratio > 0.55 ? '#5f7a55' : ratio > 0.28 ? '#c9a13b' : '#b5372f';
  }

  hideCodeMatch() {
    this.el('#codematch').style.display = 'none';
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
