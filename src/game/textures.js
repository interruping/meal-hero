import * as THREE from 'three';
import { ASSET_BASE } from '../core/loader.js';

// gpt-image-2 생성 텍스처 로더. §7.1: NearestFilter, mipmap 최소.
const loader = new THREE.TextureLoader();
const cache = new Map();

export function tex(name, opts = {}) {
  const { repeatX = 1, repeatY = 1 } = opts;
  const key = `${name}|${repeatX}|${repeatY}`;
  if (!cache.has(key)) {
    const t = loader.load(`${ASSET_BASE}generated/${name}.png`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    cache.set(key, t);
  }
  return cache.get(key);
}

export function mat(name, opts = {}) {
  const { alpha = false, ...texOpts } = opts;
  const m = new THREE.MeshLambertMaterial({ map: tex(name, texOpts) });
  if (alpha) {
    m.transparent = false;
    m.alphaTest = 0.5;
    m.side = THREE.DoubleSide;
  }
  return m;
}

// 머티리얼 캐시 (동일 텍스처 공유)
const matCache = new Map();
export function sharedMat(name, opts = {}) {
  const key = `${name}|${JSON.stringify(opts)}`;
  if (!matCache.has(key)) matCache.set(key, mat(name, opts));
  return matCache.get(key);
}
