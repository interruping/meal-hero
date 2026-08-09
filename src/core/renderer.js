import * as THREE from 'three';

// §7.1 렌더링 파이프라인: 640×360 고정 렌더타깃 → nearest 업스케일.
// 후처리(§7.9 포스터라이즈+디더)는 같은 업스케일 패스의 셰이더 유니폼으로 토글한다.
export const RENDER_W = 960;
export const RENDER_H = 540;

const UPSCALE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const UPSCALE_FRAG = /* glsl */ `
uniform sampler2D tSource;
uniform float uDither;   // 0 = off, 1 = on (FR-15)
uniform float uLevels;   // 포스터라이즈 단계 수
varying vec2 vUv;

const mat4 BAYER = mat4(
   0.0,  8.0,  2.0, 10.0,
  12.0,  4.0, 14.0,  6.0,
   3.0, 11.0,  1.0,  9.0,
  15.0,  7.0, 13.0,  5.0
);

vec3 linearToSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 c = linearToSRGB(texture2D(tSource, vUv).rgb);
  if (uDither > 0.5) {
    ivec2 p = ivec2(mod(gl_FragCoord.xy, 4.0));
    float threshold = (BAYER[p.y][p.x] + 0.5) / 16.0 - 0.5;
    c += threshold / uLevels;
    c = floor(c * uLevels + 0.5) / uLevels;
  }
  gl_FragColor = vec4(c, 1.0);
}
`;

export class RetroRenderer {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.renderer.domElement.style.imageRendering = 'pixelated';
    container.appendChild(this.renderer.domElement);

    this.target = new THREE.WebGLRenderTarget(RENDER_W, RENDER_H, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;

    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: UPSCALE_VERT,
      fragmentShader: UPSCALE_FRAG,
      uniforms: {
        tSource: { value: this.target.texture },
        uDither: { value: 0 },
        uLevels: { value: 6 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    quad.frustumCulled = false;
    this.postScene.add(quad);

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  setDither(on, levels = 6) {
    this.postMaterial.uniforms.uDither.value = on ? 1 : 0;
    this.postMaterial.uniforms.uLevels.value = levels;
  }

  resize() {
    // 창 안에 16:9 최대 크기로 레터박스 (AC-11)
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = Math.min(w / RENDER_W, h / RENDER_H);
    const cw = Math.max(1, Math.floor(RENDER_W * scale));
    const ch = Math.max(1, Math.floor(RENDER_H * scale));
    this.renderer.setSize(cw, ch, false);
    const el = this.renderer.domElement;
    el.style.width = `${cw}px`;
    el.style.height = `${ch}px`;
    el.style.position = 'absolute';
    el.style.left = `${Math.floor((w - cw) / 2)}px`;
    el.style.top = `${Math.floor((h - ch) / 2)}px`;
  }

  render(scene, camera) {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
