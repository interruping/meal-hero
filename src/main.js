import { Game } from './game/game.js';

const game = new Game(document.getElementById('app'));
window.__game = game; // 자동화 검증 훅

function loop() {
  game.frame();
  requestAnimationFrame(loop);
}

const loader = document.getElementById('boot-loader');
game.init().then(() => {
  loop();
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 400);
  }
}).catch((e) => {
  console.error(e);
  const label = loader?.querySelector('.label');
  if (label) label.textContent = '로딩 실패 — 새로고침 해주세요';
});
