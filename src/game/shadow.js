import * as THREE from 'three';

// §7.6 실시간 그림자 대신 반투명 블롭 섀도 (캔버스 방사형 그라데이션 텍스처)
let blobTexture = null;

function getBlobTexture() {
  if (!blobTexture) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    g.addColorStop(0, 'rgba(30,30,28,0.55)');
    g.addColorStop(1, 'rgba(30,30,28,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    blobTexture = new THREE.CanvasTexture(c);
  }
  return blobTexture;
}

export function makeBlobShadow(radius = 0.5) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: getBlobTexture(),
      transparent: true,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}
