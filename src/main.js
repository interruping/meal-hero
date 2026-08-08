import { Game } from './game/game.js';

const game = new Game(document.getElementById('app'));
window.__game = game; // 자동화 검증 훅

function loop() {
  game.frame();
  requestAnimationFrame(loop);
}

game.init().then(loop);
