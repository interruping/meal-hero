# AI 활용 기록 — Meal Hero

해커톤 "AI 활용 기술 문서" 원자료. 에셋·코드 생성에 사용한 AI 도구와 프롬프트, 비용을 작업 순서대로 기록한다.

## 비용 러닝 토탈

| 도구 | 사용량 | 잔여/한도 |
|---|---|---|
| Meshy.ai | **135 크레딧** (9모델 × 15cr) | 965 / 1,100 |
| OpenRouter gpt-image-2 | $0 | $20 한도 |

## 개발 도구

- **Claude Code (Fable 5)**: 게임 코드 전체(Three.js), 맵 생성 로직, 에셋 파이프라인 스크립트 작성·실행 자율 에이전트
- **Meshy.ai text-to-3d API**: 캐릭터·탈것·방해요소 3D 모델 (meshy-5, preview 5cr + refine 10cr)
- **gpt-image-2 (OpenRouter)**: 건물 파사드·지면·계절 텍스처 (예정)

## Meshy.ai 생성 모델 (2026-08-09)

파이프라인: `scripts/meshy-batch.mjs` — preview(폴리곤 제한) → refine(2K 텍스처) → GLB 다운로드 → gltf-transform으로 텍스처 256px 축소 (PS1 룩 + 용량 27MB→1.85MB).

공통 스타일 프롬프트: `chunky cute proportions, low poly, PS1 retro game style, muted desaturated colors`

| 파일 | 용도 | 프롬프트 요약 | 폴리곤 | 크레딧 |
|---|---|---|---|---|
| character-hero.glb | 주인공 배달원 (AC-16) | cartoon Korean delivery rider, baseball cap, windbreaker | 3000 | 15 |
| prop-delivery-bag.glb | 구보 스테이지 배달가방 | square insulated food delivery backpack | 600 | 15 |
| vehicle-kickboard.glb | 여름 탈것 | stand-up electric kick scooter, teal | 1500 | 15 |
| vehicle-bicycle.glb | 가을 탈것 | city bicycle with front basket, olive | 2000 | 15 |
| vehicle-scooter.glb | 겨울 탈것 | delivery moped with rear delivery box | 2000 | 15 |
| obstacle-flyer-worker.glb | 방해요소: 전단지 알바생 | flyer distributor, visor cap, sash, arm extended | 3000 | 15 |
| obstacle-kid-bike.glb | 방해요소: 자전거 초딩 | child riding small bicycle leaning forward | 3000 | 15 |
| obstacle-pigeon.glb | 방해요소: 비둘기 | plump pigeon, round fat body | 800 | 15 |
| obstacle-drunk.glb | 방해요소: 취객 | drunk office worker, rumpled suit, swaying | 3000 | 15 |

합계: **135 크레딧**, 실패·재시도 0회.
