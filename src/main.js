import * as THREE from 'three';
import { RetroRenderer } from './core/renderer.js';
import { Input } from './core/input.js';
import { PALETTES, FOG_NEAR, FOG_FAR } from './game/palettes.js';

const container = document.getElementById('app');
const retro = new RetroRenderer(container);
const input = new Input(retro.renderer.domElement);

// 파이프라인 검증용 임시 씬 (블록아웃 단계 — 이후 게임 씬으로 교체)
const scene = new THREE.Scene();
const pal = PALETTES.spring;
scene.background = new THREE.Color(pal.sky);
scene.fog = new THREE.Fog(pal.sky, FOG_NEAR, FOG_FAR);

const camera = new THREE.PerspectiveCamera(60, 640 / 360, 0.1, FOG_FAR + 20);
camera.position.set(0, 3, 8);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight(pal.sky, pal.ground, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.25);
sun.position.set(30, 50, 20);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshLambertMaterial({ color: pal.ground }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshLambertMaterial({ color: pal.accent, flatShading: true }),
);
cube.position.y = 1;
scene.add(cube);

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  cube.rotation.y += dt;
  retro.render(scene, camera);
  input.endFrame();
  requestAnimationFrame(frame);
}
frame();
