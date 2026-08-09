import * as THREE from 'three';

// 정적 Meshy 모델에 프로시저럴 걷기: 버텍스 셰이더에서 엉덩이 아래
// 버텍스를 좌우(x 부호) 위상 반전 시켜 다리 가위질 스윙을 만든다.
// 리깅 없이 "어떻게든" 걷는 실루엣을 내는 방식.

export function setupWalkAnimation(model) {
  const uPhase = { value: 0 };
  const uAmp = { value: 0 };

  model.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    const minY = bb.min.y;
    const maxY = bb.max.y;
    const height = Math.max(maxY - minY, 0.001);
    const hipY = minY + height * 0.45;
    const f = (n) => n.toFixed(5);

    const mat = o.material.clone();
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWalkPhase = uPhase;
      shader.uniforms.uWalkAmp = uAmp;
      shader.vertexShader = `
uniform float uWalkPhase;
uniform float uWalkAmp;
` + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  float legF = clamp((${f(hipY)} - position.y) / ${f(hipY - minY)}, 0.0, 1.0);
  float side = position.x >= 0.0 ? 1.0 : -1.0;
  float swing = sin(uWalkPhase) * side;
  // 다리 전후 스윙 (엉덩이 피벗 전단 변형)
  transformed.z += swing * legF * legF * uWalkAmp * ${f(height * 0.55)};
  // 스윙 중 무릎 들림
  transformed.y += max(swing, 0.0) * legF * uWalkAmp * ${f(height * 0.12)};
  // 상체 반동 (어깨 위 약한 역위상)
  float torsoF = clamp((position.y - ${f(hipY)}) / ${f(Math.max(maxY - hipY, 0.001))}, 0.0, 1.0);
  transformed.z -= sin(uWalkPhase) * torsoF * uWalkAmp * ${f(height * 0.06)};
}`,
      );
    };
    o.material = mat;
  });

  return {
    set(phase, amp) {
      uPhase.value = phase;
      uAmp.value = amp;
    },
  };
}

// 실루엣 분리용 인버티드 헐 아웃라인 (§7 룩 유지: 순검정 대신 최암부색)
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x2e2e2c, side: THREE.BackSide });

export function addOutline(model, thickness = 1.06) {
  const outline = new THREE.Group();
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (!o.isMesh) return;
    const m = new THREE.Mesh(o.geometry, OUTLINE_MAT);
    m.matrixAutoUpdate = false;
    m.matrix.copy(o.matrixWorld); // model 루트 기준 로컬처럼 사용
    outline.add(m);
  });
  outline.scale.setScalar(thickness);
  outline.position.y = -0.01;
  model.add(outline);
  return outline;
}
