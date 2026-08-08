import * as THREE from 'three';
import { RetroRenderer } from './core/renderer.js';
import { Input } from './core/input.js';
import { PALETTES, FOG_NEAR, FOG_FAR } from './game/palettes.js';
import { buildCity } from './game/citymap.js';
import { Player } from './game/player.js';
import { FollowCamera } from './game/camera.js';

const container = document.getElementById('app');
const retro = new RetroRenderer(container);
const input = new Input(retro.renderer.domElement);

const scene = new THREE.Scene();
const pal = PALETTES.spring;
scene.background = new THREE.Color(pal.sky);
scene.fog = new THREE.Fog(pal.sky, FOG_NEAR, FOG_FAR);

const hemi = new THREE.HemisphereLight(pal.sky, pal.ground, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.25);
sun.position.set(30, 50, 20);
scene.add(sun);

const world = buildCity(scene);
// 블록아웃 팔레트 적용 (FR-18에서 텍스처로 교체)
world.terrain.material.color.set(pal.ground);
world.root.getObjectByName('roads').children.forEach((m) => m.material.color.set(pal.road));

const player = new Player(world, scene);
player.reset();
const followCam = new FollowCamera();

retro.renderer.domElement.addEventListener('click', () => input.requestPointerLock());

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  player.update(dt, input, followCam.yaw);
  followCam.update(dt, input, player.pos);
  retro.render(scene, followCam.camera);
  input.endFrame();
  requestAnimationFrame(frame);
}
frame();
